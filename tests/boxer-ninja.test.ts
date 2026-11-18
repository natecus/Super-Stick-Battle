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
  if (coop) m.setMode('boss'); m.start(); tick(m, 3.01);
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

describe('Ninja Shadow form', () => {
  it('activates after the windup, pauses, naturally expires, and does no damage', () => {
    const m = battle(); const f = m.fighters[0]; f.charge = 100;
    m.step(STEP, [input({ ultra: true }), input()]); tick(m, 0.4); expect(f.invisible).toBe(0);
    tick(m, 0.3); expect(f.invisible).toBeGreaterThan(4.8); expect(f.charge).toBe(0);
    const remaining = f.invisible; m.pause(); tick(m, 2); expect(f.invisible).toBe(remaining);
    m.resume(); tick(m, 5); expect(f.invisible).toBe(0); expect(m.fighters[1].damage).toBe(0);
  });
  it('can attack while protected, then becomes vulnerable when the effect expires', () => {
    const m = battle(); const f = m.fighters[0], enemy = m.fighters[1];
    enemy.x = f.x + 60; f.invisible = 5;
    m.step(STEP, [input({ attack: true }), input()]); tick(m, 0.2);
    expect(f.invisible).toBeGreaterThan(4.7); expect(enemy.damage).toBe(ninja.attack.damage);
    tick(m, 5); expect(f.invisible).toBe(0);
    enemy.x = f.x + 60; enemy.y = f.y; enemy.vx = enemy.vy = 0; enemy.facing = -1;
    m.step(STEP, [input(), input({ attack: true })]); tick(m, 0.1);
    expect(f.invisible).toBe(0); expect(f.damage).toBe(sword.attack.damage);
  });
  it.each(['swordsman', 'robot', 'wizard', 'clubber', 'dave'])('ignores %s hits and slowing, including attacks already in flight', id => {
    const enemy = characters.find(c => c.id === id)!;
    const useUltra = ['wizard', 'clubber', 'dave'].includes(id);
    for (const protectedByShadow of [false, true]) {
      const m = new Match(ninja, enemy, undefined, () => true); m.start(); tick(m, 3.01);
      const f = m.fighters[0], attacker = m.fighters[1];
      const projectile = enemy.attack.kind === 'projectile' || id === 'dave';
      f.x = projectile ? 850 : 680; attacker.x = 600; attacker.facing = 1; attacker.charge = 100;
      m.step(STEP, [input(), input(useUltra ? { ultra: true } : { attack: true })]);
      if (projectile) {
        for (let i = 0; i < 0.7 / STEP && m.projectiles.length === 0; i++) m.step(STEP);
        expect(m.projectiles.length).toBeGreaterThan(0);
      }
      if (protectedByShadow) f.invisible = 5;
      tick(m, 1.4);
      if (protectedByShadow) {
        expect(f.damage).toBe(0); expect(f.slowed).toBe(0); expect(f.stun).toBe(0);
        expect(f.invisible).toBeGreaterThan(3.5);
      } else expect(f.damage > 0 || f.lives < 3).toBe(true);
    }
  });
  it('keeps movement effects visible, clears on knockout/restart, and cannot spend another ultra while protected', () => {
    const m = battle(); const f = m.fighters[0]; f.invisible = 5; f.charge = 100;
    m.drainEvents(); m.step(STEP, [input({ ultra: true, jump: true }), input()]);
    expect(f.attack).toBeNull(); expect(f.charge).toBe(100); expect(m.drainEvents().some(e => e.type === 'jump')).toBe(true);
    f.x = -200; m.step(STEP); expect(f.invisible).toBe(0);
    m.start(); expect(m.fighters[0].invisible).toBe(0);
  });
  it('boss AI can follow a translucent hero but waits for protection to expire before attacking', () => {
    const m = battle(ninja, true); const brain = new BossBrain(), boss = m.boss!;
    boss.stun = 0; boss.cooldown = 0; boss.attack = null; boss.charge = 100;
    m.fighters[0].invisible = 5; m.fighters[1].lives = 0;
    const protectedInput = brain.step(boss, m.fighters.slice(0, 2), STEP);
    expect(protectedInput.left || protectedInput.right).toBe(true);
    expect(protectedInput.attack || protectedInput.ultra).toBe(false);
    m.fighters[0].invisible = 0;
    expect(brain.step(boss, m.fighters.slice(0, 2), STEP).ultra).toBe(true);
  });
  it('protects the Ninja boss HP too, and permits damage again after expiry', () => {
    const m = new Match(sword, sword, bosses.find(b => b.id === 'ninja')!, () => true, () => true);
    m.setMode('boss'); m.start(); tick(m, 3.01);
    const boss = m.boss!, f = m.fighters[0]; boss.attack = null; boss.stun = 100; boss.cooldown = 999;
    f.x = 580; boss.x = 640; boss.invisible = 0.4;
    m.step(STEP, [input({ attack: true }), input()]); tick(m, 0.2);
    expect(boss.health).toBe(boss.maxHealth);
    tick(m, 0.4); m.step(STEP, [input({ attack: true }), input()]); tick(m, 0.2);
    expect(boss.health).toBe(boss.maxHealth - sword.attack.damage);
  });
  it('rejects missing invisibility durations and too-short glove windups', () => {
    expect(() => validateCharacter({ ...ninja, ultra: { ...ninja.ultra, invisibleDuration: undefined } })).toThrow('invisibleDuration');
    expect(() => validateCharacter({ ...boxer, ultra: { ...boxer.ultra, duration: 0.1 } })).toThrow('including windup');
  });
});
