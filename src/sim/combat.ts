import type { Enemy } from "./EnemyPool";

const CHAIN_RANGE = 150;

export function findNearestToExit(x: number, y: number, range: number, enemies: Enemy[]): Enemy | null {
  const rangeSq = range * range;
  let best: Enemy | null = null;
  let bestProgress = -1;
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e || !e.alive) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    if (dx * dx + dy * dy > rangeSq) continue;
    if (e.progress > bestProgress) {
      bestProgress = e.progress;
      best = e;
    }
  }
  return best;
}

export function hasHitEnemy(hits: readonly (Enemy | null)[], hitCount: number, enemy: Enemy): boolean {
  for (let i = 0; i < hitCount; i++) {
    if (hits[i] === enemy) return true;
  }
  return false;
}

export function findChainTarget(
  x: number,
  y: number,
  enemies: Enemy[],
  hits: readonly (Enemy | null)[],
  hitCount: number,
  range = CHAIN_RANGE,
): Enemy | null {
  const rangeSq = range * range;
  let best: Enemy | null = null;
  let bestDist = rangeSq;
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e || !e.alive) continue;
    if (hasHitEnemy(hits, hitCount, e)) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestDist) {
      bestDist = d;
      best = e;
    }
  }
  return best;
}

/** Fill `out` with living enemies inside the radius. Returns the count written. */
export function collectInRadius(
  x: number,
  y: number,
  radius: number,
  enemies: Enemy[],
  out: Enemy[],
  max: number,
): number {
  const rangeSq = radius * radius;
  let n = 0;
  for (let i = 0; i < enemies.length && n < max; i++) {
    const e = enemies[i];
    if (!e || !e.alive) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    if (dx * dx + dy * dy <= rangeSq) {
      out[n] = e;
      n += 1;
    }
  }
  return n;
}
