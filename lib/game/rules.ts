/** Rules live here; rendering and local AI consume this pure engine. */
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
// Internal immutable-by-convention adjacency. Public neighbors still returns a
// fresh array, so callers cannot mutate the engine's cached topology.
const adjacency = Array.from({length:RULES.size ** 2},(_,i)=>neighbors(i));
const adjacent = (i:number,size:number) => size===RULES.size && Number.isInteger(i) && i>=0 && i<adjacency.length ? adjacency[i] : neighbors(i,size);
export const positionKey = (board: Cell[], turn: Color, supply: Record<Color, number>) => {
  let key=`${turn}:${supply.blue}:${supply.red}:`;
  for(const piece of board)key+=piece==='blue'?'B':piece==='red'?'R':'.';
  return key;
};
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
  for (const n of adjacent(i, size)) {
    if (board[n] === owner) allies++;
    else if (board[n] === other(owner)) enemies++;
  }
  return enemies > allies;
}
export function territory(board: Cell[], size: number = RULES.size): Cell[] {
  return board.map((piece, i) => {
    if (piece) return piece;
    let blue=false,red=false;
    for(const n of adjacent(i,size)){if(board[n]==='blue')blue=true;else if(board[n]==='red')red=true;}
    return blue===red?null:blue?'blue':'red';
  });
}
export function score(board: Cell[], captured: Record<Color, number> = {blue:0,red:0}, size: number = RULES.size) {
  const land = territory(board, size), totals = { blue: 0, red: 0 }, largest = { blue: 0, red: 0 }, seen = new Uint8Array(board.length);
  land.forEach((c, i) => {
    if (!c) return;
    totals[c]++;
    if (seen[i]) return;
    const stack = [i]; seen[i]=1; let count = 0;
    while (stack.length) { const n = stack.pop()!; count++; for(const j of adjacent(n,size)){if(!seen[j] && land[j]===c){seen[j]=1;stack.push(j);}} }
    largest[c] = Math.max(largest[c], count);
  });
  const captures = { blue: captured.red, red: captured.blue };
  const points = { blue: totals.blue + captures.blue, red: totals.red + captures.red };
  const delta = points.blue - points.red || largest.blue - largest.red;
  return { land, totals, captures, points, largest, winner: delta > 0 ? 'blue' as Color : delta < 0 ? 'red' as Color : null };
}
export function legalMoves(g: Pick<Game, 'board' | 'turn' | 'supply' | 'ended'>): Move[] {
  if (g.ended) return [];
  const moves: Move[] = [];
  g.board.forEach((c, i) => {
    if (!c && g.supply[g.turn] > 0) moves.push({ type: 'place', to: i });
    if (c === other(g.turn) && isCapturable(g.board, i)) moves.push({ type: 'remove', to: i });
    if (c === g.turn) adjacent(i, RULES.size).forEach(to => { if (!g.board[to]) moves.push({ type: 'shift', from: i, to }); });
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
  return advanceLegalMove(g, m);
}
/** Enumerate already-validated successors without rechecking the full move list
 * for every sibling. Shares exactly the normal engine's transition semantics.
 */
export function* legalSuccessors(g: Game): Generator<{move: Move; game: Game}> {
  for (const move of legalMoves(g)) yield {move, game: advanceLegalMove(g, move)};
}
function advanceLegalMove(g: Game, m: Move): Game {
  const {board,supply,turn,finalRound,key,ended}=legalMoveOutcome(g,m), captured={...g.captured};
  if (m.type === 'remove') captured[other(g.turn)]++;
  const positions={...g.positions,[key]:(g.positions[key]||0)+1};
  return { board, supply, captured, turn, ply: g.ply + 1, finalRound, ended, positions, last: { color: g.turn, move: m } };
}
/** Leaf evaluation needs exact terminal/repetition semantics, but not a copied
 * history, capture ledger or last-move record. This is deliberately NOT a Game:
 * it cannot be advanced into another turn. Both paths share the outcome helper.
 */
export type ValueState = Pick<Game,'board'|'supply'|'captured'|'ended'>;
export function* legalValueSuccessors(g:Game):Generator<{move:Move;state:ValueState}> {
  for(const move of legalMoves(g)){
    const {board,supply,ended}=legalMoveOutcome(g,move);
    const captured={...g.captured};if(move.type==='remove')captured[other(g.turn)]++;
    yield {move,state:{board,supply,captured,ended}};
  }
}
function legalMoveOutcome(g:Game,m:Move) {
  const board = movedBoard(g.board, g.turn, m), supply = { ...g.supply };
  if (m.type === 'place') supply[g.turn]--;
  const turn = nextTurn(g);
  const finalRound = g.finalRound || (supply[g.turn] === 0);
  const key = positionKey(board, turn, supply);
  const ended:Game['ended'] = finalRound && g.turn === 'red' ? 'supply' : (g.positions[key]||0)+1 >= RULES.repetitions ? 'repetition' : null;
  return {board,supply,turn,finalRound,key,ended};
}
export const coordinate = (i: number) => String.fromCharCode(65 + i % RULES.size) + (Math.floor(i / RULES.size) + 1);
export function moveLabel(m: Move) { return m.type === 'shift' ? `shifted ${coordinate(m.from)} to ${coordinate(m.to)}` : m.type === 'place' ? `placed at ${coordinate(m.to)}` : `captured at ${coordinate(m.to)}`; }
