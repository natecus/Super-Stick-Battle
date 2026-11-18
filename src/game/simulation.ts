import { emptyInput, type AttackState, type CharacterDefinition, type Fighter, type FighterId, type GameEvent, type GameMode, type Hazard, type InputFrame, type MatchPhase, type MatchWinner, type Platform, type PlayerId, type Projectile } from './types';
import { BossBrain } from './boss-ai';
import { arenas, arenaForBoss, DESK_PLATFORMS, platformsAt, spikeState, type ArenaDefinition, type ArenaId } from './arenas';

export const WIDTH = 1280;
export const HEIGHT = 640;
export const STEP = 1 / 120;
export const PLAYER_COLORS = ['#2865b3', '#d35b48', '#638d2f'] as const;
export const PLATFORMS: Platform[] = DESK_PLATFORMS;
const GRAVITY = 1750;
const BODY_HEIGHT = 93;
const BODY_RADIUS = 19;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const approach = (value: number, target: number, by: number) => value < target ? Math.min(target, value + by) : Math.max(target, value - by);

function createFighter(character: CharacterDefinition, player: FighterId): Fighter {
  const boss = player === 2 ? character.boss : undefined;
  return {
    player, character, x: player === 0 ? 430 : 850, y: 524, vx: 0, vy: 0,
    team: player, size: boss?.scale ?? 1, health: boss?.health ?? 0, maxHealth: boss?.health ?? 0, slowed: 0, hovering: 0, invisible: 0, arenaHitCooldown: 0,
    facing: player === 0 ? 1 : -1, grounded: true, platform: 0, jumps: 0,
    damage: 0, lives: boss ? 1 : 3, charge: 0, stun: 0, invulnerable: 0, cooldown: 0,
    dropThrough: 0, coyote: 0.09, jumpBuffer: 0, attack: null, respawn: 0, walkTime: 0,
  };
}

// Pure, fixed-step combat rules. Rendering and input devices do not own game state.
export class Match {
  fighters: [Fighter, Fighter, ...Fighter[]];
  projectiles: Projectile[] = [];
  hazards: Hazard[] = [];
  events: GameEvent[] = [];
  phase: MatchPhase = 'lobby';
  countdown = 3;
  elapsed = 0;
  winner: MatchWinner = null;
  mode: GameMode = 'duel';
  private resumePhase: MatchPhase = 'playing';
  private projectileId = 0;
  private brain = new BossBrain();
  private enragedAnnounced = false;
  private selectedArena = arenas[0];
  private duelArena: ArenaId = 'notebook';
  platforms = platformsAt(arenas[0], 0);
  private previousPlatforms = this.platforms;

  constructor(first: CharacterDefinition, second: CharacterDefinition, private bossDefinition?: CharacterDefinition,
    private canSelect: (character: CharacterDefinition) => boolean = character => character.playable !== false && !character.unlock,
    private canChallenge: (character: CharacterDefinition) => boolean = character => Boolean(character.boss && !character.boss.requires),
    private canSelectArena: (arena: ArenaDefinition) => boolean = arena => !arena.boss) {
    this.fighters = [createFighter(first, 0), createFighter(second, 1)];
  }

  get boss(): Fighter | undefined { return this.mode === 'boss' ? this.fighters[2] : undefined; }
  get selectedBoss(): CharacterDefinition | undefined { return this.bossDefinition; }
  get arena(): ArenaDefinition { return this.selectedArena; }
  arenaAvailable(arena: ArenaDefinition): boolean {
    return this.mode === 'boss'
      ? arena.id === arenaForBoss(this.bossDefinition!.id).id && this.canChallenge(this.bossDefinition!)
      : this.canSelectArena(arena);
  }
  selectArena(id: string): boolean {
    const arena = arenas.find(a => a.id === id);
    if (this.mode !== 'duel' || this.phase !== 'lobby' || !arena || !this.arenaAvailable(arena)) return false;
    this.selectedArena = arena;
    if (this.mode === 'duel') this.duelArena = arena.id;
    this.lobby();
    return true;
  }
  get bossEnraged(): boolean { return Boolean(this.boss && this.boss.health <= this.boss.maxHealth * (this.boss.character.boss?.enrageAt ?? 0.5)); }

  setMode(mode: GameMode): boolean {
    if (this.phase !== 'lobby' || (mode === 'boss' && (!this.bossDefinition?.boss || !this.canChallenge(this.bossDefinition)))) return false;
    this.mode = mode;
    this.selectedArena = mode === 'boss' ? arenaForBoss(this.bossDefinition!.id) : arenas.find(a => a.id === this.duelArena)!;
    this.lobby();
    return true;
  }

  selectBoss(character: CharacterDefinition): boolean {
    if (this.phase !== 'lobby' || !character.boss || !this.canChallenge(character)) return false;
    this.bossDefinition = character;
    if (this.mode === 'boss') this.selectedArena = arenaForBoss(character.id);
    this.lobby();
    return true;
  }

  private resetFighters() {
    this.platforms = platformsAt(this.arena, 0);
    this.previousPlatforms = this.platforms;
    this.fighters = [createFighter(this.fighters[0].character, 0), createFighter(this.fighters[1].character, 1)];
    if (this.mode === 'boss' && this.bossDefinition) {
      this.fighters[0].team = this.fighters[1].team = 0;
      this.fighters[0].x = 350;
      this.fighters[1].x = 930;
      const boss = createFighter(this.bossDefinition, 2);
      boss.x = 640;
      this.fighters.push(boss);
    }
    for (const fighter of this.fighters) this.placeOnFloor(fighter);
    this.brain.reset();
    this.enragedAnnounced = false;
  }

  private placeOnFloor(f: Fighter) {
    f.x = this.arena.spawns?.[this.mode][f.player] ?? f.x;
    const index = this.platforms.findIndex(p => p.main && f.x >= p.x && f.x <= p.x + p.width);
    if (index >= 0) { f.platform = index; f.y = this.platforms[index].y; }
    else { f.grounded = false; f.platform = null; }
  }

  select(player: PlayerId, character: CharacterDefinition) {
    if (this.phase !== 'lobby' || character.playable === false || !this.canSelect(character)) return;
    this.fighters[player] = createFighter(character, player);
    if (this.mode === 'boss') { this.fighters[player].team = 0; this.fighters[player].x = player === 0 ? 350 : 930; }
    this.placeOnFloor(this.fighters[player]);
  }

  start() {
    if (this.mode === 'boss' && (!this.bossDefinition || !this.canChallenge(this.bossDefinition))) return;
    this.resetFighters();
    this.projectiles = [];
    this.hazards = [];
    this.events = [];
    this.countdown = 3;
    this.elapsed = 0;
    this.winner = null;
    this.phase = 'countdown';
  }

  lobby() {
    this.phase = 'lobby';
    this.projectiles = [];
    this.hazards = [];
    this.events = [];
    this.winner = null;
    this.elapsed = 0;
    this.resetFighters();
  }

  pause() {
    if (this.phase === 'playing' || this.phase === 'countdown') {
      this.resumePhase = this.phase;
      this.phase = 'paused';
    }
  }

  resume() {
    if (this.phase === 'paused') this.phase = this.resumePhase;
  }

  drainEvents(): GameEvent[] { return this.events.splice(0); }

  step(dt: number, inputs: [InputFrame, InputFrame] = [emptyInput(), emptyInput()]) {
    if (this.phase === 'countdown') {
      this.countdown = Math.max(0, this.countdown - dt);
      if (this.countdown === 0) this.phase = 'playing';
      return;
    }
    if (this.phase !== 'playing') return;
    this.previousPlatforms = this.platforms;
    this.elapsed += dt;
    this.platforms = platformsAt(this.arena, this.elapsed);
    this.updateHazards(dt);
    const boss = this.boss;
    if (boss && boss.lives > 0 && boss.respawn === 0) {
      boss.charge = Math.min(100, boss.charge + (boss.character.boss?.chargePerSecond ?? 14) * (this.bossEnraged ? 1.45 : 1) * dt);
      if (this.bossEnraged && !this.enragedAnnounced) { this.enragedAnnounced = true; this.event('enrage', boss, 2); }
    }
    const bossInput = boss ? this.brain.step(boss, this.fighters.slice(0, 2), dt, this.platforms) : emptyInput();
    for (const f of this.fighters) this.move(f, f.player === 2 ? bossInput : inputs[f.player], dt);
    this.updateArenaHazards();
    for (const f of this.fighters) this.updateAttack(f, dt);
    this.updateProjectiles(dt);
    // Resolve both knockouts before choosing a winner, including simultaneous final stocks.
    for (const f of this.fighters) {
      if (f.lives > 0 && f.respawn === 0 && (f.x < -110 || f.x > WIDTH + 110 || f.y > HEIGHT + 140 || f.y < -260)) this.knockOut(f);
    }
    const aliveHeroes = this.fighters.slice(0, 2).filter(f => f.lives > 0);
    if (this.mode === 'boss' ? boss!.health <= 0 || aliveHeroes.length === 0 : aliveHeroes.length < 2) {
      this.winner = this.mode === 'boss'
        ? boss!.health <= 0 ? aliveHeroes.length ? 'team' : null : 'boss'
        : aliveHeroes[0]?.player as PlayerId | undefined ?? null;
      this.phase = 'finished';
      this.events.push({ type: 'win', winner: this.winner });
    }
  }

  private event(type: 'jump' | 'land' | 'hit' | 'ko' | 'shot' | 'ultra' | 'enrage', f: Fighter, intensity = 1) {
    this.events.push({ type, x: f.x, y: type === 'jump' || type === 'land' ? f.y : f.y - 45, player: f.player, intensity });
  }

  private move(f: Fighter, input: InputFrame, dt: number) {
    if (f.lives <= 0) return;
    if (f.respawn > 0) {
      f.respawn = Math.max(0, f.respawn - dt);
      if (f.respawn === 0) {
        f.x = f.player === 2 ? 640 : f.player === 0 ? 430 : 850;
        f.y = 170;
        f.invulnerable = 2;
      }
      return;
    }
    f.stun = Math.max(0, f.stun - dt);
    f.invulnerable = Math.max(0, f.invulnerable - dt);
    f.cooldown = Math.max(0, f.cooldown - dt);
    f.dropThrough = Math.max(0, f.dropThrough - dt);
    f.slowed = Math.max(0, f.slowed - dt);
    f.hovering = Math.max(0, f.hovering - dt);
    f.invisible = Math.max(0, f.invisible - dt);
    f.arenaHitCooldown = Math.max(0, f.arenaHitCooldown - dt);
    // A grounded rider inherits the exact surface displacement before moving independently.
    const riding = f.grounded ? f.platform : null;
    if (riding !== null) {
      f.x += this.platforms[riding].x - this.previousPlatforms[riding].x;
      f.y += this.platforms[riding].y - this.previousPlatforms[riding].y;
    }
    f.coyote = f.grounded ? 0.09 : Math.max(0, f.coyote - dt);
    f.jumpBuffer = input.jump ? 0.12 : Math.max(0, f.jumpBuffer - dt);

    const direction = Number(input.right) - Number(input.left);
    if (f.stun === 0) {
      const speed = f.character.stats.speed * (f.attack?.ultra && f.character.ultra.kind === 'spin' ? 0.8 : 1)
        * (f.slowed > 0 ? 0.55 : 1) * (f.player === 2 && this.bossEnraged ? 1.18 : 1);
      f.vx = approach(f.vx, direction * speed, (f.grounded ? 2400 : direction ? 1250 : 450) * dt);
      if (direction && !f.attack) f.facing = direction;
      if (input.down && f.grounded && f.platform !== null && !this.platforms[f.platform].main && !this.platforms[f.platform].solid) {
        f.dropThrough = 0.22;
        f.grounded = false;
        f.coyote = 0;
        f.jumps = Math.max(f.jumps, 1);
        f.y += 3;
        f.vy = 100;
      }
      if (f.hovering === 0 && f.jumpBuffer > 0 && (f.jumps < 2 || f.coyote > 0)) {
        // Walking off a ledge spends the ground jump; one recovery jump remains.
        if (!f.grounded && f.coyote === 0 && f.jumps === 0) f.jumps = 1;
        f.vy = -f.character.stats.jumpSpeed * (f.jumps > 0 ? 0.94 : 1);
        f.jumps = f.coyote > 0 ? 1 : f.jumps + 1;
        f.grounded = false;
        f.platform = null;
        f.coyote = 0;
        f.jumpBuffer = 0;
        this.event('jump', f);
      }
      if (input.ultra && f.charge >= 100 && !f.attack && (f.character.ultra.kind !== 'quake' || f.grounded)
        && !(f.character.ultra.kind === 'invisibility' && f.invisible > 0)
        && !(f.character.ultra.kind === 'hover' && f.hovering > 0)) this.beginAttack(f, true);
      else if (input.attack && f.cooldown === 0 && !f.attack) this.beginAttack(f, false);
    } else {
      f.vx *= Math.pow(0.93, dt);
    }

    const lastY = f.y;
    const lastX = f.x;
    const wasGrounded = f.grounded;
    const flying = f.hovering > 0 && f.stun === 0;
    if (flying) {
      // Brief automatic takeoff, then hold jump to ascend, down to descend, or release to hover.
      const takingOff = f.hovering > (f.character.ultra.hoverDuration ?? 4) - 0.45;
      f.vy = input.down ? 260 : input.up || input.jump || takingOff ? -260 : 0;
      f.coyote = 0; f.jumpBuffer = 0; f.jumps = Math.max(1, f.jumps);
    } else f.vy = Math.min(1100, f.vy + GRAVITY * dt * (input.down && f.vy > 0 ? 1.8 : 1));
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    const flightCeiling = Math.max(150, BODY_HEIGHT * f.size + 30);
    if (flying && f.y < flightCeiling && f.vy < 0) { f.y = flightCeiling; f.vy = 0; }
    f.grounded = false;
    f.platform = null;
    {
      // Higher platforms are checked first if a single step crosses multiple surfaces.
      const surfaces = this.platforms.map((p, index) => ({ ...p, index })).sort((a, b) => a.y - b.y);
      for (const p of surfaces) {
        if (!p.main && !p.solid && f.dropThrough > 0) continue;
        const oldTop = riding === p.index ? p.y : this.previousPlatforms[p.index].y;
        if (f.x + 13 > p.x && f.x - 13 < p.x + p.width && lastY <= oldTop + 0.1 && f.y >= p.y && f.y - lastY >= p.y - oldTop) {
          f.y = p.y;
          f.vy = 0;
          f.grounded = true;
          f.platform = p.index;
          f.jumps = 0;
          if (!wasGrounded) this.event('land', f);
          break;
        }
      }
    }
    this.resolveSolids(f, lastX, lastY);
    f.walkTime += Math.abs(f.vx) * dt / 37;
  }

  private resolveSolids(f: Fighter, lastX: number, lastY: number) {
    const radius = BODY_RADIUS * f.size;
    const height = BODY_HEIGHT * f.size;
    this.platforms.forEach((p, index) => {
      if (!p.solid || f.platform === index) return;
      const bottom = p.y + (p.height ?? 24);
      if (f.x + radius <= p.x || f.x - radius >= p.x + p.width || f.y <= p.y || f.y - height >= bottom) return;
      const old = this.previousPlatforms[index];
      if (lastY - height >= old.y + (old.height ?? 24) - 0.1 && f.vy < 0) {
        f.y = bottom + height;
        f.vy = Math.max(0, f.vy);
        return;
      }
      const side = lastX < old.x + old.width / 2 ? -1 : 1;
      f.x = side < 0 ? p.x - radius : p.x + p.width + radius;
      if (f.vx * side < 0) f.vx = 0;
      if (p.solid === 'clock' && this.canHit(f) && f.arenaHitCooldown === 0) {
        this.hit(f, null, 0, 420, 1.5, side, true);
        f.arenaHitCooldown = 0.8;
      }
    });
  }

  private updateArenaHazards() {
    for (const f of this.fighters) {
      if (!this.canHit(f)) continue;
      for (const patch of this.arena.slime ?? []) {
        const p = this.platforms[patch.platform];
        if (f.grounded && f.platform === patch.platform && f.x + BODY_RADIUS > p.x + patch.offset && f.x - BODY_RADIUS < p.x + patch.offset + patch.width) {
          f.slowed = Math.max(f.slowed, 0.6);
        }
      }
      for (const strip of this.arena.spikes ?? []) {
        const { height } = spikeState(strip, this.elapsed);
        if (height < 8 || f.arenaHitCooldown > 0) continue;
        if (f.x + BODY_RADIUS * f.size > strip.x && f.x - BODY_RADIUS * f.size < strip.x + strip.width && f.y >= strip.y - height && f.y - BODY_HEIGHT * f.size < strip.y) {
          this.hit(f, null, 12, 340, 2, Math.sign(f.x - (strip.x + strip.width / 2)) || 1, true);
          f.arenaHitCooldown = 0.8;
        }
      }
    }
  }

  private beginAttack(f: Fighter, ultra: boolean) {
    const move = ultra ? f.character.ultra : f.character.attack;
    const target = this.enemies(f).filter(other => this.canHit(other) && other.invisible === 0).sort((a, b) => Math.abs(a.x - f.x) - Math.abs(b.x - f.x))[0];
    f.attack = { ultra, elapsed: 0, duration: move.duration, fired: 0, facing: f.facing, targetX: target?.x ?? f.x, targetY: target?.y ?? 524, hitTargets: [] };
    f.cooldown = (ultra ? move.duration + (f.player === 2 ? 0.45 : 0.25) : f.character.attack.cooldown) * (f.player === 2 && this.bossEnraged ? 0.8 : 1);
    // Choosing to attack ends respawn protection.
    f.invulnerable = 0;
    if (ultra) {
      f.charge = 0;
      this.event('ultra', f, 2);
    }
  }

  private updateAttack(f: Fighter, dt: number) {
    const a = f.attack;
    if (!a || f.lives <= 0 || f.respawn > 0) return;
    a.elapsed += dt;
    if (!a.ultra) {
      const move = f.character.attack;
      if (a.elapsed >= move.windup && a.fired === 0) {
        a.fired = 1;
        if (move.kind === 'projectile') {
          this.spawnProjectile(f, a, move.projectile!, move.speed!, move.radius!, move.range / move.speed!, false);
          this.event('shot', f);
        }
      }
      // The active swing spans a short window, so a moving target can enter the hitbox.
      if (move.kind === 'melee' && a.elapsed >= move.windup && a.elapsed <= move.duration) {
        this.melee(f, move.range, false, move.damage, move.knockback, move.growth, a.hitTargets);
      }
    } else {
      const move = f.character.ultra;
      if (move.kind === 'heal' || move.kind === 'hover' || move.kind === 'invisibility') {
        if (a.elapsed >= 0.62 && a.fired === 0) {
          a.fired = 1;
          if (move.kind === 'heal') {
            if (f.player === 2) f.health = Math.min(f.maxHealth, f.health + (move.healAmount ?? 0));
            else f.damage = Math.max(0, f.damage - (move.healAmount ?? 0));
          } else if (move.kind === 'invisibility') {
            f.invisible = move.invisibleDuration ?? 5;
          } else {
            f.hovering = move.hoverDuration ?? 4;
            f.vy = -260;
            f.grounded = false; f.platform = null; f.coyote = 0;
            f.jumps = Math.max(1, f.jumps);
          }
        }
      } else if (move.kind === 'glove-throw') {
        if (a.elapsed >= 0.26 && a.fired === 0) {
          a.fired = 1;
          this.spawnProjectile(f, a, 'glove', 700, 20, move.range / 700, true);
          this.event('shot', f);
        }
      } else if (move.kind === 'spin') {
        const windup = f.player === 2 ? 0.62 : 0;
        const strikes = a.elapsed < windup ? 0 : Math.min(move.count, Math.floor((a.elapsed - windup) / ((move.duration - windup) / move.count)) + 1);
        if (strikes > a.fired) {
          a.fired = strikes;
          this.melee(f, move.range, true, move.damage, move.knockback, move.growth);
        }
      } else if (move.kind === 'rain') {
        const shots = Math.min(move.count, Math.floor(a.elapsed / (move.duration / move.count)) + 1);
        while (a.fired < shots) {
          const index = a.fired++;
          // Low-discrepancy placement fills the warning area without using random game state.
          const offset = (((index * 7) % move.count) / Math.max(1, move.count - 1) - 0.5) * move.range;
          this.projectiles.push({
            id: this.projectileId++, owner: f.player, kind: 'arrow', x: clamp(a.targetX + offset, 20, WIDTH - 20), y: 95,
            vx: a.facing * 35, vy: 760, radius: 8, damage: move.damage, knockback: move.knockback,
            growth: move.growth, life: 1.25, ultra: true,
          });
        }
      } else if (move.kind === 'quake') {
        if (a.elapsed >= 0.4 && a.fired === 0) { a.fired = 1; this.quake(f); }
      } else if (move.kind === 'boomerang-burst') {
        if (a.elapsed >= 0.2 && a.fired === 0) {
          a.fired = 1;
          this.spawnProjectile(f, a, 'boomerang', 560, 22, 2, true);
          const p = this.projectiles[this.projectiles.length - 1];
          p.explosionRadius = move.range; p.fuse = 0.9;
        }
      } else if (move.kind === 'slime-bomb') {
        // A clear windup, followed by a lob toward each live teammate.
        if (a.elapsed >= 0.62 && a.fired === 0) {
          a.fired = 1;
          for (const target of this.enemies(f).filter(other => other.lives > 0 && other.respawn === 0 && other.invisible === 0)) {
            const x = f.x + a.facing * 30;
            const y = f.y - BODY_HEIGHT * f.size * 0.7;
            const flight = 0.7;
            const targetY = this.platforms.filter(p => target.x >= p.x && target.x <= p.x + p.width && p.y >= target.y - 2).sort((a, b) => a.y - b.y)[0]?.y ?? 524;
            this.projectiles.push({ id: this.projectileId++, owner: f.player, x, y,
              vx: (target.x - x) / flight, vy: (targetY - y - 0.5 * 950 * flight * flight) / flight,
              radius: 16, kind: 'slime', damage: move.damage, knockback: move.knockback, growth: move.growth,
              life: 2, ultra: true, explosionRadius: move.range, fuse: flight, age: 0,
              slowDuration: move.slowDuration ?? 2, puddleDuration: move.puddleDuration ?? 4 });
          }
        }
      } else if (a.elapsed >= 0.26 && a.fired === 0) {
        a.fired = 1;
        this.spawnProjectile(f, a, 'fireball', 640, 36, move.range / 640, true);
      }
    }
    if (a.elapsed >= a.duration) f.attack = null;
  }

  private enemies(f: Fighter): Fighter[] { return this.fighters.filter(other => other.team !== f.team); }

  private melee(f: Fighter, range: number, bothSides: boolean, damage: number, knockback: number, growth: number, hitTargets?: FighterId[]): boolean {
    let hit = false;
    for (const other of this.enemies(f)) {
      if (!this.canHit(other) || hitTargets?.includes(other.player)) continue;
      const dx = other.x - f.x;
      const dy = (other.y - BODY_HEIGHT * other.size / 2) - (f.y - BODY_HEIGHT * f.size / 2);
      if (Math.abs(dx) > range + BODY_RADIUS * other.size || Math.abs(dy) > 40 + BODY_HEIGHT * other.size / 2 || (!bothSides && dx * f.facing < -18)) continue;
      this.hit(other, f, damage, knockback, growth, bothSides ? Math.sign(dx) || f.facing : f.facing, Boolean(f.attack?.ultra));
      hitTargets?.push(other.player);
      hit = true;
    }
    return hit;
  }

  private spawnProjectile(f: Fighter, a: AttackState, kind: Projectile['kind'], speed: number, radius: number, life: number, ultra: boolean) {
    const move = ultra ? f.character.ultra : f.character.attack;
    this.projectiles.push({
      id: this.projectileId++, owner: f.player, x: f.x + a.facing * 38, y: f.y - 58,
      vx: speed * a.facing, vy: 0, radius, kind, damage: move.damage, knockback: move.knockback,
      growth: move.growth, life: kind === 'boomerang' && !ultra ? life * 2 + 1 : life, ultra,
      age: 0, returnAfter: kind === 'boomerang' && !ultra ? life : undefined, returning: false, hitTargets: [],
      slowDuration: !ultra ? f.character.attack.slowDuration : undefined,
    });
  }

  private updateProjectiles(dt: number) {
    this.projectiles = this.projectiles.filter(p => {
      const owner = this.fighters[p.owner];
      if (!owner || owner.lives <= 0 || owner.respawn > 0) return false;
      p.age = (p.age ?? 0) + dt;
      if (p.kind === 'boomerang' && !p.ultra) {
        if (!p.returning && p.age >= (p.returnAfter ?? 0.65)) { p.returning = true; p.hitTargets = []; }
        if (p.returning) {
          const dx = owner.x - p.x;
          const dy = owner.y - 58 - p.y;
          const distance = Math.hypot(dx, dy);
          if (distance < p.radius + 15) return false;
          const speed = owner.character.attack.speed ?? 590;
          p.vx = dx / distance * speed;
          p.vy = dy / distance * speed;
        }
      }
      const previousX = p.x;
      const previousY = p.y;
      if (p.kind === 'slime') p.vy += 950 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.fuse !== undefined && p.age >= p.fuse) { this.explode(p); return false; }
      for (const other of this.enemies(owner)) {
        if (!this.canHit(other) || p.hitTargets?.includes(other.player)) continue;
        // Swept segment against an expanded fighter box prevents fast arrows tunneling.
        if (segmentHitsBox(previousX, previousY, p.x, p.y,
          other.x - BODY_RADIUS * other.size - p.radius, other.y - BODY_HEIGHT * other.size - p.radius,
          other.x + BODY_RADIUS * other.size + p.radius, other.y + p.radius)) {
          if (p.explosionRadius !== undefined) { this.explode(p); return false; }
          this.hit(other, owner, p.damage, p.knockback, p.growth, Math.sign(p.vx) || Math.sign(other.x - owner.x) || 1, p.ultra);
          if (p.slowDuration) other.slowed = Math.max(other.slowed, p.slowDuration);
          if (p.kind === 'boomerang') { (p.hitTargets ??= []).push(other.player); continue; }
          return false;
        }
      }
      return p.life > 0 && p.x > -160 && p.x < WIDTH + 160 && p.y < HEIGHT + 100;
    });
  }

  private quake(f: Fighter) {
    if (!f.grounded || f.platform === null) return;
    const platform = this.platforms[f.platform];
    const move = f.character.ultra;
    this.hazards.push({ id: this.projectileId++, owner: f.player, kind: 'quake', x: platform.x + platform.width / 2, y: platform.y, radius: platform.width / 2, life: 0.65, total: 0.65 });
    for (const other of this.enemies(f)) {
      if (!this.canHit(other) || !other.grounded || other.platform !== f.platform) continue;
      this.hit(other, f, move.damage, move.knockback, move.growth, Math.sign(other.x - f.x) || f.facing, true);
    }
  }

  private explode(p: Projectile) {
    const owner = this.fighters[p.owner];
    const radius = p.explosionRadius ?? 100;
    for (const target of this.enemies(owner)) {
      if (!this.canHit(target)) continue;
      const nearestX = clamp(p.x, target.x - BODY_RADIUS * target.size, target.x + BODY_RADIUS * target.size);
      const nearestY = clamp(p.y, target.y - BODY_HEIGHT * target.size, target.y);
      if (Math.hypot(nearestX - p.x, nearestY - p.y) > radius) continue;
      this.hit(target, owner, p.damage, p.knockback, p.growth, Math.sign(target.x - p.x) || Math.sign(p.vx) || 1, true);
      if (p.kind === 'slime') target.slowed = Math.max(target.slowed, p.slowDuration ?? 2);
    }
    this.hazards.push({ id: this.projectileId++, owner: p.owner, kind: 'explosion', x: p.x, y: p.y, radius, life: 0.4, total: 0.4 });
    if (p.kind === 'slime') {
      const ground = this.platforms.filter(platform => p.x >= platform.x && p.x <= platform.x + platform.width)
        .sort((a, b) => Math.abs(a.y - p.y) - Math.abs(b.y - p.y))[0];
      if (ground) {
        const left = Math.max(ground.x, p.x - radius);
        const right = Math.min(ground.x + ground.width, p.x + radius);
        const duration = p.puddleDuration ?? 4;
        this.hazards.push({ id: this.projectileId++, owner: p.owner, kind: 'slime', x: (left + right) / 2, y: ground.y, radius: (right - left) / 2, life: duration, total: duration, platform: this.platforms.indexOf(ground), offsetX: (left + right) / 2 - ground.x });
      }
    }
    this.events.push({ type: 'explosion', x: p.x, y: p.y, player: p.owner, intensity: 2 });
  }

  private updateHazards(dt: number) {
    this.hazards = this.hazards.filter(h => { h.life -= dt; return h.life > 0; });
    for (const h of this.hazards) {
      if (h.platform !== undefined) { h.x = this.platforms[h.platform].x + (h.offsetX ?? 0); h.y = this.platforms[h.platform].y; }
      if (h.kind !== 'slime') continue;
      const owner = this.fighters[h.owner];
      for (const target of this.enemies(owner)) {
        if (this.canHit(target) && Math.abs(target.x - h.x) < h.radius + BODY_RADIUS && Math.abs(target.y - h.y) < 18) target.slowed = Math.max(target.slowed, 0.6);
      }
    }
  }

  private canHit(f: Fighter) { return f.lives > 0 && f.respawn === 0 && f.invulnerable === 0 && f.invisible === 0; }

  private hit(target: Fighter, attacker: Fighter | null, damage: number, base: number, growth: number, direction: number, ultra: boolean) {
    target.invisible = 0;
    target.damage = Math.min(999, target.damage + damage);
    const isBoss = target.player === 2;
    if (isBoss) {
      target.health = Math.max(0, target.health - damage);
      if (target.health === 0) { target.lives = 0; target.attack = null; }
    }
    const force = Math.min(1500, (base + (isBoss ? 0 : target.damage) * growth) / target.character.stats.weight) * (isBoss ? 0.5 : 1);
    target.vx = direction * force;
    target.vy = -Math.min(820, force * 0.58 + (isBoss ? 0 : 80));
    target.stun = isBoss ? 0.045 : clamp(0.14 + force / 2200, 0.2, 0.7);
    target.invulnerable = isBoss ? 0 : 0.14;
    target.grounded = false;
    target.platform = null;
    // Bosses have armor during telegraphed attacks, so two players cannot stunlock them.
    if (!isBoss) target.attack = null;
    target.jumpBuffer = 0;
    // Being launched does not restore spent jumps.
    target.jumps = Math.max(1, target.jumps);
    target.coyote = 0;
    if (attacker) target.charge = Math.min(100, target.charge + damage * 0.75);
    if (!ultra && attacker) attacker.charge = Math.min(100, attacker.charge + damage * 1.25 + 5);
    this.event('hit', target, force / 350);
  }

  private knockOut(f: Fighter) {
    this.event('ko', f, 3);
    f.lives -= 1;
    if (f.player === 2) { f.health = Math.max(0, f.health - 70); f.lives = f.health > 0 ? 1 : 0; }
    f.damage = 0;
    f.vx = 0;
    f.vy = 0;
    f.jumps = 0;
    f.stun = 0;
    f.invulnerable = 0;
    f.cooldown = 0;
    f.dropThrough = 0;
    f.slowed = 0;
    f.hovering = 0;
    f.invisible = 0;
    f.arenaHitCooldown = 0;
    f.jumpBuffer = 0;
    f.coyote = 0;
    f.grounded = false;
    f.platform = null;
    f.attack = null;
    f.charge = Math.floor(f.charge / 2);
    f.respawn = f.lives > 0 ? 0.85 : 0;
    this.projectiles = this.projectiles.filter(p => p.owner !== f.player);
  }
}

function segmentHitsBox(x0: number, y0: number, x1: number, y1: number, minX: number, minY: number, maxX: number, maxY: number) {
  let enter = 0;
  let leave = 1;
  for (const [origin, delta, min, max] of [[x0, x1 - x0, minX, maxX], [y0, y1 - y0, minY, maxY]]) {
    if (Math.abs(delta) < 1e-9) { if (origin < min || origin > max) return false; }
    else {
      const a = (min - origin) / delta;
      const b = (max - origin) / delta;
      enter = Math.max(enter, Math.min(a, b));
      leave = Math.min(leave, Math.max(a, b));
      if (enter > leave) return false;
    }
  }
  return true;
}
