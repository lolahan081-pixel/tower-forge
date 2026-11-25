import { buildPathTiles, mergePathTiles, type GridPos } from "./map";

export type MapLayoutId = "cinder-approach" | "riven-switchback" | "twin-ash-roads" | "hollow-crown";

export type MapLayout = {
  id: MapLayoutId;
  name: string;
  flavor: string;
  /** One or more axis-aligned spawn paths. Shared end cells are a single gate. */
  paths: readonly (readonly GridPos[])[];
  tiles: ReadonlySet<string>;
};

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
  return { id, name, flavor, paths, tiles: mergePathTiles(paths) };
}

export const MAP_LAYOUTS: Record<MapLayoutId, MapLayout> = {
  "cinder-approach": layout(
    "cinder-approach",
    "Cinder Approach",
    "The old road to the gate, scored by a thousand last stands.",
    [
      [
        { col: 0, row: 6 },
        { col: 5, row: 6 },
        { col: 5, row: 11 },
        { col: 10, row: 11 },
        { col: 10, row: 2 },
        { col: 16, row: 2 },
        { col: 16, row: 8 },
        { col: 19, row: 8 },
      ],
    ],
  ),
  "riven-switchback": layout(
    "riven-switchback",
    "Riven Switchback",
    "A scar in the stone that folds back on itself like a broken blade.",
    [
      [
        { col: 0, row: 3 },
        { col: 3, row: 3 },
        { col: 3, row: 11 },
        { col: 8, row: 11 },
        { col: 8, row: 2 },
        { col: 14, row: 2 },
        { col: 14, row: 12 },
        { col: 18, row: 12 },
        { col: 18, row: 7 },
        { col: 19, row: 7 },
      ],
    ],
  ),
  "twin-ash-roads": layout(
    "twin-ash-roads",
    "Twin Ash Roads",
    "Two columns of mist walk the same ending.",
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
  "hollow-crown": layout(
    "hollow-crown",
    "The Hollow Crown",
    "A winding circuit around a throne of cinder, then out through the gate.",
    [
      [
        { col: 0, row: 2 },
        { col: 17, row: 2 },
        { col: 17, row: 12 },
        { col: 2, row: 12 },
        { col: 2, row: 4 },
        { col: 14, row: 4 },
        { col: 14, row: 10 },
        { col: 5, row: 10 },
        { col: 5, row: 6 },
        { col: 19, row: 6 },
      ],
    ],
  ),
};

export const MAP_LAYOUT_IDS: readonly MapLayoutId[] = [
  "cinder-approach",
  "riven-switchback",
  "twin-ash-roads",
  "hollow-crown",
];

export function isMapLayoutId(value: string): value is MapLayoutId {
  return Object.prototype.hasOwnProperty.call(MAP_LAYOUTS, value);
}

export function getMapLayout(id: MapLayoutId): MapLayout {
  return MAP_LAYOUTS[id];
}
