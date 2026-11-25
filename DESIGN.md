# Tower Forge — The Ashen Bastion

The last fortress that still guards a gate against the Hollow mist. Dark fantasy palette: near-black charcoal ground, a dim stone path, ember, blood-red, and gold. Simple shapes only; no external art.

## Pillars

- **Frames, not guns.** A placed tower is a frame: sockets, base stats, and a tag (Spire = projectile, Font = spell, Totem = aura). A newly built frame auto-sockets a free starter Sigil so it can fire immediately; without a Sigil it is inert.
- **Prepare in the Bastion, fight in the Breach.** Runes, Relics, and the Ember Lattice are set in the hub, per tower type. In battle only the main Sigil can be swapped.
- **Ease in.** A main menu greets the player. Features unlock one by one as Depths are cleared, so the first Breach is only frames and a Sigil. Locked Bastion tabs stay visible with a lock and a “Clear Depth N” hint. Drops never grant a type that is still locked.
- **Data-first.** Towers, Sigils, Runes, Relics, affixes, currency, drops, Depths, Lattice nodes, unlocks, enemies, and enemy mods live in typed data files and are looked up by id.
- **Modifiable stats.** Combat is a `ResolvedAttack` from `resolveLoadout(frame, sigil, runes, relics, extra)`: damage, rate, range, projectiles, chain, pierce, conversion, and gold. Relics and Lattice nodes fold in here, scoped by tags where needed.
- **Permanent ARPG account.** Items, gems, and currency are serializable records with a `uid`, saved in `localStorage`.
- **Cheap to simulate.** Pooled enemies and projectiles. No per-frame allocations in the hot loop.

## Core loop

Main menu (Start / Continue, Bastion, How to Play, Settings) → optionally prepare in the Bastion → pick a Depth → Enter Breach (~10 waves, Unique boss on the last) → place frames → optionally swap the Sigil → fight, shop between waves, auto-collect spoils → clear for account XP and Lattice points, unlock the next Depth and any new systems, take spoils into the stash. Menu is reachable from the hub and from a Breach.

## Unlock order

- Start: frames, main Sigil swap, Depth 1 only. No shop Runes.
- Clear Depth 1: Runes, Bastion inscription, shop Runes.
- Clear Depth 2: Relics and the Stash.
- Clear Depth 3: Ember Forge (currency can drop) and enemy pack mods.
- Clear Depth 4: Ember Lattice.

Conditions and tutorial copy live in `src/data/unlocks.ts`. Existing saves inherit whatever their clear depth already implies; they are not shown catch-up popups.

## Systems

- **Sigils & Runes.** One active Sigil per frame, swapped in battle. Loadout Runes apply only when every Rune tag is on the current Sigil. Gems gain XP from that frame’s kills.
- **Shop.** Between waves, basic level-1 Sigils for gold; Runes join the stall once unlocked. Rare and high-level gems are drop-only.
- **Relics & affixes.** 1–2 slots per frame type. Bases have implicits. Normal / Magic (1 prefix + 1 suffix) / Rare (up to 3+3). Prefixes = damage, suffixes = utility. Affix tiers follow item level. Equipped Relics change resolved stats.
- **Drops.** Enemies drop Relics, Sigils, Runes, and currency (weights in data; rares and the boss drop more). Locked types are omitted. Loot auto-collects into spoils, shown at the end of a Breach, then moves to the stash.
- **Currency (fully random crafting).** Kindle Shard, Ash Mote, Crown Cinder, Sovereign Ember, Rift Salt, Null Ash, Blight Heart (corrupt, then locks), Unbinding Tear (Lattice respec). Used at the Ember Forge once it is open.
- **Stash & Depth.** Stash lists all items, gems, and currency. Depths 1–10; early Depths (1–3) are relaxed. HP, count, gold, and pack-mod chance scale with Depth. Clearing awards account XP and unspent Lattice points.
- **Ember Lattice.** ~40 nodes: Spire (projectile), Font (spell), Totem (aura, future-facing), and an economy center. Small nodes, notables, and three trade-off keystones (Ashen Volley, Sanguine Font, Crown of Cinders). Bind adjacent nodes with points. Bonuses are global or tag-scoped.
- **Enemy rarity.** After Depth 3: Normal / Magic (1–2 mods) / Rare (3–4, ember outline) / Unique boss (Hollow Sovereign). Mods: Fleet Ash, Cinder Hide, Rime Hide, Slag Plate, Smoldering, Cinder Split, Ward Shell, Haste Paean, Close Ward.

## Out of scope / deferred

Sound, multiple maps, aura Totem frames, multiplayer and trade. Droppable/craftable Breach map items with quantity/rarity mods are deferred — Depth is selected directly.
