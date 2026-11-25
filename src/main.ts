import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "./data/map";
import { BastionScene } from "./game/BastionScene";
import { GameScene } from "./game/GameScene";
import { MenuScene } from "./game/MenuScene";
import "./debug";

const params = new URLSearchParams(window.location.search);
const canvasRequested = params.get("renderer") === "canvas";
const config: Phaser.Types.Core.GameConfig = {
  type: canvasRequested ? Phaser.CANVAS : Phaser.AUTO,
  parent: "app",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#0b0a0c",
  scene: [MenuScene, BastionScene, GameScene],
  banner: false,
  audio: { noAudio: true },
  render: {
    antialias: true,
    powerPreference: "high-performance",
    roundPixels: true,
    pixelArt: false,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
};

new Phaser.Game(config);
