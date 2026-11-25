import { TILE_SIZE, type GridPos } from "../data/map";

export type PathSample = {
  x: number;
  y: number;
  waypoint: number;
  distOnSeg: number;
  atEnd: boolean;
  progress: number;
};

export class PathRoute {
  readonly pointsX: Float64Array;
  readonly pointsY: Float64Array;
  readonly pointCount: number;
  readonly segLen: Float64Array;
  readonly cumLen: Float64Array;
  readonly totalLen: number;

  constructor(waypoints: readonly GridPos[]) {
    const pts = waypoints;
    this.pointCount = pts.length;
    this.pointsX = new Float64Array(this.pointCount);
    this.pointsY = new Float64Array(this.pointCount);
    for (let i = 0; i < this.pointCount; i++) {
      const p = pts[i];
      if (!p) continue;
      this.pointsX[i] = (p.col + 0.5) * TILE_SIZE;
      this.pointsY[i] = (p.row + 0.5) * TILE_SIZE;
    }
    const segCount = Math.max(0, this.pointCount - 1);
    this.segLen = new Float64Array(segCount);
    this.cumLen = new Float64Array(this.pointCount);
    this.cumLen[0] = 0;
    let total = 0;
    for (let i = 0; i < segCount; i++) {
      const dx = this.pointsX[i + 1]! - this.pointsX[i]!;
      const dy = this.pointsY[i + 1]! - this.pointsY[i]!;
      const len = Math.hypot(dx, dy);
      this.segLen[i] = len;
      total += len;
      this.cumLen[i + 1] = total;
    }
    this.totalLen = total;
  }

  sample(dist: number, out: PathSample): void {
    if (dist >= this.totalLen) {
      const last = this.pointCount - 1;
      out.x = this.pointsX[last]!;
      out.y = this.pointsY[last]!;
      out.waypoint = Math.max(0, last - 1);
      out.distOnSeg = this.segLen[out.waypoint] ?? 0;
      out.atEnd = true;
      out.progress = 1;
      return;
    }
    if (dist <= 0) {
      out.x = this.pointsX[0]!;
      out.y = this.pointsY[0]!;
      out.waypoint = 0;
      out.distOnSeg = 0;
      out.atEnd = false;
      out.progress = 0;
      return;
    }

    let lo = 0;
    let hi = this.pointCount - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (this.cumLen[mid]! <= dist) lo = mid;
      else hi = mid;
    }
    const seg = lo;
    const segLen = this.segLen[seg]!;
    const distOnSeg = dist - this.cumLen[seg]!;
    const t = segLen > 0 ? distOnSeg / segLen : 0;
    out.x = this.pointsX[seg]! + (this.pointsX[seg + 1]! - this.pointsX[seg]!) * t;
    out.y = this.pointsY[seg]! + (this.pointsY[seg + 1]! - this.pointsY[seg]!) * t;
    out.waypoint = seg;
    out.distOnSeg = distOnSeg;
    out.atEnd = false;
    out.progress = this.totalLen > 0 ? dist / this.totalLen : 1;
  }
}

export function routesForPaths(paths: readonly (readonly GridPos[])[]): PathRoute[] {
  return paths.map((path) => new PathRoute(path));
}
