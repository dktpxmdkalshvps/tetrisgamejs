import { test } from 'node:test';
import assert from 'node:assert';
import { getGhost, createBoard, ROWS, COLS } from './gameLogic.js';

test('getGhost returns the correct position on an empty board', () => {
  const board = createBoard();
  const piece = {
    key: 'O',
    shape: [[1, 1], [1, 1]],
    x: 4,
    y: 0
  };

  const ghost = getGhost(board, piece);

  // On an empty board of 20 rows, an O piece (height 2) starting at y=0
  // should fall to the bottom. Bottom row index is 19.
  // The piece's y is its top-left corner. So it should be at y = 20 - 2 = 18.
  assert.strictEqual(ghost.y, 18);
  assert.strictEqual(ghost.x, 4);
});

test('getGhost stops above obstacles', () => {
  const board = createBoard();
  // Place an obstacle at row 15, column 4
  board[15][4] = 'I';

  const piece = {
    key: 'O',
    shape: [[1, 1], [1, 1]],
    x: 4,
    y: 0
  };

  const ghost = getGhost(board, piece);

  // The piece has width 2 and is at x=4, so it occupies columns 4 and 5.
  // There is an obstacle at (15, 4).
  // The piece shape is:
  // (y, 4) (y, 5)
  // (y+1, 4) (y+1, 5)
  // To not collide with (15, 4), y+1 must be less than 15.
  // So y+1 = 14 => y = 13.
  assert.strictEqual(ghost.y, 13);
  assert.strictEqual(ghost.x, 4);
});

test('getGhost returns same position if piece is already at the bottom', () => {
  const board = createBoard();
  const piece = {
    key: 'I',
    shape: [[1, 1, 1, 1]],
    x: 0,
    y: 19
  };

  const ghost = getGhost(board, piece);

  assert.strictEqual(ghost.y, 19);
  assert.strictEqual(ghost.x, 0);
});

test('getGhost handles complex obstacles', () => {
  const board = createBoard();
  // Create a floor at row 10, but with a hole at column 5
  for (let c = 0; c < COLS; c++) {
    if (c !== 5) {
      board[10][c] = 'I';
    }
  }

  // Piece O at x=4, occupies columns 4 and 5.
  // It should be blocked by the obstacle at (10, 4).
  const pieceO = {
    key: 'O',
    shape: [[1, 1], [1, 1]],
    x: 4,
    y: 0
  };
  const ghostO = getGhost(board, pieceO);
  assert.strictEqual(ghostO.y, 8); // y+1 = 9 (bottom of piece) is above 10.

  // Piece I (vertical) at x=5, occupies only column 5.
  // It should fall through the hole at column 5 to the bottom.
  const pieceI = {
    key: 'I',
    shape: [[1], [1], [1], [1]],
    x: 5,
    y: 0
  };
  const ghostI = getGhost(board, pieceI);
  assert.strictEqual(ghostI.y, 16); // 20 - 4 = 16
});
