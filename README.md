# Super Stick Battle

A local two-player browser platform fighter based on your character drawings. Made with TypeScript and Phaser 3.90, with animated pencil-style vector characters and five notebook-style arenas. Play against each other in Versus, or climb the Robot → Ninja → Cheese → Dave ladder together in Boss Battle.

## Start playing

On Windows, double-click **Start Game.cmd**, then open **http://localhost:4173**. The launcher installs dependencies if needed, builds the game, and serves it. Keep its terminal open while playing. The first installation needs an internet connection; subsequent play uses local assets and needs no external service.

Or use a terminal in this folder:

```sh
npm ci
npm run build
npm start
```

For development with automatic reload:

```sh
npm run dev
```

Open **http://localhost:5173**. Node.js **22.12+** is required (Node 24 is already installed on the development computer).

## Publish on GitHub Pages

The project includes [a GitHub Actions workflow](.github/workflows/pages.yml) that installs dependencies, runs the gameplay tests, builds the game, and publishes `dist` on pushes to `main`. Pull requests run the checks without publishing. GitHub handles the build and hosting, so your computer can be off while people play.

For the intended `natecus/Super-Stick-Battle` repository, the address after a successful deployment will be **https://natecus.github.io/Super-Stick-Battle/**.

One-time repository setup and publishing instructions are in **[GitHub Pages setup](docs/GITHUB-PAGES.md)**. The Vite build uses relative asset paths so it works under the repository's URL and on the local server. Original reference photographs stay local and are excluded from Git; the animated vector artwork is included in the game.

Players still share a keyboard on each device. Unlocks are saved in each browser at the hosted address; localhost unlocks do not automatically transfer there.

## Play on the home network

`npm start` prints the computer's local network address, for example `http://192.168.1.50:4173`. Open the printed address on another computer connected to the same home network. The host must stay awake with the server running. If Windows asks about Node.js firewall access, allow it on your **private home network**. Guest Wi-Fi or router device isolation may prevent local access.

Each browser has its own independent match, with **two people sharing that device's keyboard**. This version does not synchronize matches between different devices. You do not need router port forwarding or a domain for home-network use. Use GitHub Pages above for public internet hosting.

## Controls

| Action | Player 1 | Player 2 |
| --- | --- | --- |
| Move | A / D | Left / Right |
| Jump / double jump | W | Up |
| Drop through floating platform / fast fall | S | Down |
| Normal attack | F | K |
| Ultra (full meter) | G | L |
| Pause / resume | Esc | Esc |

Tap jump again for a second jump. Attacks trigger on a press, not continuous holding. Face a direction by moving toward it. Some keyboards cannot register every multi-key combination; use a keyboard with good rollover if simultaneous inputs are missed.

Choose **Versus** or **Boss Battle** above the arena. Select each player's character using the **P1** and **P2** buttons on the cards, then start the match. Both players can use the same character; blue and coral labels distinguish them. Robot, Ninja, Cheese, and Dave start locked as playable fighters. Defeat each boss to unlock the balanced player version in either mode and open the next boss encounter. Sound is off initially and can be enabled with the sound button. The game pauses automatically when its window loses focus.

To change mode or characters during a match, pause and choose **Change fighters**. Rematches keep the same mode and characters.

## Rules and moves

- Three lives each. Leaving the arena costs a life; in Versus, the final surviving player wins.
- Damage increases knockback. Damage resets after a knockout.
- Dealing and receiving damage charges the ultra meter. Ultras spend the whole meter and don't refill the attacker's meter through their own hits. Knockouts halve remaining charge.
- Respawning gives two seconds of protection, which ends immediately when attacking.
- Ordinary platforms can be jumped through from underneath. Hold down to drop from floating platforms. Main floors and solid clock/wall tops are not droppable. The cheese clock and Lab wall also block their sides and undersides.
- No match time limit. A simultaneous final knockout is a draw.

| Character | Attack | Ultra |
| --- | --- | --- |
| Swordsman | Fast melee slashes with strong knockback | Moving multi-strike sword spin |
| Archer | Fast straight arrow | Arrow rain over the opponent's position at activation |
| Wizard | Slower magic blast | Large, powerful fireball |
| Clubber | Heavy club smash | Earthquake hits grounded enemies on the same platform; activate while grounded |
| Boomeranger | Returning boomerang can hit once going out and once coming back | Ka-boomerang explodes on impact or after a short fuse |
| Dave (unlockable fighter) | Long-reaching claws with moderate damage and a readable windup | One smaller slime bomb with a brief slowing effect and short-lived puddle |
| Dave (boss opponent) | Powerful magic claws with a visible windup | Slime bombs leave temporary puddles that slow players |
| Cheese (unlockable) | Nacho cheese blobs slow enemies briefly | Cheese snack removes 22 damage after a windup; cannot restore lives |
| Robot (unlockable) | Fast straight laser bolts | Hover boots launch upward and slow descent for four seconds; hold down to descend |
| Ninja (unlockable) | Quick, short-range katana cuts; fast and lightweight | Vanish hides him for five seconds; attacking or taking a hit reveals him |
| Boxer | Quick close-range punches | A large glove flies straight ahead with powerful knockback |

### Unlockable arenas

Boss encounters start in their home arena. Win to use that arena in Versus or any available boss replay. Choose an arena above the battle screen while in the lobby. Rematches keep it; returning to Versus restores your last Versus choice. Existing saved boss victories automatically unlock their arenas.

| Arena | Unlock | Features |
| --- | --- | --- |
| Notebook | Available immediately | Original four fixed platforms |
| Slime Caves | Defeat Dave | Permanent green slime patches slow everyone, including bosses; jump clear to escape |
| Cheese Land | Defeat Cheese | Swiss-cheese islands and a moving cheese clock; ride its top, avoid its knocking sides. Its rail is scenery |
| The Lab | Defeat Robot | Three vertical lifts, alternating spikes with flashing warnings, and a moving striped wall that pushes toward them. Jump over the wall or land on top |
| Moonlit Dojo | Defeat Ninja | Pagoda rooftops, bamboo, moonlight, lanterns, and a gently swaying rope bridge |

Moving platforms carry their riders. Spikes deal 12 damage with knockback and a brief repeat-hit cooldown. Environmental hazards affect both teams and do not charge ultras. Arena motion and hazard timers freeze on pause and reset on restart. Ninja’s invisibility also hides his marker and shadow; boss AI cannot track hidden players, but attacks and spikes can still hit them.

### Boss Battle

Both players fight on the same team, with **no friendly fire**. Drain the boss's health before both players lose all their lives. If one teammate is eliminated, the other can finish the fight. A simultaneous final defeat is a draw.

| Boss | Requirement to challenge | Health | What to watch for |
| --- | --- | --- | --- |
| Robot | Available immediately | 800 HP | Lasers and five seconds of hover boots |
| Ninja | Defeat Robot | 950 HP | Fast katana attacks and a 4.5-second invisibility ultra |
| Cheese | Defeat Ninja | 650 HP | Slowing cheese blobs and a 35 HP healing snack |
| Dave | Defeat Cheese | 500 HP | Claws and slowing slime bombs |

The boss ladder shows locked, ready, and defeated encounters. Each victory recruits that fighter, unlocks their home arena, and opens the next challenge. **Next boss** returns to the lobby so you can select newly unlocked teammates before starting. Rematch keeps the same opponent; defeated bosses remain available to replay. Completing Dave unlocks the full roster and all arenas. Boxer is available from the start.

Bosses chase players and jump between platforms; ranged bosses try to keep firing distance. Watch attack warnings, dodge projectiles, and land a hit to reveal an invisible Ninja. Boss attacks have armor, so hitting them does not interrupt the windup. When enraged, bosses move and charge their ultras faster. Knocking a boss off the page removes 70 HP; surviving bosses return. Players keep their usual damage, knockback, and respawn rules.

### Unlock playable bosses

Win an available boss encounter. The victory screen announces the unlocked fighter, and their P1/P2 selection buttons become available when you return to fighter select. Either or both players can choose them, including against their boss counterpart. One surviving teammate earns the unlock for both. A loss, draw, restart, or unfinished fight grants no reward.

Playable Dave has ordinary size, three lives, normal knockback and interruptible attacks, and earns ultra charge through combat. His claws reach slightly farther than the Swordsman's, but are slower and deal less damage and knockback. His slime ultra deals 18 damage in a 90-pixel radius, slows direct hits for 1.1 seconds, and leaves a puddle for 2.5 seconds. Jump clear of the puddle to avoid continued slowing. The boss keeps his original stats and behavior.

All four playable versions have ordinary size, three lives, interruptible attacks, and combat-earned ultra charge. Cheese's snack reduces damage instead of healing boss HP. Robot's hover does not grant invulnerability or extra jumps, ends on knockout, and pauses with the match. The short hover duration keeps the drawing's flight idea suited to the arena.

Unlocks save automatically **in the browser at the game address you use**. Both local players share that save. Different computers, browser profiles, or addresses (for example `localhost` versus your LAN IP) have separate progress. Clearing site data clears unlocks. If browser saving is unavailable, rewards remain available for the current session and the game says so. **Existing victories keep their fighters, arenas, and boss replays unlocked. New victories follow Robot → Ninja → Cheese → Dave.**

## Add a character

```sh
npm run character:new -- knight "Knight" swordsman
```

Edit `src/characters/knight/character.json`, then restart the development server or rebuild. The character appears automatically. **[Full guide](docs/ADDING-CHARACTERS.md)** explains appearance, stats, supported moves, and where to extend new mechanics.

Character folders contain configuration and a copy of their original reference photograph where supplied. Cheese and Robot use their supplied drawings; Ninja currently uses an original masked katana doodle because no Ninja reference image was present. Photos are references, not bundled runtime assets. The original photographs at the project root are preserved.

## Project layout

```text
src/
  characters/
    swordsman/character.json + reference.jpeg
    archer/character.json + reference.jpeg
    wizard/character.json + reference.jpeg
    clubber/character.json + reference.jpeg
    boomeranger/character.json + reference.jpeg
    dave/character.json + boss.json + reference.jpeg
    cheese/character.json + boss.json + reference.jpeg
    robot/character.json + boss.json + reference.jpeg
    ninja/character.json + boss.json
    index.ts             automatic roster discovery
    schema.ts            readable configuration validation
  game/
    simulation.ts        fixed-step movement, combat, stocks, projectiles
    boss-ai.ts           boss targeting, movement, and attack decisions
    progression.ts       boss-victory rewards and browser save handling
    drawing.ts           shared animated character rig and notebook art
    scene.ts             Phaser scene, game loop, particles, captions
    input.ts             independent keyboard inputs for both players
    audio.ts             optional synthesized sound effects
    types.ts             character and match types
  main.ts                menus, fighter selection, HUD, accessibility
  style.css              paper UI and responsive layout
scripts/
  create-character.mjs    safe character scaffolder
  serve.mjs              local/LAN server for the built game
tests/                   gameplay and character validation tests
```

Phaser handles the scene, canvas renderer, scaling, and timing. Game rules live in a separate TypeScript simulation running at 120 fixed steps per second, so combat behavior does not depend on frame rate. The shared vector rig animates idle, run, jump, normal attack, ultra, hurt, and victory poses. The artwork is a recreation of the reference drawings, not a pixel-for-pixel cutout of the photos.

## Verify

```sh
npm test
npm run build
```

The production build includes Phaser and all game assets locally. There are no external fonts, CDN requests, accounts, analytics, or multiplayer services. Desktop/laptop keyboard play is the target; the layout fits smaller screens, but touch and gamepad controls are not implemented in this first version.
