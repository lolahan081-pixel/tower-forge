import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "./data/map";
import { GameScene } from "./game/GameScene";
import "./debug";

const params = new URLSearchParams(window.location.search);
const canvasRequested = params.get("renderer") === "canvas";

const config: Phaser.Types.Core.GameConfig = {
  type: canvasRequested ? Phaser.CANVAS : Phaser.AUTO,
  parent: "app",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#0b0a0c",
  scene: [GameScene],
  banner: false,
  audio: { noAudio: true },
  render: {
    antialias: true,
    powerPreference: "high-performance",
  },
};

new Phaser.Game(config);
