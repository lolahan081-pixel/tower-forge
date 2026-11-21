import type { GemInstance } from "../data/items";
import type { ResolvedAttack } from "../data/stats";
import type { TowerId } from "../data/towers";

export type PlacedTower = {
  col: number;
  row: number;
  id: TowerId;
  x: number;
  y: number;
  sockets: (GemInstance | null)[];
  resolved: ResolvedAttack;
  cooldown: number;
  sprite: Phaser.GameObjects.Image;
  rangeGfx: Phaser.GameObjects.Graphics;
  badge: Phaser.GameObjects.Image;
};
