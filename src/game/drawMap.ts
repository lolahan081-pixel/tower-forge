import Phaser from "phaser";
import { HUD_HEIGHT, MAP_COLS, MAP_ROWS, TILE_SIZE, GAME_WIDTH, GAME_HEIGHT, isPathTile } from "../data/map";
import type { MapLayout } from "../data/maps";
import { Palette } from "../palette";

export function drawBoard(scene: Phaser.Scene, layout: MapLayout): void {
  const g = scene.add.graphics().setDepth(0);
  const tiles = layout.tiles;

  g.fillStyle(Palette.ground, 1);
  g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  g.fillStyle(Palette.groundAlt, 1);
  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      if ((col + row) % 2 === 0) continue;
      g.fillRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }

  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      if (!isPathTile(col, row, tiles)) continue;
      const x = col * TILE_SIZE;
      const y = row * TILE_SIZE;
      g.fillStyle(Palette.pathEdge, 1);
      g.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      g.fillStyle(Palette.path, 1);
      g.fillRect(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6);
      g.fillStyle(Palette.pathInner, 0.55);
      g.fillRect(x + 8, y + 8, TILE_SIZE - 16, TILE_SIZE - 16);
    }
  }

  g.lineStyle(1, Palette.grid, 0.7);
  for (let c = 0; c <= MAP_COLS; c++) {
    g.lineBetween(c * TILE_SIZE, 0, c * TILE_SIZE, MAP_ROWS * TILE_SIZE);
  }
  for (let r = 0; r <= MAP_ROWS; r++) {
    g.lineBetween(0, r * TILE_SIZE, MAP_COLS * TILE_SIZE, r * TILE_SIZE);
  }

  for (const path of layout.paths) {
    const start = path[0];
    if (!start) continue;
    g.fillStyle(Palette.goldDim, 0.85);
    g.fillCircle((start.col + 0.5) * TILE_SIZE, (start.row + 0.5) * TILE_SIZE, 7);
  }
  const first = layout.paths[0];
  const end = first?.[first.length - 1];
  if (end) {
    g.fillStyle(Palette.bloodBright, 0.9);
    g.fillCircle((end.col + 0.5) * TILE_SIZE, (end.row + 0.5) * TILE_SIZE, 7);
  }

  g.fillStyle(0x08070a, 0.96);
  g.fillRect(0, MAP_ROWS * TILE_SIZE, GAME_WIDTH, HUD_HEIGHT);
  g.lineStyle(1, Palette.stoneLight, 0.8);
  g.lineBetween(0, MAP_ROWS * TILE_SIZE, GAME_WIDTH, MAP_ROWS * TILE_SIZE);
}

/** Draw a compact path preview of a layout into a graphics object. */
export function drawPathPreview(
  g: Phaser.GameObjects.Graphics,
  layout: MapLayout,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  g.clear();
  g.fillStyle(Palette.ground, 1);
  g.fillRect(x, y, w, h);
  g.lineStyle(1, Palette.goldDim, 0.8);
  g.strokeRect(x, y, w, h);
  const pad = 8;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const cell = Math.min(innerW / MAP_COLS, innerH / MAP_ROWS);
  const ox = x + pad + (innerW - cell * MAP_COLS) * 0.5;
  const oy = y + pad + (innerH - cell * MAP_ROWS) * 0.5;
  g.fillStyle(Palette.groundAlt, 1);
  g.fillRect(ox, oy, cell * MAP_COLS, cell * MAP_ROWS);
  g.fillStyle(Palette.path, 1);
  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      if (!isPathTile(col, row, layout.tiles)) continue;
      g.fillRect(ox + col * cell, oy + row * cell, Math.max(1, cell), Math.max(1, cell));
    }
  }
  for (const path of layout.paths) {
    const start = path[0];
    if (!start) continue;
    g.fillStyle(Palette.goldBright, 1);
    g.fillCircle(ox + (start.col + 0.5) * cell, oy + (start.row + 0.5) * cell, Math.max(2, cell * 0.4));
  }
  const path0 = layout.paths[0];
  const end = path0?.[path0.length - 1];
  if (end) {
    g.fillStyle(Palette.bloodBright, 1);
    g.fillCircle(ox + (end.col + 0.5) * cell, oy + (end.row + 0.5) * cell, Math.max(2, cell * 0.4));
  }
}
