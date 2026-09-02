// The referee for Keep Chess.
//
// A move arrives as an issue titled `keep-chess | g<game> | ply<ply> | <uci>`.
// This script, run by the Action in .github/workflows/referee.yml, is the only
// thing that ever writes to game.json: it checks that the move was chosen
// against the current position, that it is legal chess, applies it, rewrites
// the README's board, and commits with the player's name in the message. The
// git log of this repository is therefore the game's scoresheet.
//
// Everything that can be judged without touching the world is in judge() and
// renderReadme(), which are pure and tested; main() at the bottom does the
// git, gh and filesystem work around them.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import {
  parseFen, toFen, legalMoves, applyMove, moveFromUci, san, outcome,
  positionKey, inCheck, algebraic, START_FEN,
} from './chess-rules.mjs';

export const FRESH_GAME = (number, tally) => ({
  game: number,
  ply: 0,
  fen: START_FEN,
  moves: [],
  positions: [],
  tally,
});

// `keep-chess | g1 | ply8 | e2e4` with forgiving spacing. Anything else is
// somebody's ordinary issue and none of the referee's business.
export function parseTitle(title) {
  const m = /^keep-chess\s*\|\s*g\s*(\d+)\s*\|\s*ply\s*(\d+)\s*\|\s*([a-h][1-8][a-h][1-8][qrbn]?)\s*$/i
    .exec(String(title || '').trim());
  return m ? { game: Number(m[1]), ply: Number(m[2]), uci: m[3].toLowerCase() } : null;
}

const RESULT_WORDS = {
  checkmate: 'checkmate',
  stalemate: 'stalemate, a draw',
  'fifty-move': 'a draw by the fifty-move rule',
  threefold: 'a draw by threefold repetition',
  insufficient: 'a draw, neither side can mate',
};

export function judge(game, request, author) {
  if (request.game !== game.game || request.ply !== game.ply) {
    return {
      verdict: 'stale',
      say: `The world got there first: this move was chosen for game ${request.game} at ply `
        + `${request.ply}, but the game is at game ${game.game}, ply ${game.ply}. `
        + 'The next commit in Keep offers a fresh turn.',
    };
  }
  const position = parseFen(game.fen);
  const move = moveFromUci(position, request.uci);
  if (!move) {
    return {
      verdict: 'illegal',
      say: `${request.uci} is not a legal move in the current position (${game.fen}).`,
    };
  }

  const notation = san(position, move);
  const next = applyMove(position, move);
  const positions = [...game.positions, positionKey(position)];
  const moves = [...game.moves, { san: notation, uci: request.uci, by: author }];
  const end = outcome(next, positions);

  if (end.status === 'playing') {
    return {
      verdict: 'played',
      san: notation,
      game: { ...game, ply: game.ply + 1, fen: toFen(next), moves, positions },
      say: `${notation} is on the board. Game ${game.game} continues at ply ${game.ply + 1}, `
        + `${next.turn === 'w' ? 'White' : 'Black'} to play. Thanks, @${author}.`,
    };
  }

  const tally = { ...game.tally };
  if (end.winner === 'white') tally.white += 1;
  else if (end.winner === 'black') tally.black += 1;
  else tally.draws += 1;
  const result = RESULT_WORDS[end.status] + (end.winner ? `, ${end.winner} wins` : '');
  return {
    verdict: 'finished',
    san: notation,
    result,
    archive: { game: game.game, result, finalFen: toFen(next), moves },
    game: FRESH_GAME(game.game + 1, tally),
    say: `${notation} ends game ${game.game}: ${result}. Game ${game.game + 1} starts from the `
      + `top - the next commit in Keep plays its first move. Thanks, @${author}.`,
  };
}

// ── The README, regenerated wholesale after every move ──

const GLYPHS = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
};

export function drawBoard(fen) {
  const position = parseFen(fen);
  const lines = [];
  for (let rank = 7; rank >= 0; rank--) {
    const row = [];
    for (let file = 0; file < 8; file++) {
      const piece = position.board[rank * 16 + file];
      row.push(piece ? GLYPHS[piece] : '.');
    }
    lines.push(`${rank + 1}  ${row.join(' ')}`);
  }
  lines.push('');
  lines.push('   a b c d e f g h');
  return lines.join('\n');
}

export function moveList(moves) {
  const parts = [];
  for (let i = 0; i < moves.length; i += 2) {
    const white = moves[i].san;
    const black = moves[i + 1] ? ` ${moves[i + 1].san}` : '';
    parts.push(`${i / 2 + 1}. ${white}${black}`);
  }
  return parts.join(' ');
}

export function renderReadme(game, finished = null) {
  const position = parseFen(game.fen);
  const toMove = position.turn === 'w' ? 'White' : 'Black';
  const check = inCheck(position) ? `, and ${toMove} is in check` : '';
  const last = game.moves[game.moves.length - 1];
  const total = game.tally.white + game.tally.black + game.tally.draws;

  return `# Keep Chess

The whole world plays one game of chess, and a commit buys one move.

Every commit made in [Keep](https://github.com/yarism/keep) offers its author
the next move, for whichever side is to play. The move arrives here as an
issue, and the referee (an Action in this repository) checks it against the
rules of chess and commits it. The git log is the scoresheet: one move, one
commit, credited to its player.

## The board

**Game ${game.game} - move ${Math.floor(game.ply / 2) + 1} - ${toMove} to play${check}**

\`\`\`
${drawBoard(game.fen)}
\`\`\`

${last ? `Last move: ${last.san} by @${last.by}` : 'No moves yet - the first commit plays the first move.'}
${game.moves.length ? `\n${moveList(game.moves)}\n` : ''}${finished ? `\nGame ${finished.game} just ended: ${finished.result}. Its scoresheet is in [games/](games/).\n` : ''}
## How to play

Commit something in [Keep](https://github.com/yarism/keep). The board appears,
you pick a move, and Keep opens the issue for you. That is the whole game:
whoever commits next, anywhere in the world, plays the next move.

No Keep at hand? Open an issue titled

\`\`\`
keep-chess | g${game.game} | ply${game.ply} | e2e4
\`\`\`

with your move in [UCI notation](https://en.wikipedia.org/wiki/Universal_Chess_Interface)
(from-square, to-square, and a letter for promotions: e7e8q). The ply number
pins the position you were looking at; if someone beats you to it, the referee
explains and you get the next one.

Board read-only in Keep? Moving needs a GitHub token; \`gh auth login\` is the
quickest way to have one found. Never want the board again? One click on
"Never show again" in Keep, or \`"chess": false\` in its settings.json.

## The score

${total === 0 ? 'No finished games yet - this is game 1.' : `White ${game.tally.white} - Black ${game.tally.black} - draws ${game.tally.draws}, over ${total} finished ${total === 1 ? 'game' : 'games'} (scoresheets in [games/](games/)).`}
`;
}

// ── The worldly part ──

const run = (command, args, opts = {}) =>
  execFileSync(command, args, { encoding: 'utf-8', ...opts });

function loadGame() {
  return JSON.parse(readFileSync('game.json', 'utf-8'));
}

function saveOutcome(ruling) {
  writeFileSync('game.json', JSON.stringify(ruling.game, null, 2) + '\n');
  if (ruling.verdict === 'finished') {
    writeFileSync(`games/g${ruling.archive.game}.json`,
      JSON.stringify({ ...ruling.archive, finished: new Date().toISOString() }, null, 2) + '\n');
    writeFileSync('README.md', renderReadme(ruling.game, ruling.archive));
  } else {
    writeFileSync('README.md', renderReadme(ruling.game));
  }
}

export function main(env = process.env) {
  const request = parseTitle(env.ISSUE_TITLE);
  if (!request) return; // an ordinary issue, for ordinary humans

  const author = env.ISSUE_AUTHOR || 'someone';
  const issue = ['-R', env.GITHUB_REPOSITORY, env.ISSUE_NUMBER];
  const reply = (body) => {
    run('gh', ['issue', 'comment', ...issue.slice(0, 2), issue[2], '--body', body]);
    run('gh', ['issue', 'close', ...issue.slice(0, 2), issue[2]]);
  };

  run('git', ['config', 'user.name', 'keep-chess referee']);
  run('git', ['config', 'user.email', 'referee@users.noreply.github.com']);

  // Two moves can race in from two corners of the world. The loser's push is
  // rejected, so on rejection: back up to what the world settled on, judge
  // the same issue again (usually now stale), and say so honestly.
  for (let attempt = 0; attempt < 3; attempt++) {
    const ruling = judge(loadGame(), request, author);
    if (ruling.verdict !== 'played' && ruling.verdict !== 'finished') {
      reply(ruling.say);
      return;
    }
    saveOutcome(ruling);
    const credit = env.ISSUE_AUTHOR_ID
      ? `\n\nCo-authored-by: ${author} <${env.ISSUE_AUTHOR_ID}+${author}@users.noreply.github.com>`
      : '';
    const summary = ruling.verdict === 'finished'
      ? `g${request.game} ply${request.ply + 1}: ${ruling.san} by @${author} - ${ruling.result}`
      : `g${request.game} ply${request.ply + 1}: ${ruling.san} by @${author}`;
    run('git', ['add', '-A']);
    run('git', ['commit', '-m', summary + credit]);
    try {
      run('git', ['push']);
      reply(ruling.say);
      return;
    } catch {
      run('git', ['fetch', 'origin']);
      run('git', ['reset', '--hard', 'origin/main']);
    }
  }
  reply('The referee could not get a word in edgewise - three pushes lost three races. '
    + 'The move was not played; the next commit in Keep offers a fresh turn.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
