/** Shared UI metrics. Buttons are sized so they stay ~44px in screen space on phone landscape (FIT scale ≈ 0.5). */
export type UiRect = { x: number; y: number; w: number; h: number };

export const BTN_H = 88;

export function containsRect(r: UiRect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export function rectCenter(r: UiRect): { x: number; y: number } {
  return { x: r.x + r.w * 0.5, y: r.y + r.h * 0.5 };
}

export const FONT_HUD = '22px Georgia, "Times New Roman", serif';
export const FONT_BTN = '20px Georgia, "Times New Roman", serif';
export const FONT_BTN_SM = '16px Georgia, "Times New Roman", serif';
export const FONT_TITLE = '28px Georgia, "Times New Roman", serif';
export const FONT_BODY = '18px Georgia, "Times New Roman", serif';
