// ── CONSTANTS ─────────────────────────────────────────────────────────────────
export const COLS = 10;

// ── HELPERS ───────────────────────────────────────────────────────────────────
export function removeLines(board, rows) {
  const kept = board.filter((_, i) => !rows.includes(i));
  return [...Array.from({ length: rows.length }, () => Array(COLS).fill(null)), ...kept];
}
