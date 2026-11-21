import Phaser from "phaser";
import { Palette } from "../palette";

/** Bake simple shape textures once so hundreds of enemies can be cheap sprites. */
export function generateTextures(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Wretch: small dark body, blood-red eye.
  g.fillStyle(Palette.groundAlt, 1);
  g.fillCircle(16, 16, 13);
  g.fillStyle(0x2a1618, 1);
  g.fillCircle(16, 16, 11);
  g.fillStyle(Palette.bloodBright, 1);
  g.fillCircle(19, 13, 3);
  g.generateTexture("wretch", 32, 32);
  g.clear();

  // Brute: heavier stone bulk with a blood slash.
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

  // Ember bolt.
  g.fillStyle(Palette.emberHot, 1);
  g.fillCircle(8, 8, 5);
  g.fillStyle(Palette.goldBright, 1);
  g.fillCircle(8, 8, 2);
  g.generateTexture("ember-bolt", 16, 16);
  g.clear();

  // Instant-hit blood beam (stretched in use).
  g.fillStyle(Palette.bloodBright, 1);
  g.fillRect(0, 0, 8, 8);
  g.generateTexture("blood-beam", 8, 8);
  g.clear();

  // Ember Spire: stone base + ember cap.
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

  // Blood Font: darker well with a crimson bowl.
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

  g.destroy();
}
