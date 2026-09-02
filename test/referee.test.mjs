// The referee's pure half: reading a move out of an issue title, judging it
// against the game, and writing the README. The rules of chess themselves are
// proven by perft over in the Keep repository, whose chess-rules module is
// vendored here; these tests protect the game bookkeeping wrapped around it.
import test from 'node:test';
import assert from 'node:assert';
import {
  parseTitle, judge, drawBoard, moveList, renderReadme, FRESH_GAME,
} from '../scripts/referee.mjs';

const fresh = () => FRESH_GAME(1, { white: 0, black: 0, draws: 0 });

// Runs a sequence of moves through judge() the way the Action would,
// asserting each one lands.
function playOut(game, ucis, author = 'someone') {
  let ruling = null;
  for (const uci of ucis) {
    ruling = judge(game, { game: game.game, ply: game.ply, uci }, author);
    assert.ok(ruling.verdict === 'played' || ruling.verdict === 'finished',
      `${uci} should be accepted, got ${ruling.verdict}: ${ruling.say}`);
    game = ruling.game;
  }
  return ruling;
}

// ── the title protocol ──

test('parseTitle: the documented shape, with forgiving spacing', () => {
  assert.deepStrictEqual(parseTitle('keep-chess | g1 | ply8 | e2e4'),
    { game: 1, ply: 8, uci: 'e2e4' });
  assert.deepStrictEqual(parseTitle('KEEP-CHESS|g12|ply0|E7E8Q'),
    { game: 12, ply: 0, uci: 'e7e8q' });
});

test('parseTitle: everything else is somebody\'s ordinary issue', () => {
  for (const title of [
    'The board renders upside down',
    'keep-chess | g1 | ply8',
    'keep-chess | g1 | ply8 | e9e4',
    'keep-chess | g1 | ply8 | resign',
    '',
    null,
  ]) {
    assert.strictEqual(parseTitle(title), null, `should ignore: ${title}`);
  }
});

// ── judging ──

test('judge: a legal move advances the game and remembers its player', () => {
  const ruling = judge(fresh(), { game: 1, ply: 0, uci: 'e2e4' }, 'yarism');
  assert.strictEqual(ruling.verdict, 'played');
  assert.strictEqual(ruling.san, 'e4');
  assert.strictEqual(ruling.game.ply, 1);
  assert.deepStrictEqual(ruling.game.moves, [{ san: 'e4', uci: 'e2e4', by: 'yarism' }]);
  assert.match(ruling.game.fen, / b KQkq e3 /);
  assert.match(ruling.say, /@yarism/);
});

test('judge: a move for yesterday\'s position is stale, not illegal', () => {
  const game = judge(fresh(), { game: 1, ply: 0, uci: 'e2e4' }, 'a').game;
  const ruling = judge(game, { game: 1, ply: 0, uci: 'd2d4' }, 'b');
  assert.strictEqual(ruling.verdict, 'stale');
  assert.match(ruling.say, /got there first/);
});

test('judge: an illegal move is refused with the position quoted', () => {
  const ruling = judge(fresh(), { game: 1, ply: 0, uci: 'e2e5' }, 'a');
  assert.strictEqual(ruling.verdict, 'illegal');
  assert.match(ruling.say, /not a legal move/);
});

test('judge: checkmate closes the game, scores it, and racks up the next one', () => {
  const ruling = playOut(fresh(), ['f2f3', 'e7e5', 'g2g4', 'd8h4']);
  assert.strictEqual(ruling.verdict, 'finished');
  assert.strictEqual(ruling.san, 'Qh4#');
  assert.match(ruling.result, /checkmate, black wins/);
  assert.strictEqual(ruling.archive.game, 1);
  assert.strictEqual(ruling.archive.moves.length, 4);
  assert.deepStrictEqual(ruling.game,
    FRESH_GAME(2, { white: 0, black: 1, draws: 0 }));
});

test('judge: shuffling knights into a third repetition is a draw', () => {
  const shuffle = ['g1f3', 'g8f6', 'f3g1', 'f6g8'];
  const ruling = playOut(fresh(), [...shuffle, ...shuffle]);
  assert.strictEqual(ruling.verdict, 'finished');
  assert.match(ruling.result, /threefold/);
  assert.strictEqual(ruling.game.tally.draws, 1);
});

// ── the readme ──

test('drawBoard: the starting position, black on top', () => {
  const board = drawBoard(fresh().fen);
  assert.strictEqual(board.split('\n')[0], '8  ♜ ♞ ♝ ♛ ♚ ♝ ♞ ♜');
  assert.strictEqual(board.split('\n')[7], '1  ♖ ♘ ♗ ♕ ♔ ♗ ♘ ♖');
  assert.strictEqual(board.split('\n')[9], '   a b c d e f g h');
});

test('moveList: pairs the plies the way a scoresheet does', () => {
  const moves = [{ san: 'e4' }, { san: 'e5' }, { san: 'Nf3' }];
  assert.strictEqual(moveList(moves), '1. e4 e5 2. Nf3');
});

test('renderReadme: says whose move it is and how to make one', () => {
  const game = judge(fresh(), { game: 1, ply: 0, uci: 'e2e4' }, 'yarism').game;
  const readme = renderReadme(game);
  assert.match(readme, /Game 1 - move 1 - Black to play/);
  assert.match(readme, /Last move: e4 by @yarism/);
  assert.match(readme, /keep-chess \| g1 \| ply1 \| e2e4/);
});

test('renderReadme: a finished game gets its farewell line', () => {
  const ruling = playOut(fresh(), ['f2f3', 'e7e5', 'g2g4', 'd8h4']);
  const readme = renderReadme(ruling.game, ruling.archive);
  assert.match(readme, /Game 1 just ended: checkmate, black wins/);
  assert.match(readme, /Game 2 - move 1 - White to play/);
  assert.match(readme, /White 0 - Black 1 - draws 0/);
});

test('renderReadme: a check is announced on the status line', () => {
  const game = { ...fresh(), fen: 'rnbqkbnr/ppppp1pp/8/5p1Q/8/4P3/PPPP1PPP/RNB1KBNR b KQkq - 1 2', ply: 3 };
  assert.match(renderReadme(game), /Black to play, and Black is in check/);
});
