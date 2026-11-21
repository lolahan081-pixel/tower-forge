import Phaser from "phaser";
import {
  HUD_HEIGHT,
  MAP_COLS,
  MAP_ROWS,
  PATH_WAYPOINTS,
  TILE_SIZE,
  GAME_WIDTH,
  GAME_HEIGHT,
  isPathTile,
} from "../data/map";
import { Palette } from "../palette";

export function drawBoard(scene: Phaser.Scene): void {
  const g = scene.add.graphics().setDepth(0);

  // Checkerboard ground in near-black charcoal.
  g.fillStyle(Palette.ground, 1);
  g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  g.fillStyle(Palette.groundAlt, 1);
  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      if ((col + row) % 2 === 0) continue;
      g.fillRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }

  // Dim stone path with a slightly lighter edge.
  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      if (!isPathTile(col, row)) continue;
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

  // Subtle grid on buildable ground.
  g.lineStyle(1, Palette.grid, 0.7);
  for (let c = 0; c <= MAP_COLS; c++) {
    g.lineBetween(c * TILE_SIZE, 0, c * TILE_SIZE, MAP_ROWS * TILE_SIZE);
  }
  for (let r = 0; r <= MAP_ROWS; r++) {
    g.lineBetween(0, r * TILE_SIZE, MAP_COLS * TILE_SIZE, r * TILE_SIZE);
  }

  // Spawn / exit marks.
  const start = PATH_WAYPOINTS[0];
  const end = PATH_WAYPOINTS[PATH_WAYPOINTS.length - 1];
  if (start) {
    g.fillStyle(Palette.goldDim, 0.85);
    g.fillCircle((start.col + 0.5) * TILE_SIZE, (start.row + 0.5) * TILE_SIZE, 7);
  }
  if (end) {
    g.fillStyle(Palette.bloodBright, 0.9);
    g.fillCircle((end.col + 0.5) * TILE_SIZE, (end.row + 0.5) * TILE_SIZE, 7);
  }

  // HUD backdrop.
  g.fillStyle(0x08070a, 0.96);
  g.fillRect(0, MAP_ROWS * TILE_SIZE, GAME_WIDTH, HUD_HEIGHT);
  g.lineStyle(1, Palette.stoneLight, 0.8);
  g.lineBetween(0, MAP_ROWS * TILE_SIZE, GAME_WIDTH, MAP_ROWS * TILE_SIZE);
}
