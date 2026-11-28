import Phaser from "phaser";
import { ATLAS_KEY } from "../data/sprites";
import { registerSpriteAnims } from "./sprites";
import { generateTextures } from "./textures";

/** Preload the pixel atlas, bake shape fallbacks, then enter the menu. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload(): void {
    this.load.atlas(ATLAS_KEY, "atlas.png", "atlas.json");
  }

  create(): void {
    generateTextures(this);
    registerSpriteAnims(this);
    this.scene.start("menu");
  }
}
