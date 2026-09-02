# Keep Chess

The whole world plays one game of chess, and a commit buys one move.

Every commit made in [Keep](https://github.com/yarism/keep) offers its author
the next move, for whichever side is to play. The move arrives here as an
issue, and the referee (an Action in this repository) checks it against the
rules of chess and commits it. The git log is the scoresheet: one move, one
commit, credited to its player.

## The board

**Game 1 - move 1 - White to play**

```
8  ♜ ♞ ♝ ♛ ♚ ♝ ♞ ♜
7  ♟ ♟ ♟ ♟ ♟ ♟ ♟ ♟
6  . . . . . . . .
5  . . . . . . . .
4  . . . . . . . .
3  . . . . . . . .
2  ♙ ♙ ♙ ♙ ♙ ♙ ♙ ♙
1  ♖ ♘ ♗ ♕ ♔ ♗ ♘ ♖

   a b c d e f g h
```

No moves yet - the first commit plays the first move.

## How to play

Commit something in [Keep](https://github.com/yarism/keep). The board appears,
you pick a move, and Keep opens the issue for you. That is the whole game:
whoever commits next, anywhere in the world, plays the next move.

No Keep at hand? Open an issue titled

```
keep-chess | g1 | ply0 | e2e4
```

with your move in [UCI notation](https://en.wikipedia.org/wiki/Universal_Chess_Interface)
(from-square, to-square, and a letter for promotions: e7e8q). The ply number
pins the position you were looking at; if someone beats you to it, the referee
explains and you get the next one.

Board read-only in Keep? Moving needs a GitHub token; `gh auth login` is the
quickest way to have one found. Never want the board again? One click on
"Never show again" in Keep, or `"chess": false` in its settings.json.

## The score

No finished games yet - this is game 1.

## Comments

Just wanted to test this game by a comment
