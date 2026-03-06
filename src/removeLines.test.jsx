import { describe, it, expect } from 'vitest';
import { removeLines, COLS } from './utils.js';

describe('removeLines', () => {
  const createBoard = (rows) => Array.from({ length: rows }, () => Array(COLS).fill(null));

  it('should return a new board of the same size when removing no lines', () => {
    const board = createBoard(4);
    board[3][0] = 'I';

    const newBoard = removeLines(board, []);

    expect(newBoard).toEqual(board);
    expect(newBoard.length).toBe(4);
  });

  it('should remove a single line and add a new empty line at the top', () => {
    const board = createBoard(4);
    board[0] = Array(COLS).fill('I');
    board[1] = Array(COLS).fill('J');
    board[2] = Array(COLS).fill('L');
    board[3] = Array(COLS).fill('O'); // The line to remove

    const newBoard = removeLines(board, [3]);

    expect(newBoard.length).toBe(4);
    // The new top line should be empty
    expect(newBoard[0]).toEqual(Array(COLS).fill(null));
    // The rest of the board should be shifted down
    expect(newBoard[1]).toEqual(Array(COLS).fill('I'));
    expect(newBoard[2]).toEqual(Array(COLS).fill('J'));
    expect(newBoard[3]).toEqual(Array(COLS).fill('L'));
  });

  it('should remove multiple contiguous lines and add empty lines at the top', () => {
    const board = createBoard(5);
    board[0] = Array(COLS).fill('A');
    board[1] = Array(COLS).fill('B');
    board[2] = Array(COLS).fill('C'); // To remove
    board[3] = Array(COLS).fill('D'); // To remove
    board[4] = Array(COLS).fill('E');

    const newBoard = removeLines(board, [2, 3]);

    expect(newBoard.length).toBe(5);
    expect(newBoard[0]).toEqual(Array(COLS).fill(null));
    expect(newBoard[1]).toEqual(Array(COLS).fill(null));
    expect(newBoard[2]).toEqual(Array(COLS).fill('A'));
    expect(newBoard[3]).toEqual(Array(COLS).fill('B'));
    expect(newBoard[4]).toEqual(Array(COLS).fill('E'));
  });

  it('should remove multiple non-contiguous lines and add empty lines at the top', () => {
    const board = createBoard(5);
    board[0] = Array(COLS).fill('A');
    board[1] = Array(COLS).fill('B'); // To remove
    board[2] = Array(COLS).fill('C');
    board[3] = Array(COLS).fill('D'); // To remove
    board[4] = Array(COLS).fill('E');

    const newBoard = removeLines(board, [1, 3]);

    expect(newBoard.length).toBe(5);
    expect(newBoard[0]).toEqual(Array(COLS).fill(null));
    expect(newBoard[1]).toEqual(Array(COLS).fill(null));
    expect(newBoard[2]).toEqual(Array(COLS).fill('A'));
    expect(newBoard[3]).toEqual(Array(COLS).fill('C'));
    expect(newBoard[4]).toEqual(Array(COLS).fill('E'));
  });

  it('should handle removing the top line', () => {
    const board = createBoard(3);
    board[0] = Array(COLS).fill('A'); // To remove
    board[1] = Array(COLS).fill('B');
    board[2] = Array(COLS).fill('C');

    const newBoard = removeLines(board, [0]);

    expect(newBoard.length).toBe(3);
    expect(newBoard[0]).toEqual(Array(COLS).fill(null));
    expect(newBoard[1]).toEqual(Array(COLS).fill('B'));
    expect(newBoard[2]).toEqual(Array(COLS).fill('C'));
  });

  it('should return an empty board when all lines are removed', () => {
    const board = createBoard(3);
    board[0] = Array(COLS).fill('A');
    board[1] = Array(COLS).fill('B');
    board[2] = Array(COLS).fill('C');

    const newBoard = removeLines(board, [0, 1, 2]);

    expect(newBoard.length).toBe(3);
    expect(newBoard[0]).toEqual(Array(COLS).fill(null));
    expect(newBoard[1]).toEqual(Array(COLS).fill(null));
    expect(newBoard[2]).toEqual(Array(COLS).fill(null));
  });
});
