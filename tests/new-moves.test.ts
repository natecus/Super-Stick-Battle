import { describe, expect, it } from 'vitest';
import { validateCharacter } from '../src/characters/schema';
import clubJson from '../src/characters/clubber/character.json';
import boomJson from '../src/characters/boomeranger/character.json';
import swordJson from '../src/characters/swordsman/character.json';
import { Match, STEP } from '../src/game/simulation';
import { emptyInput, type CharacterDefinition } from '../src/game/types';

const club = validateCharacter(clubJson), boom = validateCharacter(boomJson), sword = validateCharacter(swordJson);
function tick(match: Match, seconds: number) { for (let i = 0; i < Math.ceil(seconds / STEP); i++) match.step(STEP); }
function battle(character: CharacterDefinition) { const m = new Match(character, sword); m.start(); tick(m, 3.01); return m; }
function ultra(m: Match) { m.fighters[0].charge = 100; m.step(STEP, [{ ...emptyInput(), ultra: true }, emptyInput()]); }

describe('Clubber', () => {
  it('earthquake hits distant grounded enemies on the same platform', () => {
    const m = battle(club); m.fighters[0].x = 300; m.fighters[1].x = 950;
    ultra(m); tick(m, 0.5);
    expect(m.fighters[1].damage).toBe(club.ultra.damage); expect(m.hazards.some(h => h.kind === 'quake')).toBe(true);
  });

  it('jumping or standing on another platform dodges the earthquake', () => {
    for (const airborne of [true, false]) {
      const m = battle(club); m.fighters[1].x = 900; m.fighters[1].y = airborne ? 200 : 365;
      m.fighters[1].grounded = !airborne; m.fighters[1].platform = airborne ? null : 2;
      if (airborne) m.fighters[1].vy = -200;
      ultra(m); tick(m, 0.5); expect(m.fighters[1].damage).toBe(0);
    }
  });

  it('does not spend the ultra meter when activated in midair', () => {
    const m = battle(club); m.fighters[0].grounded = false; m.fighters[0].y = 300; m.fighters[0].platform = null;
    ultra(m); expect(m.fighters[0].charge).toBe(100); expect(m.fighters[0].attack).toBeNull();
  });
});

describe('Boomeranger', () => {
  it('returns to its owner and can hit once on each leg of the trip', () => {
    const m = battle(boom); m.fighters[0].x = 400; m.fighters[1].x = 600;
    m.step(STEP, [{ ...emptyInput(), attack: true }, emptyInput()]);
    let firstHit = false, returnedHit = false, sawReturn = false;
    for (let i = 0; i < 3 / STEP; i++) {
      // Keep the target in the lane to isolate outward/return collision semantics.
      const target = m.fighters[1]; target.x = 600; target.y = 524; target.vx = target.vy = 0; target.grounded = true;
      m.step(STEP);
      firstHit ||= target.damage >= boom.attack.damage;
      returnedHit ||= target.damage === boom.attack.damage * 2;
      sawReturn ||= m.projectiles.some(p => p.returning);
    }
    expect(firstHit).toBe(true); expect(sawReturn).toBe(true); expect(returnedHit).toBe(true);
    expect(m.fighters[1].damage).toBe(boom.attack.damage * 2); expect(m.projectiles).toHaveLength(0);
  });

  it('exploding ultra damages enemies but not its owner', () => {
    const m = battle(boom); m.fighters[0].x = 500; m.fighters[1].x = 610;
    ultra(m); tick(m, 0.6);
    expect(m.fighters[1].damage).toBe(boom.ultra.damage); expect(m.fighters[0].damage).toBe(0);
    expect(m.projectiles).toHaveLength(0);
  });

  it('explodes when its fuse expires even if it misses', () => {
    const m = battle(boom); m.fighters[0].x = 400; m.fighters[1].y = 235; m.fighters[1].x = 640; m.fighters[1].platform = 3;
    ultra(m); tick(m, 1.15);
    expect(m.projectiles).toHaveLength(0); expect(m.hazards.some(h => h.kind === 'explosion')).toBe(true);
  });
});
