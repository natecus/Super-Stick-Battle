# Swordsman

Based on `reference.jpeg`: smiling stick figure with a straight sword. Normal attack: sword slash. Ultra: sword spin.

Swordsman is the fast brawler: his 380 px/s run speed lets him catch Archer (340) and Wizard (285), while quick sword slashes reward getting into melee range. His slash starts hitting after 60 ms, can be repeated every 340 ms, and has 380 base knockback. The swing stays active for 160 ms, preserving its window for catching moving opponents. These are a first balance pass; tune them after playing a few matches.

Edit `character.json` for its look, stats, and moves. Animations and portraits come from the shared rig in `../../game/drawing.ts`. See [the character guide](../../../docs/ADDING-CHARACTERS.md).
