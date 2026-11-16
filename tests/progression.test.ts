import { describe, expect, it, vi } from 'vitest';
import { characters, bosses } from '../src/characters';
import { Progression, PROGRESS_KEY, type ProgressStorage } from '../src/game/progression';
import { Match, STEP } from '../src/game/simulation';
import { emptyInput } from '../src/game/types';

const robot = characters.find(c => c.id === 'robot')!;
const sword = characters.find(c => c.id === 'swordsman')!;
const boss = bosses.find(c => c.id === 'robot')!;
const win = { phase: 'finished', mode: 'boss', winner: 'team' } as const;
function memoryStorage(initial?: string): ProgressStorage {
  const data = new Map(initial === undefined ? [] : [[PROGRESS_KEY, initial]]);
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); } };
}
function tick(match: Match, seconds: number) { for (let i = 0; i < Math.ceil(seconds / STEP); i++) match.step(STEP); }

describe('boss victory unlocks', () => {
  it('keeps Robot locked while the original five fighters and Boxer are available', () => {
    const progress = new Progression(characters, memoryStorage(), bosses);
    expect(characters.filter(c => progress.canSelect(c)).map(c => c.id)).toEqual(['swordsman', 'archer', 'wizard', 'clubber', 'boomeranger', 'boxer']);
    expect(progress.canSelect(boss)).toBe(false);
    const match = new Match(sword, sword, boss, c => progress.canSelect(c));
    match.select(0, robot); match.select(1, robot);
    expect(match.fighters.map(f => f.character.id)).toEqual(['swordsman', 'swordsman']);
  });

  it('awards a real boss win with one survivor, saves it, and enables both player slots', () => {
    const storage = memoryStorage();
    const progress = new Progression(characters, storage, bosses);
    const match = new Match(sword, sword, boss, c => progress.canSelect(c));
    match.setMode('boss'); match.start(); tick(match, 3.01);
    match.fighters[0].lives = 0;
    match.fighters[1].x = 700;
    match.boss!.health = sword.attack.damage;
    match.boss!.cooldown = 999;
    match.step(STEP, [emptyInput(), { ...emptyInput(), attack: true }]); tick(match, 0.1);
    expect(match.winner).toBe('team'); expect(match.boss!.health).toBe(0);
    expect(progress.recordResult(match, match.boss!.character.id)).toEqual([robot]);
    expect(progress.saved).toBe(true);
    match.lobby(); match.select(0, robot); match.select(1, robot);
    expect(match.fighters.slice(0, 2).map(f => f.character.id)).toEqual(['robot', 'robot']);
    match.start(); expect(match.fighters.slice(0, 2).map(f => f.size)).toEqual([1, 1]);
    match.lobby(); match.setMode('duel');
    expect(match.fighters.map(f => f.character.id)).toEqual(['robot', 'robot']);
    const reloaded = new Progression(characters, storage, bosses);
    expect(reloaded.canSelect(robot)).toBe(true);
    expect(reloaded.canSelect(boss)).toBe(false);
  });

  it.each([
    { phase: 'finished', mode: 'boss', winner: 'boss' },
    { phase: 'finished', mode: 'boss', winner: null },
    { phase: 'finished', mode: 'duel', winner: 0 },
    { phase: 'paused', mode: 'boss', winner: 'team' },
    { phase: 'playing', mode: 'boss', winner: 'team' },
    { phase: 'lobby', mode: 'boss', winner: null },
  ] as const)('does not reward $mode / $phase / $winner', result => {
    const storage = memoryStorage(); const progress = new Progression(characters, storage, bosses);
    expect(progress.recordResult(result, 'robot')).toEqual([]);
    expect(progress.canSelect(robot)).toBe(false); expect(storage.getItem(PROGRESS_KEY)).toBeNull();
  });

  it('requires the matching boss and only awards the first victory', () => {
    const storage = memoryStorage(); const save = vi.spyOn(storage, 'setItem');
    const progress = new Progression(characters, storage, bosses);
    expect(progress.recordResult(win)).toEqual([]);
    expect(progress.recordResult(win, 'someone-else')).toEqual([]);
    expect(progress.recordResult(win, 'robot')).toEqual([robot]);
    expect(progress.recordResult(win, 'robot')).toEqual([]);
    expect(save).toHaveBeenCalledTimes(1);
    expect(new Progression(characters, storage, bosses).recordResult(win, 'robot')).toEqual([]);
  });

  it.each(['not json', 'null', '[]', '{"version":2,"defeatedBosses":["robot"]}', '{"version":1,"defeatedBosses":"robot"}'])('recovers from an invalid save: %s', raw => {
    const storage = memoryStorage(raw); const progress = new Progression(characters, storage, bosses);
    expect(progress.canSelect(robot)).toBe(false);
    expect(progress.recordResult(win, 'robot')).toEqual([robot]);
    expect(new Progression(characters, storage, bosses).canSelect(robot)).toBe(true);
  });

  it('retains the session unlock if storage is blocked, absent, or full', () => {
    const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    const full = { getItem: () => null, setItem() { throw new Error('quota'); } };
    for (const storage of [undefined, blocked, full]) {
      const progress = new Progression(characters, storage, bosses);
      expect(progress.recordResult(win, 'robot')).toEqual([robot]);
      expect(progress.canSelect(robot)).toBe(true); expect(progress.saved).toBe(false);
    }
  });
});
