const Jimp = require("jimp");

// 🎯 Token colors (RGBA)
const COLORS = [
  0xff0000ff, // Red
  0x1e88e5ff, // Blue
  0x43a047ff, // Green
  0xfdd835ff  // Yellow
];

// 🎯 Home positions inside bases (for YOUR image)
const HOME = [
  [[120,120],[180,120],[120,180],[180,180]], // Red
  [[520,120],[580,120],[520,180],[580,180]], // Blue
  [[120,520],[180,520],[120,580],[180,580]], // Green
  [[520,520],[580,520],[520,580],[580,580]]  // Yellow
];

// 🎯 Example track path (demo — extend later)
const PATH = [
  [340,60],[380,60],[420,60],[460,60],
  [500,60],[540,60],[580,60],[620,60]
];

async function renderBoardFromImage(game) {

  const board = await Jimp.read("./assets/ludo_board.png");

  const tokenSize = 28;

  game.players.forEach((player, pIndex) => {

    const tokens = game.tokens[player] || [];

    tokens.forEach((pos, tIndex) => {

      let x, y;

      // 🏠 Token still in home
      if (pos < 0) {
        [x, y] = HOME[pIndex][tIndex];
      }

      // 🚶 Token on board path
      else if (pos < PATH.length) {
        [x, y] = PATH[pos];
      }

      else return;

      const token = new Jimp(tokenSize, tokenSize, COLORS[pIndex]);
      token.circle();

      // ✨ White outline (professional look)
      const outline = new Jimp(tokenSize + 4, tokenSize + 4, 0xffffffff);
      outline.circle();

      board.composite(outline, x - 2, y - 2);
      board.composite(token, x, y);

    });

  });

  return await board.getBufferAsync(Jimp.MIME_PNG);
}

module.exports = { renderBoardFromImage };
