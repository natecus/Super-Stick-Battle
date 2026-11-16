import { describe, expect, it } from 'vitest';
import { bosses, characters } from '../src/characters';
import { BossBrain } from '../src/game/boss-ai';
import { Match, STEP } from '../src/game/simulation';
import { emptyInput, type InputFrame } from '../src/game/types';
import { validateCharacter } from '../src/characters/schema';

const boxer = characters.find(c => c.id === 'boxer')!;
const ninja = characters.find(c => c.id === 'ninja')!;
const sword = characters[0];
const input = (values: Partial<InputFrame> = {}) => ({ ...emptyInput(), ...values });
function tick(m: Match, seconds: number) { for (let i = 0; i < Math.ceil(seconds / STEP); i++) m.step(STEP); }
function battle(character = ninja, coop = false) {
  const m = new Match(character, sword, bosses.find(b => b.id === 'dave')!, () => true, () => true);
  if (coop) m.setMode('boss'); m.selectArena('notebook'); m.start(); tick(m, 3.01);
  if (m.boss) { m.boss.stun = 100; m.boss.cooldown = 999; }
  return m;
}

describe('Boxer', () => {
  it('is immediately selectable and his punch hits only once per swing', () => {
    const m = battle(boxer); const f = m.fighters[0], enemy = m.fighters[1];
    expect(boxer.unlock).toBeUndefined(); expect(boxer.appearance.weapon).toBe('gloves');
    enemy.x = f.x + 60; m.step(STEP, [input({ attack: true }), input()]); tick(m, 0.3);
    expect(enemy.damage).toBe(boxer.attack.damage); expect(f.charge).toBeGreaterThan(0);
  });
  it('throws a single glove in the facing direction and spends the whole meter', () => {
    const m = battle(boxer); const f = m.fighters[0]; f.charge = 100;
    m.step(STEP, [input({ ultra: true }), input()]); tick(m, 0.27);
    expect(m.projectiles.filter(p => p.kind === 'glove')).toHaveLength(1); expect(f.charge).toBe(0);
    tick(m, 0.55); expect(m.fighters[1].damage).toBe(boxer.ultra.damage); expect(f.charge).toBe(0);
    tick(m, 2); expect(m.projectiles).toHaveLength(0);
  });
  it('punches and thrown gloves pass teammates without friendly fire', () => {
    for (const ultra of [false, true]) {
      const m = battle(boxer, true); const f = m.fighters[0], ally = m.fighters[1], boss = m.boss!;
      f.x = 450; ally.x = 480; boss.x = 540; f.charge = 100;
      m.step(STEP, [input(ultra ? { ultra: true } : { attack: true }), input()]); tick(m, 0.5);
      expect(ally.damage).toBe(0); expect(boss.health).toBe(boss.maxHealth - (ultra ? boxer.ultra.damage : boxer.attack.damage));
    }
  });
});

describe('Ninja invisibility', () => {
  it('vanishes after the windup, pauses, naturally expires, and does no damage', () => {
    const m = battle(); const f = m.fighters[0]; f.charge = 100;
    m.step(STEP, [input({ ultra: true }), input()]); tick(m, 0.4); expect(f.invisible).toBe(0);
    tick(m, 0.3); expect(f.invisible).toBeGreaterThan(4.8); expect(f.charge).toBe(0);
    const remaining = f.invisible; m.pause(); tick(m, 2); expect(f.invisible).toBe(remaining);
    m.resume(); tick(m, 5); expect(f.invisible).toBe(0); expect(m.fighters[1].damage).toBe(0);
  });
  it('reveals when attacking or being hit, without granting invulnerability', () => {
    const m = battle(); const f = m.fighters[0], enemy = m.fighters[1];
    f.invisible = 5; m.step(STEP, [input({ attack: true }), input()]); expect(f.invisible).toBe(0);
    tick(m, 0.5); f.invisible = 5; enemy.x = f.x + 60; enemy.facing = -1;
    m.step(STEP, [input(), input({ attack: true })]); tick(m, 0.1);
    expect(f.invisible).toBe(0); expect(f.damage).toBe(sword.attack.damage);
  });
  it('hides movement effects, clears on knockout/restart, and cannot spend another ultra while invisible', () => {
    const m = battle(); const f = m.fighters[0]; f.invisible = 5; f.charge = 100;
    m.drainEvents(); m.step(STEP, [input({ ultra: true, jump: true }), input()]);
    expect(f.attack).toBeNull(); expect(f.charge).toBe(100); expect(m.drainEvents().some(e => e.type === 'jump')).toBe(false);
    f.x = -200; m.step(STEP); expect(f.invisible).toBe(0);
    m.start(); expect(m.fighters[0].invisible).toBe(0);
  });
  it('boss AI stops tracking hidden heroes, while blind attacks can still connect', () => {
    const m = battle(ninja, true); const brain = new BossBrain(), boss = m.boss!;
    boss.stun = 0; boss.cooldown = 0; m.fighters[0].invisible = 5; m.fighters[1].lives = 0;
    expect(brain.step(boss, m.fighters.slice(0, 2), STEP)).toEqual(emptyInput());
    m.fighters[0].invisible = 0;
    const visible = brain.step(boss, m.fighters.slice(0, 2), STEP); expect(visible.left || visible.right || visible.attack).toBe(true);
  });
  it('rejects missing invisibility durations and too-short glove windups', () => {
    expect(() => validateCharacter({ ...ninja, ultra: { ...ninja.ultra, invisibleDuration: undefined } })).toThrow('invisibleDuration');
    expect(() => validateCharacter({ ...boxer, ultra: { ...boxer.ultra, duration: 0.1 } })).toThrow('including windup');
  });
});
