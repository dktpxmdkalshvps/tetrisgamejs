export const COLS = 10;
export const ROWS = 20;

export const TETROMINOES = {
  I: { shape:[[1,1,1,1]] },
  O: { shape:[[1,1],[1,1]] },
  T: { shape:[[0,1,0],[1,1,1]] },
  S: { shape:[[0,1,1],[1,1,0]] },
  Z: { shape:[[1,1,0],[0,1,1]] },
  J: { shape:[[1,0,0],[1,1,1]] },
  L: { shape:[[0,0,1],[1,1,1]] },
};

export const PIECE_KEYS = Object.keys(TETROMINOES);

export const createBoard = () => Array.from({length:ROWS}, () => Array(COLS).fill(null));

export const rotateCW = s => s[0].map((_,ci) => s.map(r=>r[ci]).reverse());

export function createPiece(key) {
  return { key, shape:[...TETROMINOES[key].shape.map(r=>[...r])],
           x: Math.floor(COLS/2)-Math.ceil(TETROMINOES[key].shape[0].length/2), y:0 };
}

export function isValid(board, shape, x, y) {
  for (let r=0;r<shape.length;r++) for (let c=0;c<shape[r].length;c++) {
    if (!shape[r][c]) continue;
    const nr=r+y, nc=c+x;
    if (nr<0||nr>=ROWS||nc<0||nc>=COLS||board[nr][nc]) return false;
  } return true;
}

export function lockPiece(board, piece) {
  const b=board.map(r=>[...r]);
  piece.shape.forEach((row,r)=>row.forEach((cell,c)=>{ if(cell) b[piece.y+r][piece.x+c]=piece.key; }));
  return b;
}

export function findFullRows(board) { return board.reduce((a,row,i)=>{if(row.every(c=>c))a.push(i);return a;},[]);}

export function removeLines(board,rows) {
  const kept=board.filter((_,i)=>!rows.includes(i));
  return [...Array.from({length:rows.length},()=>Array(COLS).fill(null)),...kept];
}

export function getGhost(board,piece) {
  let g={...piece}; while(isValid(board,g.shape,g.x,g.y+1)) g={...g,y:g.y+1}; return g;
}
