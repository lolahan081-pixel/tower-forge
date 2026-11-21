# Tower Forge — The Ashen Bastion

The last fortress that still guards a gate against the Hollow mist. Dark fantasy palette: near-black charcoal ground, a dim stone path, ember, blood-red, and gold. Simple shapes only; no external art.

## Pillars

- **Frames, not guns.** A placed tower is a frame: sockets, base stats, and a tag (Spire = projectile, Font = spell, Totem = aura). It does not attack until a Sigil is inscribed.
- **Data-first.** Towers, Sigils, Runes, enemies, waves, and (later) Relics, tree nodes, and enemy mods live in typed data files. Systems look them up by id.
- **Modifiable stats.** Combat is a `ResolvedAttack` from `resolveAttack(frame, sigil, runes)`: damage, attack rate, range, plus projectile count, chain, pierce, and conversion. Later Relics and the Ember Lattice hook here too.
- **Permanent ARPG account.** Everything the player owns lives in a stash, as plain serializable records with a unique `uid`. The save is local but portable — groundwork for a later authoritative server and trade.
- **Cheap to simulate.** Pooled enemies and projectiles. No per-frame allocations in the hot loop.

## Core loop (now)

Place a frame → inscribe one Sigil and link Runes in its sockets (Inscription) → start a wave → enemies walk a fixed path → the Sigil fires at the foe nearest the gate → kills grant gold and Sigil/Rune XP → clear the waves or lose the gate.

## Systems

- **Sigils & Runes.** One active Sigil per frame. Runes in the same Inscription apply only when every Rune tag is present on the Sigil. Free swapping. Gems gain XP from that frame’s kills and level up (damage scales). A shop between waves will sell basic Runes and level-1 Sigils; rare and high-level gems only drop.
- **Breach & Depth.** A map is a Breach (~10 waves). Tier is Depth. Clearing grants account XP (passive points) and loot by Depth. Early Depths (1–3) stay relaxed: few mods, generous lives. Difficulty and rewards ramp with Depth. Breaches can later be crafted with enemy mods for more quantity and rarity.
- **Relics.** A tower item, 1–2 slots per frame. Implicit plus random affixes. Normal / Magic (1 prefix + 1 suffix) / Rare (up to 3+3). Prefixes = damage, suffixes = utility. Affix tiers follow item level.
- **Currency (fully random crafting).** Kindle Shard (normal→magic), Ash Mote (add affix to magic), Crown Cinder (magic→rare +1 affix), Sovereign Ember (add affix to rare), Rift Salt (remove one random affix, add one), Null Ash (remove a random affix), Blight Heart (corrupt, unpredictable, locks the item), Unbinding Tear (passive respec).
- **Ember Lattice.** One passive tree. Regions for Spire, Font, and Totem, plus an economy center. Starts at ~40 nodes: small nodes, notables, and 2–3 keystones with sharp trade-offs. Bonuses are global, scoped by tags. Nodes, edges, and effects are data.
- **Enemy mods.** Normal / Magic (1–2 mods) / Rare (3–4, mini-boss) / a Unique boss at the end of a Breach. Mods such as Swift, Cinderhide, Rimehide, Armoured, Regenerating, Splitter, Shielded, Hasted Aura, Proximal Ward. Rares carry a gold/ember outline. Scaling follows Depth.

## In scope now

The core path, two frames (Ember Spire, Blood Font), four Sigils, five Runes, socket UI, starter inventory, XP, and generic projectile / chain / nova / pierce behaviour. Totem frames wait for aura Sigils.

## Out of scope now

Shop, Relics, currency crafting, stash, Breach/Depth progression, save, Ember Lattice, enemy rarity/mods, sound, multiple maps, multiplayer and trade.
