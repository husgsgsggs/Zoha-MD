const Jimp = require("jimp");

async function renderBoardFromImage(game) {
  const board = await Jimp.read("./assets/ludo_board.png");

  const tokenSize = 28;

  // Example coordinate map (EDIT later for perfect alignment)
  const PATH = [
    [50, 50], [90, 50], [130, 50], [170, 50], [210, 50],
    [250, 50], [290, 50], [330, 50], [370, 50]
  ];

  for (const [player, tokens] of Object.entries(game.tokens)) {
    const color =
      player === game.players[0] ? 0xff0000ff :
      player === game.players[1] ? 0x0000ffff :
      player === game.players[2] ? 0x00ff00ff :
      0xffff00ff;

    for (const pos of tokens) {
      if (pos < 0 || pos >= PATH.length) continue;

      const [x, y] = PATH[pos];

      const token = new Jimp(tokenSize, tokenSize, color);
      token.circle();

      board.composite(token, x, y);
    }
  }

  return board.getBufferAsync(Jimp.MIME_PNG);
}
