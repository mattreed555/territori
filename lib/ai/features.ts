import { applyMove, isCapturable, legalMoves, neighbors, nextPositionKey, other, score, RULES, type Cell, type Color, type Game, type Move } from '../game/rules';
export const FEATURE_VERSION = 1;
const exposure = (board: Cell[], color: Color) => board.reduce<number>((n,c,i) => n + Number(c === color && isCapturable(board,i)),0);
function largestGroup(board: Cell[], color: Color) {
  const seen = new Set<number>(); let largest = 0;
  board.forEach((c,i) => { if(c !== color || seen.has(i)) return; const queue=[i]; seen.add(i); let size=0;
    while(queue.length) { const j=queue.pop()!; size++; for(const k of neighbors(j)) if(board[k]===color && !seen.has(k)) { seen.add(k); queue.push(k); } } largest=Math.max(largest,size); });
  return largest;
}
function spread(board: Cell[], color: Color) {
  const cells=board.flatMap((c,i)=>c===color?[i]:[]); if(!cells.length)return 0;
  const rows=cells.map(i=>Math.floor(i/RULES.size)),cols=cells.map(i=>i%RULES.size);
  return (Math.max(...rows)-Math.min(...rows)+1)*(Math.max(...cols)-Math.min(...cols)+1);
}
type Context = ReturnType<typeof context>;
function context(game: Game, move: Move) {
  const next=applyMove(game,move), me=game.turn, opponent=other(me);
  return {game,move,next,me,opponent,before:score(game.board),after:score(next.board)};
}
/** Add/remove one named feature here; bump FEATURE_VERSION when semantics change. */
export const FEATURES: Record<string,(c: Context)=>number> = {
  territoryGain: c=>c.after.totals[c.me]-c.before.totals[c.me],
  opponentTerritoryLost:c=>c.before.totals[c.opponent]-c.after.totals[c.opponent],
  ownExposureChange:c=>exposure(c.next.board,c.me)-exposure(c.game.board,c.me),
  opponentExposureChange:c=>exposure(c.next.board,c.opponent)-exposure(c.game.board,c.opponent),
  ownGroupChange:c=>largestGroup(c.next.board,c.me)-largestGroup(c.game.board,c.me),
  largestTerritoryChange:c=>c.after.largest[c.me]-c.before.largest[c.me],
  // Hypothetical own next turn before an opponent reply; zero in terminal states.
  ownMobility:c=>legalMoves({...c.next,turn:c.me}).length,
  opponentMobility:c=>legalMoves(c.next).length,
  spreadChange:c=>spread(c.next.board,c.me)-spread(c.game.board,c.me),
  centerDistance:c=>Math.abs(c.move.to%RULES.size-(RULES.size-1)/2)+Math.abs(Math.floor(c.move.to/RULES.size)-(RULES.size-1)/2),
  ownPiecesRemaining:c=>c.next.supply[c.me],
  opponentPiecesRemaining:c=>c.next.supply[c.opponent],
  place:c=>Number(c.move.type==='place'), remove:c=>Number(c.move.type==='remove'), shift:c=>Number(c.move.type==='shift'),
  // Interactions let a linear policy change move preferences as supplies fall.
  placeReserve:c=>Number(c.move.type==='place')*c.game.supply[c.me]/RULES.pieces,
  removeReserve:c=>Number(c.move.type==='remove')*c.game.supply[c.me]/RULES.pieces,
  shiftReserve:c=>Number(c.move.type==='shift')*c.game.supply[c.me]/RULES.pieces,
  terminalWin:c=>Number(!!c.next.ended && c.after.winner===c.me),
  terminalLoss:c=>Number(!!c.next.ended && c.after.winner===c.opponent),
  repetitionCount:c=>c.game.positions[nextPositionKey(c.game,c.move)] || 0,
};
export const FEATURE_NAMES=Object.keys(FEATURES);
export function moveFeatures(game:Game,move:Move,names=FEATURE_NAMES) { const c=context(game,move);return names.map(name=>{if(!FEATURES[name])throw new Error(`Unknown feature ${name}`);return FEATURES[name](c);}); }
