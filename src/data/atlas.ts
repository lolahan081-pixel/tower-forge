import { getMapLayout, isMapLayoutId, type MapLayout, type MapLayoutId } from "./maps";

export type AtlasNodeId = string;

export type AtlasNodeDef = {
  id: AtlasNodeId;
  layoutId: MapLayoutId;
  depth: number;
  x: number;
  y: number;
  name: string;
  flavor: string;
  neighbors: readonly AtlasNodeId[];
};

function node(
  id: AtlasNodeId,
  layoutId: MapLayoutId,
  depth: number,
  x: number,
  y: number,
  name: string,
  flavor: string,
  neighbors: readonly AtlasNodeId[],
): AtlasNodeDef {
  if (!isMapLayoutId(layoutId)) throw new Error(`Unknown layout ${layoutId}`);
  return { id, layoutId, depth, x, y, name, flavor, neighbors };
}

/**
 * A small campaign atlas. Clearing a node unlocks its neighbors.
 * Depth rises farther from the start. Each node has its own path layout.
 * Story hooks can be added later without changing the graph shape.
 */
export const ATLAS_NODES: Record<string, AtlasNodeDef> = {
  "ash-gate": node(
    "ash-gate",
    "cinder-approach",
    1,
    80,
    300,
    "Ash Gate",
    "The first road to the bastion. Hold it, and the rest of the Atlas opens.",
    ["ember-cut"],
  ),
  "ember-cut": node(
    "ember-cut",
    "kindling-lane",
    2,
    200,
    300,
    "Ember Cut",
    "A higher lane, already warming under the mist. The drop comes late.",
    ["ash-gate", "riven-ford"],
  ),
  "riven-ford": node(
    "riven-ford",
    "ford-of-shards",
    3,
    320,
    300,
    "Riven Ford",
    "The path folds back on itself. Choose the ditch or the twin roads beyond.",
    ["ember-cut", "slag-ditch", "twin-march"],
  ),
  "slag-ditch": node(
    "slag-ditch",
    "slag-ditch",
    4,
    440,
    150,
    "Slag Ditch",
    "A scorched trench along the switchback, still holding the heat of old sieges.",
    ["riven-ford", "cinder-fall"],
  ),
  "twin-march": node(
    "twin-march",
    "twin-ash-roads",
    4,
    440,
    450,
    "Twin March",
    "Two columns of the Hollow take the same ending. Watch both roads.",
    ["riven-ford", "split-crown"],
  ),
  "cinder-fall": node(
    "cinder-fall",
    "ash-cataract",
    5,
    560,
    150,
    "Cinder Fall",
    "The road falls in shelves of cinder, steeper and closer to the gate's fire.",
    ["slag-ditch", "ashen-spine"],
  ),
  "split-crown": node(
    "split-crown",
    "forked-circlet",
    5,
    560,
    450,
    "Split Crown",
    "Two roads cross at the heart of the field, then part, then meet.",
    ["twin-march", "ashen-spine"],
  ),
  "ashen-spine": node(
    "ashen-spine",
    "ashen-spine",
    6,
    680,
    150,
    "Ashen Spine",
    "A winding circuit around a dead throne of cinder.",
    ["cinder-fall", "split-crown", "hollow-stair"],
  ),
  "hollow-stair": node(
    "hollow-stair",
    "hollow-stair",
    7,
    830,
    150,
    "Hollow Stair",
    "A stepped climb from the lower ash. Every landing is another hold.",
    ["ashen-spine", "mist-crown"],
  ),
  "mist-crown": node(
    "mist-crown",
    "veil-switch",
    8,
    760,
    450,
    "Mist Crown",
    "A long switchback drowned in mist, and a second column that joins it late.",
    ["hollow-stair", "sovereign-gate"],
  ),
  "sovereign-gate": node(
    "sovereign-gate",
    "named-circuit",
    9,
    900,
    250,
    "Sovereign Gate",
    "A long inner circuit under a name that was once a king's, plus a midland spawn.",
    ["mist-crown", "last-watch"],
  ),
  "last-watch": node(
    "last-watch",
    "final-watch",
    10,
    900,
    430,
    "Last Watch",
    "The farthest node on this Atlas. Three roads, one ending, no further path.",
    ["sovereign-gate"],
  ),
};

export const ATLAS_START_ID = "ash-gate";

export const ATLAS_NODE_IDS: readonly AtlasNodeId[] = Object.keys(ATLAS_NODES);

export function isAtlasNodeId(value: string): value is AtlasNodeId {
  return Object.prototype.hasOwnProperty.call(ATLAS_NODES, value);
}

export function getAtlasNode(id: AtlasNodeId): AtlasNodeDef {
  const nodeDef = ATLAS_NODES[id];
  if (!nodeDef) throw new Error(`Unknown atlas node ${id}`);
  return nodeDef;
}

export function atlasLayout(id: AtlasNodeId): MapLayout {
  return getMapLayout(getAtlasNode(id).layoutId);
}

export function isAtlasNodeCleared(id: AtlasNodeId, cleared: readonly string[]): boolean {
  return cleared.includes(id);
}

/** A node is open if it is the start, already cleared, or a neighbor has been cleared. */
export function isAtlasNodeUnlocked(id: AtlasNodeId, cleared: readonly string[]): boolean {
  if (id === ATLAS_START_ID) return true;
  if (cleared.includes(id)) return true;
  const def = ATLAS_NODES[id];
  if (!def) return false;
  for (const n of def.neighbors) {
    if (cleared.includes(n)) return true;
  }
  return false;
}

/** For migrating old Depth-only saves and debug hooks: treat every node at or under this depth as cleared. */
export function atlasNodesClearedByDepth(highestDepthCleared: number): string[] {
  const out: string[] = [];
  if (highestDepthCleared <= 0) return out;
  for (const id of ATLAS_NODE_IDS) {
    const def = ATLAS_NODES[id];
    if (def && def.depth <= highestDepthCleared) out.push(id);
  }
  return out;
}

export function migrateClearedAtlas(highestDepthCleared: number, raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((id): id is string => typeof id === "string" && isAtlasNodeId(id));
  }
  return atlasNodesClearedByDepth(highestDepthCleared);
}

/** Prefer an unlocked, uncleared neighbor of `fromId`; otherwise the nearest such node on the Atlas. */
export function nextAtlasTarget(cleared: readonly string[], fromId?: string): AtlasNodeId | null {
  const pick = (ids: readonly string[]): AtlasNodeDef | null => {
    const found: AtlasNodeDef[] = [];
    for (const id of ids) {
      if (!isAtlasNodeUnlocked(id, cleared) || isAtlasNodeCleared(id, cleared)) continue;
      const def = ATLAS_NODES[id];
      if (def) found.push(def);
    }
    found.sort((a, b) => a.depth - b.depth || a.name.localeCompare(b.name));
    return found[0] ?? null;
  };
  if (fromId) {
    const def = ATLAS_NODES[fromId];
    if (def) {
      const local = pick(def.neighbors);
      if (local) return local.id;
    }
  }
  return pick(ATLAS_NODE_IDS)?.id ?? null;
}

/** Neighbors that became reachable because `clearedId` is now cleared. */
export function newlyUnlockedNeighbors(clearedId: string, cleared: readonly string[]): string[] {
  const def = ATLAS_NODES[clearedId];
  if (!def) return [];
  const out: string[] = [];
  for (const id of def.neighbors) {
    if (isAtlasNodeCleared(id, cleared)) continue;
    if (isAtlasNodeUnlocked(id, cleared)) out.push(id);
  }
  return out;
}
