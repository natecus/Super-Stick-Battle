import { describe, expect, it } from 'vitest';
import { validateCharacter, validateRoster } from '../src/characters/schema';
import swordsman from '../src/characters/swordsman/character.json';
import { bosses, characters } from '../src/characters';

const definitions = import.meta.glob('../src/characters/*/character.json', { eager: true, import: 'default' });

describe('character packs', () => {
  it('discovers and validates every character folder', () => {
    const roster = validateRoster(definitions);
    expect(roster.length).toBeGreaterThanOrEqual(3);
    expect(roster.map(c => c.id)).toEqual(expect.arrayContaining(['swordsman', 'archer', 'wizard']));
  });

  it('rejects duplicate IDs before starting a game', () => {
    expect(() => validateRoster({ one: swordsman, two: swordsman })).toThrow('duplicate id');
  });

  it('explains invalid physics values and unknown move types', () => {
    const badSpeed = structuredClone(swordsman); badSpeed.stats.speed = -1;
    expect(() => validateCharacter(badSpeed, 'new-fighter')).toThrow('speed must be between');
    const badAttack = structuredClone(swordsman); badAttack.ultra.kind = 'unknown';
    expect(() => validateCharacter(badAttack)).toThrow('unknown ultra.kind');
  });

  it('rejects projectile definitions without projectile parameters', () => {
    const character = structuredClone(swordsman); character.attack.kind = 'projectile';
    expect(() => validateCharacter(character)).toThrow('attack.speed');
  });

  it('rejects timing that never produces a hit', () => {
    const character = structuredClone(swordsman); character.attack.windup = character.attack.duration + 1;
    expect(() => validateCharacter(character)).toThrow('attack.windup');
  });

  it('validates boss packs independently and resolves unlock requirements', () => {
    expect(bosses.find(c => c.id === 'dave')?.boss?.health).toBe(500);
    expect(characters.find(c => c.id === 'dave')?.boss).toBeUndefined();
    for (const c of characters.filter(c => c.unlock)) expect(bosses.some(b => b.id === c.unlock!.boss && b.boss)).toBe(true);
    expect(() => validateCharacter({ ...swordsman, unlock: { boss: '../invalid' } })).toThrow('unlock.boss');
    expect(() => validateCharacter({ ...swordsman, ultra: { ...swordsman.ultra, puddleDuration: -1 } })).toThrow('puddleDuration');
  });
});
