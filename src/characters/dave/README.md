# Dave, the Slime King

Based on the green, crowned figure and move notes in `reference.jpeg`, recreated in the notebook's animated line-art style.

Dave is the fourth and final boss in the Robot → Ninja → Cheese → Dave ladder. Defeat Cheese to challenge him.

Dave has two separate configurations: `boss.json` for the AI opponent and `character.json` for the unlockable player. Win Boss Battle to unlock the player version for both local players in either mode. The victory and roster screens show the unlock, which persists in that browser at that game address. Old victories from before the unlock feature were not recorded.

Boss tuning lives in `boss.json`: `boss.health` (500), `boss.scale` (1.65), `boss.enrageAt` (0.5), and `boss.chargePerSecond` (14). His `stats`, normal `attack`, and `ultra` fields work like other character packs. Boss armor limits knockback and prevents repeated hits from cancelling his telegraphed attacks. Falling off the page costs Dave 70 HP and respawns him if he survives. At half health he speeds up and charges slime bombs faster.

Playable Dave is a medium-speed fighter (310) with ordinary size, three lives, weight 1.08, and jump speed 710. Claws deal 11 damage, have 110 reach, and take 0.46 seconds between attacks, with a 0.14-second windup. He trades the Swordsman's speed and damage for a little extra reach and slime utility. He has no boss armor, enrage, health bar, or passive ultra charging.

The player's slime bomb deals 18 damage in a 90-pixel radius, slows direct hits for 1.1 seconds, and leaves a 2.5-second puddle. It has the same readable 0.62-second cast windup as the boss, with an aim warning and flight time to dodge. Ordinary combat charges the meter; hitting Dave interrupts his cast. Team filtering prevents friendly damage and slow effects.

The team wins by reducing Dave to zero HP. Each player has three lives; one surviving player can finish the fight. The team loses only when both players are eliminated. Friendly fire is disabled for every move. A simultaneous final defeat is a draw.

See [the character guide](../../../docs/ADDING-CHARACTERS.md).
