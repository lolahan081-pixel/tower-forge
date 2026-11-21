# Tower Forge — The Ashen Bastion

The last fortress that still guards a gate against the Hollow mist. Dark fantasy palette: near-black charcoal ground, a dim stone path, ember, blood-red, and gold. Simple shapes only; no external art.

## Pillars

- **Frames, not guns.** A placed tower is a frame: sockets, base stats, and a tag (Spire = projectile, Font = spell, Totem = aura). A newly built frame auto-sockets a free starter Sigil so it can fire immediately; without a Sigil it is inert.
- **Prepare in the Bastion, fight in the Breach.** Runes, Relics, and the Ember Lattice are set in the hub, per tower type. In battle only the main Sigil can be swapped.
- **Data-first.** Towers, Sigils, Runes, Relics, affixes, currency, drops, Depths, Lattice nodes, enemies, and enemy mods live in typed data files and are looked up by id.
- **Modifiable stats.** Combat is a `ResolvedAttack` from `resolveLoadout(frame, sigil, runes, relics, extra)`: damage, rate, range, projectiles, chain, pierce, conversion, and gold. Relics and Lattice nodes fold in here, scoped by tags where needed.
- **Permanent ARPG account.** Items, gems, and currency are serializable records with a `uid`, saved in `localStorage`.
- **Cheap to simulate.** Pooled enemies and projectiles. No per-frame allocations in the hot loop.

## Core loop

In the Bastion, set Runes and Relics, bind Lattice nodes, and pick a Depth → Enter Breach (~10 waves, Unique boss on the last) → place frames → optionally swap the Sigil → fight, shop for basic gems between waves, auto-collect spoils → clear for account XP and Lattice points, unlock the next Depth, take spoils into the stash.

## Systems

- **Sigils & Runes.** One active Sigil per frame, swapped in battle. Loadout Runes apply only when every Rune tag is on the current Sigil. Gems gain XP from that frame’s kills.
- **Shop.** Between waves, basic Runes and level-1 Sigils for gold. Rare and high-level gems are drop-only.
- **Relics & affixes.** 1–2 slots per frame type. Bases have implicits. Normal / Magic (1 prefix + 1 suffix) / Rare (up to 3+3). Prefixes = damage, suffixes = utility. Affix tiers follow item level. Equipped Relics change resolved stats.
- **Drops.** Enemies drop Relics, Sigils, Runes, and currency (weights in data; rares and the boss drop more). Loot auto-collects into spoils, shown at the end of a Breach, then moves to the stash.
- **Currency (fully random crafting).** Kindle Shard, Ash Mote, Crown Cinder, Sovereign Ember, Rift Salt, Null Ash, Blight Heart (corrupt, then locks), Unbinding Tear (Lattice respec). Used at the Ember Forge.
- **Stash & Depth.** Stash lists all items, gems, and currency. Depths 1–10; early Depths (1–3) are relaxed. HP, count, gold, and pack-mod chance scale with Depth. Clearing awards account XP and unspent Lattice points.
- **Ember Lattice.** ~40 nodes: Spire (projectile), Font (spell), Totem (aura, future-facing), and an economy center. Small nodes, notables, and three trade-off keystones (Ashen Volley, Sanguine Font, Crown of Cinders). Bind adjacent nodes with points. Bonuses are global or tag-scoped.
- **Enemy rarity.** Normal / Magic (1–2 mods) / Rare (3–4, ember outline) / Unique boss (Hollow Sovereign). Mods: Fleet Ash, Cinder Hide, Rime Hide, Slag Plate, Smoldering, Cinder Split, Ward Shell, Haste Paean, Close Ward.

## Out of scope / deferred

Sound, multiple maps, aura Totem frames, multiplayer and trade. Droppable/craftable Breach map items with quantity/rarity mods are deferred — Depth is selected directly.
