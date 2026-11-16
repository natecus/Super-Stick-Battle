import { describe, expect, it } from 'vitest';
import swordsman from '../src/characters/swordsman/character.json';
import archer from '../src/characters/archer/character.json';
import wizard from '../src/characters/wizard/character.json';
import { validateCharacter } from '../src/characters/schema';
import { Match, PLATFORMS, STEP, WIDTH } from '../src/game/simulation';
import { emptyInput, type CharacterDefinition, type InputFrame } from '../src/game/types';

const sword = validateCharacter(swordsman);
const bow = validateCharacter(archer);
const magic = validateCharacter(wizard);
const frame = (values: Partial<InputFrame> = {}): InputFrame => ({ ...emptyInput(), ...values });
const tick = (match: Match, duration: number, inputs: [InputFrame, InputFrame] = [frame(), frame()]) => {
  for (let i = 0; i < Math.ceil(duration / STEP); i++) match.step(STEP, inputs);
};
const battle = (first: CharacterDefinition = sword, second: CharacterDefinition = sword) => {
  const match = new Match(first, second);
  match.start(); tick(match, 3.1);
  return match;
};
const closeFighters = (match: Match) => { match.fighters[0].x = 600; match.fighters[1].x = 665; };

describe('movement and platforms', () => {
  it('waits for the countdown before either fighter can move', () => {
    const match = new Match(sword, bow);
    match.start(); tick(match, 2, [frame({ right: true }), frame({ left: true })]);
    expect(match.phase).toBe('countdown');
    expect(match.fighters[0].x).toBe(430);
    tick(match, 1.1);
    expect(match.phase).toBe('playing');
  });

  it('moves both players independently during the same simulation ticks', () => {
    const match = battle();
    tick(match, 0.3, [frame({ right: true }), frame({ left: true })]);
    expect(match.fighters[0].x).toBeGreaterThan(480);
    expect(match.fighters[1].x).toBeLessThan(800);
    expect(match.fighters[0].facing).toBe(1);
    expect(match.fighters[1].facing).toBe(-1);
  });

  it('allows two jumps, rejects a third, and restores jumps on landing', () => {
    const match = battle(); const f = match.fighters[0];
    match.step(STEP, [frame({ jump: true }), frame()]);
    expect(f.jumps).toBe(1);
    tick(match, 0.12);
    match.step(STEP, [frame({ jump: true }), frame()]);
    expect(f.jumps).toBe(2);
    tick(match, 0.1);
    const velocity = f.vy;
    match.step(STEP, [frame({ jump: true }), frame()]);
    expect(f.jumps).toBe(2);
    expect(f.vy).toBeGreaterThan(velocity);
    tick(match, 2);
    expect(f.grounded).toBe(true);
    expect(f.jumps).toBe(0);
  });

  it('passes up through a floating platform and lands on it when falling', () => {
    const match = battle(); const f = match.fighters[0];
    f.x = 340; f.y = 430; f.grounded = false; f.platform = null; f.vy = -600;
    tick(match, 0.25);
    expect(f.y).toBeLessThan(365);
    tick(match, 0.65);
    expect(f.y).toBe(365);
    expect(f.platform).toBe(1);
  });

  it('drops through floating platforms but keeps the main platform solid', () => {
    const match = battle(); const f = match.fighters[0];
    f.x = 340; f.y = 365; f.platform = 1; f.grounded = true;
    tick(match, 0.15, [frame({ down: true }), frame()]);
    expect(f.y).toBeGreaterThan(365);
    tick(match, 1, [frame({ down: true }), frame()]);
    expect(f.y).toBe(PLATFORMS[0].y);
    expect(f.grounded).toBe(true);
  });

  it('allows a short coyote jump after leaving a ledge', () => {
    const match = battle(); const f = match.fighters[0];
    f.x = 1070; f.grounded = true;
    match.step(STEP); match.step(STEP, [frame({ jump: true }), frame()]);
    expect(f.jumps).toBe(1); expect(f.vy).toBeLessThan(-600);
  });
});

describe('damage, attacks, and charge', () => {
  it('hits once per sword swing and charges both players appropriately', () => {
    const match = battle(); closeFighters(match);
    match.step(STEP, [frame({ attack: true }), frame()]); tick(match, 0.3);
    expect(match.fighters[1].damage).toBe(12);
    expect(match.fighters[0].damage).toBe(0);
    expect(match.fighters[0].charge).toBe(20);
    expect(match.fighters[1].charge).toBe(9);
    expect(match.fighters[1].vx).toBeGreaterThan(0);
  });

  it('does not hit behind a normal sword swing', () => {
    const match = battle(); closeFighters(match); match.fighters[1].x = 535;
    match.step(STEP, [frame({ attack: true }), frame()]); tick(match, 0.3);
    expect(match.fighters[1].damage).toBe(0);
  });

  it('launches more strongly at higher accumulated damage', () => {
    const fresh = battle(); const damaged = battle();
    closeFighters(fresh); closeFighters(damaged); damaged.fighters[1].damage = 100;
    for (const m of [fresh, damaged]) { m.step(STEP, [frame({ attack: true }), frame()]); tick(m, 0.1); }
    expect(damaged.fighters[1].vx).toBeGreaterThan(fresh.fighters[1].vx * 1.5);
  });

  it.each([bow, magic])('$name projectiles hit a distant opponent without hitting their owner', character => {
    const match = battle(character, sword);
    match.fighters[0].x = 400; match.fighters[1].x = 820;
    match.step(STEP, [frame({ attack: true }), frame()]); tick(match, 1);
    expect(match.fighters[1].damage).toBe(character.attack.damage);
    expect(match.fighters[0].damage).toBe(0);
  });

  it('requires a full ultra meter and spends it on activation', () => {
    const match = battle(magic); const f = match.fighters[0];
    f.charge = 99;
    match.step(STEP, [frame({ ultra: true }), frame()]);
    expect(f.attack).toBeNull(); expect(f.charge).toBe(99);
    f.charge = 100;
    match.step(STEP, [frame({ ultra: true }), frame()]);
    expect(f.attack?.ultra).toBe(true); expect(f.charge).toBe(0);
    tick(match, 0.3);
    expect(match.projectiles.some(p => p.kind === 'fireball')).toBe(true);
  });

  it('spins to hit enemies on either side', () => {
    const match = battle(); closeFighters(match);
    match.fighters[1].x = 535; match.fighters[0].charge = 100;
    match.step(STEP, [frame({ ultra: true }), frame()]);
    expect(match.fighters[1].damage).toBe(sword.ultra.damage);
    expect(match.fighters[1].vx).toBeLessThan(0);
    expect(match.fighters[0].charge).toBe(0);
  });

  it('targets arrow rain at the captured enemy position', () => {
    const match = battle(bow); const f = match.fighters[0]; f.charge = 100;
    match.step(STEP, [frame({ ultra: true }), frame()]);
    const target = f.attack!.targetX;
    match.fighters[1].x = 400;
    tick(match, 0.2);
    expect(f.attack?.targetX).toBe(target);
    expect(match.projectiles.length).toBeGreaterThanOrEqual(2);
    expect(match.projectiles.every(p => p.vy > 0 && p.ultra)).toBe(true);
  });

  it('protects a respawned fighter until they attack', () => {
    const match = battle(); closeFighters(match); match.fighters[1].invulnerable = 2;
    match.step(STEP, [frame({ attack: true }), frame()]); tick(match, 0.3);
    expect(match.fighters[1].damage).toBe(0);
    match.step(STEP, [frame(), frame({ attack: true })]);
    expect(match.fighters[1].invulnerable).toBe(0);
  });
});

describe('stocks and match lifecycle', () => {
  it('removes one life per fall and respawns with damage reset and protection', () => {
    const match = battle(); const f = match.fighters[0];
    f.damage = 120; f.charge = 81; f.x = WIDTH + 200;
    match.step(STEP);
    expect(f.lives).toBe(2); expect(f.damage).toBe(0); expect(f.charge).toBe(40);
    tick(match, 0.5); expect(f.lives).toBe(2);
    tick(match, 0.4); expect(f.respawn).toBe(0); expect(f.invulnerable).toBeGreaterThan(1);
    expect(f.x).toBe(430);
  });

  it('finishes after the final stock and rematch resets both fighters', () => {
    const match = battle(); match.fighters[0].lives = 1; match.fighters[0].y = 900;
    match.step(STEP);
    expect(match.phase).toBe('finished'); expect(match.winner).toBe(1);
    match.start();
    expect(match.phase).toBe('countdown'); expect(match.winner).toBeNull();
    expect(match.fighters.map(f => f.lives)).toEqual([3, 3]);
    expect(match.fighters.map(f => f.damage)).toEqual([0, 0]);
    expect(match.projectiles).toHaveLength(0);
  });

  it('calls simultaneous final knockouts a draw', () => {
    const match = battle();
    for (const f of match.fighters) { f.lives = 1; f.y = 900; }
    match.step(STEP);
    expect(match.phase).toBe('finished'); expect(match.winner).toBeNull();
  });

  it('freezes every gameplay timer during pause and resumes the countdown correctly', () => {
    const match = new Match(sword, bow); match.start(); tick(match, 0.5); match.pause();
    const count = match.countdown; tick(match, 1);
    expect(match.countdown).toBe(count); match.resume(); expect(match.phase).toBe('countdown');
    tick(match, 3); match.fighters[0].charge = 100;
    match.step(STEP, [frame({ ultra: true }), frame()]); match.pause();
    const state = JSON.stringify({ fighters: match.fighters, projectiles: match.projectiles, elapsed: match.elapsed });
    tick(match, 2, [frame({ right: true, jump: true }), frame({ attack: true })]);
    expect(JSON.stringify({ fighters: match.fighters, projectiles: match.projectiles, elapsed: match.elapsed })).toBe(state);
    match.resume(); expect(match.phase).toBe('playing');
  });

  it('only allows roster changes in the lobby, including mirror matches', () => {
    const match = battle(); match.select(0, magic); expect(match.fighters[0].character.id).toBe('swordsman');
    match.lobby(); match.select(0, bow); match.select(1, bow);
    expect(match.fighters.map(f => f.character.id)).toEqual(['archer', 'archer']);
  });
});
