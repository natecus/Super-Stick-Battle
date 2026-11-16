import type { Platform } from './types';

export type ArenaId = 'notebook' | 'slime-caves' | 'cheese-land' | 'the-lab' | 'moonlit-dojo';
export interface ArenaPlatform extends Platform {
  motion?: { axis: 'x' | 'y'; amplitude: number; period: number; phase?: number };
}
export interface SlimePatch { platform: number; offset: number; width: number }
export interface SpikeStrip { x: number; width: number; y: number; phase: number }
export interface ArenaDefinition {
  id: ArenaId;
  name: string;
  boss?: string;
  accent: string;
  description: string;
  platforms: ArenaPlatform[];
  spawns?: { duel: [number, number]; boss: [number, number, number] };
  slime?: SlimePatch[];
  spikes?: SpikeStrip[];
}

export const DESK_PLATFORMS: ArenaPlatform[] = [
  { x: 225, y: 524, width: 830, main: true },
  { x: 260, y: 365, width: 205 },
  { x: 815, y: 365, width: 205 },
  { x: 530, y: 235, width: 220 },
];

export const arenas: ArenaDefinition[] = [
  { id: 'notebook', name: 'Notebook', accent: '#8a8062', description: 'The original page. Four steady platforms and no arena hazards.', platforms: DESK_PLATFORMS },
  { id: 'slime-caves', name: 'Slime Caves', boss: 'dave', accent: '#709548',
    description: 'Slippery cave ledges. Green slime slows everyone standing in it; jump to escape.',
    platforms: DESK_PLATFORMS.map(p => ({ ...p })),
    slime: [{ platform: 0, offset: 60, width: 155 }, { platform: 0, offset: 420, width: 150 },
      { platform: 1, offset: 30, width: 65 }, { platform: 2, offset: 110, width: 65 }, { platform: 3, offset: 80, width: 65 }] },
  { id: 'cheese-land', name: 'Cheese Land', boss: 'cheese', accent: '#bd912c',
    description: 'Swiss-cheese islands and a moving cheese clock. Ride its top; its sides knock you away. The rail is scenery.',
    platforms: [
      { x: 430, y: 524, width: 625, main: true }, { x: 225, y: 524, width: 155, main: true },
      { x: 245, y: 402, width: 200 }, { x: 850, y: 402, width: 190 },
      { x: 515, y: 222, width: 115 }, { x: 680, y: 222, width: 115 },
      { x: 585, y: 304, width: 108, height: 72, solid: 'clock', motion: { axis: 'x', amplitude: 350, period: 7 } },
    ] },
  { id: 'the-lab', name: 'The Lab', boss: 'robot', accent: '#4d929b',
    description: 'Ride the lifts. Flashing strips warn of spikes. Jump over the moving wall before it pushes you into them.',
    spawns: { duel: [430, 810], boss: [400, 810, 640] },
    platforms: [
      { x: 225, y: 524, width: 830, main: true },
      { x: 300, y: 355, width: 155, motion: { axis: 'y', amplitude: 80, period: 5.5 } },
      { x: 565, y: 280, width: 150, motion: { axis: 'y', amplitude: 65, period: 6.2, phase: Math.PI } },
      { x: 825, y: 355, width: 155, motion: { axis: 'y', amplitude: 80, period: 5.5, phase: Math.PI } },
      { x: 615, y: 426, width: 42, height: 98, solid: 'wall', motion: { axis: 'x', amplitude: 265, period: 11, phase: Math.PI / 2 } },
    ], spikes: [{ x: 270, y: 524, width: 85, phase: 0 }, { x: 930, y: 524, width: 85, phase: 2.4 }] },
  { id: 'moonlit-dojo', name: 'Moonlit Dojo', boss: 'ninja', accent: '#7c6e9b',
    description: 'A moonlit rooftop dojo, bamboo, lanterns, and a gently swaying rope bridge. Watch for a vanishing Ninja.',
    platforms: [
      { x: 225, y: 524, width: 830, main: true }, { x: 255, y: 382, width: 180 }, { x: 845, y: 382, width: 180 },
      { x: 540, y: 218, width: 200 },
      { x: 515, y: 365, width: 250, motion: { axis: 'y', amplitude: 12, period: 4.5 } },
    ] },
];

export function arenaForBoss(bossId: string): ArenaDefinition {
  return arenas.find(arena => arena.boss === bossId) ?? arenas[0];
}

// Absolute-time motion is deterministic, stays in sync with collisions, and freezes on pause.
export function platformsAt(arena: ArenaDefinition, time: number): Platform[] {
  return arena.platforms.map(({ motion, ...p }) => {
    if (motion) p[motion.axis] += Math.sin(time / motion.period * Math.PI * 2 + (motion.phase ?? 0)) * motion.amplitude;
    return p;
  });
}

export function spikeState(strip: SpikeStrip, time: number): { height: number; warning: boolean } {
  const phase = (time + strip.phase) % 4.8;
  const height = phase < 2.5 ? 0 : phase < 2.75 ? (phase - 2.5) / 0.25 * 34
    : phase < 3.7 ? 34 : phase < 4 ? (4 - phase) / 0.3 * 34 : 0;
  return { height, warning: phase >= 1.75 && phase < 2.5 };
}
