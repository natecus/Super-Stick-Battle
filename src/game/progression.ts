import type { BossLadder, CharacterDefinition, GameMode, MatchPhase, MatchWinner } from './types';
import type { ArenaDefinition } from './arenas';

export const PROGRESS_KEY = 'super-stick-battle.progress.v1';
export interface ProgressStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
interface Result { mode: GameMode; phase: MatchPhase; winner: MatchWinner }

export function browserProgressStorage(): ProgressStorage | undefined {
  try { return window.localStorage; } catch { return undefined; }
}

// Both keyboard players share progress. Storage is optional: a blocked or full
// browser store must never prevent playing or receiving this session's reward.
export class Progression {
  private defeatedBosses = new Set<string>();
  saved = false;

  constructor(private characters: CharacterDefinition[], private storage?: ProgressStorage, private bosses: CharacterDefinition[] = []) {
    try {
      const raw = storage?.getItem(PROGRESS_KEY);
      if (!raw) return;
      const progress: unknown = JSON.parse(raw);
      if (!progress || typeof progress !== 'object' || !('version' in progress) || progress.version !== 1 || !('defeatedBosses' in progress) || !Array.isArray(progress.defeatedBosses)) return;
      for (const id of progress.defeatedBosses) if (typeof id === 'string' && /^[a-z][a-z0-9-]*$/.test(id)) this.defeatedBosses.add(id);
      this.saved = true;
    } catch { /* Invalid or inaccessible saves start with the default roster. */ }
  }

  canSelect(character: CharacterDefinition): boolean {
    return character.playable !== false && (!character.unlock || this.defeatedBosses.has(character.unlock.boss));
  }

  hasDefeated(bossId: string): boolean { return this.defeatedBosses.has(bossId); }

  canSelectArena(arena: ArenaDefinition): boolean {
    return !arena.boss || this.hasDefeated(arena.boss);
  }

  canChallenge(boss: CharacterDefinition): boolean {
    // Reordering the ladder must not take away replays earned by an older save.
    return Boolean(boss.boss && (this.hasDefeated(boss.id) || !boss.boss.requires || this.hasDefeated(boss.boss.requires)));
  }

  nextBoss(ladder?: BossLadder): CharacterDefinition | undefined {
    return this.bosses.find(boss => (!ladder || (boss.boss?.ladder ?? 'classic') === ladder) && this.canChallenge(boss) && !this.hasDefeated(boss.id));
  }

  recordResult(result: Result, bossId?: string): CharacterDefinition[] {
    if (result.phase !== 'finished' || result.mode !== 'boss' || result.winner !== 'team' || !bossId || this.defeatedBosses.has(bossId)) return [];
    if (this.bosses.length && !this.bosses.some(boss => boss.id === bossId && this.canChallenge(boss))) return [];
    const rewards = this.characters.filter(c => c.playable !== false && c.unlock?.boss === bossId);
    if (!rewards.length) return [];
    this.defeatedBosses.add(bossId);
    try {
      this.storage?.setItem(PROGRESS_KEY, JSON.stringify({ version: 1, defeatedBosses: [...this.defeatedBosses] }));
      this.saved = Boolean(this.storage);
    } catch { this.saved = false; }
    return rewards;
  }
}
