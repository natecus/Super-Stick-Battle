import { emptyInput, type Fighter, type InputFrame, type Platform } from './types';
import { DESK_PLATFORMS, type ArenaDefinition } from './arenas';

// A deterministic local opponent. Decisions only read the current arena state.
export class BossBrain {
  private targetId = 0;
  private retargetIn = 0;
  private jumpIn = 0;

  reset() { this.targetId = 0; this.retargetIn = 0; this.jumpIn = 0; }

  step(boss: Fighter, heroes: Fighter[], dt: number, platforms: Platform[] = DESK_PLATFORMS, fire?: ArenaDefinition['fire']): InputFrame {
    const input = emptyInput();
    this.retargetIn -= dt;
    this.jumpIn = Math.max(0, this.jumpIn - dt);
    if (boss.lives <= 0 || boss.respawn > 0 || boss.stun > 0 || boss.attack) return input;
    const available = heroes.filter(f => f.lives > 0 && f.respawn === 0);
    const floors = platforms.filter(p => p.main);
    const safeFloor = floors.reduce((a, b) => Math.abs(boss.x - Math.max(a.x + 35, Math.min(a.x + a.width - 35, boss.x))) < Math.abs(boss.x - Math.max(b.x + 35, Math.min(b.x + b.width - 35, boss.x))) ? a : b);
    const offEdge = !platforms.some(p => (p.main || boss.y <= p.y + 20) && boss.x >= p.x + 25 && boss.x <= p.x + p.width - 25);
    if (!available.length) {
      if (offEdge) {
        input.left = boss.x > safeFloor.x + safeFloor.width / 2; input.right = !input.left;
        input.jump = this.jumpIn === 0 && boss.jumps < 2 && boss.vy > -150;
        if (input.jump) this.jumpIn = 0.32;
      }
      return input;
    }
    let target = available.find(f => f.player === this.targetId);
    if (!target || this.retargetIn <= 0) {
      target = available.reduce((a, b) => Math.abs(a.x - boss.x) + Math.abs(a.y - boss.y) * 0.5 < Math.abs(b.x - boss.x) + Math.abs(b.y - boss.y) * 0.5 ? a : b);
      this.targetId = target.player;
      this.retargetIn = 1.1;
    }
    const dx = target.x - boss.x;
    const dy = target.y - boss.y;
    const ranged = boss.character.attack.kind === 'projectile';
    const approachingLedge = target.grounded && !boss.grounded && dy < 20;
    const spacing = ranged && Math.abs(dy) < 65 && !approachingLedge ? Math.min(260, boss.character.attack.range * 0.45) : 0;
    let destination = offEdge ? safeFloor.x + safeFloor.width / 2 : Math.max(260, Math.min(1020, target.x - Math.sign(dx || boss.facing) * spacing));
    // A ranged fighter must not choose the fireplace as its firing position.
    if (fire && destination > fire.x - 55 && destination < fire.x + fire.width + 55) destination = target.x < fire.x + fire.width / 2 ? fire.x - 65 : fire.x + fire.width + 65;
    const nearFire = Boolean(fire && boss.y > fire.y - fire.height - 45 && boss.x > fire.x - 60 && boss.x < fire.x + fire.width + 60);
    const gap = destination - boss.x;
    if (Math.abs(gap) > (offEdge || ranged ? 10 : 85)) {
      input.left = gap < 0;
      input.right = gap > 0;
    }
    if (!boss.attack && Math.abs(dx) > 5) boss.facing = Math.sign(dx);

    const obstacle = platforms.some(p => p.solid && boss.y > p.y && boss.y - 93 * boss.size < p.y + (p.height ?? 24) && Math.abs(boss.x - (p.x + p.width / 2)) < p.width / 2 + 95);
    // Use the recovery jump when the first jump falls just short of an occupied ledge.
    const belowTargetLedge = target.grounded && !boss.grounded && dy < -1;
    const needsJump = dy < -65 || belowTargetLedge || (offEdge && boss.y > 440) || obstacle || nearFire;
    if (boss.hovering > 0) {
      const takeoff = boss.hovering > (boss.character.ultra.hoverDuration ?? 4) - 0.45;
      const flightY = target.y - 25;
      input.up = takeoff || obstacle || boss.y > flightY + 12;
      input.down = !input.up && boss.y < flightY - 12;
    } else if (needsJump && this.jumpIn === 0 && (boss.grounded || (boss.jumps < 2 && boss.vy > -150))) {
      input.jump = true;
      this.jumpIn = 0.32;
    }
    if (dy > 65 && boss.grounded && boss.platform !== null && !platforms[boss.platform].main && !platforms[boss.platform].solid) input.down = true;
    // Descend to a lower opponent, including landing through a bouncy couch.
    if (dy > 65 && boss.hovering === 0) input.down = true;
    // A protected Ninja still commits to attacks, even against another protected Ninja.
    if (!nearFire && !boss.attack && boss.cooldown === 0 && (!target.shadowForm || boss.shadowForm)) {
      const kind = boss.character.ultra.kind;
      const usefulUltra = kind === 'heal' ? boss.health <= boss.maxHealth - (boss.character.ultra.healAmount ?? 0)
        : kind === 'hover' ? boss.hovering === 0
        : kind === 'invisibility' ? !boss.shadowForm
        : kind === 'spin' ? Math.abs(dx) < boss.character.ultra.range + 35 && Math.abs(dy) < 90
        : kind === 'quake' ? boss.grounded : true;
      input.ultra = boss.charge >= 100 && usefulUltra;
      input.attack = !input.ultra && !approachingLedge && Math.abs(dx) < boss.character.attack.range + 10 && Math.abs(dy) < (ranged ? 45 : 90);
    }
    return input;
  }
}
