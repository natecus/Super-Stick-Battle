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
  it('earns half as much ultra charge from dealing and receiving damage', () => {
    const attacking = battle(); const f = attacking.fighters[0], enemy = attacking.fighters[1];
    enemy.x = f.x + 60;
    attacking.step(STEP, [input({ attack: true }), input()]); tick(attacking, 0.2);
    expect(f.charge).toBeCloseTo((ninja.attack.damage * 1.25 + 5) * 0.5);
    expect(enemy.charge).toBeCloseTo(ninja.attack.damage * 0.75);

    const defending = battle(); const target = defending.fighters[0], attacker = defending.fighters[1];
    attacker.x = target.x + 60; attacker.facing = -1;
    defending.step(STEP, [input(), input({ attack: true })]); tick(defending, 0.2);
    expect(target.charge).toBeCloseTo(sword.attack.damage * 0.75 * 0.5);
    expect(attacker.charge).toBeCloseTo(sword.attack.damage * 1.25 + 5);
  });
  it.each([false, true])('halves Ninja boss passive charge, including enrage (%s)', enraged => {
    const m = new Match(sword, sword, bosses.find(b => b.id === 'ninja')!, () => true, () => true);
    m.setMode('boss'); m.start(); tick(m, 3.01);
    const boss = m.boss!; boss.charge = 0; boss.cooldown = 999; boss.stun = 100; boss.attack = null;
    if (enraged) boss.health = boss.maxHealth * 0.4;
    tick(m, 2);
    expect(boss.charge).toBeCloseTo(15 * 0.5 * 2 * (enraged ? 1.45 : 1));
  });
  it('activates after the windup and stays protected beyond the old timeout and through pause', () => {
    const m = battle(); const f = m.fighters[0]; f.charge = 100;
    m.step(STEP, [input({ ultra: true }), input()]); tick(m, 0.4); expect(f.shadowForm).toBe(false);
    tick(m, 0.3); expect(f.shadowForm).toBe(true); expect(f.charge).toBe(0);
    m.pause(); tick(m, 2); expect(f.shadowForm).toBe(true);
    m.resume(); tick(m, 30); expect(f.shadowForm).toBe(true); expect(m.fighters[1].damage).toBe(0);
  });
  it.each([false, true])('ends protection on the next accepted attack, including a miss (%s)', misses => {
    const m = battle(); const f = m.fighters[0], enemy = m.fighters[1];
    enemy.x = f.x + (misses ? 350 : 60); f.shadowForm = true;
    f.cooldown = 0.1; m.step(STEP, [input({ attack: true }), input()]);
    expect(f.attack).toBeNull(); expect(f.shadowForm).toBe(true);
    tick(m, 0.1); m.step(STEP, [input({ attack: true }), input()]);
    expect(f.shadowForm).toBe(false); expect(f.attack).not.toBeNull();
    tick(m, 0.2); expect(enemy.damage).toBe(misses ? 0 : ninja.attack.damage);
    tick(m, 0.5);
    enemy.x = f.x + 60; enemy.y = f.y; enemy.vx = enemy.vy = 0; enemy.facing = -1;
    m.step(STEP, [input(), input({ attack: true })]); tick(m, 0.1);
    expect(f.shadowForm).toBe(false); expect(f.damage).toBe(sword.attack.damage);
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
      if (protectedByShadow) f.shadowForm = true;
      tick(m, 1.4);
      if (protectedByShadow) {
        expect(f.damage).toBe(0); expect(f.slowed).toBe(0); expect(f.stun).toBe(0);
        expect(f.shadowForm).toBe(true);
      } else expect(f.damage > 0 || f.lives < 3).toBe(true);
    }
  });
  it('keeps movement effects visible, clears on knockout/restart, and cannot spend another ultra while protected', () => {
    const m = battle(); const f = m.fighters[0]; f.shadowForm = true; f.charge = 100;
    m.drainEvents(); m.step(STEP, [input({ ultra: true, jump: true }), input()]);
    expect(f.attack).toBeNull(); expect(f.charge).toBe(100); expect(m.drainEvents().some(e => e.type === 'jump')).toBe(true);
    expect(f.shadowForm).toBe(true);
    f.x = -200; m.step(STEP); expect(f.shadowForm).toBe(false);
    m.start(); expect(m.fighters[0].shadowForm).toBe(false);
  });
  it('boss AI can follow a translucent hero but waits for an opening before attacking', () => {
    const m = battle(ninja, true); const brain = new BossBrain(), boss = m.boss!;
    boss.stun = 0; boss.cooldown = 0; boss.attack = null; boss.charge = 100;
    m.fighters[0].shadowForm = true; m.fighters[1].lives = 0;
    const protectedInput = brain.step(boss, m.fighters.slice(0, 2), STEP);
    expect(protectedInput.left || protectedInput.right).toBe(true);
    expect(protectedInput.attack || protectedInput.ultra).toBe(false);
    m.fighters[0].shadowForm = false;
    expect(brain.step(boss, m.fighters.slice(0, 2), STEP).ultra).toBe(true);
  });
  it('protects the Ninja boss HP until he commits to an attack', () => {
    const m = new Match(sword, sword, bosses.find(b => b.id === 'ninja')!, () => true, () => true);
    m.setMode('boss'); m.start(); tick(m, 3.01);
    const boss = m.boss!, f = m.fighters[0]; boss.attack = null; boss.stun = 100; boss.cooldown = 999;
    f.x = 580; boss.x = 640; boss.vx = 0; boss.shadowForm = true;
    m.step(STEP, [input({ attack: true }), input()]); tick(m, 0.2);
    expect(boss.health).toBe(boss.maxHealth);
    tick(m, 6); expect(boss.shadowForm).toBe(true);
    boss.stun = 0; boss.cooldown = 0; m.step(STEP);
    expect(boss.attack).not.toBeNull(); expect(boss.shadowForm).toBe(false);
    m.step(STEP, [input({ attack: true }), input()]); tick(m, 0.2);
    expect(boss.health).toBe(boss.maxHealth - sword.attack.damage);
  });
  it('lets a protected Ninja boss attack a protected Ninja player instead of waiting forever', () => {
    const m = new Match(ninja, sword, bosses.find(b => b.id === 'ninja')!, () => true, () => true);
    m.setMode('boss'); m.start(); tick(m, 3.01);
    const boss = m.boss!, f = m.fighters[0];
    m.fighters[1].lives = 0; f.x = boss.x - 60; f.shadowForm = true; boss.shadowForm = true;
    boss.attack = null; boss.cooldown = 0; m.step(STEP);
    expect(boss.attack).not.toBeNull(); expect(boss.shadowForm).toBe(false); expect(f.shadowForm).toBe(true);
    m.step(STEP, [input({ attack: true }), input()]); tick(m, 0.15);
    expect(f.shadowForm).toBe(false); expect(boss.health).toBeLessThan(boss.maxHealth);
  });
  it('rejects too-short Shadow form and glove windups', () => {
    expect(() => validateCharacter({ ...ninja, ultra: { ...ninja.ultra, duration: 0.1 } })).toThrow('including windup');
    expect(() => validateCharacter({ ...boxer, ultra: { ...boxer.ultra, duration: 0.1 } })).toThrow('including windup');
  });
});
