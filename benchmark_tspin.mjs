import { performance } from 'perf_hooks';

const ROWS = 20;
const COLS = 10;
const b = Array.from({length: ROWS}, () => Array(COLS).fill(0));
b[19][0] = 1;
b[19][2] = 1;

const piece = { key: "T", y: 17, x: 0 };
const lastRotation = { current: true };

function testOriginal() {
  let tSpin = false;
  if (piece.key==="T" && lastRotation.current) {
    const corners = [[piece.y,piece.x],[piece.y,piece.x+2],[piece.y+2,piece.x],[piece.y+2,piece.x+2]];
    const occ = corners.filter(([y,x]) => y>=ROWS||x<0||x>=COLS||(b[y]&&b[y][x])).length;
    if (occ>=3) tSpin=true;
  }
  return tSpin;
}

function testOptimized() {
  let tSpin = false;
  if (piece.key==="T" && lastRotation.current) {
    const py = piece.y;
    const px = piece.x;
    let occ = 0;

    if (py >= ROWS || px < 0 || px >= COLS || (b[py] && b[py][px])) occ++;
    if (py >= ROWS || px + 2 < 0 || px + 2 >= COLS || (b[py] && b[py][px + 2])) occ++;
    if (py + 2 >= ROWS || px < 0 || px >= COLS || (b[py + 2] && b[py + 2][px])) occ++;
    if (py + 2 >= ROWS || px + 2 < 0 || px + 2 >= COLS || (b[py + 2] && b[py + 2][px + 2])) occ++;

    if (occ >= 3) tSpin = true;
  }
  return tSpin;
}

const ITERATIONS = 10000000;

let start = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
  testOriginal();
}
let end = performance.now();
const timeOriginal = end - start;

start = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
  testOptimized();
}
end = performance.now();
const timeOptimized = end - start;

console.log(`Original: ${timeOriginal.toFixed(2)}ms`);
console.log(`Optimized: ${timeOptimized.toFixed(2)}ms`);
console.log(`Improvement: ${((timeOriginal - timeOptimized) / timeOriginal * 100).toFixed(2)}%`);
