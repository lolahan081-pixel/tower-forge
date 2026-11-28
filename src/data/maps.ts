import { buildPathTiles, mergePathTiles, tileKey, MAP_COLS, MAP_ROWS, type GridPos } from "./map";

export type MapLayoutId =
  | "cinder-approach"
  | "kindling-lane"
  | "ford-of-shards"
  | "slag-ditch"
  | "twin-ash-roads"
  | "ash-cataract"
  | "forked-circlet"
  | "ashen-spine"
  | "hollow-stair"
  | "veil-switch"
  | "named-circuit"
  | "final-watch";

export type MapLayout = {
  id: MapLayoutId;
  name: string;
  flavor: string;
  /** One or more axis-aligned spawn paths. Shared end cells are a single gate. */
  paths: readonly (readonly GridPos[])[];
  tiles: ReadonlySet<string>;
};

/** Battle MENU occupies this cell block; no path tile may sit here. */
const MENU_COLS = { lo: 0, hi: 3 };
const MENU_ROWS = { lo: 0, hi: 1 };

function layout(
  id: MapLayoutId,
  name: string,
  flavor: string,
  paths: readonly (readonly GridPos[])[],
): MapLayout {
  for (const path of paths) {
    if (path.length < 2) throw new Error(`Layout ${id} has a path that is too short`);
    buildPathTiles(path);
  }
  const tiles = mergePathTiles(paths);
  const ends = paths.map((p) => p[p.length - 1]).filter((c): c is GridPos => !!c);
  const gate = ends[0];
  if (gate) {
    for (const end of ends) {
      if (end.col !== gate.col || end.row !== gate.row) {
        throw new Error(`Layout ${id} paths do not share a single gate`);
      }
    }
  }
  for (const key of tiles) {
    const [cs, rs] = key.split(",");
    const c = Number(cs);
    const r = Number(rs);
    if (c >= MENU_COLS.lo && c <= MENU_COLS.hi && r >= MENU_ROWS.lo && r <= MENU_ROWS.hi) {
      throw new Error(`Layout ${id} overlaps the battle MENU at ${key}`);
    }
  }
  return { id, name, flavor, paths, tiles };
}

export const MAP_LAYOUTS: Record<MapLayoutId, MapLayout> = {
  "cinder-approach": layout(
    "cinder-approach",
    "Cinder Approach",
    "A short, scarred road to the gate. The first lesson is to hold the line.",
    [
      [
        { col: 0, row: 7 },
        { col: 6, row: 7 },
        { col: 6, row: 10 },
        { col: 14, row: 10 },
        { col: 14, row: 6 },
        { col: 19, row: 6 },
      ],
    ],
  ),
  "kindling-lane": layout(
    "kindling-lane",
    "Kindling Lane",
    "A higher cut of the old approach, then a long drop toward the gate.",
    [
      [
        { col: 0, row: 4 },
        { col: 11, row: 4 },
        { col: 11, row: 8 },
        { col: 4, row: 8 },
        { col: 4, row: 11 },
        { col: 19, row: 11 },
      ],
    ],
  ),
  "ford-of-shards": layout(
    "ford-of-shards",
    "Ford of Shards",
    "The road folds once, then again, like a blade broken at the river.",
    [
      [
        { col: 0, row: 3 },
        { col: 5, row: 3 },
        { col: 5, row: 11 },
        { col: 11, row: 11 },
        { col: 11, row: 3 },
        { col: 17, row: 3 },
        { col: 17, row: 8 },
        { col: 19, row: 8 },
      ],
    ],
  ),
  "slag-ditch": layout(
    "slag-ditch",
    "Slag Ditch",
    "A scorched trench that zigzags the length of the field, still holding old heat.",
    [
      [
        { col: 0, row: 3 },
        { col: 3, row: 3 },
        { col: 3, row: 12 },
        { col: 8, row: 12 },
        { col: 8, row: 2 },
        { col: 13, row: 2 },
        { col: 13, row: 12 },
        { col: 17, row: 12 },
        { col: 17, row: 6 },
        { col: 19, row: 6 },
      ],
    ],
  ),
  "twin-ash-roads": layout(
    "twin-ash-roads",
    "Twin Ash Roads",
    "Two columns of mist walk the same ending. Watch both roads.",
    [
      [
        { col: 0, row: 3 },
        { col: 6, row: 3 },
        { col: 6, row: 5 },
        { col: 13, row: 5 },
        { col: 13, row: 7 },
        { col: 19, row: 7 },
      ],
      [
        { col: 0, row: 12 },
        { col: 6, row: 12 },
        { col: 6, row: 9 },
        { col: 13, row: 9 },
        { col: 13, row: 7 },
        { col: 19, row: 7 },
      ],
    ],
  ),
  "ash-cataract": layout(
    "ash-cataract",
    "Ash Cataract",
    "The road falls in shelves of cinder, left then right, down to the gate.",
    [
      [
        { col: 0, row: 3 },
        { col: 15, row: 3 },
        { col: 15, row: 6 },
        { col: 3, row: 6 },
        { col: 3, row: 9 },
        { col: 15, row: 9 },
        { col: 15, row: 12 },
        { col: 8, row: 12 },
        { col: 8, row: 7 },
        { col: 19, row: 7 },
      ],
    ],
  ),
  "forked-circlet": layout(
    "forked-circlet",
    "Forked Circlet",
    "Two roads cross at the heart of the field, then part, then meet at the gate.",
    [
      [
        { col: 0, row: 3 },
        { col: 8, row: 3 },
        { col: 8, row: 7 },
        { col: 14, row: 7 },
        { col: 14, row: 4 },
        { col: 18, row: 4 },
        { col: 18, row: 7 },
        { col: 19, row: 7 },
      ],
      [
        { col: 0, row: 12 },
        { col: 8, row: 12 },
        { col: 8, row: 7 },
        { col: 14, row: 7 },
        { col: 14, row: 11 },
        { col: 18, row: 11 },
        { col: 18, row: 7 },
        { col: 19, row: 7 },
      ],
    ],
  ),
  "ashen-spine": layout(
    "ashen-spine",
    "Ashen Spine",
    "A winding circuit around a dead throne of cinder, then out through the gate.",
    [
      [
        { col: 0, row: 3 },
        { col: 16, row: 3 },
        { col: 16, row: 11 },
        { col: 3, row: 11 },
        { col: 3, row: 5 },
        { col: 12, row: 5 },
        { col: 12, row: 8 },
        { col: 19, row: 8 },
      ],
    ],
  ),
  "hollow-stair": layout(
    "hollow-stair",
    "Hollow Stair",
    "A stepped climb from the lower ash, each landing another chance to hold.",
    [
      [
        { col: 0, row: 12 },
        { col: 2, row: 12 },
        { col: 2, row: 10 },
        { col: 5, row: 10 },
        { col: 5, row: 8 },
        { col: 8, row: 8 },
        { col: 8, row: 6 },
        { col: 11, row: 6 },
        { col: 11, row: 3 },
        { col: 16, row: 3 },
        { col: 16, row: 12 },
        { col: 12, row: 12 },
        { col: 12, row: 7 },
        { col: 19, row: 7 },
      ],
    ],
  ),
  "veil-switch": layout(
    "veil-switch",
    "Veil Switch",
    "A long switchback drowned in mist, and a second column that joins it late.",
    [
      [
        { col: 0, row: 3 },
        { col: 4, row: 3 },
        { col: 4, row: 12 },
        { col: 9, row: 12 },
        { col: 9, row: 2 },
        { col: 14, row: 2 },
        { col: 14, row: 11 },
        { col: 17, row: 11 },
        { col: 17, row: 7 },
        { col: 19, row: 7 },
      ],
      [
        { col: 0, row: 9 },
        { col: 14, row: 9 },
        { col: 14, row: 11 },
        { col: 17, row: 11 },
        { col: 17, row: 7 },
        { col: 19, row: 7 },
      ],
    ],
  ),
  "named-circuit": layout(
    "named-circuit",
    "Named Circuit",
    "A long inner circuit under a name that was once a king's, plus a midland spawn.",
    [
      [
        { col: 0, row: 3 },
        { col: 17, row: 3 },
        { col: 17, row: 12 },
        { col: 2, row: 12 },
        { col: 2, row: 5 },
        { col: 14, row: 5 },
        { col: 14, row: 9 },
        { col: 6, row: 9 },
        { col: 6, row: 7 },
        { col: 19, row: 7 },
      ],
      [
        { col: 0, row: 8 },
        { col: 6, row: 8 },
        { col: 6, row: 7 },
        { col: 19, row: 7 },
      ],
    ],
  ),
  "final-watch": layout(
    "final-watch",
    "Final Watch",
    "Three roads, one ending. The farthest gate on this Atlas has no further path.",
    [
      [
        { col: 0, row: 3 },
        { col: 7, row: 3 },
        { col: 7, row: 6 },
        { col: 13, row: 6 },
        { col: 13, row: 7 },
        { col: 19, row: 7 },
      ],
      [
        { col: 0, row: 8 },
        { col: 7, row: 8 },
        { col: 7, row: 6 },
        { col: 13, row: 6 },
        { col: 13, row: 7 },
        { col: 19, row: 7 },
      ],
      [
        { col: 0, row: 12 },
        { col: 16, row: 12 },
        { col: 16, row: 7 },
        { col: 19, row: 7 },
      ],
    ],
  ),
};

export const MAP_LAYOUT_IDS: readonly MapLayoutId[] = [
  "cinder-approach",
  "kindling-lane",
  "ford-of-shards",
  "slag-ditch",
  "twin-ash-roads",
  "ash-cataract",
  "forked-circlet",
  "ashen-spine",
  "hollow-stair",
  "veil-switch",
  "named-circuit",
  "final-watch",
];

export function isMapLayoutId(value: string): value is MapLayoutId {
  return Object.prototype.hasOwnProperty.call(MAP_LAYOUTS, value);
}

export function getMapLayout(id: MapLayoutId): MapLayout {
  return MAP_LAYOUTS[id];
}

export function layoutBuildableCount(layout: MapLayout): number {
  let n = 0;
  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      if (!layout.tiles.has(tileKey(col, row))) n += 1;
    }
  }
  return n;
}
