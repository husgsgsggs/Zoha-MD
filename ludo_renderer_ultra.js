const Jimp = require("jimp");

// Ultra "Ludo King"-style board renderer (no external assets).
// Draws a 15x15 classic Ludo layout, stars for safe cells, home triangles, dice box,
// per-color path rotation, token stacking, and turn highlight.

const GRID = 15;
const CELL = 44; // slightly larger
const PAD = 18;
const W = GRID * CELL + PAD * 2;
const H = GRID * CELL + PAD * 2 + 44; // extra footer row for legend

const WIN_POS = 56;
const SAFE_PHYS = [1, 9, 14, 22, 27, 35, 40, 48];
const START_OFFSETS = [0, 13, 26, 39]; // RED, BLUE, GREEN, YELLOW

const C = {
  bg: 0xffffffff,
  grid: 0x00000022,
  center: 0xf2f2f7ff,
  black: 0x000000ff,

  red: 0xff3b30ff,
  blue: 0x007affff,
  green: 0x34c759ff,
  yellow: 0xffcc00ff,

  white: 0xffffffff,
  safe: 0x00000018,
  star: 0x00000088,
};

const PLAYER_COLORS = [C.red, C.blue, C.green, C.yellow];

// Shared ring coordinates (52 cells), indexed by RED physical index (1..52).
const TRACK_52 = [
  [6,13],[6,12],[6,11],[6,10],[6,9],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8],
  [0,7],[0,6],[1,6],[2,6],[3,6],[4,6],[5,6],[6,5],[6,4],[6,3],[6,2],[6,1],[6,0],
  [7,0],[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[9,6],[10,6],[11,6],[12,6],[13,6],[14,6],
  [14,7],[14,8],[13,8],[12,8],[11,8],[10,8],[9,8],[8,9],[8,10],[8,11],[8,12],[8,13],[8,14],
  [7,14]
];

const FINAL_LANES = [
  // RED lane (towards center)
  [[7,13],[7,12],[7,11],[7,10]],
  // BLUE lane
  [[1,7],[2,7],[3,7],[4,7]],
  // GREEN lane
  [[7,1],[7,2],[7,3],[7,4]],
  // YELLOW lane
  [[13,7],[12,7],[11,7],[10,7]],
];

const HOME_SPOTS = [
  // RED home (bottom-left quadrant)
  [[2,12],[4,12],[2,14],[4,14]],
  // BLUE home (top-left)
  [[2,2],[4,2],[2,4],[4,4]],
  // GREEN home (top-right)
  [[10,2],[12,2],[10,4],[12,4]],
  // YELLOW home (bottom-right)
  [[10,12],[12,12],[10,14],[12,14]],
];

function cellToPx(cx, cy) {
  const x = PAD + cx * CELL;
  const y = PAD + cy * CELL;
  return [x, y];
}

function fillCell(img, cx, cy, color) {
  const [x, y] = cellToPx(cx, cy);
  img.composite(new Jimp(CELL, CELL, color), x, y);
}

function drawGrid(img) {
  for (let i = 0; i <= GRID; i++) {
    const x = PAD + i * CELL;
    const y = PAD + i * CELL;
    for (let yy = PAD; yy < PAD + GRID * CELL; yy++) img.setPixelColor(C.grid, x, yy);
    for (let xx = PAD; xx < PAD + GRID * CELL; xx++) img.setPixelColor(C.grid, xx, y);
  }
}

function drawStar(img, cx, cy) {
  // Simple 5-point star marker (pixel-based)
  const [x0, y0] = cellToPx(cx, cy);
  const cxp = x0 + CELL / 2;
  const cyp = y0 + CELL / 2;
  const r1 = 12, r2 = 5;

  function plot(x, y) {
    if (x >= 0 && y >= 0 && x < img.bitmap.width && y < img.bitmap.height) {
      img.setPixelColor(C.star, x, y);
    }
  }

  const pts = [];
  for (let k = 0; k < 10; k++) {
    const a = (Math.PI / 2) + (k * Math.PI / 5);
    const r = (k % 2 === 0) ? r1 : r2;
    pts.push([cxp + r * Math.cos(a), cyp - r * Math.sin(a)]);
  }

  // draw lines between points
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    const steps = 60;
    for (let s = 0; s <= steps; s++) {
      const x = Math.round(x1 + (x2 - x1) * (s / steps));
      const y = Math.round(y1 + (y2 - y1) * (s / steps));
      plot(x, y);
      plot(x+1, y);
      plot(x, y+1);
    }
  }
}

function physicalIndexFromSteps(steps, playerIndex) {
  if (steps < 1 || steps > 52) return null;
  const off = START_OFFSETS[playerIndex] || 0;
  return ((off + (steps - 1)) % 52) + 1;
}

function posToCell(steps, playerIndex) {
  if (steps === 0) return null;
  if (steps === WIN_POS) return null;

  if (steps >= 1 && steps <= 52) {
    const phys = physicalIndexFromSteps(steps, playerIndex);
    const [cx, cy] = TRACK_52[phys - 1];
    return [cx, cy];
  }
  if (steps >= 53 && steps <= 56) {
    const lane = FINAL_LANES[playerIndex] || FINAL_LANES[0];
    return lane[steps - 53];
  }
  return null;
}

async function drawToken(img, cx, cy, color, offsetIndex = 0, total = 1) {
  const base = 28;
  const radius = 12;
  const [x0, y0] = cellToPx(cx, cy);

  const spread = Math.min(10, Math.floor(20 / Math.max(1, total)));
  const ox = (offsetIndex % 2) * spread - spread / 2;
  const oy = Math.floor(offsetIndex / 2) * spread - spread / 2;

  const dot = new Jimp(base, base, 0x00000000);

  for (let y = 0; y < base; y++) {
    for (let x = 0; x < base; x++) {
      const dx = x - base / 2;
      const dy = y - base / 2;
      if (dx * dx + dy * dy <= radius * radius) dot.setPixelColor(color, x, y);
    }
  }
  // outline
  for (let y = 0; y < base; y++) {
    for (let x = 0; x < base; x++) {
      const dx = x - base / 2;
      const dy = y - base / 2;
      const d = dx * dx + dy * dy;
      if (d <= radius * radius && d >= (radius - 2) * (radius - 2)) dot.setPixelColor(C.black, x, y);
    }
  }

  img.composite(dot, x0 + (CELL - base) / 2 + ox, y0 + (CELL - base) / 2 + oy);
}

function drawHomeTriangles(img) {
  // center arrows/triangles pointing inward (Ludo-King vibe)
  // we color strips leading to center (approx)
  for (let i=1;i<=4;i++) fillCell(img, 7, 13 - (i-1), C.red);
  for (let i=1;i<=4;i++) fillCell(img, 1 + (i-1), 7, C.blue);
  for (let i=1;i<=4;i++) fillCell(img, 7, 1 + (i-1), C.green);
  for (let i=1;i<=4;i++) fillCell(img, 13 - (i-1), 7, C.yellow);
}

function drawHomes(img) {
  // 6x6 quadrants
  for (let y=0;y<6;y++) for (let x=0;x<6;x++) fillCell(img, x, y, C.blue);
  for (let y=0;y<6;y++) for (let x=9;x<15;x++) fillCell(img, x, y, C.green);
  for (let y=9;y<15;y++) for (let x=0;x<6;x++) fillCell(img, x, y, C.red);
  for (let y=9;y<15;y++) for (let x=9;x<15;x++) fillCell(img, x, y, C.yellow);

  // inner white squares inside homes (token parking)
  const boxes = [
    [1,1],[10,1],[1,10],[10,10]
  ];
  for (const [bx, by] of boxes) {
    for (let y=0;y<4;y++) for (let x=0;x<4;x++) fillCell(img, bx+x, by+y, C.white);
  }

  // center
  for (let y=6;y<9;y++) for (let x=6;x<9;x++) fillCell(img, x, y, C.center);
}

function drawSafeCells(img) {
  for (const phys of SAFE_PHYS) {
    const [cx, cy] = TRACK_52[phys - 1];
    fillCell(img, cx, cy, C.safe);
    drawStar(img, cx, cy);
  }
}

async function drawDiceBox(img, dice) {
  const font = await Jimp.loadFont(Jimp.FONT_SANS_16_BLACK);
  const boxW = 120, boxH = 34;
  const x = PAD;
  const y = PAD + GRID * CELL + 6;

  img.composite(new Jimp(boxW, boxH, 0xf2f2f7ff), x, y);
  // border
  for (let i=0;i<boxW;i++) { img.setPixelColor(C.grid, x+i, y); img.setPixelColor(C.grid, x+i, y+boxH-1); }
  for (let i=0;i<boxH;i++) { img.setPixelColor(C.grid, x, y+i); img.setPixelColor(C.grid, x+boxW-1, y+i); }

  img.print(font, x+8, y+8, `Dice: ${dice || "-"}`);
}

async function renderLudoBoardUltra(game, opts = {}) {
  const img = new Jimp(W, H, C.bg);
  const font = await Jimp.loadFont(Jimp.FONT_SANS_16_BLACK);
  const fontSmall = await Jimp.loadFont(Jimp.FONT_SANS_16_BLACK);

  drawHomes(img);
  drawHomeTriangles(img);
  drawSafeCells(img);
  drawGrid(img);

  // Header
  img.print(font, PAD, 6, "LUDO KING • Ultra Board");

  const turnPlayer = opts.turnPlayer || null;
  if (turnPlayer) img.print(fontSmall, PAD + 270, 6, `Turn: @${turnPlayer.split("@")[0]}`);
  await drawDiceBox(img, opts.dice ?? null);

  // Build placements + stacking counts
  const players = Array.isArray(game.players) ? game.players : Object.keys(game.tokens || {});
  const tokensByPlayer = game.tokens || {};

  const cellCounts = new Map();
  const placements = [];

  for (let pi = 0; pi < players.length; pi++) {
    const jid = players[pi];
    const toks = tokensByPlayer[jid] || [0,0,0,0];

    for (let ti = 0; ti < toks.length; ti++) {
      const steps = toks[ti];

      if (steps === 0) {
        placements.push({ kind: "home", pi, ti, jid });
        continue;
      }
      if (steps === WIN_POS) {
        placements.push({ kind: "finish", pi, ti, jid });
        continue;
      }

      const cell = posToCell(steps, pi);
      if (!cell) continue;
      const key = cell.join(",");
      cellCounts.set(key, (cellCounts.get(key) || 0) + 1);
      placements.push({ kind: "track", pi, ti, jid, steps, cell });
    }
  }

  // Track tokens
  const seen = new Map();
  for (const t of placements) {
    if (t.kind !== "track") continue;
    const color = PLAYER_COLORS[t.pi % PLAYER_COLORS.length];
    const key = t.cell.join(",");
    const total = cellCounts.get(key) || 1;
    const s = seen.get(key) || 0;
    seen.set(key, s + 1);
    await drawToken(img, t.cell[0], t.cell[1], color, s, total);
  }

  // Home tokens
  for (const t of placements) {
    if (t.kind !== "home") continue;
    const color = PLAYER_COLORS[t.pi % PLAYER_COLORS.length];
    const spot = (HOME_SPOTS[t.pi] || HOME_SPOTS[0])[t.ti % 4];
    await drawToken(img, spot[0], spot[1], color, 0, 1);
  }

  // Finished tokens in center (simple)
  let k = 0;
  for (const t of placements) {
    if (t.kind !== "finish") continue;
    const color = PLAYER_COLORS[t.pi % PLAYER_COLORS.length];
    const cx = 6 + (k % 3);
    const cy = 6 + Math.floor(k / 3);
    await drawToken(img, cx, cy, color, 0, 1);
    k++;
  }

  // Player list with capture indicator ⚔️
  for (let i = 0; i < players.length; i++) {
    const jid = players[i];
    const name = jid.split("@")[0];
    const hasCap = game.captured?.[jid] ? "⚔️" : "";
    const sw = new Jimp(14, 14, PLAYER_COLORS[i % 4]);
    img.composite(sw, PAD + 420, 28 + i * 18);
    img.print(fontSmall, PAD + 440, 26 + i * 18, `${name} ${hasCap}`);
  }

  // Footer legend
  img.print(fontSmall, PAD + 140, PAD + GRID * CELL + 14, "★ safe • token colors = players • captures show ⚔️");

  return await img.getBufferAsync(Jimp.MIME_PNG);
}

module.exports = { renderLudoBoardUltra };
