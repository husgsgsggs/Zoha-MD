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
  [[145,145],[215,145],[145,215],[215,215]], // Red
  [[555,145],[625,145],[555,215],[625,215]], // Blue
  [[145,555],[215,555],[145,625],[215,625]], // Green
  [[555,555],[625,555],[555,625],[625,625]]  // Yellow
];


// 🎯 Example track path (demo — extend later)
const PATH = [
  // 🔵 Top row (left → right)
  [260,60],[300,60],[340,60],[380,60],[420,60],[460,60],

  // 🔵 Right column (top → bottom)
  [500,100],[500,140],[500,180],[500,220],[500,260],[500,300],

  // 🔵 Bottom row (right → left)
  [460,340],[420,340],[380,340],[340,340],[300,340],[260,340],

  // 🔵 Left column (bottom → top)
  [220,300],[220,260],[220,220],[220,180],[220,140],[220,100]
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
