// ludo_renderer_image_king.js
// Renders tokens on TOP of your real board image (assets/ludo_board.png).
// Uses a 15x15 grid for track/lane cells + scaled pixel-perfect HOME circles.

const Jimp = require("jimp");
const path = require("path");

const { posToCell } = require("./ludo_engine_king_image");

const TOKEN_COLORS = {
  RED: 0xff0000ff,
  BLUE: 0x1e88e5ff,
  GREEN: 0x43a047ff,
  YELLOW: 0xfdd835ff
};

// These HOME circle centers are for a 768x768 reference version of your image.
// We SCALE them automatically to your actual png size.
const HOME_REF_768 = {
  RED:    [[145,145],[215,145],[145,215],[215,215]],
  BLUE:   [[555,145],[625,145],[555,215],[625,215]],
  GREEN:  [[145,555],[215,555],[145,625],[215,625]],
  YELLOW: [[555,555],[625,555],[555,625],[625,625]],
};

function scalePoint(pt, w, h, ref=768) {
  const sx = w / ref;
  const sy = h / ref;
  return [Math.round(pt[0]*sx), Math.round(pt[1]*sy)];
}

function cellCenter(w, h, row, col) {
  const cw = w / 15;
  const ch = h / 15;
  return [Math.round(col * cw + cw / 2), Math.round(row * ch + ch / 2)];
}

function drawToken(board, cx, cy, rgba, sizePx) {
  const token = new Jimp(sizePx, sizePx, rgba);
  // Jimp circle() exists in many setups; if it doesn't, you'll see an error.
  token.circle();

  const outline = new Jimp(sizePx + 4, sizePx + 4, 0xffffffff);
  outline.circle();

  board.composite(outline, cx - Math.floor((sizePx+4)/2), cy - Math.floor((sizePx+4)/2));
  board.composite(token, cx - Math.floor(sizePx/2), cy - Math.floor(sizePx/2));
}

async function renderBoardFromImage(game, opts = {}) {
  const boardPath = opts.boardPath || path.join(__dirname, "assets", "ludo_board.png");
  const board = await Jimp.read(boardPath);

  const w = board.bitmap.width;
  const h = board.bitmap.height;

  // token size relative to board (works for 768 or 1024 etc)
  const sizePx = Math.max(18, Math.round(Math.min(w,h) * 0.035));

  for (const p of game.players) {
    const toks = game.tokens[p.id] || [-1,-1,-1,-1];

    toks.forEach((pos, tIndex) => {
      const info = posToCell(game, p.id, pos);
      if (!info) return;

      let cx, cy;

      if (info.zone === "HOME") {
        const refPt = HOME_REF_768[p.color][tIndex];
        [cx, cy] = scalePoint(refPt, w, h);
      } else if (info.zone === "TRACK" || info.zone === "LANE") {
        [cx, cy] = cellCenter(w, h, info.r, info.c);
      } else if (pos === 57) {
        [cx, cy] = cellCenter(w, h, 7, 7); // center
      } else {
        return;
      }

      drawToken(board, cx, cy, TOKEN_COLORS[p.color], sizePx);
    });
  }

  return await board.getBufferAsync(Jimp.MIME_PNG);
}

module.exports = { renderBoardFromImage };
