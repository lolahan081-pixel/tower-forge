export type GridPos = { col: number; row: number };

export const TILE_SIZE = 48;
export const MAP_COLS = 20;
export const MAP_ROWS = 14;
export const HUD_HEIGHT = 120;
export const GAME_WIDTH = MAP_COLS * TILE_SIZE;
export const GAME_HEIGHT = MAP_ROWS * TILE_SIZE + HUD_HEIGHT;

export const STARTING_GOLD = 100;
export const STARTING_LIVES = 20;

/**
 * Axis-aligned waypoint cells. Enemies walk cell-center to cell-center.
 * The path is rasterized into blocked tiles in `pathTiles`.
 */
export const PATH_WAYPOINTS: readonly GridPos[] = [
  { col: 0, row: 6 },
  { col: 5, row: 6 },
  { col: 5, row: 11 },
  { col: 10, row: 11 },
  { col: 10, row: 2 },
  { col: 16, row: 2 },
  { col: 16, row: 8 },
  { col: 19, row: 8 },
];

export const pathTiles: ReadonlySet<string> = buildPathTiles(PATH_WAYPOINTS);

export function tileKey(col: number, row: number): string {
  return `${col},${row}`;
}

export function isInBounds(col: number, row: number): boolean {
  return col >= 0 && row >= 0 && col < MAP_COLS && row < MAP_ROWS;
}

export function isPathTile(col: number, row: number): boolean {
  return pathTiles.has(tileKey(col, row));
}

export function isBuildableTile(col: number, row: number): boolean {
  return isInBounds(col, row) && !isPathTile(col, row);
}

function buildPathTiles(waypoints: readonly GridPos[]): Set<string> {
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

export function cellCenter(col: number, row: number): { x: number; y: number } {
  return { x: (col + 0.5) * TILE_SIZE, y: (row + 0.5) * TILE_SIZE };
}
