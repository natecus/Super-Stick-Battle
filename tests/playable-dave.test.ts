import { describe, expect, it } from 'vitest';
import { bosses, characters } from '../src/characters';
import { Match, STEP } from '../src/game/simulation';
import { emptyInput, type InputFrame } from '../src/game/types';

const dave = characters.find(c => c.id === 'dave')!;
const sword = characters.find(c => c.id === 'swordsman')!;
const boss = bosses.find(c => c.id === 'dave')!;
const input = (values: Partial<InputFrame> = {}) => ({ ...emptyInput(), ...values });
function tick(match: Match, seconds: number, frames: [InputFrame, InputFrame] = [input(), input()]) {
  for (let i = 0; i < Math.ceil(seconds / STEP); i++) match.step(STEP, frames);
}
function battle(coop = false) {
  const match = new Match(dave, sword, boss, undefined, () => true);
  if (coop) match.setMode('boss');
  match.start(); tick(match, 3.01); return match;
}

describe('playable Dave balance', () => {
  it('has ordinary lives, size, vulnerability, and no passive ultra charge in either mode', () => {
    for (const coop of [false, true]) {
      const match = battle(coop); const player = match.fighters[0];
      if (match.boss) { match.boss.cooldown = 999; match.boss.stun = 100; }
      tick(match, 1);
      expect(player.lives).toBe(3); expect(player.size).toBe(1); expect(player.health).toBe(0);
      expect(player.character.boss).toBeUndefined(); expect(player.charge).toBe(0);
      if (coop) { expect(match.boss!.health).toBe(500); expect(match.boss!.size).toBe(1.65); }
    }
  });

  it('trades faster sword damage and club strength for claw reach and slime utility', () => {
    const club = characters.find(c => c.id === 'clubber')!;
    expect(dave.stats.speed).toBeLessThan(sword.stats.speed);
    expect(dave.stats.weight).toBeLessThan(club.stats.weight);
    expect(dave.attack.damage / dave.attack.cooldown).toBeLessThan(sword.attack.damage / sword.attack.cooldown);
    expect(dave.attack.range).toBeGreaterThan(sword.attack.range);
    expect(dave.attack.knockback).toBeLessThan(club.attack.knockback);
    expect(dave.ultra.range).toBeLessThan(boss.ultra.range);
  });

  it('can be interrupted and launched like other fighters', () => {
    const match = battle(); const player = match.fighters[0];
    player.x = 500; match.fighters[1].x = 560;
    match.step(STEP, [input({ attack: true }), input({ attack: true })]); tick(match, 0.08);
    expect(player.attack).toBeNull(); expect(player.damage).toBe(sword.attack.damage);
    expect(Math.abs(player.vx)).toBeGreaterThan(300); expect(player.stun).toBeGreaterThan(0.2);
    expect(player.invulnerable).toBeGreaterThan(0);
    expect(match.fighters[1].damage).toBe(0);
  });

  it('loses a stock when knocked off instead of using boss health', () => {
    const match = battle(); const player = match.fighters[0]; player.y = 900;
    match.step(STEP); expect(player.lives).toBe(2); expect(player.respawn).toBeGreaterThan(0);
    expect(match.phase).toBe('playing'); tick(match, 0.9); expect(player.health).toBe(0);
  });

  it('requires a full meter and gives time to dodge the single smaller bomb', () => {
    const match = battle(); const player = match.fighters[0];
    match.step(STEP, [input({ ultra: true }), input()]); expect(player.attack).toBeNull();
    player.charge = 100;
    match.step(STEP, [input({ ultra: true }), input()]); tick(match, 0.4);
    expect(player.charge).toBe(0); expect(match.projectiles).toHaveLength(0);
    tick(match, 0.25);
    expect(match.projectiles).toHaveLength(1);
    expect(match.projectiles[0]).toMatchObject({ kind: 'slime', explosionRadius: 90, slowDuration: 1.1, puddleDuration: 2.5 });
    // Move out of the lane: the bomb aims at launch, not throughout flight.
    match.fighters[1].x = 300;
    tick(match, 1);
    expect(match.fighters[1].damage).toBe(0);
    const puddle = match.hazards.find(h => h.kind === 'slime')!;
    expect(puddle.total).toBe(2.5); expect(puddle.radius).toBeLessThanOrEqual(90);
    tick(match, 3); expect(match.hazards).toHaveLength(0);
  });

  it('can hit and slow an enemy with the reduced bomb', () => {
    const match = battle(); match.fighters[0].charge = 100;
    match.step(STEP, [input({ ultra: true }), input()]);
    let hit = false;
    for (let i = 0; i < 2 / STEP; i++) {
      match.step(STEP);
      if (match.fighters[1].damage > 0) {
        hit = true; expect(match.fighters[1].damage).toBe(18);
        expect(match.fighters[1].slowed).toBeCloseTo(1.1); break;
      }
    }
    expect(hit).toBe(true); expect(match.fighters[0].damage).toBe(0);
  });

  it('keeps allied Dave claws, slime damage, and slowing effects off teammates', () => {
    const match = battle(true); const player = match.fighters[0], ally = match.fighters[1], enemy = match.boss!;
    enemy.x = 580; enemy.stun = 100; enemy.cooldown = 999;
    player.x = 480; ally.x = 540;
    match.step(STEP, [input({ attack: true }), input()]); tick(match, 0.4);
    expect(ally.damage).toBe(0);
    // Keep the ally clear of the arena's permanent slime while testing friendly fire.
    player.charge = 100; ally.x = 580; ally.slowed = 0;
    match.step(STEP, [input({ ultra: true }), input()]); tick(match, 1.5);
    expect(enemy.health).toBeLessThan(500);
    expect(ally.damage).toBe(0); expect(ally.slowed).toBe(0); expect(ally.charge).toBe(0);
    expect(match.hazards.some(h => h.kind === 'slime')).toBe(true);
  });
});
