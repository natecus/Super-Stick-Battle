import { describe, expect, it } from 'vitest';
import { bosses, characters } from '../src/characters';
import { validateBossProgression, validateCharacter } from '../src/characters/schema';
import { arenaForBoss, platformsAt, type ArenaId } from '../src/game/arenas';
import { Progression } from '../src/game/progression';
import { applyPowerUp, GOOD_POWER_UPS, hasPowerUp } from '../src/game/powerups';
import { Match, STEP } from '../src/game/simulation';
import { emptyInput, type InputFrame, type ProjectileKind } from '../src/game/types';

const fighter = (id: string) => characters.find(c => c.id === id)!;
const input = (values: Partial<InputFrame> = {}) => ({ ...emptyInput(), ...values });
function tick(m: Match, seconds: number, frames: [InputFrame, InputFrame] = [input(), input()]) {
  for (let i = 0; i < Math.ceil(seconds / STEP); i++) m.step(STEP, frames);
}
function battle(id = 'snowman', arena: ArenaId = 'notebook', random = () => .5) {
  const m = new Match(fighter(id), fighter('swordsman'), undefined, () => true, () => true, () => true, random);
  m.selectArena(arena); m.start(); tick(m, 3.01); return m;
}
const win = { phase: 'finished', mode: 'boss', winner: 'team' } as const;

describe('independent winter ladder', () => {
  it('starts alongside Robot, unlocks only winter rewards, and preserves both ladders across reloads', () => {
    let saved: string | null = null;
    const storage = { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value; } };
    let p = new Progression(characters, storage, bosses);
    expect(bosses.filter(b => p.canChallenge(b)).map(b => b.id)).toEqual(['robot','snowman']);
    expect(p.recordResult(win, 'santa')).toEqual([]);
    for (const id of ['snowman','christmas-tree','santa']) {
      expect(p.nextBoss('winter')?.id).toBe(id);
      expect(p.canSelect(fighter(id))).toBe(false);
      expect(p.canSelectArena(arenaForBoss(id))).toBe(false);
      expect(p.recordResult(win, id).map(c => c.id)).toEqual([id]);
      p = new Progression(characters, storage, bosses);
      expect(p.canSelect(fighter(id))).toBe(true);
      expect(p.canSelectArena(arenaForBoss(id))).toBe(true);
      expect(p.nextBoss('classic')?.id).toBe('robot');
    }
    expect(p.nextBoss('winter')).toBeUndefined();
    expect(p.canSelect(fighter('robot'))).toBe(false);
    p.recordResult(win,'robot'); expect(p.nextBoss('classic')?.id).toBe('ninja');
  });
  it('rejects cross-ladder dependencies and ultras too short to fire', () => {
    const packs = structuredClone(bosses); packs.find(b => b.id === 'snowman')!.boss!.requires = 'dave';
    expect(() => validateBossProgression(packs)).toThrow('within its ladder');
    for (const id of ['snowman','christmas-tree','santa']) {
      const c=structuredClone(fighter(id)); c.ultra.duration=.4;
      expect(() => validateCharacter(c)).toThrow('including windup');
    }
  });
});

describe('winter combat', () => {
  it('throws a slowing snowball and fires a telegraphed blizzard at the target area', () => {
    const m=battle(), f=m.fighters[0], target=m.fighters[1]; target.x=f.x+180;
    m.step(STEP,[input({attack:true}),input()]);tick(m,.5);
    expect(target.damage).toBeGreaterThan(0);expect(target.slowed).toBeGreaterThan(0);
    target.x=1000;f.charge=100;f.cooldown=0;
    m.step(STEP,[input({ultra:true}),input()]);tick(m,.4);
    expect(m.projectiles.filter(p=>p.ultra)).toHaveLength(0);
    tick(m,.3);expect(m.projectiles.some(p=>p.ultra&&p.kind==='snowball'&&p.vy>0)).toBe(true);
    expect(f.charge).toBe(0);
  });
  it('explodes a normal present once and charges Santa from the hit', () => {
    const m=battle('santa'), f=m.fighters[0], target=m.fighters[1];target.x=f.x+210;
    m.step(STEP,[input({attack:true}),input()]);tick(m,1.2);
    expect(m.drainEvents().filter(e=>e.type==='explosion')).toHaveLength(1);
    expect(target.damage).toBe(f.character.attack.damage);expect(f.charge).toBeGreaterThan(0);
  });
  it('ornaments burst into damaging star and moon shards', () => {
    const m=battle('christmas-tree'),f=m.fighters[0];m.fighters[1].x=1100;f.charge=100;
    m.step(STEP,[input({ultra:true}),input()]);tick(m,.7);
    expect(m.projectiles.some(p=>p.kind==='ornament')).toBe(true);
    tick(m,.9);expect(m.projectiles.some(p=>p.kind==='needle'&&p.variant)).toBe(true);
    expect(m.drainEvents().some(e=>e.type==='explosion')).toBe(true);
  });
  it.each(GOOD_POWER_UPS)('Self gift can grant %s and never chooses a negative effect', kind => {
    const m=battle('santa','notebook',()=> (GOOD_POWER_UPS.indexOf(kind)+.1)/4), f=m.fighters[0];
    f.damage=70;f.charge=100;m.step(STEP,[input({ultra:true}),input()]);tick(m,.7);
    expect(hasPowerUp(f,kind)).toBe(true);expect(f.charge).toBe(0);
    expect(f.damage).toBe(kind==='heal'?45:70);
  });
  it.each(['fireball','cheese'] as ProjectileKind[])('Snowman takes 50% extra damage from %s', kind => {
    const m=battle(),target=m.fighters[0];
    m.projectiles.push({id:999,owner:1,kind,x:target.x-25,y:target.y-50,vx:600,vy:0,radius:10,damage:10,knockback:100,growth:0,life:1,ultra:true});
    m.step(STEP);expect(target.damage).toBe(15);
  });
  it('winter bosses finish encounters without dying in the fireplace or getting stuck', () => {
    for(const boss of bosses.filter(b=>b.boss?.ladder==='winter')) {
      const m=new Match(fighter('swordsman'),fighter('archer'),boss,()=>true,()=>true,()=>true,()=>.5);
      m.setMode('boss');m.start();tick(m,183.1);
      expect(m.phase, boss.name + JSON.stringify(m.fighters.map(f => ({x:f.x,y:f.y,hp:f.health,lives:f.lives,damage:f.damage,platform:f.platform,jumps:f.jumps,attack:f.attack?.elapsed})))).toBe('finished');expect(m.winner,boss.name).toBe('boss');
    }
  });
});

describe('mystery pickups', () => {
  it('spawns only during play, collects once, freezes on pause, and clears on restart', () => {
    const m=battle();tick(m,12.1);expect(m.pickups.length).toBeGreaterThan(0);
    m.pause();const items=structuredClone(m.pickups);tick(m,5);expect(m.pickups).toEqual(items);m.resume();
    const item=m.pickups[0],p=m.platforms[item.platform],f=m.fighters[0];
    f.x=p.x+item.offset;f.y=p.y;f.platform=item.platform;f.grounded=true;f.vy=0;
    m.step(STEP);expect(m.pickups).toHaveLength(0);expect(hasPowerUp(f,item.kind)).toBe(true);
    const duration=f.powerUps[0].remaining;m.pause();tick(m,2);expect(f.powerUps[0].remaining).toBe(duration);
    m.start();expect(m.pickups).toEqual([]);expect(m.fighters[0].powerUps).toEqual([]);
  });
  it('refreshes effects, replaces opposites, expires, and clears on knockout', () => {
    const m=battle(),f=m.fighters[0];applyPowerUp(f,'strength');applyPowerUp(f,'strength');expect(f.powerUps).toHaveLength(1);
    applyPowerUp(f,'weakness');expect(hasPowerUp(f,'strength')).toBe(false);expect(hasPowerUp(f,'weakness')).toBe(true);
    tick(m,8.1);expect(f.powerUps).toHaveLength(0);
    applyPowerUp(f,'defense');f.x=-200;m.step(STEP);expect(f.powerUps).toEqual([]);
  });
  it('applies strength and defense to damage and speed to movement', () => {
    const damage=(boost:boolean)=>{const m=battle('swordsman'),f=m.fighters[0],t=m.fighters[1];t.x=f.x+60;
      if(boost){applyPowerUp(f,'strength');applyPowerUp(t,'defense');}
      m.step(STEP,[input({attack:true}),input()]);tick(m,.18);return t.damage;};
    expect(damage(true)).toBeCloseTo(damage(false)*1.35*.65);
    const m=battle(),f=m.fighters[0];applyPowerUp(f,'speed');tick(m,.25,[input({right:true}),input()]);expect(f.vx).toBeCloseTo(f.character.stats.speed*1.4);
  });
  it('healing restores boss HP, damage hurts HP, and neither can grant stocks', () => {
    const boss=bosses.find(b=>b.id==='santa')!;
    const m=new Match(fighter('swordsman'),fighter('archer'),boss,()=>true,()=>true);m.setMode('boss');
    const f=m.boss!;f.health=f.maxHealth-10;applyPowerUp(f,'heal');expect(f.health).toBe(f.maxHealth);
    f.health=20;applyPowerUp(f,'damage');expect(f.health).toBe(0);expect(f.lives).toBe(0);
    const p=m.fighters[0];p.damage=5;p.lives=2;applyPowerUp(p,'heal');expect(p.damage).toBe(0);expect(p.lives).toBe(2);
  });
});

describe('winter arenas', () => {
  it('ice preserves more momentum than a normal floor', () => {
    const ice=battle('swordsman','snow-fort'),normal=battle('swordsman');
    for(const m of [ice,normal]) {m.fighters[0].vx=300;tick(m,.2);}
    expect(ice.fighters[0].vx).toBeGreaterThan(250);expect(normal.fighters[0].vx).toBe(0);
  });
  it('the Living Room contains fighters, bounces couches, and knocks out at 200%', () => {
    const m=battle('swordsman','living-room'),f=m.fighters[0];
    f.x=155;f.vx=-500;f.stun=1;m.step(STEP);expect(f.x).toBeGreaterThan(150);expect(f.lives).toBe(3);
    f.y=111;f.vy=-800;m.step(STEP);expect(f.y).toBeGreaterThan(200);
    f.x=270;f.y=434;f.vy=250;f.stun=0;f.grounded=false;f.platform=null;m.step(STEP);
    expect(f.vy).toBe(-840);expect(f.grounded).toBe(false);
    f.damage=200;m.step(STEP);expect(f.lives).toBe(2);expect(f.damage).toBe(0);expect(f.respawn).toBeGreaterThan(0);
  });
  it('the fireplace hurts Snowman more and respects invulnerability', () => {
    const m=battle('snowman','living-room'),f=m.fighters[0];f.x=640;f.y=524;f.platform=0;
    m.step(STEP);expect(f.damage).toBe(15);
    f.x=640;f.y=524;f.invulnerable=1;f.arenaHitCooldown=0;m.step(STEP);expect(f.damage).toBe(15);
  });
  it('workshop belts move riders and gift platforms fall, carry, and reset on restart', () => {
    const m=battle('swordsman','santas-workshop'),f=m.fighters[0];f.x=350;
    tick(m,.5);expect(f.x).toBeCloseTo(385,0);
    const a=platformsAt(m.arena,0)[6],b=platformsAt(m.arena,.5)[6];expect(b.y).toBeGreaterThan(a.y);
    const gift=platformsAt(m.arena,2)[6];expect(gift.solid).toBe('gift');expect(gift.y).toBe(470);expect(gift.x).toBeGreaterThan(a.x);
    m.start();expect(m.platforms).toEqual(platformsAt(m.arena,0));
  });
});
