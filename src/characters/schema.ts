import type { CharacterDefinition } from '../game/types';

const fail = (source: string, message: string): never => { throw new Error(`Character ${source}: ${message}`); };

export function validateCharacter(value: unknown, source = 'definition'): CharacterDefinition {
  if (!value || typeof value !== 'object') return fail(source, 'expected a JSON object');
  const c = value as CharacterDefinition;
  for (const key of ['id', 'name', 'tagline', 'role', 'description'] as const) {
    if (typeof c[key] !== 'string' || !c[key].trim()) fail(source, `${key} must be a nonempty string`);
  }
  if (!/^[a-z][a-z0-9-]*$/.test(c.id)) fail(source, 'id must use lowercase letters, numbers, and hyphens');
  const number = (v: unknown, key: string, min: number, max: number) => {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) fail(source, `${key} must be between ${min} and ${max}`);
  };
  number(c.order, 'order', 0, 9999);
  if (!c.appearance || !c.stats || !c.attack || !c.ultra) fail(source, 'appearance, stats, attack, and ultra are required');
  if (!['sword', 'bow', 'staff', 'club', 'boomerang', 'claws', 'blaster', 'none'].includes(c.appearance.weapon)) fail(source, 'unknown appearance.weapon');
  if (!['smile', 'grin', 'angry', 'slime', 'cheese', 'robot', 'ninja'].includes(c.appearance.face)) fail(source, 'unknown appearance.face');
  if (!/^#[0-9a-f]{6}$/i.test(c.appearance.accent)) fail(source, 'accent must be a six-digit hex color');
  number(c.appearance.headRadius, 'headRadius', 10, 25);
  number(c.appearance.height, 'height', 0.7, 1.3);
  number(c.appearance.lineWidth, 'lineWidth', 1, 6);
  number(c.stats.speed, 'speed', 100, 600);
  number(c.stats.jumpSpeed, 'jumpSpeed', 400, 1000);
  number(c.stats.weight, 'weight', 0.5, 2);
  if (!['melee', 'projectile'].includes(c.attack.kind)) fail(source, 'unknown attack.kind');
  if (!['spin', 'rain', 'blast', 'quake', 'boomerang-burst', 'slime-bomb', 'heal', 'hover'].includes(c.ultra.kind)) fail(source, 'unknown ultra.kind');
  for (const move of ['attack', 'ultra'] as const) {
    if (typeof c[move].name !== 'string' || !c[move].name.trim()) fail(source, `${move}.name is required`);
    number(c[move].damage, `${move}.damage`, 1, 100);
    number(c[move].knockback, `${move}.knockback`, 1, 1000);
    number(c[move].growth, `${move}.growth`, 0, 15);
    number(c[move].duration, `${move}.duration`, 0.1, 5);
    number(c[move].range, `${move}.range`, 20, 2000);
  }
  number(c.attack.cooldown, 'attack.cooldown', 0.1, 5);
  number(c.attack.windup, 'attack.windup', 0, c.attack.duration - 0.01);
  number(c.ultra.count, 'ultra.count', 1, 30);
  if (!Number.isInteger(c.ultra.count)) fail(source, 'ultra.count must be a whole number');
  if (c.attack.kind === 'projectile') {
    number(c.attack.speed, 'attack.speed', 100, 1500);
    number(c.attack.radius, 'attack.radius', 2, 40);
    if (!['arrow', 'magic', 'boomerang', 'cheese', 'laser'].includes(c.attack.projectile ?? '')) fail(source, 'projectile attacks need a supported projectile');
  }
  if (c.playable !== undefined && typeof c.playable !== 'boolean') fail(source, 'playable must be true or false');
  if (c.unlock !== undefined && (!c.unlock || typeof c.unlock.boss !== 'string' || !/^[a-z][a-z0-9-]*$/.test(c.unlock.boss))) fail(source, 'unlock.boss must be a valid boss ID');
  if (c.ultra.slowDuration !== undefined) number(c.ultra.slowDuration, 'ultra.slowDuration', 0.1, 5);
  if (c.ultra.puddleDuration !== undefined) number(c.ultra.puddleDuration, 'ultra.puddleDuration', 0.1, 10);
  if (c.attack.slowDuration !== undefined) number(c.attack.slowDuration, 'attack.slowDuration', 0.1, 5);
  if (c.ultra.kind === 'heal') number(c.ultra.healAmount, 'ultra.healAmount', 1, 100);
  if (c.ultra.kind === 'hover') number(c.ultra.hoverDuration, 'ultra.hoverDuration', 0.1, 10);
  if (['heal', 'hover'].includes(c.ultra.kind) || c.boss && c.ultra.kind === 'spin') number(c.ultra.duration, 'ultra.duration (including windup)', 0.63, 5);
  if (c.boss) {
    number(c.boss.health, 'boss.health', 100, 3000);
    number(c.boss.scale, 'boss.scale', 1, 2.5);
    number(c.boss.enrageAt, 'boss.enrageAt', 0.1, 0.9);
    number(c.boss.chargePerSecond, 'boss.chargePerSecond', 1, 40);
    if (c.boss.requires !== undefined && (typeof c.boss.requires !== 'string' || !/^[a-z][a-z0-9-]*$/.test(c.boss.requires))) fail(source, 'boss.requires must be a valid boss ID');
  }
  return c;
}

export function validateBossProgression(bosses: CharacterDefinition[]): void {
  for (const boss of bosses) {
    if (!boss.boss || boss.playable !== false) fail(boss.id, 'boss packs need boss settings and playable: false');
    const visited = new Set([boss.id]);
    let required = boss.boss!.requires;
    while (required) {
      if (visited.has(required)) fail(boss.id, 'boss.requires contains a cycle');
      visited.add(required);
      const previous = bosses.find(c => c.id === required);
      if (!previous?.boss) fail(boss.id, 'boss.requires does not match a configured boss');
      required = previous!.boss!.requires;
    }
  }
}

export function validateRoster(entries: Record<string, unknown>): CharacterDefinition[] {
  const roster = Object.entries(entries).map(([source, c]) => validateCharacter(c, source));
  const ids = new Set<string>();
  for (const c of roster) {
    if (ids.has(c.id)) fail(c.id, 'duplicate id');
    ids.add(c.id);
  }
  if (!roster.length) fail('roster', 'add at least one character.json');
  return roster.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}
