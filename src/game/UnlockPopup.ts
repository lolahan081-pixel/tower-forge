import type { FeatureDef } from "../data/unlocks";
import { MessagePopup } from "./MessagePopup";
import type { UiRect } from "./ui";
import type Phaser from "phaser";

/** One-time feature unlock card with a single OK button. */
export class UnlockPopup {
  private readonly popup: MessagePopup;
  private current: FeatureDef | null = null;

  constructor(
    scene: Phaser.Scene,
    private readonly onAccepted: (id: string) => void,
  ) {
    this.popup = new MessagePopup(scene, 80);
  }

  get visible(): boolean {
    return this.popup.visible;
  }

  get okRect(): UiRect {
    return this.popup.okRect;
  }

  show(def: FeatureDef): void {
    this.current = def;
    this.popup.show(def.title, def.body, () => {
      const id = this.current?.id;
      this.current = null;
      if (id) this.onAccepted(id);
    });
  }

  hide(): void {
    this.current = null;
    this.popup.hide();
  }

  handleTap(x: number, y: number): boolean {
    return this.popup.handleTap(x, y);
  }
}
