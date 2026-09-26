/** Opt-in two-ply development policy. No API, dependency, or UI default change. */
import { legalSuccessors, legalValueSuccessors, moveId, neighbors, other, score, RULES, type Cell, type Color, type Game, type Move, type ValueState } from '../game/rules';
import type { Strategy } from '../game/strategies';
import { rankMoves, type PolicyModel } from './policy';

export const SEARCH_VERSION = 2;
export type SearchOptions = { policyBeam?: number; staticBeam?: number; priorWeight?: number };
export const DEFAULT_SEARCH = { policyBeam: 12, staticBeam: 8, priorWeight: .75 } as const;
const adjacency = Array.from({length: RULES.size ** 2}, (_, i) => neighbors(i));
const WIN = 10000;

// A move changes local control/exposure only at its endpoints and their
// neighbors. Cache topology, never game state, across calls.
const affected = adjacency.map((ns,i)=>[i,...ns]);
const shifted = adjacency.map((ns,from)=>new Map(ns.map(to=>[to,[...new Set([...affected[from],...affected[to]])]])));
function cellTerms(board:Cell[],i:number,color:Color):[number,number,number] {
 const piece=board[i],enemy=other(color);let own=0,opposing=0;
 for(const n of adjacency[i]){if(board[n]===color)own++;else if(board[n]===enemy)opposing++;}
 if(piece===color)return [1,1,Number(opposing>own)];
 if(piece===enemy)return [-1,-1,-Number(own>opposing)];
 return [own&&!opposing?1:opposing&&!own?-1:0,0,0];
}
/** Internal fast leaf scorer: state must be the legal successor for move.
 * Integer totals preserve the reference evaluator's arithmetic exactly. Supply,
 * repetition and final-round outcomes still come from the canonical engine.
 */
export function replyEvaluator(parent:Game,color:Color) {
 const terms=parent.board.map((_,i)=>cellTerms(parent.board,i,color));
 const totals=terms.reduce((a,t)=>[a[0]+t[0],a[1]+t[1],a[2]+t[2]],[0,0,0]);
 const enemy=other(color);
 return (state:ValueState,move:Move)=>{
  let [territory,stones,exposure]=totals;
  for(const i of move.type==='shift'?shifted[move.from].get(move.to)!:affected[move.to]){
   const next=cellTerms(state.board,i,color),before=terms[i];
   territory+=next[0]-before[0];stones+=next[1]-before[1];exposure+=next[2]-before[2];
  }
  const points=territory+state.captured[enemy]-state.captured[color];
  if(state.ended){const winner=points===0?score(state.board,state.captured).winner:points>0?color:enemy;return winner===color?WIN:winner===null?0:-WIN;}
  return points+.25*stones-.5*exposure+.1*(state.supply[color]-state.supply[enemy]);
 };
}

/** Board points, not probabilities. Terminal scores use the actual tiebreak rule.
 * Supplies have a small positive value; captures never replenish them.
 */
export function searchValue(game: ValueState, color: Color): number {
  const enemy = other(color);
  let territory = 0, stones = 0, exposure = 0;
  for (let i = 0; i < game.board.length; i++) {
    const piece = game.board[i];
    let own = 0, opposing = 0;
    for (const n of adjacency[i]) {
      if (game.board[n] === color) own++;
      else if (game.board[n] === enemy) opposing++;
    }
    if (piece === color) { territory++; stones++; exposure += Number(opposing > own); }
    else if (piece === enemy) { territory--; stones--; exposure -= Number(own > opposing); }
    else territory += own && !opposing ? 1 : opposing && !own ? -1 : 0;
  }
  const points = territory + game.captured[enemy] - game.captured[color];
  if (game.ended) {
    // Connected-area scoring is needed only when total points tie.
    const winner = points === 0 ? score(game.board,game.captured).winner : points > 0 ? color : enemy;
    return winner === color ? WIN : winner === null ? 0 : -WIN;
  }
  return points + .25 * stones - .5 * exposure + .1 * (game.supply[color] - game.supply[enemy]);
}

export function rankSearchMoves(game: Game, strategy: Strategy, model: PolicyModel, options: SearchOptions = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options) ||
    Object.keys(options).some(key => !Object.hasOwn(DEFAULT_SEARCH, key))) throw new Error('Unknown or invalid search options');
  const config = {...DEFAULT_SEARCH, ...options};
  for (const key of ['policyBeam', 'staticBeam'] as const)
    if (!Number.isSafeInteger(config[key]) || config[key] < 0) throw new Error('Search beams must be nonnegative integers');
  if (!Number.isFinite(config.priorWeight) || config.priorWeight < 0 || config.priorWeight > 10)
    throw new Error('Search prior weight must be between 0 and 10');
  const ranked = rankMoves(game, strategy, model);
  const successors = new Map([...legalSuccessors(game)].map(s=>[moveId(s.move),s.game]));
  const roots = ranked.map(({move}, index) => {
    const next = successors.get(moveId(move))!;
    return {move, next, value: searchValue(next, game.turn), prior: (ranked.length - index) / ranked.length};
  });
  // Always include every immediate terminal move. Zero policyBeam means full width.
  const included = new Set(roots.slice(0, config.policyBeam || roots.length).map(r => moveId(r.move)));
  for (const root of [...roots].sort((a,b) => b.value-a.value).slice(0, config.staticBeam)) included.add(moveId(root.move));
  let nodes = roots.length;
  const evaluateRoot = (root: typeof roots[number]) => {
    let worst = root.value, reply: Move | null = null;
    const valueOfReply=replyEvaluator(root.next,game.turn);
    // Include ALL opposing placements, shifts and captures, not just captures.
    for (const child of legalValueSuccessors(root.next)) {
      const value = valueOfReply(child.state,child.move); nodes++;
      if (reply === null || value < worst) { worst = value; reply = child.move; }
    }
    return {move: root.move, score: worst + config.priorWeight * root.prior,
      searchValue: worst, immediateValue: root.value, prior: root.prior, worstReply: reply};
  };
  const result = roots.filter(r => r.next.ended || included.has(moveId(r.move))).map(evaluateRoot);
  // A learned beam can exclude every shift, including the only way to defer a
  // visible terminal loss. If all searched options lose within two plies, widen
  // to EVERY root before accepting that loss. Normal winning play stays bounded.
  const expandedForSafety = result.length > 0 && result.every(r => r.searchValue === -WIN) && result.length < roots.length;
  if (expandedForSafety) {
    const evaluated = new Set(result.map(r => moveId(r.move)));
    result.push(...roots.filter(r => !evaluated.has(moveId(r.move))).map(evaluateRoot));
  }
  result.sort((a,b) => b.score-a.score || moveId(a.move).localeCompare(moveId(b.move)));
  // The beam policy never selects an unsearched root. Give those roots an
  // explicit trailing order (learned prior order) for complete policy-rank
  // diagnostics, without pretending their minimax values were computed.
  const searched = new Set(result.map(r => moveId(r.move)));
  const policyOrder = [...result.map(r => r.move), ...roots.filter(r => !searched.has(moveId(r.move))).map(r => r.move)];
  return {ranked: result, policyOrder, nodes, legalRootCount: roots.length, config, expandedForSafety};
}

export function chooseSearchMove(game: Game, strategy: Strategy, model: PolicyModel,
  options: SearchOptions = {}, epsilon = 0, random: () => number = Math.random): Move {
  if (!Number.isFinite(epsilon) || epsilon < 0 || epsilon > 1) throw new Error('Randomness must be between 0 and 1');
  const {ranked} = rankSearchMoves(game, strategy, model, options);
  if (!ranked.length) throw new Error('No legal moves');
  // Explore only close alternatives; never throw away a visible forced win or
  // select a visible forced loss if a non-losing two-ply alternative exists.
  const best = ranked[0], close = ranked.filter(r =>
    r.searchValue >= best.searchValue - 1 && (best.searchValue < WIN || r.searchValue === WIN));
  return epsilon > 0 && random() < epsilon ? close[Math.floor(random() * close.length)].move : best.move;
}
