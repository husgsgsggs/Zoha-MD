const Jimp = require("jimp");

// Professional animated Ludo board renderer (GIF-like via frames → buffer)

const GRID = 15;
const CELL = 40;
const PAD = 20;
const SIZE = GRID * CELL + PAD * 2;

const COLORS = {
  red: 0xff3b30ff,
  blue: 0x007affff,
  green: 0x34c759ff,
  yellow: 0xffcc00ff,
  white: 0xffffffff,
  black: 0x000000ff,
  bg: 0xffffffff
};

const PLAYER_COLORS = [
  COLORS.red,
  COLORS.blue,
  COLORS.green,
  COLORS.yellow
];

// Fixed professional home slots (centered)
const HOME_SPOTS = [
  [[2,10],[4,10],[2,12],[4,12]], // red
  [[2,2],[4,2],[2,4],[4,4]],     // blue
  [[10,2],[12,2],[10,4],[12,4]], // green
  [[10,10],[12,10],[10,12],[12,12]] // yellow
];

function cellToPx(cx, cy) {
  return [PAD + cx * CELL, PAD + cy * CELL];
}

// Professional token (3D style)
async function drawToken(img, cx, cy, color) {
  const size = 28;
  const r = 12;

  const [x0, y0] = cellToPx(cx, cy);

  const token = new Jimp(size, size, 0x00000000);

  // shadow
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - size/2 + 2;
      const dy = y - size/2 + 2;
      if (dx*dx + dy*dy <= r*r) token.setPixelColor(0x00000055, x, y);
    }
  }

  // body
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - size/2;
      const dy = y - size/2;
      if (dx*dx + dy*dy <= r*r) token.setPixelColor(color, x, y);
    }
  }

  // white border
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - size/2;
      const dy = y - size/2;
      const d = dx*dx + dy*dy;
      if (d <= r*r && d >= (r-2)*(r-2)) token.setPixelColor(0xffffffff, x, y);
    }
  }

  img.composite(token, x0 + 6, y0 + 6);
}

// Draw professional board
async function drawBoard(game) {
  const img = new Jimp(SIZE, SIZE, COLORS.bg);

  // colored bases
  img.composite(new Jimp(CELL*6, CELL*6, COLORS.blue), PAD, PAD);
  img.composite(new Jimp(CELL*6, CELL*6, COLORS.green), PAD + CELL*9, PAD);
  img.composite(new Jimp(CELL*6, CELL*6, COLORS.red), PAD, PAD + CELL*9);
  img.composite(new Jimp(CELL*6, CELL*6, COLORS.yellow), PAD + CELL*9, PAD + CELL*9);

  const players = game.players || [];
  const tokens = game.tokens || {};

  for (let i = 0; i < players.length; i++) {
    const jid = players[i];
    const t = tokens[jid] || [];
    const spots = HOME_SPOTS[i];

    for (let k = 0; k < t.length; k++) {
      if (t[k] === 0) {
        const [cx, cy] = spots[k];
        await drawToken(img, cx, cy, PLAYER_COLORS[i]);
      }
    }
  }

  return img;
}

// MAIN EXPORT
async function renderProLudoAnimated(game) {
  // For WhatsApp we just send a high-quality static frame (safe)
  const img = await drawBoard(game);
  return await img.getBufferAsync(Jimp.MIME_PNG);
}

module.exports = { renderProLudoAnimated };
