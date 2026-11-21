import { isEnemyId, type EnemyId } from "../data/enemies";
import { WAVES, type WaveDef } from "../data/waves";

type SpawnEvent = { t: number; enemyId: EnemyId };

export class WaveController {
  /** Index of the wave currently running or just finished; -1 before the first. */
  waveIndex = -1;
  active = false;
  elapsedMs = 0;
  private readonly schedule: SpawnEvent[] = [];
  private schedLen = 0;
  private schedIndex = 0;

  get waveNumber(): number {
    return this.waveIndex + 1;
  }

  get totalWaves(): number {
    return WAVES.length;
  }

  get allSpawned(): boolean {
    return this.schedIndex >= this.schedLen;
  }

  get hasMoreWaves(): boolean {
    return this.waveIndex + 1 < WAVES.length;
  }

  get currentWave(): WaveDef | undefined {
    return this.waveIndex >= 0 ? WAVES[this.waveIndex] : undefined;
  }

  canStart(): boolean {
    return !this.active && this.hasMoreWaves;
  }

  startNext(): boolean {
    if (!this.canStart()) return false;
    this.waveIndex += 1;
    const wave = WAVES[this.waveIndex];
    if (!wave) return false;
    this.buildSchedule(wave);
    this.active = true;
    this.elapsedMs = 0;
    this.schedIndex = 0;
    return true;
  }

  /**
   * Spawn due enemies. `spawn` is called once per due event.
   * Does not end the wave; the scene ends it when the field is clear.
   */
  update(dtMs: number, spawn: (enemyId: EnemyId) => void): void {
    if (!this.active) return;
    this.elapsedMs += dtMs;
    while (this.schedIndex < this.schedLen) {
      const ev = this.schedule[this.schedIndex];
      if (!ev || ev.t > this.elapsedMs) break;
      spawn(ev.enemyId);
      this.schedIndex += 1;
    }
  }

  endIfClear(livingEnemies: number): boolean {
    if (!this.active || !this.allSpawned || livingEnemies > 0) return false;
    this.active = false;
    return true;
  }

  private buildSchedule(wave: WaveDef): void {
    this.schedLen = 0;
    for (const group of wave.spawns) {
      if (!isEnemyId(group.enemyId)) continue;
      for (let i = 0; i < group.count; i++) {
        const ev = this.schedule[this.schedLen];
        const t = group.delayMs + i * group.intervalMs;
        if (ev) {
          ev.t = t;
          ev.enemyId = group.enemyId;
        } else {
          this.schedule.push({ t, enemyId: group.enemyId });
        }
        this.schedLen += 1;
      }
    }
    // Groups can interleave; keep the reused buffer in time order.
    const slice = this.schedule.slice(0, this.schedLen);
    slice.sort((a, b) => a.t - b.t);
    for (let i = 0; i < slice.length; i++) this.schedule[i] = slice[i]!;
  }
}
