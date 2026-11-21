# Tower Forge — Design

A lightweight browser tower defense game. The long-term north star is Path of Exile 2–style depth: skill gems and support links, a passive tree, affixed loot, crafting, and enemy modifiers. This repository currently ships only the small core loop.

## Visual theme

Dark fantasy, PoE-like. Near-black / charcoal ground, a dim stone path, and ember / blood-red / gold accents. All art is simple Phaser shapes (baked into textures at boot). No external assets.

## Pillars

- **Readable combat.** One path, clear shots, numbers you can see (gold, lives, hit points).
- **Data-first content.** Towers, enemies, waves, and the map live in typed data files. Systems look them up by id. New content is a new entry, not a new code path.
- **Modifiable stats.** A tower fights with a small `StatBlock` (`damage`, `attackRate`, `range`) produced by `resolveStats`. Later gems, supports, and affixes hook there — they are not built yet.
- **Cheap to simulate.** Object pools for enemies, projectiles, and beam flashes. No per-frame allocations in the hot loop. Simple range checks are enough at this scale.

## Core loop (this slice)

Place a tower on a buildable grid cell (spend gold) → start a wave → enemies walk a fixed waypoint path → towers shoot the enemy nearest the exit that is in range → kills grant gold, leaks cost lives → clear five waves to win, or hit zero lives to lose.

## Systems planned

- Skill gems and support links that modify `resolveStats` (and later, extra projectile or ailment behaviour).
- Affixed loot dropped onto the path or from elites, slotted into towers.
- A modest passive tree that grants global or archetype bonuses.
- Crafting / reforging of affixes.
- Enemy modifiers (packs and rares) built as data, the same way waves are today.

## In scope now

Grid map, one path, two tower types, two enemy types, five waves, gold/lives, nearest-to-exit targeting, projectiles or instant hits, HUD, win/lose.

## Out of scope now

Gems, supports, loot, passives, crafting, enemy mods, animations beyond simple shapes, sound, multiple maps, path-building, online features, persistence.
