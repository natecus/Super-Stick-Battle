import { describe, expect, it } from 'vitest';
import { bosses, characters } from '../src/characters';
import { arenas, arenaForBoss, platformsAt, spikeState, type ArenaId } from '../src/game/arenas';
import { Match, STEP } from '../src/game/simulation';
import { Progression, PROGRESS_KEY } from '../src/game/progression';
import { emptyInput, type Fighter, type InputFrame } from '../src/game/types';

const sword = characters[0];
const daveBoss = bosses.find(b => b.id === 'dave')!;
const robotBoss = bosses.find(b => b.id === 'robot')!;
const input = (values: Partial<InputFrame> = {}) => ({ ...emptyInput(), ...values });
function tick(m: Match, seconds: number, frames: [InputFrame, InputFrame] = [input(), input()]) {
  for (let i = 0; i < Math.ceil(seconds / STEP); i++) m.step(STEP, frames);
}
function battle(arena: ArenaId) {
  const m = new Match(sword, sword, undefined, () => true, () => true, () => true);
  m.selectArena(arena); m.start(); tick(m, 3.01); return m;
}
function stand(m: Match, f: Fighter, index: number, offset = m.platforms[index].width / 2) {
  f.x = m.platforms[index].x + offset; f.y = m.platforms[index].y;
  f.vx = f.vy = 0; f.grounded = true; f.platform = index; f.jumps = 0;
}

describe('arena progression and lifecycle', () => {
  it('unlocks each home arena from existing version-one boss saves', () => {
    let saved: string | null = null;
    const storage = { getItem: (key: string) => key === PROGRESS_KEY ? saved : null, setItem: (_key: string, value: string) => { saved = value; } };
    let progress = new Progression(characters, storage, bosses);
    for (let i = 0; i < bosses.length; i++) {
      const boss = bosses[i], home = arenaForBoss(boss.id);
      expect(progress.canSelectArena(home)).toBe(false);
      const m = new Match(sword, sword, boss, c => progress.canSelect(c), b => progress.canChallenge(b), a => progress.canSelectArena(a));
      expect(m.selectArena(home.id)).toBe(false);
      expect(m.setMode('boss')).toBe(true); expect(m.arena.id).toBe(home.id);
      expect(m.arenaAvailable(home)).toBe(true);
      const next = bosses[i + 1] ? arenaForBoss(bosses[i + 1].id) : undefined;
      if (next) expect(m.selectArena(next.id)).toBe(false);
      progress.recordResult({ phase: 'finished', mode: 'boss', winner: 'team' }, boss.id);
      progress = new Progression(characters, storage, bosses);
      expect(arenas.filter(a => progress.canSelectArena(a))).toHaveLength(i + 2);
      m.setMode('duel'); expect(m.selectArena(home.id)).toBe(true);
    }
    expect(JSON.parse(saved!).version).toBe(1);
  });

  it('remembers the versus arena, switches boss homes, and blocks changes during play', () => {
    const m = new Match(sword, sword, daveBoss, () => true, () => true, () => true);
    m.selectArena('cheese-land'); m.setMode('boss'); expect(m.arena.id).toBe('slime-caves');
    m.selectBoss(robotBoss); expect(m.arena.id).toBe('the-lab');
    m.setMode('duel'); expect(m.arena.id).toBe('cheese-land');
    m.start(); expect(m.selectArena('notebook')).toBe(false);
    tick(m, 5); m.pause(); const frozen = structuredClone(m.platforms); const elapsed = m.elapsed;
    tick(m, 2); expect(m.platforms).toEqual(frozen); expect(m.elapsed).toBe(elapsed);
    expect(m.selectArena('notebook')).toBe(false);
    m.start(); expect(m.platforms).toEqual(platformsAt(m.arena, 0));
    expect(m.elapsed).toBe(0); expect(m.arena.id).toBe('cheese-land');
    m.lobby(); expect(m.selectArena('notebook')).toBe(true);
  });

  it.each(bosses)('$name can fight in its home without getting stuck', boss => {
    const m = new Match(sword, sword, boss, () => true, () => true);
    m.setMode('boss'); m.start(); tick(m, 3.01);
    for (let i = 0; i < 180 / STEP && m.phase === 'playing'; i++) m.step(STEP);
    expect(m.fighters.every(f => Number.isFinite(f.x) && Number.isFinite(f.y))).toBe(true);
    expect(m.phase, JSON.stringify(m.fighters.map(f => ({ x: f.x, y: f.y, lives: f.lives, hp: f.health, damage: f.damage })))).toBe('finished');
    expect(m.winner).toBe('boss');
  });
});

describe('moving surfaces and environmental hazards', () => {
  it('starts both modes clear of the Lab spikes and moving wall, including after a fighter change', () => {
    const m = new Match(sword, sword, robotBoss, () => true, () => true, () => true);
    for (const mode of ['duel', 'boss'] as const) {
      m.lobby(); m.setMode(mode); m.selectArena('the-lab'); m.select(1, characters.at(-1)!);
      for (const f of m.fighters) {
        for (const strip of m.arena.spikes!) expect(f.x + 19 < strip.x || f.x - 19 > strip.x + strip.width).toBe(true);
        const wall = m.platforms[4]; expect(f.x + 19 < wall.x || f.x - 19 > wall.x + wall.width).toBe(true);
      }
      m.start(); tick(m, 3.4); expect(m.fighters.every(f => f.damage === 0)).toBe(true);
    }
  });
  it.each(['the-lab', 'cheese-land', 'moonlit-dojo'] as const)('carries a standing rider through a complete motion cycle in %s', arena => {
    const m = battle(arena); const f = m.fighters[0];
    const index = arena === 'the-lab' ? 2 : arena === 'cheese-land' ? 6 : 4;
    stand(m, f, index); const offset = f.x - m.platforms[index].x;
    for (let i = 0; i < 8 / STEP; i++) {
      m.step(STEP);
      expect(f.platform).toBe(index); expect(f.y).toBeCloseTo(m.platforms[index].y, 5);
      expect(f.x - m.platforms[index].x).toBeCloseTo(offset, 5);
    }
    m.step(STEP, [input({ jump: true }), input()]); expect(f.grounded).toBe(false); expect(f.vy).toBeLessThan(0);
  });

  it('lets a falling fighter land on a moving lift and then drop through it', () => {
    const m = battle('the-lab'); const f = m.fighters[0]; const p = m.platforms[1];
    f.x = p.x + 50; f.y = p.y - 30; f.vy = 180; f.grounded = false; f.platform = null;
    tick(m, 0.2); expect(f.platform).toBe(1);
    m.step(STEP, [input({ down: true }), input()]); expect(f.grounded).toBe(false); expect(f.y).toBeGreaterThan(m.platforms[1].y);
  });

  it('the clock sides knock fighters away but its rail is not a platform', () => {
    const m = battle('cheese-land'); const f = m.fighters[0]; const p = m.platforms[6];
    f.x = p.x + p.width + 15; f.y = p.y + 45; f.vx = 0; f.vy = 0; f.grounded = false; f.platform = null;
    m.step(STEP); expect(f.vx).toBeGreaterThan(200); expect(f.vy).toBeLessThan(0);
    expect(f.damage).toBe(0); expect(f.charge).toBe(0);
    const fall = battle('cheese-land'); const other = fall.fighters[0];
    other.x = 480; other.y = 322; other.vy = 200; other.grounded = false; other.platform = null;
    tick(fall, 0.15); expect(other.y).toBeGreaterThan(344); expect(other.grounded).toBe(false);
  });

  it('the wall pushes a fighter on the floor and can be jumped over or stood on', () => {
    const m = battle('the-lab'); const f = m.fighters[0];
    // At the first quarter of the cycle the wall moves left towards the left spike strip.
    tick(m, 2); const p = m.platforms[4]; stand(m, f, 0, p.x - 19 - m.platforms[0].x);
    const before = f.x; tick(m, 0.3); expect(f.x).toBeLessThan(before - 20); expect(f.damage).toBe(0);
    m.step(STEP, [input({ jump: true }), input()]); tick(m, 0.22);
    expect(f.y).toBeLessThan(m.platforms[4].y);
    stand(m, f, 4); tick(m, 0.1); expect(f.platform).toBe(4); expect(f.y).toBe(m.platforms[4].y);
    m.step(STEP, [input({ down: true }), input()]); expect(f.platform).toBe(4);
  });

  it('spikes warn before rising, damage once, respect protection, and do not generate charge', () => {
    const m = battle('the-lab'); const strip = m.arena.spikes![0]; const f = m.fighters[0];
    tick(m, 1.8); expect(spikeState(strip, m.elapsed).warning).toBe(true);
    expect(spikeState(strip, m.elapsed).height).toBe(0);
    stand(m, f, 0, 80); tick(m, 0.2); expect(f.damage).toBe(0);
    stand(m, f, 0, 300); tick(m, 0.8); stand(m, f, 0, 80); f.invulnerable = 0; f.arenaHitCooldown = 0;
    m.step(STEP); expect(f.damage).toBe(12); expect(f.vy).toBeLessThan(0); expect(f.charge).toBe(0);
    stand(m, f, 0, 80); m.step(STEP); expect(f.damage).toBe(12);
    f.arenaHitCooldown = 0; f.invulnerable = 1; stand(m, f, 0, 80); m.step(STEP); expect(f.damage).toBe(12);
    expect(spikeState(strip, 4.1).height).toBe(0);
  });

  it('permanent cave slime slows either team and stops refreshing after a jump', () => {
    const m = new Match(sword, sword, daveBoss, undefined, () => true); m.setMode('boss'); m.start(); tick(m, 3.01);
    const hero = m.fighters[0], boss = m.boss!; boss.stun = 100; boss.cooldown = 999;
    stand(m, hero, 0, 100); stand(m, boss, 0, 470); m.step(STEP);
    expect(hero.slowed).toBeGreaterThan(0); expect(boss.slowed).toBeGreaterThan(0);
    tick(m, 0.1, [input({ right: true }), input()]); expect(hero.vx).toBeCloseTo(sword.stats.speed * 0.55);
    m.step(STEP, [input({ jump: true }), input()]); tick(m, 0.65);
    expect(hero.slowed).toBe(0);
  });

  it('attack puddles follow their moving platform and are cleared on restart', () => {
    const m = battle('the-lab'); const p = m.platforms[1];
    m.hazards.push({ id: 500, owner: 0, kind: 'slime', x: p.x + 40, y: p.y, radius: 30, life: 3, total: 3, platform: 1, offsetX: 40 });
    tick(m, 0.3); expect(m.hazards[0].y).toBeCloseTo(m.platforms[1].y); expect(m.hazards[0].x).toBeCloseTo(m.platforms[1].x + 40);
    m.start(); expect(m.hazards).toEqual([]);
  });
});
