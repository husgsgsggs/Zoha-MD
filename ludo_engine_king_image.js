// ludo_engine_king_image.js
// Professional Ludo King-style engine (positions: -1 home, 0..51 track, 52..57 home lane, 57 finished).
// Designed for a standard 15x15 Ludo board (same layout as your provided image).

const COLORS = ["RED", "BLUE", "GREEN", "YELLOW"];

// 52-step GLOBAL TRACK in 15x15 grid coordinates (row, col).
// This matches the classic Ludo loop around the central cross.
const TRACK_52 = [
  [6,0],[6,1],[6,2],[6,3],[6,4],[6,5],
  [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],
  [0,7],
  [0,8],[1,8],[2,8],[3,8],[4,8],[5,8],
  [6,9],[6,10],[6,11],[6,12],[6,13],[6,14],
  [7,14],
  [8,14],[8,13],[8,12],[8,11],[8,10],[8,9],
  [9,8],[10,8],[11,8],[12,8],[13,8],[14,8],
  [14,7],
  [14,6],[13,6],[12,6],[11,6],[10,6],[9,6],
  [8,5],[8,4],[8,3],[8,2],[8,1],[8,0],
  [7,0]
];

// Start square index in TRACK_52 for each color for YOUR board orientation:
// Red=top-left start, Blue=top-right start, Green=bottom-left start, Yellow=bottom-right start
const START_INDEX = {
  RED: 1,     // TRACK_52[1]  => (6,1)
  BLUE: 14,   // TRACK_52[14] => (1,8)
  GREEN: 40,  // TRACK_52[40] => (13,6)
  YELLOW: 27  // TRACK_52[27] => (8,13)
};

// Home lane (finish lane) per color: 6 cells to center (positions 52..57).
const HOME_LANE = {
  RED:    [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],
  BLUE:   [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
  GREEN:  [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]],
  YELLOW: [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],
};

// Safe tiles (no capture). Includes 4 starts + typical star positions on classic layout.
// If your star squares differ, you can tweak STAR_INDEXES later.
const STAR_INDEXES = [9, 22, 35, 48];
const SAFE_TRACK_INDEXES = new Set([
  ...STAR_INDEXES,
  START_INDEX.RED, START_INDEX.BLUE, START_INDEX.GREEN, START_INDEX.YELLOW
]);

function makeGame(chatId) {
  return {
    chatId,
    status: "LOBBY",     // LOBBY | PLAYING | ENDED
    players: [],         // [{ id, color }]
    tokens: {},          // { playerId: [-1,-1,-1,-1] }
    turn: 0,
    dice: null,
    lastMove: null,
    winner: null,
  };
}

function addPlayer(game, playerId) {
  if (game.status !== "LOBBY") throw new Error("Game already started");
  if (game.players.some(p => p.id === playerId)) return;

  if (game.players.length >= 4) throw new Error("Game is full");

  const color = COLORS[game.players.length];
  game.players.push({ id: playerId, color });

  // ✅ IMPORTANT: all tokens start IN HOME
  game.tokens[playerId] = [-1, -1, -1, -1];
}

function startGame(game) {
  if (game.players.length < 2) throw new Error("Need at least 2 players");
  game.status = "PLAYING";
  game.turn = 0;
  game.dice = null;
  game.lastMove = null;
  game.winner = null;
}

function currentPlayer(game) {
  return game.players[game.turn];
}

function rollDice(game) {
  if (game.status !== "PLAYING") throw new Error("Game not started");
  if (game.dice != null) throw new Error("Dice already rolled");

  game.dice = Math.floor(Math.random() * 6) + 1;
  return game.dice;
}

function canMove(pos, dice) {
  if (pos < 0) return dice === 6;                 // must roll 6 to open
  if (pos >= 0 && pos <= 57) return pos + dice <= 57; // can't overshoot finish
  return false;
}

// Convert a logical pos to global track index (0..51) for capture checks.
// Only valid if pos is on track (0..51).
function posToTrackIndex(color, pos) {
  const start = START_INDEX[color];
  return (start + pos) % 52;
}

function applyCapture(game, moverId, moverTokenIndex) {
  const moverPlayer = game.players.find(p => p.id === moverId);
  if (!moverPlayer) return;

  const moverPos = game.tokens[moverId][moverTokenIndex];
  if (moverPos < 0 || moverPos > 51) return; // captures only on main track

  const moverTrackIndex = posToTrackIndex(moverPlayer.color, moverPos);

  // Safe tile => no capture
  if (SAFE_TRACK_INDEXES.has(moverTrackIndex)) return;

  for (const p of game.players) {
    if (p.id === moverId) continue;

    for (let ti = 0; ti < 4; ti++) {
      const oppPos = game.tokens[p.id][ti];
      if (oppPos < 0 || oppPos > 51) continue;

      const oppTrackIndex = posToTrackIndex(p.color, oppPos);
      if (oppTrackIndex === moverTrackIndex) {
        game.tokens[p.id][ti] = -1;
        game.lastMove.capture = { victim: p.id, token: ti };
      }
    }
  }
}

function nextTurn(game) {
  game.dice = null;
  game.turn = (game.turn + 1) % game.players.length;
}

function moveToken(game, playerId, tokenIndex) {
  if (game.status !== "PLAYING") throw new Error("Game not started");

  const cp = currentPlayer(game);
  if (!cp || cp.id !== playerId) throw new Error("Not your turn");

  if (game.dice == null) throw new Error("Roll dice first");

  const dice = game.dice;

  const tokens = game.tokens[playerId];
  if (!tokens) throw new Error("Player not in game");
  if (tokenIndex < 0 || tokenIndex > 3) throw new Error("Token must be 1..4");

  const pos = tokens[tokenIndex];
  if (!canMove(pos, dice)) throw new Error("Move not possible");

  let newPos;
  if (pos < 0) {
    // Open token on 6 => goes to track pos 0
    newPos = 0;
  } else {
    newPos = pos + dice;
  }

  tokens[tokenIndex] = newPos;

  game.lastMove = { playerId, tokenIndex, from: pos, to: newPos, dice, capture: null };

  applyCapture(game, playerId, tokenIndex);

  // Win: all 4 tokens at 57
  if (tokens.every(t => t === 57)) {
    game.status = "ENDED";
    game.winner = playerId;
    game.dice = null;
    return;
  }

  // Extra turn on 6
  if (dice === 6) {
    game.dice = null; // same player rolls again
  } else {
    nextTurn(game);
  }
}

// For rendering: convert token pos to board grid cell or HOME zone
function posToCell(game, playerId, pos) {
  const player = game.players.find(p => p.id === playerId);
  if (!player) return null;

  const color = player.color;

  if (pos < 0) return { zone: "HOME" };

  if (pos <= 51) {
    const trackIndex = posToTrackIndex(color, pos);
    const [r, c] = TRACK_52[trackIndex];
    return { zone: "TRACK", r, c, trackIndex };
  }

  if (pos >= 52 && pos <= 57) {
    const laneIdx = pos - 52;
    const [r, c] = HOME_LANE[color][laneIdx];
    return { zone: "LANE", r, c };
  }

  return { zone: "FINISHED" };
}

module.exports = {
  makeGame,
  addPlayer,
  startGame,
  rollDice,
  moveToken,
  currentPlayer,
  posToCell,
  TRACK_52,
  HOME_LANE,
  START_INDEX
};
