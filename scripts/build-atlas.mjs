/**
 * Reproducible pixel-art atlas for Tower Forge.
 * Run: node scripts/build-atlas.mjs
 * Writes public/atlas.png and public/atlas.json (Phaser 3 atlas hash format).
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public");

/** Palette AARRGGBB. `.` is transparent. Ash, ember, blood, frost, gold only. */
const P = {
  ".": 0x00000000,
  k: 0xff0b0a0c,
  n: 0xff121014,
  d: 0xff1a1816,
  a: 0xff2a2826,
  s: 0xff3f3b38,
  m: 0xff8a8490,
  u: 0xffc4b8a8,
  w: 0xffe8e0d4,
  e: 0xffc4451c,
  h: 0xffe86a2a,
  f: 0xfff0a060,
  b: 0xff8b1a1a,
  r: 0xffc42222,
  t: 0xffe06058,
  c: 0xff6a9bb8,
  i: 0xff9fd0e8,
  q: 0xffd8f0f8,
  g: 0xff8a7018,
  y: 0xffc9a227,
  l: 0xffe8c547,
  z: 0xffc8b44a,
  x: 0xfff8eec0,
  o: 0xff2a2014,
  v: 0xff3a1a1a,
};

function argbToRgba(argb) {
  return [(argb >>> 16) & 255, (argb >>> 8) & 255, argb & 255, (argb >>> 24) & 255];
}

function make(w, h) {
  return { w, h, data: new Uint8Array(w * h * 4) };
}

function pset(cv, x, y, ch) {
  if (x < 0 || y < 0 || x >= cv.w || y >= cv.h) return;
  const argb = P[ch];
  if (argb === undefined) throw new Error(`bad pixel '${ch}'`);
  const [r, g, b, a] = argbToRgba(argb);
  const i = (y * cv.w + x) * 4;
  cv.data[i] = r;
  cv.data[i + 1] = g;
  cv.data[i + 2] = b;
  cv.data[i + 3] = a;
}

function fillRect(cv, x, y, w, h, ch) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) pset(cv, xx, yy, ch);
}

function fillCircle(cv, cx, cy, rad, ch) {
  const r2 = rad * rad;
  for (let y = Math.floor(cy - rad); y <= Math.ceil(cy + rad); y++) {
    for (let x = Math.floor(cx - rad); x <= Math.ceil(cx + rad); x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r2) pset(cv, x, y, ch);
    }
  }
}

const sprites = [];

function addGrid(name, rows, width = 16) {
  const norm = rows.map((row, i) => {
    if (row.length > width) throw new Error(`${name} row ${i} too long (${row.length} > ${width}): ${row}`);
    return row.padEnd(width, ".");
  });
  const h = norm.length;
  const cv = make(width, h);
  for (let y = 0; y < h; y++) {
    const row = norm[y] ?? "";
    for (let x = 0; x < width; x++) pset(cv, x, y, row[x] ?? ".");
  }
  sprites.push({ name, w: width, h, data: cv.data });
}

function addCanvas(name, cv) {
  sprites.push({ name, w: cv.w, h: cv.h, data: cv.data });
}

// ---- icons 16x16 ----
addGrid("cinder-orb", [
  "................",
  "......sss.......",
  "....sshhhees....",
  "...shhhhhhees...",
  "...shhfhhhees...",
  "..shhhffhhhees..",
  "..shhffxffhees..",
  "..shhffxffhees..",
  "...shhfhhhees...",
  "...sehhhhhees...",
  "....seeheess....",
  "......esss......",
]);

addGrid("forked-spark", [
  "................",
  "........x.......",
  ".......xlz......",
  "......zlzy......",
  ".....xzy........",
  "......zyz.x.....",
  ".......ylzlx....",
  "....x...zyz.....",
  "....lzzyy.......",
  ".....xzy........",
  "......yzlx......",
  ".......zy.......",
]);

addGrid("hoarfrost-burst", [
  "................",
  ".......q........",
  "......qiq.......",
  "....i..i..i.....",
  "...q.ciic.c.q...",
  "......iiii......",
  "..i.ciiqqic.i...",
  ".qq.iiqqqii.qq..",
  "..i.ciiqqic.i...",
  "......iiii......",
  "...q.c.iic.q....",
  "....i..i..i.....",
  "......qiq.......",
  ".......q........",
]);

addGrid("crimson-spike", [
  "................",
  "..........t.....",
  ".........trr....",
  "........trrb....",
  ".......trrbb....",
  "......trrbb.....",
  ".....trrbb......",
  "....trrbb.......",
  "...trrbb........",
  "..vvbbb.........",
  ".vvbb...........",
  ".vb.............",
]);

addGrid("split-volley", [
  "................",
  "...y.......y....",
  "...ly.....yl....",
  "....ly...yl.....",
  ".....ly.yl......",
  "......lyl.......",
  ".......y........",
  "......lyl.......",
  ".....y.l.y......",
  "....y.....y.....",
]);

addGrid("linked-arc", [
  "................",
  "....zz...zz.....",
  "...z..z.z..z....",
  "...z..zzz..z....",
  "....zz...zz.....",
  "....zz...zz.....",
  "...z..zzz..z....",
  "...z..z.z..z....",
  "....zz...zz.....",
]);

addGrid("through-flesh", [
  "................",
  "...........w....",
  "..........wu....",
  ".........wus....",
  "........wus.....",
  ".......wus......",
  "..rr..wus.......",
  ".rtrrwus........",
  "..rr.ss.........",
  ".....s..........",
]);

addGrid("rime-touch", [
  "................",
  ".......q........",
  "......qiq.......",
  ".......i........",
  "....i.cc.c.i....",
  "...c.ciii.c.....",
  "..qiiiqqqiiiq...",
  "...c.ciii.c.....",
  "....i.c.cc.i....",
  ".......i........",
  "......qiq.......",
  ".......q........",
]);

addGrid("quickening", [
  "................",
  "....l....l......",
  "...ly...ly......",
  "..lyy..lyy......",
  "...ly...ly......",
  "....l.l..l......",
  ".....ly.ly......",
  "....lyylyy......",
  ".....ly.ly......",
  "......l..l......",
]);

addGrid("kindle-shard", [
  "................",
  ".......q........",
  "......qi........",
  ".....qiic.......",
  "....qiicc.......",
  "....iiccc.......",
  "...iicccs.......",
  "...iccc.s.......",
  "....cc.s........",
  ".....c.s........",
]);

addGrid("ash-mote", [
  "................",
  "......l.y.......",
  "....y.lly.y.....",
  ".....yllly......",
  "....ylyxlyl.....",
  ".....yllly......",
  "....y.lly.y.....",
  "......y.l.......",
]);

addGrid("crown-cinder", [
  "................",
  "..l.y.l.y.l.....",
  "..lyylyylyl.....",
  "...yyyyyyy......",
  "...yeeheeey.....",
  "....yehhey......",
  ".....yyyy.......",
  "......gg........",
]);

addGrid("sovereign-ember", [
  "................",
  "......sss.......",
  ".....shlhs......",
  "....shhfhhs.....",
  "...shhfffhhs....",
  "...shhfffhhs....",
  "....sehhhhes....",
  ".....seeees.....",
  "......sess......",
  ".......ss.......",
]);

addGrid("rift-salt", [
  "................",
  "......w....w....",
  ".....wiw..wi....",
  ".....iii..ii....",
  "....wiic.wic....",
  ".....icc..ic....",
  "...w..cc...c....",
  "..wiw...........",
  "..iii...........",
  "...c............",
]);

addGrid("null-ash", [
  "................",
  "......m.........",
  "....m.s.m.......",
  "...msassam......",
  "....saasaa......",
  "...msaasaam.....",
  "....ssaaas......",
  ".....smmm.......",
  "......ss........",
]);

addGrid("blight-heart", [
  "................",
  "....bb..bb......",
  "...brr..rrb.....",
  "..brtrrrtrb.....",
  "..brrrrrrrb.....",
  "...brrrrrb......",
  "....brrrb.......",
  ".....brb........",
  "......b.........",
]);

addGrid("unbinding-tear", [
  "................",
  ".......w........",
  "......wuw.......",
  ".....wuiiw......",
  ".....wiiiw......",
  "....wuiiiqw.....",
  "....wiiiiqw.....",
  ".....wiiiw......",
  "......wiw.......",
  ".......w........",
]);

addGrid("relic-ember", [
  "................",
  "....ssssss......",
  "...soooooos.....",
  "...soohhoos.....",
  "...sohffhos.....",
  "...sohffhos.....",
  "...soohhoos.....",
  "...soooooos.....",
  "....ssssss......",
  ".....s..s.......",
]);

addGrid("relic-blood", [
  "................",
  "......ss........",
  ".....s..s.......",
  ".....s..s.......",
  "....ssssss......",
  "...sbbbbbbs.....",
  "...sbbrrbbs.....",
  "...sbbbbbbs.....",
  "....ssssss......",
  ".....ssss.......",
]);

addGrid("relic-ash", [
  "................",
  "......ss........",
  ".....s..s.......",
  "....s....s......",
  "...s.yyyy.s.....",
  "...s.yily.s.....",
  "...s.yyyy.s.....",
  "....s....s......",
  ".....s..s.......",
  "......ss........",
]);

addGrid("relic-gate", [
  "................",
  "...ssssssss.....",
  "...smmmmmmms....",
  "...smsssssms....",
  "...smsllsms.....",
  "...smsllsms.....",
  "...smsssssms....",
  "...smmmmmmms....",
  "...ssssssss.....",
]);

addGrid("rarity-normal", [
  "................",
  "....mmmmmm......",
  "...m......m.....",
  "...m.wwww.m.....",
  "...m.w..w.m.....",
  "...m.w..w.m.....",
  "...m.wwww.m.....",
  "...m......m.....",
  "....mmmmmm......",
]);

addGrid("rarity-magic", [
  "................",
  "....iiiiii......",
  "...i......i.....",
  "...i.cccc.i.....",
  "...i.cqqc.i.....",
  "...i.cqqc.i.....",
  "...i.cccc.i.....",
  "...i......i.....",
  "....iiiiii......",
]);

addGrid("rarity-rare", [
  "................",
  "....llllll......",
  "...l......l.....",
  "...l.yyyy.l.....",
  "...l.ylly.l.....",
  "...l.ylly.l.....",
  "...l.yyyy.l.....",
  "...l......l.....",
  "....llllll......",
]);

addGrid("relic-slot", [
  "................",
  "....ssssss......",
  "...s......s.....",
  "...s......s.....",
  "...s..dd..s.....",
  "...s..dd..s.....",
  "...s......s.....",
  "...s......s.....",
  "....ssssss......",
]);

addGrid("ui-lock", [
  "................",
  ".....yyyy.......",
  "....y....y......",
  "....y....y......",
  "....y....y......",
  "...yyyyyyyy.....",
  "...yyooooyy.....",
  "...yyoloyy......",
  "...yyooooyy.....",
  "...yyyyyyyy.....",
]);

addGrid("no-sigil", [
  "................",
  ".....yyyy.......",
  "....y....y......",
  "...y..ll..y.....",
  "...y..ll..y.....",
  "...y..ll..y.....",
  "...y..ll..y.....",
  "...y......y.....",
  "...y..ll..y.....",
  "....y....y......",
  ".....yyyy.......",
]);

addGrid("frost-bolt", [
  "................",
  ".......q........",
  "......qiq.......",
  ".....qiciq......",
  "....qiciiicq....",
  ".....qiciq......",
  "......qcq.......",
  ".......c........",
]);

addGrid("spark-bolt", [
  "................",
  "......x.........",
  ".....xlz........",
  "......lzy.......",
  ".....zly........",
  "....xzyx........",
  ".....ylz........",
  "......zy........",
]);

addGrid("blood-spike", [
  "................",
  ".........t......",
  "........tr......",
  ".......trr......",
  "......trrb......",
  ".....trrbb......",
  "....vvbbb.......",
  "...vbb..........",
]);

addGrid("spark-beam", [
  "zzzzzzzz",
  "zxxxxxxz",
  "zxxxxxxz",
  "zzzzzzzz",
], 8);

addGrid("blood-beam", [
  "rrrrrrrr",
  "rttttttr",
  "rttttttr",
  "rrrrrrrr",
], 8);

// ---- impact bursts 16x16 x 3 frames ----
function impact(name, core, mid, edge, frames) {
  for (let f = 0; f < frames; f++) {
    const cv = make(16, 16);
    const r0 = 1 + f * 1.4;
    const r1 = 2.2 + f * 1.6;
    const r2 = 3.2 + f * 2.0;
    fillCircle(cv, 8, 8, r2, edge);
    fillCircle(cv, 8, 8, r1, mid);
    fillCircle(cv, 8, 8, r0, core);
    if (f === frames - 1) {
      // last frame is a thinner ring
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const dx = x + 0.5 - 8;
          const dy = y + 0.5 - 8;
          const d = Math.hypot(dx, dy);
          if (d < r2 - 1.4) pset(cv, x, y, ".");
        }
      }
    }
    addCanvas(`${name}-${f}`, cv);
  }
}
impact("impact-fire", "x", "h", "e", 3);
impact("impact-cold", "q", "i", "c", 3);
impact("impact-lightning", "x", "z", "y", 3);
impact("impact-blood", "t", "r", "b", 3);

// ---- death puff 24x24 x 4 ----
for (let f = 0; f < 4; f++) {
  const cv = make(24, 24);
  const blobs = [
    [12, 12, 3 + f * 1.6, "s"],
    [10 - f, 11, 2 + f, "m"],
    [14 + f, 10, 2 + f * 0.8, "a"],
    [12, 14 + f, 2 + f * 0.7, "s"],
    [9, 9 - f * 0.5, 1.6 + f * 0.5, "m"],
  ];
  for (const [x, y, r, ch] of blobs) fillCircle(cv, x, y, r, ch);
  if (f > 1) fillCircle(cv, 12, 12, 1 + f, ".");
  addCanvas(`death-puff-${f}`, cv);
}

// ---- towers 32x32 ----
function paintSpire(frame, attack) {
  const cv = make(32, 32);
  fillRect(cv, 8, 16, 16, 14, "s");
  fillRect(cv, 10, 18, 12, 12, "a");
  fillRect(cv, 12, 20, 8, 10, "d");
  // battlements
  for (let i = 0; i < 4; i++) fillRect(cv, 8 + i * 4, 14, 3, 3, "s");
  fillRect(cv, 9, 15, 14, 2, "a");
  // door
  fillRect(cv, 14, 24, 4, 6, "o");
  fillRect(cv, 15, 25, 2, 5, "k");
  // gold trim
  fillRect(cv, 11, 18, 10, 1, "g");
  // brazier
  fillRect(cv, 13, 12, 6, 3, "o");
  const flicker = attack ? 2 : frame % 4;
  const flameH = 5 + flicker + (attack ? 3 : 0);
  fillCircle(cv, 16, 11 - (attack ? 2 : 0), 3 + (attack ? 1 : 0), "e");
  fillCircle(cv, 16, 10 - (attack ? 2 : 0), 2, "h");
  if (flicker >= 1) pset(cv, 16, 8 - (attack ? 2 : 0), "f");
  if (flicker >= 2) pset(cv, 15, 9 - (attack ? 1 : 0), "x");
  if (flicker >= 3 || attack) pset(cv, 17, 7, "l");
  for (let i = 0; i < flameH; i++) {
    const w = Math.max(1, 3 - Math.floor(i / 3));
    fillRect(cv, 16 - Math.floor(w / 2) + (frame % 2 === 0 ? 0 : 0), 11 - i, w, 1, i < 2 ? "h" : i < 4 ? "f" : "x");
  }
  return cv;
}

function paintFont(frame, attack) {
  const cv = make(32, 32);
  // pedestal
  fillRect(cv, 8, 22, 16, 8, "s");
  fillRect(cv, 10, 24, 12, 6, "a");
  fillRect(cv, 9, 22, 14, 2, "g");
  // bowl
  fillRect(cv, 6, 14, 20, 8, "s");
  fillRect(cv, 8, 15, 16, 6, "a");
  fillRect(cv, 10, 16, 12, 5, "v");
  // blood pool
  const ripple = frame % 4;
  fillCircle(cv, 16, 18, 6, "b");
  fillCircle(cv, 16, 18, 4, "r");
  if (ripple === 1 || attack) fillCircle(cv, 15, 17, 2, "t");
  if (ripple === 3 || attack) fillCircle(cv, 17, 18, 2, "t");
  if (attack) {
    fillCircle(cv, 16, 14, 3, "r");
    pset(cv, 16, 11, "t");
    pset(cv, 15, 12, "r");
    pset(cv, 17, 12, "r");
  } else if (ripple === 2) {
    pset(cv, 16, 15, "t");
  }
  // rim
  fillRect(cv, 6, 14, 20, 2, "s");
  pset(cv, 7, 14, "y");
  pset(cv, 24, 14, "y");
  return cv;
}

for (let f = 0; f < 4; f++) {
  addCanvas(`ember-spire-idle-${f}`, paintSpire(f, false));
  addCanvas(`blood-font-idle-${f}`, paintFont(f, false));
}
for (let f = 0; f < 2; f++) {
  addCanvas(`ember-spire-attack-${f}`, paintSpire(f + 2, true));
  addCanvas(`blood-font-attack-${f}`, paintFont(f + 2, true));
}
// stills used as HUD / fallback keys
addCanvas("ember-spire", paintSpire(0, false));
addCanvas("blood-font", paintFont(0, false));

// ---- enemies ----
function paintWretch(frame) {
  const cv = make(24, 24);
  const bob = frame % 2;
  const leg = frame % 4;
  const y = 2 + bob;
  // legs
  if (leg === 0 || leg === 1) {
    fillRect(cv, 8, 16 + y, 2, 5, "v");
    fillRect(cv, 14, 17 + y, 2, 4, "v");
  } else {
    fillRect(cv, 8, 17 + y, 2, 4, "v");
    fillRect(cv, 14, 16 + y, 2, 5, "v");
  }
  fillRect(cv, 7, 20 + y, 3, 2, "d");
  fillRect(cv, 13, 20 + y, 3, 2, "d");
  // body
  fillRect(cv, 7, 10 + y, 10, 8, "a");
  fillRect(cv, 8, 11 + y, 8, 6, "v");
  fillRect(cv, 9, 13 + y, 6, 3, "b");
  // head, hunched
  fillCircle(cv, 12, 8 + y, 4, "a");
  fillCircle(cv, 12, 8 + y, 3, "v");
  pset(cv, 10, 7 + y, "r");
  pset(cv, 14, 7 + y, "r");
  pset(cv, 12, 9 + y, "d");
  // claw
  const claw = leg < 2 ? 0 : 1;
  fillRect(cv, 5, 13 + y + claw, 3, 2, "s");
  fillRect(cv, 16, 13 + y + (1 - claw), 3, 2, "s");
  return cv;
}

function paintBrute(frame) {
  const cv = make(32, 32);
  const bob = frame % 2;
  const leg = frame % 4;
  const y = 1 + bob;
  // legs
  if (leg === 0 || leg === 1) {
    fillRect(cv, 10, 22 + y, 4, 7, "s");
    fillRect(cv, 18, 23 + y, 4, 6, "s");
  } else {
    fillRect(cv, 10, 23 + y, 4, 6, "s");
    fillRect(cv, 18, 22 + y, 4, 7, "s");
  }
  fillRect(cv, 9, 28 + y, 5, 2, "d");
  fillRect(cv, 17, 28 + y, 5, 2, "d");
  // torso
  fillRect(cv, 8, 12 + y, 16, 12, "s");
  fillRect(cv, 10, 14 + y, 12, 9, "a");
  fillRect(cv, 12, 16 + y, 8, 5, "v");
  fillRect(cv, 13, 17 + y, 6, 3, "b");
  // shoulders
  fillRect(cv, 6, 13 + y, 5, 6, "s");
  fillRect(cv, 21, 13 + y, 5, 6, "s");
  // head
  fillRect(cv, 11, 6 + y, 10, 8, "s");
  fillRect(cv, 12, 7 + y, 8, 6, "a");
  pset(cv, 14, 9 + y, "r");
  pset(cv, 18, 9 + y, "r");
  fillRect(cv, 14, 11 + y, 4, 1, "d");
  // brow
  fillRect(cv, 13, 8 + y, 6, 1, "d");
  return cv;
}

function paintSovereign(frame) {
  const cv = make(48, 48);
  const bob = frame % 2;
  const leg = frame % 4;
  const y = bob;
  // cape
  fillRect(cv, 12, 18 + y, 24, 18, "n");
  fillRect(cv, 14, 20 + y, 20, 16, "d");
  fillRect(cv, 16, 22 + y, 16, 12, "k");
  // legs
  if (leg < 2) {
    fillRect(cv, 18, 34 + y, 4, 10, "s");
    fillRect(cv, 26, 35 + y, 4, 9, "s");
  } else {
    fillRect(cv, 18, 35 + y, 4, 9, "s");
    fillRect(cv, 26, 34 + y, 4, 10, "s");
  }
  fillRect(cv, 17, 43 + y, 5, 2, "g");
  fillRect(cv, 25, 43 + y, 5, 2, "g");
  // body
  fillRect(cv, 16, 16 + y, 16, 18, "s");
  fillRect(cv, 18, 18 + y, 12, 14, "a");
  fillRect(cv, 20, 20 + y, 8, 8, "o");
  fillRect(cv, 22, 22 + y, 4, 4, "y");
  // staff
  const staffX = 36;
  fillRect(cv, staffX, 8 + y, 2, 34, "g");
  fillCircle(cv, staffX + 1, 9 + y, 3, "l");
  fillCircle(cv, staffX + 1, 9 + y, 1, "e");
  // head
  fillCircle(cv, 24, 12 + y, 6, "s");
  fillCircle(cv, 24, 12 + y, 5, "a");
  pset(cv, 22, 12 + y, "l");
  pset(cv, 26, 12 + y, "l");
  pset(cv, 24, 14 + y, "d");
  // crown
  fillRect(cv, 19, 6 + y, 10, 3, "y");
  pset(cv, 19, 5 + y, "l");
  pset(cv, 24, 4 + y, "l");
  pset(cv, 29, 5 + y, "l");
  pset(cv, 24, 6 + y, "e");
  return cv;
}

for (let f = 0; f < 4; f++) {
  addCanvas(`wretch-walk-${f}`, paintWretch(f));
  addCanvas(`brute-walk-${f}`, paintBrute(f));
  addCanvas(`hollow-sovereign-walk-${f}`, paintSovereign(f));
}
addCanvas("wretch", paintWretch(0));
addCanvas("brute", paintBrute(0));
addCanvas("hollow-sovereign", paintSovereign(0));

// ---- pack + write PNG / JSON ----
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function u32(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0);
  return b;
}

function chunk(tag, data) {
  const t = Buffer.from(tag);
  const crc = crc32(Buffer.concat([t, data]));
  return Buffer.concat([u32(data.length), t, data, u32(crc)]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const src = y * width * 4;
    const dst = y * (width * 4 + 1);
    raw[dst] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength).copy(raw, dst + 1, src, src + width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function pack(list, maxW = 512) {
  const sorted = [...list].sort((a, b) => b.h - a.h || b.w - a.w);
  const frames = {};
  let x = 0;
  let y = 0;
  let rowH = 0;
  let sheetW = 0;
  let sheetH = 0;
  const pad = 1;
  const placed = [];
  for (const spr of sorted) {
    if (x + spr.w + pad > maxW) {
      x = 0;
      y += rowH + pad;
      rowH = 0;
    }
    placed.push({ spr, x, y });
    frames[spr.name] = {
      frame: { x, y, w: spr.w, h: spr.h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: spr.w, h: spr.h },
      sourceSize: { w: spr.w, h: spr.h },
    };
    x += spr.w + pad;
    rowH = Math.max(rowH, spr.h);
    sheetW = Math.max(sheetW, x);
    sheetH = Math.max(sheetH, y + spr.h);
  }
  // pad to multiple of 4 for nicer GPU sizes
  const width = Math.ceil(sheetW / 4) * 4;
  const height = Math.ceil(sheetH / 4) * 4;
  const rgba = new Uint8Array(width * height * 4);
  for (const { spr, x: sx, y: sy } of placed) {
    for (let yy = 0; yy < spr.h; yy++) {
      const src = yy * spr.w * 4;
      const dst = ((sy + yy) * width + sx) * 4;
      rgba.set(spr.data.subarray(src, src + spr.w * 4), dst);
    }
  }
  return { width, height, rgba, frames };
}

const packed = pack(sprites);
const png = encodePng(packed.width, packed.height, packed.rgba);
const json = {
  frames: packed.frames,
  meta: {
    app: "tower-forge-atlas",
    version: "1",
    image: "atlas.png",
    format: "RGBA8888",
    size: { w: packed.width, h: packed.height },
    scale: "1",
  },
};

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "atlas.png"), png);
writeFileSync(join(outDir, "atlas.json"), JSON.stringify(json));
console.log(
  `atlas ${packed.width}x${packed.height}  frames ${Object.keys(packed.frames).length}  png ${png.length} bytes`,
);
