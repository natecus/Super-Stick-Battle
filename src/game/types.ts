export type PlayerId = 0 | 1;
export type FighterId = PlayerId | 2;
export type GameMode = 'duel' | 'boss';
export type MatchWinner = PlayerId | 'team' | 'boss' | null;
export type Weapon = 'sword' | 'bow' | 'staff' | 'club' | 'boomerang' | 'claws' | 'blaster' | 'none';
export type ProjectileKind = 'arrow' | 'magic' | 'fireball' | 'boomerang' | 'slime' | 'cheese' | 'laser';

export interface CharacterDefinition {
  id: string;
  name: string;
  order: number;
  tagline: string;
  role: string;
  description: string;
  playable?: boolean;
  unlock?: { boss: string };
  boss?: { health: number; scale: number; enrageAt: number; chargePerSecond: number; requires?: string };
  appearance: {
    weapon: Weapon;
    face: 'smile' | 'grin' | 'angry' | 'slime' | 'cheese' | 'robot' | 'ninja';
    accent: string;
    headRadius: number;
    height: number;
    lineWidth: number;
  };
  stats: { speed: number; jumpSpeed: number; weight: number };
  attack: {
    kind: 'melee' | 'projectile';
    name: string;
    damage: number;
    knockback: number;
    growth: number;
    cooldown: number;
    windup: number;
    duration: number;
    range: number;
    speed?: number;
    radius?: number;
    projectile?: 'arrow' | 'magic' | 'boomerang' | 'cheese' | 'laser';
    slowDuration?: number;
  };
  ultra: {
    kind: 'spin' | 'rain' | 'blast' | 'quake' | 'boomerang-burst' | 'slime-bomb' | 'heal' | 'hover';
    name: string;
    damage: number;
    knockback: number;
    growth: number;
    duration: number;
    range: number;
    count: number;
    slowDuration?: number;
    puddleDuration?: number;
    healAmount?: number;
    hoverDuration?: number;
  };
}

export interface InputFrame {
  left: boolean;
  right: boolean;
  down: boolean;
  jump: boolean;
  attack: boolean;
  ultra: boolean;
}

export const emptyInput = (): InputFrame => ({ left: false, right: false, down: false, jump: false, attack: false, ultra: false });

export interface AttackState {
  ultra: boolean;
  elapsed: number;
  duration: number;
  fired: number;
  facing: number;
  targetX: number;
  targetY: number;
  hitTargets: FighterId[];
}

export interface Fighter {
  player: FighterId;
  team: number;
  size: number;
  health: number;
  maxHealth: number;
  slowed: number;
  hovering: number;
  character: CharacterDefinition;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  grounded: boolean;
  platform: number | null;
  jumps: number;
  damage: number;
  lives: number;
  charge: number;
  stun: number;
  invulnerable: number;
  cooldown: number;
  dropThrough: number;
  coyote: number;
  jumpBuffer: number;
  attack: AttackState | null;
  respawn: number;
  walkTime: number;
}

export interface Platform { x: number; y: number; width: number; main?: boolean }

export interface Projectile {
  id: number;
  owner: FighterId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  kind: ProjectileKind;
  damage: number;
  knockback: number;
  growth: number;
  life: number;
  ultra: boolean;
  age?: number;
  returning?: boolean;
  returnAfter?: number;
  hitTargets?: FighterId[];
  explosionRadius?: number;
  fuse?: number;
  slowDuration?: number;
  puddleDuration?: number;
}

export interface Hazard {
  id: number;
  owner: FighterId;
  kind: 'slime' | 'quake' | 'explosion';
  x: number;
  y: number;
  radius: number;
  life: number;
  total: number;
}

export type GameEvent =
  | { type: 'jump' | 'land' | 'hit' | 'ko' | 'shot' | 'ultra' | 'explosion' | 'enrage'; x: number; y: number; player: FighterId; intensity: number }
  | { type: 'win'; winner: MatchWinner };

export type MatchPhase = 'lobby' | 'countdown' | 'playing' | 'paused' | 'finished';
