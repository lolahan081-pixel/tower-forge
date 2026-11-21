# Tower Forge

The Ashen Bastion, a small browser tower defense game (Phaser 3 + Vite + TypeScript). See `DESIGN.md` and `TODO.md`.

```bash
npm install
npm run dev
```

- In the Bastion, pick a frame type, socket Runes into its loadout, then Enter Breach.
- In battle, tap a frame type, then tap a stone (non-path) cell to build. A new frame starts with a starter Sigil and uses that type’s loadout.
- Tap a placed frame, or Sigil, to swap the main skill gem. Loadout Runes are read-only in battle.
- Tap Start Wave to send the next wave. After a win or loss, return to the Bastion.
- Keyboard shortcuts (optional): `1` / `2` select a frame, `SPACE` starts a wave, `Esc` closes the panel.

Best on a landscape phone or desktop. `npm run build` type-checks and bundles to `dist/`. Loadouts are saved in the browser.
