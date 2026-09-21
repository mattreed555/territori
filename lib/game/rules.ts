/** Rules live here; rendering and the Jev adapter consume this pure engine. */
export const RULES = { size: 8, pieces: 25, repetitions: 3 } as const;
export type Color = 'blue' | 'red';
export type Cell = Color | null;
export type Move = { type: 'place'; to: number } | { type: 'remove'; to: number } | { type: 'shift'; from: number; to: number };
export type Game = { board: Cell[]; turn: Color; supply: Record<Color, number>; captured: Record<Color, number>; ply: number; finalRound: boolean; ended: 'supply' | 'repetition' | null; positions: Record<string, number>; last: { color: Color; move: Move } | null };
export const other = (c: Color): Color => c === 'blue' ? 'red' : 'blue';
export const title = (s: string) => s === 'blue' ? 'Teal' : s === 'red' ? 'Apricot' : s[0].toUpperCase() + s.slice(1);
export function neighbors(i: number, size: number = RULES.size): number[] {
  const row = Math.floor(i / size), col = i % size;
  return [row > 0 ? i - size : -1, row < size - 1 ? i + size : -1, col > 0 ? i - 1 : -1, col < size - 1 ? i + 1 : -1].filter(n => n >= 0);
}
export const positionKey = (board: Cell[], turn: Color, supply: Record<Color, number>) => `${turn}:${supply.blue}:${supply.red}:` + board.map(c => c === 'blue' ? 'B' : c === 'red' ? 'R' : '.').join('');
export function newGame(): Game {
  const board: Cell[] = Array(RULES.size ** 2).fill(null);
  return { board, turn: 'blue', supply: { blue: RULES.pieces, red: RULES.pieces }, captured: { blue: 0, red: 0 }, ply: 0, finalRound: false, ended: null, positions: { [positionKey(board, 'blue', { blue: RULES.pieces, red: RULES.pieces })]: 1 }, last: null };
}
/** A target is capturable only when adjacent enemies outnumber its allies.
 * The target itself is not counted; ties and isolated stones are safe.
 */
export function isCapturable(board: Cell[], i: number, size: number = RULES.size) {
  const owner = board[i];
  if (!owner) return false;
  let allies = 0, enemies = 0;
  for (const n of neighbors(i, size)) {
    if (board[n] === owner) allies++;
    else if (board[n] === other(owner)) enemies++;
  }
  return enemies > allies;
}
export function territory(board: Cell[], size: number = RULES.size): Cell[] {
  return board.map((piece, i) => {
    if (piece) return piece;
    const reach = new Set(neighbors(i, size).map(n => board[n]).filter(Boolean));
    return reach.size === 1 ? [...reach][0] as Color : null;
  });
}
export function score(board: Cell[], size: number = RULES.size) {
  const land = territory(board, size), totals = { blue: 0, red: 0 }, largest = { blue: 0, red: 0 }, seen = new Set<number>();
  land.forEach((c, i) => {
    if (!c) return;
    totals[c]++;
    if (seen.has(i)) return;
    const stack = [i]; seen.add(i); let count = 0;
    while (stack.length) { const n = stack.pop()!; count++; neighbors(n, size).forEach(j => { if (!seen.has(j) && land[j] === c) { seen.add(j); stack.push(j); } }); }
    largest[c] = Math.max(largest[c], count);
  });
  const delta = totals.blue - totals.red || largest.blue - largest.red;
  return { land, totals, largest, winner: delta > 0 ? 'blue' as Color : delta < 0 ? 'red' as Color : null };
}
export function legalMoves(g: Pick<Game, 'board' | 'turn' | 'supply' | 'ended'>): Move[] {
  if (g.ended) return [];
  const moves: Move[] = [];
  g.board.forEach((c, i) => {
    if (!c && g.supply[g.turn] > 0) moves.push({ type: 'place', to: i });
    if (c === other(g.turn) && isCapturable(g.board, i)) moves.push({ type: 'remove', to: i });
    if (c === g.turn) neighbors(i).forEach(to => { if (!g.board[to]) moves.push({ type: 'shift', from: i, to }); });
  });
  return moves;
}
export const moveId = (m: Move) => m.type === 'shift' ? `shift_${m.from}_${m.to}` : `${m.type}_${m.to}`;
export function movedBoard(board: Cell[], turn: Color, m: Move): Cell[] {
  const next = [...board]; if (m.type === 'shift') next[m.from] = null; next[m.to] = m.type === 'remove' ? null : turn; return next;
}
/** Supplies are part of the position: a permanent capture is progress, not a loop. */
export const nextTurn = (g: Game): Color => other(g.turn);
export function nextPositionKey(g: Game, m: Move): string {
  const supply = { ...g.supply };
  if (m.type === 'place') supply[g.turn]--;
  return positionKey(movedBoard(g.board, g.turn, m), nextTurn(g), supply);
}
export function applyMove(g: Game, m: Move): Game {
  if (!legalMoves(g).some(legal => moveId(legal) === moveId(m))) throw new Error('That move is not legal.');
  const board = movedBoard(g.board, g.turn, m), supply = { ...g.supply }, captured = { ...g.captured };
  if (m.type === 'place') supply[g.turn]--;
  if (m.type === 'remove') captured[other(g.turn)]++;
  const turn = nextTurn(g);
  const finalRound = g.finalRound || (supply[g.turn] === 0);
  const key = positionKey(board, turn, supply), positions = { ...g.positions, [key]: (g.positions[key] || 0) + 1 };
  const ended = finalRound && g.turn === 'red' ? 'supply' : positions[key] >= RULES.repetitions ? 'repetition' : null;
  return { board, supply, captured, turn, ply: g.ply + 1, finalRound, ended, positions, last: { color: g.turn, move: m } };
}
export const coordinate = (i: number) => String.fromCharCode(65 + i % RULES.size) + (Math.floor(i / RULES.size) + 1);
export function moveLabel(m: Move) { return m.type === 'shift' ? `shifted ${coordinate(m.from)} to ${coordinate(m.to)}` : m.type === 'place' ? `placed at ${coordinate(m.to)}` : `captured at ${coordinate(m.to)}`; }
