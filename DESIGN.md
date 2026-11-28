# Tower Forge — The Ashen Bastion

The last fortress that still guards a gate against the Hollow mist. Dark fantasy palette: near-black charcoal ground, a dim stone path, ember, blood-red, frost cyan, and gold.

## Pillars

- **Frames, not guns.** A placed tower is a frame: sockets, base stats, and a tag (Spire = projectile, Font = spell, Totem = aura). A newly built frame auto-sockets a free starter Sigil so it can fire immediately; without a Sigil it is inert.
- **Prepare in the Bastion, fight in the Breach.** Runes, Relics, and the Ember Lattice are set in the hub, per tower type. In battle only the main Sigil can be swapped.
- **Ease in.** A main menu greets the player. Features unlock one by one as Depths are cleared, so the first Breach is only frames and a Sigil. Locked Bastion tabs stay visible with a lock and a “Clear Depth N” hint. Drops never grant a type that is still locked.
- **Data-first.** Towers, Sigils, Runes, Relics, affixes, currency, drops, Depths, Atlas nodes, map layouts, Lattice nodes, unlocks, enemies, and enemy mods live in typed data files and are looked up by id.
- **Modifiable stats.** Combat is a `ResolvedAttack` from `resolveLoadout(frame, sigil, runes, relics, extra)`: damage, rate, range, projectiles, chain, pierce, conversion, and gold. Relics and Lattice nodes fold in here, scoped by tags where needed.
- **Permanent ARPG account.** Items, gems, and currency are serializable records with a `uid`, saved in `localStorage`.
- **Cheap to simulate.** Pooled enemies, projectiles, and short FX. No per-frame allocations in the hot loop.
- **Pixel art, staged.** Stage 1 uses one original 16-color-or-less spritesheet (`public/atlas.png`, built by `scripts/build-atlas.mjs` from typed pixel grids — no downloaded art). Icons are 16×16; frames ~32px; the Hollow Sovereign is 48px. The game runs with `pixelArt: true` (nearest-neighbor). Sprite keys come from data (`icon` / `sprite` / anim fields); baked shape textures remain as fallbacks if a frame is missing.

## Core loop

Main menu (Start / Continue, Bastion, How to Play, Settings) → optionally prepare in the Bastion → open the Ember Atlas and pick a node → Enter Breach (~10 waves, Unique boss on the last) → place frames → optionally swap the Sigil → fight, shop between waves, auto-collect spoils → clear the node to unlock its neighbors, award account XP and Lattice points, unlock any new systems, take spoils into the stash. Menu is reachable from the hub and from a Breach.

## Unlock order

- Start: frames, main Sigil swap, Ash Gate (Depth 1) only. No shop Runes.
- Clear Depth 1: Runes, Bastion inscription, shop Runes.
- Clear Depth 2: Relics and the Stash.
- Clear Depth 3: Ember Forge (currency can drop) and enemy pack mods.
- Clear Depth 4: Ember Lattice.

Conditions and tutorial copy live in `src/data/unlocks.ts`. Existing saves inherit whatever their clear depth already implies; they are not shown catch-up popups. Old Depth progress is also mapped onto cleared Atlas nodes.

## Systems

- **Sigils & Runes.** One active Sigil per frame, swapped in battle. Loadout Runes apply only when every Rune tag is on the current Sigil. Gems gain XP from that frame’s kills.
- **Shop.** Between waves, the Ashen Peddler sells basic level-1 Sigils for gold (with a short first-time explanation); Runes join the stall once unlocked. Bought Sigils go to the bag and are swapped with the SIGIL button. Rare and high-level gems are drop-only.
- **Relics & affixes.** 1–2 slots per frame type. Bases have implicits. Normal / Magic (1 prefix + 1 suffix) / Rare (up to 3+3). Prefixes = damage, suffixes = utility. Affix tiers follow item level. Equipped Relics change resolved stats.
- **Drops.** Enemies drop Relics, Sigils, Runes, and currency (weights in data; rares and the boss drop more). Locked types are omitted. Loot auto-collects into spoils, shown at the end of a Breach, then moves to the stash.
- **Currency (fully random crafting).** Kindle Shard, Ash Mote, Crown Cinder, Sovereign Ember, Rift Salt, Null Ash, Blight Heart (corrupt, then locks), Unbinding Tear (Lattice respec). Used at the Ember Forge once it is open.
- **Stash & Depth.** Stash lists all items, gems, and currency. Node Depth (1–10) scales lives, HP, counts, gold, and pack-mod chance. Early Depths (1–3) are relaxed. Clearing awards account XP and unspent Lattice points.
- **Ember Atlas.** A small campaign graph (~12 nodes) over four map layouts (Cinder Approach, Riven Switchback, Twin Ash Roads, The Hollow Crown). Clearing a node unlocks its neighbors; Depth rises farther from the Ash Gate. Twin Ash Roads has two spawn paths that share a gate. Designed so a story layer can be added later.
- **Ember Lattice.** ~40 nodes: Spire (projectile), Font (spell), Totem (aura, future-facing), and an economy center. Small nodes, notables, and three trade-off keystones (Ashen Volley, Sanguine Font, Crown of Cinders). Bind adjacent nodes with points. Bonuses are global or tag-scoped.
- **Enemy rarity.** After Depth 3: Normal / Magic (1–2 mods) / Rare (3–4, ember outline) / Unique boss (Hollow Sovereign). Mods: Fleet Ash, Cinder Hide, Rime Hide, Slag Plate, Smoldering, Cinder Split, Ward Shell, Haste Paean, Close Ward.

## Out of scope / deferred

Sound, aura Totem frames, multiplayer and trade. Droppable/craftable Breach map items with quantity/rarity mods are deferred — the Atlas is the campaign map for now.
