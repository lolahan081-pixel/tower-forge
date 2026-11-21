import Phaser from "phaser";
import { Palette } from "../palette";

/** Bake simple shape textures once so hundreds of enemies can be cheap sprites. */
export function generateTextures(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  g.fillStyle(Palette.groundAlt, 1);
  g.fillCircle(16, 16, 13);
  g.fillStyle(0x2a1618, 1);
  g.fillCircle(16, 16, 11);
  g.fillStyle(Palette.bloodBright, 1);
  g.fillCircle(19, 13, 3);
  g.generateTexture("wretch", 32, 32);
  g.clear();

  g.fillStyle(0x141318, 1);
  g.fillRoundedRect(2, 2, 36, 36, 4);
  g.fillStyle(0x2a282c, 1);
  g.fillRoundedRect(6, 6, 28, 28, 3);
  g.fillStyle(Palette.blood, 1);
  g.fillRect(10, 16, 20, 5);
  g.fillStyle(Palette.bloodBright, 1);
  g.fillCircle(20, 14, 3);
  g.generateTexture("brute", 40, 40);
  g.clear();

  // Cinder Orb
  g.fillStyle(Palette.emberHot, 1);
  g.fillCircle(8, 8, 6);
  g.fillStyle(Palette.goldBright, 1);
  g.fillCircle(8, 8, 2.5);
  g.generateTexture("cinder-orb", 16, 16);
  g.clear();

  // Frost bolt
  g.fillStyle(Palette.cold, 1);
  g.fillCircle(8, 8, 6);
  g.fillStyle(Palette.coldBright, 1);
  g.fillCircle(8, 8, 2.5);
  g.generateTexture("frost-bolt", 16, 16);
  g.clear();

  // Spark
  g.fillStyle(Palette.lightning, 1);
  g.fillTriangle(8, 1, 14, 10, 2, 10);
  g.fillStyle(0xf8eec0, 1);
  g.fillTriangle(8, 5, 12, 14, 4, 14);
  g.generateTexture("spark-bolt", 16, 16);
  g.clear();

  // Blood spike
  g.fillStyle(Palette.bloodBright, 1);
  g.fillTriangle(2, 8, 14, 3, 14, 13);
  g.fillStyle(Palette.blood, 1);
  g.fillCircle(6, 8, 3);
  g.generateTexture("blood-spike", 16, 16);
  g.clear();

  g.fillStyle(Palette.bloodBright, 1);
  g.fillRect(0, 0, 8, 8);
  g.generateTexture("blood-beam", 8, 8);
  g.clear();

  g.fillStyle(Palette.lightning, 1);
  g.fillRect(0, 0, 8, 8);
  g.generateTexture("spark-beam", 8, 8);
  g.clear();

  g.lineStyle(3, Palette.coldBright, 1);
  g.strokeCircle(24, 24, 20);
  g.generateTexture("nova-ring", 48, 48);
  g.clear();

  // Ember Spire frame
  g.fillStyle(0x1a1816, 1);
  g.fillRect(6, 10, 28, 26);
  g.fillStyle(Palette.stoneLight, 1);
  g.fillRect(10, 14, 20, 18);
  g.fillStyle(Palette.ember, 1);
  g.fillCircle(20, 14, 8);
  g.fillStyle(Palette.gold, 1);
  g.fillCircle(20, 14, 3);
  g.generateTexture("ember-spire", 40, 40);
  g.clear();

  // Blood Font frame
  g.fillStyle(0x141014, 1);
  g.fillRoundedRect(4, 8, 32, 28, 4);
  g.fillStyle(Palette.stone, 1);
  g.fillRoundedRect(8, 14, 24, 18, 3);
  g.fillStyle(Palette.blood, 1);
  g.fillCircle(20, 16, 9);
  g.fillStyle(Palette.bloodBright, 1);
  g.fillCircle(20, 16, 4);
  g.generateTexture("blood-font", 40, 40);
  g.clear();

  // Gem chip (tinted in UI)
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(2, 2, 18, 18, 3);
  g.generateTexture("gem-chip", 22, 22);
  g.clear();

  // Empty-frame warning badge.
  g.fillStyle(0x1a1210, 1);
  g.fillCircle(12, 12, 11);
  g.lineStyle(2, 0xc9a227, 1);
  g.strokeCircle(12, 12, 10);
  g.fillStyle(0xe8c547, 1);
  g.fillRect(11, 5, 2, 8);
  g.fillCircle(12, 17, 1.5);
  g.generateTexture("no-sigil", 24, 24);
  g.clear();

  g.destroy();
}
