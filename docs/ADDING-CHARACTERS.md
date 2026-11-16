# Adding a fighter

## The quick route

1. Run `npm run character:new -- knight "Knight" swordsman` in the project folder. The final argument can be any existing character ID; it defaults to `swordsman`.
2. Open the new `src/characters/knight/character.json` and edit the name, tagline, appearance, stats, and moves.
3. Optionally place a reference drawing in that folder. Reference photos are for future artwork work; they are not automatically converted into animated art.
4. Restart `npm run dev`, or run `npm run build` for the hosted version. The roster discovers every `src/characters/*/character.json` automatically.

You can also copy an existing character folder manually, then change its `id` and `name`. IDs must be unique, start with a lowercase letter, and contain only lowercase letters, numbers, or hyphens. The template command refuses to overwrite existing folders. `order` controls the card order.

Useful templates include `clubber` for heavy melee/earthquake and `boomeranger` for returning/exploding throws. Cloning `dave` uses his balanced player configuration. The helper removes unlock requirements and boss-only settings so the new fighter is available immediately. When copying Dave's folder manually for a new playable fighter, copy `character.json` and remove its `unlock` field. His separate `boss.json` describes the boss encounter; do not copy that unless you are building a new boss too.

## Appearance

The same vector rig renders the roster portrait and every gameplay animation. You don't need animation frames for a new configuration of the existing rig.

| Field | Supported values | Meaning |
| --- | --- | --- |
| `weapon` | `sword`, `bow`, `staff`, `club`, `boomerang`, `claws`, `blaster`, `gloves`, `none` | Which animated weapon is drawn |
| `face` | `smile`, `grin`, `angry`, `slime`, `cheese`, `robot`, `ninja` | Face and character details, including Cheese's wedge head, Robot's metal body, and Ninja's mask |
| `accent` | Six-digit hex, e.g. `#4a8061` | Weapon and card accent; player colors stay blue/coral |
| `headRadius` | 10–25 | Drawn head size, typically 17 |
| `height` | 0.7–1.3 | Art scale, typically 1 |
| `lineWidth` | 1–6 | Pencil stroke thickness, typically 3 |

Appearance is cosmetic; playable fighters have the same collision dimensions. Dave's separate `boss.scale` setting enlarges both his art and collision body. A new weapon shape, different anatomy, or a unique face requires extending `src/game/drawing.ts`. Existing reference photos are recreated as vector line art. Simply replacing `reference.jpeg` does not change the rendered fighter.

## Stats

| Field | Meaning | Typical value |
| --- | --- | --- |
| `speed` | Horizontal running speed in pixels/second | 310 |
| `jumpSpeed` | Initial upward velocity; higher goes farther | 680 |
| `weight` | Knockback divisor; heavier gets launched less | 1.0 |

## Normal attack

Choose `kind: "melee"` or `kind: "projectile"`.

- `name`: label in the card.
- `damage`: percentage added on hit.
- `knockback`: initial launch force.
- `growth`: how strongly accumulated damage increases launch force.
- `windup`: seconds before the hitbox/projectile activates.
- `duration`: full animation time in seconds; must exceed windup.
- `cooldown`: minimum delay between starts; a current attack must also finish.
- `range`: melee reach or projectile travel distance in pixels.
- For projectiles, set `projectile` to `arrow`, `magic`, `boomerang`, `cheese`, or `laser`, plus `speed` and `radius`. A boomerang turns back after traveling its range, follows its owner, and can hit each enemy once per leg. Optional `attack.slowDuration` slows direct hits for that many seconds; Cheese uses it for nacho cheese blobs.

Examples are in the existing Swordsman (melee) and Archer (projectile) JSON files. Mix and match appearance and moves freely. The normal move animation follows the weapon appearance.

## Ultra

All ultras require a full meter. Fields common to all: `kind`, `name`, `damage`, `knockback`, `growth`, `duration`, `range`, `count`.

| `kind` | Behavior | `range` | `count` |
| --- | --- | --- | --- |
| `spin` | Repeated melee strikes on both sides while moving | Hit radius | Number of strike attempts |
| `rain` | Arrows fall in a marked region around the rival's position when activated | Region width | Number of arrows |
| `blast` | One giant fireball after a brief windup | Travel distance | Set to 1 |
| `quake` | Hits grounded enemies sharing the user's platform after a windup; requires the user to stay grounded | Reserved; effect spans the platform | Set to 1 |
| `boomerang-burst` | Exploding throw with an impact trigger and short fuse | Explosion radius | Set to 1 |
| `slime-bomb` | Lobs a slowing bomb toward each living enemy; leaves temporary slime puddles | Explosion/puddle radius | Reserved; one bomb per living enemy |
| `heal` | After 0.62 seconds, removes player damage or restores boss HP using required `healAmount`; cannot restore lives | Reserved (20) | Set to 1 |
| `hover` | After 0.62 seconds, launches upward and limits downward speed for required `hoverDuration` seconds; down bypasses the limit | Reserved (20) | Set to 1 |

| `invisibility` | After 0.62 seconds, hides body/marker/shadow for required `invisibleDuration`; an attack or hit reveals the fighter | Reserved (0) | Set to 1 |
| `glove-throw` | Throws one straight glove at 700 pixels/second after 0.26 seconds; duration must exceed windup | Travel distance | Set to 1 |

Support ultras (`heal`, `hover`, `invisibility`) accept damage/knockback/range values of 0 and growth 0; they do not deal damage. Their animation duration must exceed 0.62 seconds. Boss `spin` ultras also use a 0.62-second warning before the first strike; set their duration above 0.62 seconds.

Player attacks are interruptible when hit; Dave's attacks have boss armor. Shared behaviors keep ordinary additions confined to a character folder. For a completely new mechanic, add its type in `src/game/types.ts`, validate it in `src/characters/schema.ts`, implement it in `src/game/simulation.ts`, and add appropriate artwork in `drawing.ts`/`scene.ts`. Keep gameplay rules separate from drawing code.

For `slime-bomb`, optional `slowDuration` and `puddleDuration` fields control the direct-hit slow and puddle lifetime in seconds (defaults: 2 and 4). Puddles refresh a short slow while an enemy stands in them. Player Dave uses 1.1 and 2.5, with a smaller `range` of 90. Slime targeting warnings work for player and boss versions.

## Unlock requirements

Add `"unlock": { "boss": "dave" }` to a playable character's configuration to require a victory over Dave. Without `unlock`, the fighter is available immediately. Boss IDs must match an encounter in a `boss.json` file. A team victory unlocks every character tied to that boss for both keyboard players, and `src/game/progression.ts` saves the defeated boss IDs in browser local storage. Losses, draws, and unfinished matches do not grant rewards. Storage failure falls back to a session unlock with a visible notice.

## Configure progressive bosses

Playable Dave lives in `src/characters/dave/character.json`; his boss opponent lives in `src/characters/dave/boss.json`. The two configurations are validated separately and share the `dave` ID. Player slots use the character configuration; the AI slot uses the boss configuration. Editing one does not change the other's stats.

The boss configuration has `playable: false` and a `boss` object with `health` (500), `scale` (1.65), `enrageAt` (0.5, a fraction of health), and `chargePerSecond` (14). His movement and attack numbers use the same fields as ordinary fighters. `src/game/boss-ai.ts` controls pursuit and attack decisions. Keep boss-only fields out of playable character configurations.

Boss encounters are discovered automatically from `src/characters/*/boss.json`. Add `boss.requires` with the previous encounter's ID to gate a boss behind that victory; omit it for a starting boss. The current chain is Dave → Cheese → Robot → Ninja, ordered by `order`. Missing prerequisites and cycles fail validation. Add a separate playable `character.json` with `unlock.boss` pointing to this encounter. The menus, health bars, warnings, and victory labels use the selected boss's configuration.

`Progression` receives the boss roster and checks prerequisites for rewards and selection. `Match.selectBoss` only accepts accessible bosses in the lobby. Player and boss configurations share an ID but have independent tuning. Existing version-1 saves keep their Dave victory and open Cheese automatically. The character helper creates playable fighters; add boss encounter settings manually.

## Check your addition

Run `npm test` and `npm run build`. Automated tests validate all discovered character folders, including duplicate IDs and invalid numbers. Test the new fighter against each existing fighter, against itself, and on a team against Dave. Check jumping onto every platform, facing both ways, hitting in the air, filling the ultra meter, respawning, and rematching. In Boss Battle, confirm its attacks cannot hurt its teammate.

## Arena definitions

`src/game/arenas.ts` owns home-arena boss IDs, platform geometry and motion, safe starting positions, permanent slime patches, and spike timing. A boss victory unlocks its arena using the same saved defeated-boss IDs. `platformsAt` produces deterministic geometry from match elapsed time; `arena-drawing.ts` renders that exact geometry, and `simulation.ts` resolves riders, solids, and hazards. New arenas need matching drawing support and physics tests. Keep decorative scenery separate from collidable surfaces.
