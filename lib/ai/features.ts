import { applyMove, isCapturable, legalMoves, legalSuccessors, neighbors, nextPositionKey, other, score, RULES, type Cell, type Color, type Game, type Move } from '../game/rules';
import { captureOutcome } from '../game/jev';
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
function baseContext(game:Game) {
  const cache=new Map<string,number>(),metrics={exposure,largestGroup,spread};
  return {before:score(game.board),beforeMetric:(name:keyof typeof metrics,color:Color)=>{
    const key=name+color;if(!cache.has(key))cache.set(key,metrics[name](game.board,color));return cache.get(key)!;
  }};
}
function context(game: Game, move: Move, base=baseContext(game), next=applyMove(game,move)) {
  const me=game.turn, opponent=other(me);
  let reply:ReturnType<typeof captureOutcome>|undefined;
  return {game,move,next,me,opponent,...base,after:score(next.board),
    capture:()=>reply===undefined ? (reply=captureOutcome(game,move)) : reply};
}
/** Add/remove one named feature here; bump FEATURE_VERSION when semantics change. */
export const FEATURES: Record<string,(c: Context)=>number> = {
  territoryGain: c=>c.after.totals[c.me]-c.before.totals[c.me],
  opponentTerritoryLost:c=>c.before.totals[c.opponent]-c.after.totals[c.opponent],
  ownExposureChange:c=>exposure(c.next.board,c.me)-c.beforeMetric('exposure',c.me),
  opponentExposureChange:c=>exposure(c.next.board,c.opponent)-c.beforeMetric('exposure',c.opponent),
  ownGroupChange:c=>largestGroup(c.next.board,c.me)-c.beforeMetric('largestGroup',c.me),
  largestTerritoryChange:c=>c.after.largest[c.me]-c.before.largest[c.me],
  // Hypothetical own next turn before an opponent reply; zero in terminal states.
  ownMobility:c=>legalMoves({...c.next,turn:c.me}).length,
  opponentMobility:c=>legalMoves(c.next).length,
  spreadChange:c=>spread(c.next.board,c.me)-c.beforeMetric('spread',c.me),
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
// Opt-in additions. Existing feature meanings/defaults and v1 models stay intact.
// Capture replies use exactly the same legal one-reply calculation supplied to Jev.
const tactical:Record<string,(c:Context)=>number>={
  movedStoneExposed:c=>Number(c.move.type!=='remove' && isCapturable(c.next.board,c.move.to)),
  captureReplyAvailable:c=>Number(c.capture()!==null),
  captureReplyOwnGain:c=>c.capture()?.myNetTerritoryGain ?? c.after.totals[c.me]-c.before.totals[c.me],
  captureReplyOpponentLoss:c=>c.before.totals[c.opponent]-(c.capture()?.territoryAfterReply[c.opponent] ?? c.after.totals[c.opponent]),
  captureReplyLargestChange:c=>(c.capture()?.myLargestAreaAfterReply ?? c.after.largest[c.me])-c.before.largest[c.me],
  captureReplyWastesStone:c=>Number(c.move.type==='place' && !!c.capture()?.boardReturnsToCurrentPosition),
  captureReplyTerminalWin:c=>Number(!!c.capture()?.gameEndsAfterReply && c.capture()?.winnerIfGameEnds===c.me),
  captureReplyTerminalLoss:c=>Number(!!c.capture()?.gameEndsAfterReply && c.capture()?.winnerIfGameEnds===c.opponent),
  movedStoneSupport:c=>c.move.type==='remove'?0:neighbors(c.move.to).filter(i=>c.next.board[i]===c.me).length,
  territoryLeadLastSupply:c=>(c.after.totals[c.me]-c.after.totals[c.opponent])*Number(c.next.supply[c.me]<=2),
};
Object.assign(FEATURES,tactical);
export const TACTICAL_FEATURE_NAMES=[...FEATURE_NAMES,...Object.keys(tactical)];
export function moveFeatures(game:Game,move:Move,names=FEATURE_NAMES) { const c=context(game,move);return names.map(name=>{if(!FEATURES[name])throw new Error(`Unknown feature ${name}`);return FEATURES[name](c);}); }
/** One call-scoped cache, never retained across board mutations or turns. */
export function legalMoveFeatures(game:Game,names=FEATURE_NAMES) {
  const base=baseContext(game);
  return [...legalSuccessors(game)].map(({move,game:next})=>{
    const c=context(game,move,base,next);
    return {move,values:names.map(name=>{if(!FEATURES[name])throw new Error(`Unknown feature ${name}`);return FEATURES[name](c);})};
  });
}
