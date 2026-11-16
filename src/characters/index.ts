import { validateBossProgression, validateRoster } from './schema';

// Add a folder with character.json; Vite discovers it without a manual registry.
export const characters = validateRoster(import.meta.glob('./*/character.json', {
  eager: true,
  import: 'default',
}));

// Boss encounters have separate tuning from their unlockable player versions.
export const bosses = validateRoster(import.meta.glob('./*/boss.json', {
  eager: true,
  import: 'default',
}));
validateBossProgression(bosses);
for (const character of characters) {
  if (character.unlock && !bosses.some(boss => boss.id === character.unlock!.boss && boss.boss)) {
    throw new Error(`Character ${character.id}: unlock.boss does not match a configured boss`);
  }
}
