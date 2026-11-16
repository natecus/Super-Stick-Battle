import { emptyInput, type Fighter, type InputFrame, type Platform } from './types';
import { DESK_PLATFORMS } from './arenas';

// A deterministic local opponent. Decisions only read the current arena state.
export class BossBrain {
  private targetId = 0;
  private retargetIn = 0;
  private jumpIn = 0;

  reset() { this.targetId = 0; this.retargetIn = 0; this.jumpIn = 0; }

  step(boss: Fighter, heroes: Fighter[], dt: number, platforms: Platform[] = DESK_PLATFORMS): InputFrame {
    const input = emptyInput();
    this.retargetIn -= dt;
    this.jumpIn = Math.max(0, this.jumpIn - dt);
    if (boss.lives <= 0 || boss.respawn > 0 || boss.stun > 0 || boss.attack) return input;
    const available = heroes.filter(f => f.lives > 0 && f.respawn === 0 && f.invisible === 0);
    const floors = platforms.filter(p => p.main);
    const safeFloor = floors.reduce((a, b) => Math.abs(boss.x - Math.max(a.x + 35, Math.min(a.x + a.width - 35, boss.x))) < Math.abs(boss.x - Math.max(b.x + 35, Math.min(b.x + b.width - 35, boss.x))) ? a : b);
    const offEdge = !floors.some(p => boss.x >= p.x + 35 && boss.x <= p.x + p.width - 35);
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
    const spacing = ranged ? Math.min(260, boss.character.attack.range * 0.45) : 0;
    const destination = offEdge ? safeFloor.x + safeFloor.width / 2 : Math.max(260, Math.min(1020, target.x - Math.sign(dx || boss.facing) * spacing));
    const gap = destination - boss.x;
    if (Math.abs(gap) > (offEdge || ranged ? 10 : 85)) {
      input.left = gap < 0;
      input.right = gap > 0;
    }
    if (!boss.attack && Math.abs(dx) > 5) boss.facing = Math.sign(dx);

    const obstacle = platforms.some(p => p.solid && boss.y > p.y && boss.y - 93 * boss.size < p.y + (p.height ?? 24) && Math.abs(boss.x - (p.x + p.width / 2)) < p.width / 2 + 95);
    const needsJump = dy < -65 || (offEdge && boss.y > 440) || obstacle;
    if (needsJump && this.jumpIn === 0 && (boss.grounded || (boss.jumps < 2 && boss.vy > -150))) {
      input.jump = true;
      this.jumpIn = 0.32;
    }
    if (dy > 65 && boss.grounded && boss.platform !== null && !platforms[boss.platform].main && !platforms[boss.platform].solid) input.down = true;
    if (!boss.attack && boss.cooldown === 0) {
      const kind = boss.character.ultra.kind;
      const usefulUltra = kind === 'heal' ? boss.health <= boss.maxHealth - (boss.character.ultra.healAmount ?? 0)
        : kind === 'hover' ? boss.hovering === 0
        : kind === 'invisibility' ? boss.invisible === 0
        : kind === 'spin' ? Math.abs(dx) < boss.character.ultra.range + 35 && Math.abs(dy) < 90
        : kind === 'quake' ? boss.grounded : true;
      input.ultra = boss.charge >= 100 && usefulUltra;
      input.attack = !input.ultra && Math.abs(dx) < boss.character.attack.range + 10 && Math.abs(dy) < (ranged ? 45 : 90);
    }
    return input;
  }
}
