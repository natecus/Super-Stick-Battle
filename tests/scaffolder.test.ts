import { afterAll, describe, expect, it } from 'vitest';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';

const tempBase = resolve(tmpdir());
const fixture = mkdtempSync(join(tempBase, 'super-stick-character-test-'));
mkdirSync(join(fixture, 'scripts'));
mkdirSync(join(fixture, 'src', 'characters', 'swordsman'), { recursive: true });
copyFileSync(resolve('scripts/create-character.mjs'), join(fixture, 'scripts', 'create-character.mjs'));
copyFileSync(resolve('src/characters/swordsman/character.json'), join(fixture, 'src', 'characters', 'swordsman', 'character.json'));
const run = (...args: string[]) => execFileSync(process.execPath, [join(fixture, 'scripts', 'create-character.mjs'), ...args], { encoding: 'utf8', stdio: 'pipe' });

afterAll(() => {
  // Verify the exact temporary directory before removing this test's own fixture.
  const target = resolve(fixture);
  if (!target.startsWith(tempBase + sep) || !basename(target).startsWith('super-stick-character-test-')) throw new Error('Unsafe fixture cleanup path');
  rmSync(target, { recursive: true, force: true });
});

describe('character creation helper', () => {
  it('creates a ready-to-edit pack with a unique ID, display name, and increasing order', () => {
    expect(run('ninja', 'Ninja', 'swordsman')).toContain('Created src/characters/ninja/character.json');
    const config = JSON.parse(readFileSync(join(fixture, 'src', 'characters', 'ninja', 'character.json'), 'utf8'));
    expect(config.id).toBe('ninja'); expect(config.name).toBe('Ninja'); expect(config.order).toBe(2);
    expect(config.attack.kind).toBe('melee');
    expect(existsSync(join(fixture, 'src', 'characters', 'ninja', 'README.md'))).toBe(true);
  });

  it('refuses to overwrite an existing fighter or accept paths as character IDs', () => {
    const original = readFileSync(join(fixture, 'src', 'characters', 'swordsman', 'character.json'), 'utf8');
    expect(() => run('swordsman', 'Replacement')).toThrow();
    expect(readFileSync(join(fixture, 'src', 'characters', 'swordsman', 'character.json'), 'utf8')).toBe(original);
    expect(() => run('../escape', 'Escape')).toThrow();
    expect(() => run('safe-id', 'Safe', '../swordsman')).toThrow();
  });

  it('makes copies of boss templates playable without boss-only rules', () => {
    const bossFolder = join(fixture, 'src', 'characters', 'dave');
    mkdirSync(bossFolder);
    copyFileSync(resolve('src/characters/dave/boss.json'), join(bossFolder, 'character.json'));
    run('slime-fighter', 'Slime Fighter', 'dave');
    const config = JSON.parse(readFileSync(join(fixture, 'src', 'characters', 'slime-fighter', 'character.json'), 'utf8'));
    expect(config.playable).toBe(true);
    expect(config.boss).toBeUndefined();
    expect(config.role).toBe('MELEE FIGHTER');
    expect(config.ultra.kind).toBe('slime-bomb');
    const original = JSON.parse(readFileSync(join(bossFolder, 'character.json'), 'utf8'));
    expect(original.playable).toBe(false);
    expect(original.boss.health).toBeGreaterThan(0);
  });

  it('creates an immediately available fighter when cloning an unlockable character', () => {
    const templateFolder = join(fixture, 'src', 'characters', 'slime-template');
    mkdirSync(templateFolder);
    copyFileSync(resolve('src/characters/dave/character.json'), join(templateFolder, 'character.json'));
    run('slime-copy', 'Slime Copy', 'slime-template');
    const config = JSON.parse(readFileSync(join(fixture, 'src', 'characters', 'slime-copy', 'character.json'), 'utf8'));
    expect(config.playable).toBe(true); expect(config.unlock).toBeUndefined(); expect(config.boss).toBeUndefined();
    const original = JSON.parse(readFileSync(join(templateFolder, 'character.json'), 'utf8'));
    expect(config.stats).toEqual(original.stats); expect(original.unlock.boss).toBe('dave');
  });
});
