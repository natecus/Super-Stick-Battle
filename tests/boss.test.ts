import { describe, expect, it } from 'vitest';
import swordJson from '../src/characters/swordsman/character.json';
import bowJson from '../src/characters/archer/character.json';
import clubJson from '../src/characters/clubber/character.json';
import boomJson from '../src/characters/boomeranger/character.json';
import daveJson from '../src/characters/dave/boss.json';
import { validateCharacter } from '../src/characters/schema';
import { Match, STEP, WIDTH } from '../src/game/simulation';
import { emptyInput, type CharacterDefinition, type InputFrame } from '../src/game/types';

const sword = validateCharacter(swordJson), archer = validateCharacter(bowJson), clubber = validateCharacter(clubJson), boomeranger = validateCharacter(boomJson), dave = validateCharacter(daveJson);
const input = (value: Partial<InputFrame> = {}): InputFrame => ({ ...emptyInput(), ...value });
function tick(match: Match, seconds: number, frames: [InputFrame, InputFrame] = [input(), input()]) {
  for (let i = 0; i < Math.ceil(seconds / STEP); i++) match.step(STEP, frames);
}
function battle(first: CharacterDefinition = sword, second: CharacterDefinition = archer) {
  const match = new Match(first, second, dave);
  expect(match.setMode('boss')).toBe(true);
  match.start(); tick(match, 3.01);
  return match;
}
function parkBoss(match: Match) {
  const boss = match.boss!;
  boss.x = 1000; boss.cooldown = 999; boss.stun = 100; boss.charge = 0;
  return boss;
}

describe('boss mode teams and lifecycle', () => {
  it('creates two allies and a separate, larger boss, with data-driven health', () => {
    const match = battle();
    expect(match.fighters).toHaveLength(3);
    expect(match.fighters[0].team).toBe(match.fighters[1].team);
    expect(match.boss!.team).not.toBe(match.fighters[0].team);
    expect(match.boss!.health).toBe(dave.boss!.health);
    expect(match.boss!.size).toBeGreaterThan(1);
    expect(match.fighters.slice(0, 2).map(f => f.lives)).toEqual([3, 3]);
  });

  it.each([sword, archer, clubber, boomeranger])('$name normal attack cannot hurt a teammate', character => {
    const match = battle(character, sword); parkBoss(match);
    match.fighters[0].x = 400; match.fighters[1].x = 460;
    match.step(STEP, [input({ attack: true }), input()]); tick(match, 0.6);
    expect(match.fighters[1].damage).toBe(0);
    expect(match.fighters[1].charge).toBe(0);
  });

  it.each([sword, archer, clubber, boomeranger])('$name ultra cannot hurt a teammate', character => {
    const match = battle(character, sword); parkBoss(match);
    match.fighters[0].x = 400; match.fighters[1].x = 460;
    match.fighters[0].charge = 100;
    match.step(STEP, [input({ ultra: true }), input()]); tick(match, 1.5);
    expect(match.fighters[1].damage).toBe(0);
  });

  it('both teammates can damage Dave on the same tick and get attack charge', () => {
    const match = battle(sword, sword);
    match.boss!.cooldown = 999;
    match.fighters[0].x = 580; match.fighters[1].x = 700;
    match.step(STEP, [input({ attack: true }), input({ attack: true })]); tick(match, 0.08);
    expect(match.boss!.health).toBe(dave.boss!.health - 24);
    expect(match.fighters.slice(0, 2).map(f => f.charge)).toEqual([20, 20]);
    expect(match.fighters.slice(0, 2).map(f => f.damage)).toEqual([0, 0]);
  });

  it('a single Dave claw swing can damage both players', () => {
    const match = battle();
    match.fighters[0].x = 715; match.fighters[1].x = 745;
    tick(match, 0.55);
    expect(match.fighters[0].damage).toBe(dave.attack.damage);
    expect(match.fighters[1].damage).toBe(dave.attack.damage);
  });

  it('continues with one eliminated teammate and loses only when both are out', () => {
    const match = battle(); match.fighters[0].lives = 0;
    match.step(STEP); expect(match.phase).toBe('playing');
    match.fighters[1].lives = 0; match.step(STEP);
    expect(match.phase).toBe('finished'); expect(match.winner).toBe('boss');
  });

  it('wins as a team when the surviving player depletes Dave’s health', () => {
    const match = battle(sword, sword); match.fighters[0].lives = 0;
    match.boss!.health = sword.attack.damage; match.boss!.cooldown = 999;
    match.fighters[1].x = 700;
    match.step(STEP, [input(), input({ attack: true })]); tick(match, 0.1);
    expect(match.boss!.health).toBe(0); expect(match.winner).toBe('team'); expect(match.phase).toBe('finished');
  });

  it('resolves simultaneous final defeat as a draw', () => {
    const match = battle(); match.boss!.health = 0; match.boss!.lives = 0;
    match.fighters[0].lives = match.fighters[1].lives = 0; match.step(STEP);
    expect(match.phase).toBe('finished'); expect(match.winner).toBeNull();
  });

  it('penalizes Dave’s falls without resetting his health', () => {
    const match = battle(); const boss = match.boss!; boss.health = 200; boss.x = WIDTH + 200;
    match.step(STEP); expect(boss.health).toBe(130); expect(boss.lives).toBe(1);
    tick(match, 0.9); expect(boss.x).toBeGreaterThan(600); expect(boss.respawn).toBe(0); expect(boss.health).toBe(130);
    boss.health = 50; boss.y = 900; match.step(STEP);
    expect(match.winner).toBe('team');
  });

  it('pauses the boss, projectiles, hazards, and slow timers together', () => {
    const match = battle(); match.boss!.charge = 100; tick(match, 1.5);
    match.fighters[0].slowed = 2;
    match.pause();
    const before = JSON.stringify([match.fighters, match.projectiles, match.hazards, match.elapsed]);
    tick(match, 4);
    expect(JSON.stringify([match.fighters, match.projectiles, match.hazards, match.elapsed])).toBe(before);
    match.resume(); match.step(STEP); expect(match.phase).toBe('playing');
  });

  it('rematches reset health and effects; switching back restores a two-player duel', () => {
    const match = battle(clubber, boomeranger); match.boss!.health = 30; match.fighters[0].slowed = 3;
    match.hazards.push({ id: 99, kind: 'slime', owner: 2, x: 400, y: 524, radius: 100, life: 3, total: 4 });
    match.start();
    expect(match.mode).toBe('boss'); expect(match.boss!.health).toBe(500); expect(match.hazards).toHaveLength(0); expect(match.fighters[0].slowed).toBe(0);
    expect(match.setMode('duel')).toBe(false);
    match.lobby(); expect(match.setMode('duel')).toBe(true);
    expect(match.fighters).toHaveLength(2); expect(match.boss).toBeUndefined();
    expect(match.fighters[0].team).not.toBe(match.fighters[1].team);
    expect(match.fighters.map(f => f.character.id)).toEqual(['clubber', 'boomeranger']);
  });

  it('keeps Dave boss-only and refuses boss mode without a boss pack', () => {
    const match = new Match(sword, archer);
    expect(match.setMode('boss')).toBe(false); match.select(0, dave);
    expect(match.fighters[0].character.id).toBe('swordsman');
  });
});

describe('Dave behavior and slime', () => {
  it('pursues a living teammate and jumps toward elevated targets', () => {
    const match = battle(); match.fighters[1].lives = 0;
    match.fighters[0].x = 340; match.fighters[0].y = 365; match.fighters[0].platform = 1;
    tick(match, 0.45);
    expect(match.boss!.x).toBeLessThan(610); expect(match.boss!.y).toBeLessThan(440);
  });

  it('charges slime bombs automatically and announces enrage only once', () => {
    const match = battle(); const boss = parkBoss(match);
    tick(match, 1); expect(boss.charge).toBeGreaterThan(13);
    boss.health = 240; match.drainEvents(); tick(match, 1);
    expect(match.bossEnraged).toBe(true);
    expect(match.drainEvents().filter(e => e.type === 'enrage')).toHaveLength(1);
    tick(match, 1); expect(match.drainEvents().filter(e => e.type === 'enrage')).toHaveLength(0);
  });

  it('telegraphs slime bombs, launches at both teammates, and leaves puddles', () => {
    const match = battle(); match.boss!.charge = 100;
    tick(match, 0.4); expect(match.boss!.attack?.ultra).toBe(true); expect(match.projectiles).toHaveLength(0);
    tick(match, 0.3); expect(match.projectiles.filter(p => p.kind === 'slime')).toHaveLength(2);
    tick(match, 0.9); expect(match.hazards.some(h => h.kind === 'slime')).toBe(true);
  });

  it('slime slows a teammate in a puddle, expires, and never slows Dave', () => {
    const match = battle(); const boss = parkBoss(match);
    match.hazards.push({ id: 99, owner: 2, kind: 'slime', x: 640, y: 524, radius: 500, life: 1, total: 1 });
    const f = match.fighters[0]; f.x = 400;
    tick(match, 0.3, [input({ right: true }), input()]);
    expect(f.slowed).toBeGreaterThan(0); expect(f.vx).toBeCloseTo(sword.stats.speed * 0.55);
    expect(boss.slowed).toBe(0);
    tick(match, 2, [input(), input()]); expect(match.hazards).toHaveLength(0); expect(f.slowed).toBe(0);
  });

  it('can complete a fight against idle players without getting stuck', () => {
    const match = battle();
    for (let i = 0; i < 120 / STEP && match.phase !== 'finished'; i++) match.step(STEP);
    expect(match.phase).toBe('finished'); expect(match.winner).toBe('boss');
  });
});
