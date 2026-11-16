import { describe, expect, it } from 'vitest';
import { bosses, characters } from '../src/characters';
import { validateBossProgression, validateCharacter } from '../src/characters/schema';
import { Progression, PROGRESS_KEY, type ProgressStorage } from '../src/game/progression';
import { Match, STEP } from '../src/game/simulation';
import { emptyInput, type CharacterDefinition } from '../src/game/types';

const sword = characters.find(c => c.id === 'swordsman')!;
const win = { phase: 'finished', mode: 'boss', winner: 'team' } as const;
const attack = { ...emptyInput(), attack: true };
const ultra = { ...emptyInput(), ultra: true };
function storage(initial?: string): ProgressStorage {
  let value = initial ?? null;
  return { getItem: () => value, setItem: (_key, next) => { value = next; } };
}
function tick(match: Match, seconds: number) { for (let i = 0; i < Math.ceil(seconds / STEP); i++) match.step(STEP); }
function battle(character: CharacterDefinition, boss?: CharacterDefinition) {
  const match = new Match(character, sword, boss, () => true, () => true);
  if (boss) match.setMode('boss');
  match.start(); tick(match, 3.01); return match;
}
const cheese = characters.find(c => c.id === 'cheese')!;
const robot = characters.find(c => c.id === 'robot')!;
const ninja = characters.find(c => c.id === 'ninja')!;

describe('progressive boss ladder', () => {
  it('opens exactly one new encounter per victory, saves rewards, and allows replay', () => {
    const save = storage();
    let progress = new Progression(characters, save, bosses);
    expect(bosses.map(b => b.id)).toEqual(['dave', 'cheese', 'robot', 'ninja']);
    for (let i = 0; i < bosses.length; i++) {
      const boss = bosses[i];
      expect(progress.nextBoss()?.id).toBe(boss.id);
      expect(bosses.filter(b => progress.canChallenge(b)).map(b => b.id)).toEqual(bosses.slice(0, i + 1).map(b => b.id));
      for (const later of bosses.slice(i + 1)) expect(progress.recordResult(win, later.id)).toEqual([]);
      const match = new Match(sword, sword, boss, c => progress.canSelect(c), b => progress.canChallenge(b));
      match.setMode('boss'); match.start(); tick(match, 3.01);
      // Earn each reward from an actual final hit with one surviving teammate.
      match.fighters[1].lives = 0;
      match.fighters[0].x = 580; match.fighters[0].facing = 1;
      match.boss!.health = sword.attack.damage; match.boss!.cooldown = 999; match.boss!.stun = 100;
      match.step(STEP, [attack, emptyInput()]); tick(match, 0.15);
      expect(match.winner).toBe('team');
      const reward = characters.find(c => c.id === boss.id)!;
      expect(progress.recordResult(match, boss.id)).toEqual([reward]);
      expect(progress.recordResult(match, boss.id)).toEqual([]);
      progress = new Progression(characters, save, bosses);
      expect(progress.canSelect(reward)).toBe(true);
      match.lobby(); match.select(0, reward); match.select(1, reward);
      expect(match.fighters.slice(0, 2).map(f => f.character.id)).toEqual([boss.id, boss.id]);
      match.start(); expect(match.boss!.health).toBe(boss.boss!.health);
      expect(match.fighters.slice(0, 2).every(f => f.size === 1 && f.lives === 3 && f.maxHealth === 0)).toBe(true);
      match.lobby(); match.setMode('duel');
      expect(match.fighters.map(f => f.character.id)).toEqual([boss.id, boss.id]);
    }
    expect(progress.nextBoss()).toBeUndefined();
    expect(characters.every(c => progress.canSelect(c))).toBe(true);
    expect(JSON.parse(save.getItem(PROGRESS_KEY)!).defeatedBosses).toEqual(bosses.map(b => b.id));
  });

  it('keeps existing Dave saves and opens Cheese without unlocking later fighters', () => {
    const progress = new Progression(characters, storage('{"version":1,"defeatedBosses":["dave"]}'), bosses);
    expect(progress.canSelect(characters.find(c => c.id === 'dave')!)).toBe(true);
    expect(progress.nextBoss()?.id).toBe('cheese');
    expect([cheese, robot, ninja].some(c => progress.canSelect(c))).toBe(false);
  });

  it('blocks locked encounters in the simulation and cannot change bosses mid-match', () => {
    const progress = new Progression(characters, storage(), bosses);
    const match = new Match(sword, sword, bosses[0], c => progress.canSelect(c), b => progress.canChallenge(b));
    expect(match.selectBoss(bosses[1])).toBe(false);
    expect(new Match(sword, sword, bosses[1]).setMode('boss')).toBe(false);
    progress.recordResult(win, 'dave');
    expect(match.selectBoss(bosses[1])).toBe(true);
    match.setMode('boss'); match.start();
    expect(match.selectBoss(bosses[0])).toBe(false);
    match.pause(); expect(match.selectBoss(bosses[0])).toBe(false);
    match.lobby(); expect(match.selectBoss(bosses[0])).toBe(true);
    expect(match.boss!.character.id).toBe('dave');
  });

  it.each(['boss', null] as const)('does not advance on a loss or draw (%s)', winner => {
    const progress = new Progression(characters, storage(), bosses);
    for (const boss of bosses) expect(progress.recordResult({ ...win, winner }, boss.id)).toEqual([]);
    expect(progress.nextBoss()?.id).toBe('dave');
  });

  it('completes the ladder even when saving is unavailable', () => {
    const progress = new Progression(characters, { getItem() { throw Error(); }, setItem() { throw Error(); } }, bosses);
    for (const boss of bosses) expect(progress.recordResult(win, boss.id).map(c => c.id)).toEqual([boss.id]);
    expect(progress.saved).toBe(false); expect(progress.nextBoss()).toBeUndefined();
  });

  it('rejects missing prerequisites and cycles', () => {
    const broken = structuredClone(bosses); broken[1].boss!.requires = 'missing';
    expect(() => validateBossProgression(broken)).toThrow('configured boss');
    broken[1].boss!.requires = 'ninja';
    expect(() => validateBossProgression(broken)).toThrow('cycle');
  });
});

describe('new boss and playable moves', () => {
  it.each([cheese, robot, ninja])('$name damages the enemy without hitting an ally', character => {
    const match = battle(character, bosses[0]);
    match.fighters[0].x = 450; match.fighters[1].x = 490;
    const boss = match.boss!; boss.x = 550; boss.cooldown = 999; boss.stun = 100;
    match.step(STEP, [attack, emptyInput()]); tick(match, 0.55);
    expect(boss.health).toBeLessThan(boss.maxHealth);
    expect(match.fighters[1].damage).toBe(0); expect(match.fighters[1].slowed).toBe(0);
    if (character.id === 'cheese') expect(boss.slowed).toBeGreaterThan(0);
  });

  it('Cheese heals damage after the windup without restoring lives or charging himself', () => {
    const match = battle(cheese); const player = match.fighters[0];
    player.damage = 60; player.lives = 2; player.charge = 100;
    match.step(STEP, [ultra, emptyInput()]); tick(match, 0.4);
    expect(player.damage).toBe(60);
    tick(match, 0.7); expect(player.damage).toBe(38); expect(player.lives).toBe(2); expect(player.charge).toBe(0);
    player.damage = 4; player.charge = 100;
    match.step(STEP, [ultra, emptyInput()]); tick(match, 1.1); expect(player.damage).toBe(0);
  });

  it('a hit interrupts playable Cheese before the heal completes', () => {
    const match = battle(cheese); const player = match.fighters[0], enemy = match.fighters[1];
    player.damage = 60; player.charge = 100; enemy.x = player.x + 65; enemy.facing = -1;
    match.step(STEP, [ultra, attack]); tick(match, 0.8);
    expect(player.damage).toBe(60 + sword.attack.damage); expect(player.attack).toBeNull();
  });

  it('boss Cheese heals HP rather than damage and never exceeds maximum HP', () => {
    const match = battle(sword, bosses[1]); const boss = match.boss!;
    match.fighters[0].x = 280; match.fighters[1].x = 1000;
    boss.health = 500; boss.charge = 100; boss.attack = null; boss.cooldown = 0;
    tick(match, 0.7); expect(boss.health).toBe(535);
    tick(match, 0.5); boss.charge = 100; boss.attack = null; boss.cooldown = 0;
    tick(match, 0.3); boss.health = boss.maxHealth - 1; tick(match, 0.4);
    expect(boss.health).toBe(boss.maxHealth);
  });

  it('Robot hover pauses, slows descent, allows attacks, and clears on a knockout or restart', () => {
    const match = battle(robot); const player = match.fighters[0];
    player.charge = 100; match.step(STEP, [ultra, emptyInput()]); tick(match, 1.1);
    expect(player.hovering).toBeGreaterThan(3); expect(player.y).toBeLessThan(524);
    match.pause(); const remaining = player.hovering; tick(match, 2); expect(player.hovering).toBe(remaining);
    match.resume(); player.cooldown = 0;
    match.step(STEP, [attack, emptyInput()]); tick(match, 0.2);
    expect(match.projectiles.some(p => p.kind === 'laser')).toBe(true);
    player.vy = 400; match.step(STEP); expect(player.vy).toBeLessThanOrEqual(55);
    player.x = -200; match.step(STEP); expect(player.hovering).toBe(0);
    match.start(); expect(match.fighters[0].hovering).toBe(0);
  });

  it('hover expires and holding down descends faster', () => {
    const match = battle(robot); const player = match.fighters[0]; player.hovering = 0.1;
    player.y = 300; player.vy = 200; player.grounded = false;
    match.step(STEP, [{ ...emptyInput(), down: true }, emptyInput()]); expect(player.vy).toBeGreaterThan(200);
    tick(match, 0.2); expect(player.hovering).toBe(0);
  });

  it('Ninja boss gives a warning before the multi-hit ultra', () => {
    const match = battle(sword, bosses[3]); const boss = match.boss!;
    match.fighters[0].x = boss.x - 60; match.fighters[1].x = boss.x + 60; boss.charge = 100;
    tick(match, 0.5); expect(boss.attack?.ultra).toBe(true);
    expect(match.fighters.slice(0, 2).map(f => f.damage)).toEqual([0, 0]);
    tick(match, 0.16); expect(match.fighters.slice(0, 2).every(f => f.damage > 0)).toBe(true);
  });

  it.each(bosses.slice(1))('$name AI deals damage and survives a normal encounter', boss => {
    const match = battle(sword, boss); tick(match, 8);
    expect(match.fighters.slice(0, 2).some(f => f.damage > 0 || f.lives < 3)).toBe(true);
    expect(Number.isFinite(match.boss!.x)).toBe(true); expect(match.boss!.health).toBeGreaterThan(0);
  });

  it('validates support ultra parameters', () => {
    expect(() => validateCharacter({ ...cheese, ultra: { ...cheese.ultra, healAmount: -1 } })).toThrow('healAmount');
    expect(() => validateCharacter({ ...robot, ultra: { ...robot.ultra, hoverDuration: 0 } })).toThrow('hoverDuration');
    expect(() => validateCharacter({ ...cheese, ultra: { ...cheese.ultra, duration: 0.4 } })).toThrow('including windup');
  });
});
