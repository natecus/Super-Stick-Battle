import type { Fighter, PowerUpKind } from './types';

export const GOOD_POWER_UPS: PowerUpKind[] = ['strength', 'speed', 'heal', 'defense'];
export const ALL_POWER_UPS: PowerUpKind[] = [...GOOD_POWER_UPS, 'weakness', 'slow', 'damage', 'fragile'];
export const POWER_UP_LABELS: Record<PowerUpKind, string> = {
  strength: 'STRENGTH UP', speed: 'SPEED UP', heal: 'HEAL +25', defense: 'DEFENSE UP',
  weakness: 'STRENGTH DOWN', slow: 'SPEED DOWN', damage: 'DAMAGE +25', fragile: 'DEFENSE DOWN',
};
const opposites: Partial<Record<PowerUpKind, PowerUpKind>> = {
  strength: 'weakness', weakness: 'strength', speed: 'slow', slow: 'speed', defense: 'fragile', fragile: 'defense',
};
export function hasPowerUp(f: Fighter, kind: PowerUpKind): boolean {
  return f.powerUps.some(effect => effect.kind === kind && effect.remaining > 0);
}
export function applyPowerUp(f: Fighter, kind: PowerUpKind) {
  // Refresh a matching effect; replace its opposite. Effects never multiply indefinitely.
  f.powerUps = f.powerUps.filter(effect => effect.kind !== kind && effect.kind !== opposites[kind]);
  f.powerUps.push({ kind, remaining: kind === 'heal' || kind === 'damage' ? 2 : 8 });
  if (kind === 'heal') {
    if (f.player === 2) f.health = Math.min(f.maxHealth, f.health + 25);
    else f.damage = Math.max(0, f.damage - 25);
  } else if (kind === 'damage') {
    f.damage = Math.min(999, f.damage + 25);
    if (f.player === 2) { f.health = Math.max(0, f.health - 25); if (!f.health) { f.lives = 0; f.attack = null; } }
  }
}
