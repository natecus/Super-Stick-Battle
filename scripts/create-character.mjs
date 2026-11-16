import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'characters');
const [id, displayName, base = 'swordsman'] = process.argv.slice(2);
if (!id || id === '--help') {
  console.log('Usage: npm run character:new -- <id> "Display Name" [base-character]');
  console.log('Example: npm run character:new -- knight "Knight" swordsman');
  console.log('A character folder is created and discovered automatically. Restart/rebuild after adding it.');
  process.exit(id ? 0 : 1);
}
const validId = /^[a-z][a-z0-9-]*$/;
if (!validId.test(id) || !validId.test(base)) {
  console.error('Character IDs must start with a lowercase letter and use only lowercase letters, numbers, and hyphens.');
  process.exit(1);
}
const destination = join(root, id);
const template = join(root, base, 'character.json');
if (existsSync(destination)) { console.error(`The character folder ${id} already exists. Nothing was changed.`); process.exit(1); }
if (!existsSync(template)) { console.error(`Base character ${base} does not exist.`); process.exit(1); }
const character = JSON.parse(readFileSync(template, 'utf8'));
// A playable copy of a boss can reuse its art and moves without inheriting boss-only rules.
if (character.playable === false) character.role = character.attack.kind === 'melee' ? 'MELEE FIGHTER' : 'RANGED FIGHTER';
character.playable = true;
delete character.boss;
delete character.unlock;
const orders = readdirSync(root, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => {
  const file = join(root, e.name, 'character.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).order || 0 : 0;
});
character.id = id;
character.name = displayName?.trim() || id[0].toUpperCase() + id.slice(1);
character.order = Math.max(0, ...orders) + 1;
character.tagline = 'Fresh from the sketchbook.';
character.description = 'Customize this character in character.json.';
mkdirSync(destination);
writeFileSync(join(destination, 'character.json'), JSON.stringify(character, null, 2) + '\n');
writeFileSync(join(destination, 'README.md'), `# ${character.name}\n\nCreated from ${base}. Edit character.json to change the appearance, stats, and moves.\n\nPut an optional reference drawing in this folder. Reference images are for the artist; the game renders the animated vector rig defined by appearance.\n\nSee ../../../docs/ADDING-CHARACTERS.md for all supported options.\n`);
console.log(`Created src/characters/${id}/character.json`);
console.log('Edit the file, then restart the dev server or run npm run build. The roster discovers it automatically.');
