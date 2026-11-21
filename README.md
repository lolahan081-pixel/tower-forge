# Tower Forge

The Ashen Bastion, a small browser tower defense game (Phaser 3 + Vite + TypeScript). See `DESIGN.md` and `TODO.md`.

```bash
npm install
npm run dev
```

- Tap a frame type, then tap a stone (non-path) cell to build. A new frame starts with a starter Sigil and will fire on its own.
- Tap a placed frame, or Inscribe, to open sockets. Tap a gem, then a socket. Tap Unsocket to return a gem.
- Tap Start Wave to send the next wave.
- Keyboard shortcuts (optional): `1` / `2` select a frame, `SPACE` starts a wave, `Esc` closes the panel.

Best on a landscape phone or desktop. `npm run build` type-checks and bundles to `dist/`.
