export type GridPos = { col: number; row: number };

export const TILE_SIZE = 48;
export const MAP_COLS = 20;
export const MAP_ROWS = 14;
export const HUD_HEIGHT = 120;
export const GAME_WIDTH = MAP_COLS * TILE_SIZE;
export const GAME_HEIGHT = MAP_ROWS * TILE_SIZE + HUD_HEIGHT;

export const STARTING_GOLD = 100;
export const STARTING_LIVES = 20;

export function tileKey(col: number, row: number): string {
  return `${col},${row}`;
}

export function isInBounds(col: number, row: number): boolean {
  return col >= 0 && row >= 0 && col < MAP_COLS && row < MAP_ROWS;
}

export function isPathTile(col: number, row: number, tiles: ReadonlySet<string>): boolean {
  return tiles.has(tileKey(col, row));
}

export function isBuildableTile(col: number, row: number, tiles: ReadonlySet<string>): boolean {
  return isInBounds(col, row) && !isPathTile(col, row, tiles);
}

/** Rasterize axis-aligned waypoint cells into a blocked-tile set. */
export function buildPathTiles(waypoints: readonly GridPos[]): Set<string> {
  const tiles = new Set<string>();
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    if (!a || !b) continue;
    if (a.col !== b.col && a.row !== b.row) {
      throw new Error(`Path segment ${i} is not axis-aligned`);
    }
    const dc = Math.sign(b.col - a.col);
    const dr = Math.sign(b.row - a.row);
    let c = a.col;
    let r = a.row;
    tiles.add(tileKey(c, r));
    while (c !== b.col || r !== b.row) {
      c += dc;
      r += dr;
      tiles.add(tileKey(c, r));
    }
  }
  return tiles;
}

export function mergePathTiles(paths: readonly (readonly GridPos[])[]): Set<string> {
  const tiles = new Set<string>();
  for (const path of paths) {
    for (const key of buildPathTiles(path)) tiles.add(key);
  }
  return tiles;
}

export function cellCenter(col: number, row: number): { x: number; y: number } {
  return { x: (col + 0.5) * TILE_SIZE, y: (row + 0.5) * TILE_SIZE };
}

const NEIGHBORS: readonly [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** First free stone cell beside the path, used by playtests and the opening hint. */
export function firstBuildableNearPath(
  tiles: ReadonlySet<string>,
  occupied: ReadonlySet<string> = new Set(),
): GridPos {
  for (const key of tiles) {
    const parts = key.split(",");
    const c = Number(parts[0]);
    const r = Number(parts[1]);
    for (const [dc, dr] of NEIGHBORS) {
      const col = c + dc;
      const row = r + dr;
      if (isBuildableTile(col, row, tiles) && !occupied.has(tileKey(col, row))) return { col, row };
    }
  }
  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      if (isBuildableTile(col, row, tiles) && !occupied.has(tileKey(col, row))) return { col, row };
    }
  }
  return { col: 1, row: 1 };
}
