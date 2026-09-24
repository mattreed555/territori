/** Opt-in two-ply development policy. No API, dependency, or UI default change. */
import { applyMove, legalSuccessors, moveId, neighbors, other, score, RULES, type Color, type Game, type Move } from '../game/rules';
import type { Strategy } from '../game/strategies';
import { rankMoves, type PolicyModel } from './policy';

export const SEARCH_VERSION = 1;
export type SearchOptions = { policyBeam?: number; staticBeam?: number; priorWeight?: number };
export const DEFAULT_SEARCH = { policyBeam: 12, staticBeam: 8, priorWeight: .75 } as const;
const adjacency = Array.from({length: RULES.size ** 2}, (_, i) => neighbors(i));
const WIN = 10000;

/** Board points, not probabilities. Terminal scores use the actual tiebreak rule.
 * Supplies have a small positive value; captures never replenish them.
 */
export function searchValue(game: Game, color: Color): number {
  if (game.ended) {
    const winner = score(game.board).winner;
    return winner === color ? WIN : winner === null ? 0 : -WIN;
  }
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
  return territory + .25 * stones - .5 * exposure + .1 * (game.supply[color] - game.supply[enemy]);
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
  const roots = ranked.map(({move}, index) => {
    const next = applyMove(game, move);
    return {move, next, value: searchValue(next, game.turn), prior: (ranked.length - index) / ranked.length};
  });
  // Always include every immediate terminal move. Zero policyBeam means full width.
  const included = new Set(roots.slice(0, config.policyBeam || roots.length).map(r => moveId(r.move)));
  for (const root of [...roots].sort((a,b) => b.value-a.value).slice(0, config.staticBeam)) included.add(moveId(root.move));
  let nodes = roots.length;
  const result = roots.filter(r => r.next.ended || included.has(moveId(r.move))).map(root => {
    let worst = root.value, reply: Move | null = null;
    // Include ALL opposing placements, shifts and captures, not just captures.
    for (const child of legalSuccessors(root.next)) {
      const value = searchValue(child.game, game.turn); nodes++;
      if (reply === null || value < worst) { worst = value; reply = child.move; }
    }
    return {move: root.move, score: worst + config.priorWeight * root.prior,
      searchValue: worst, immediateValue: root.value, prior: root.prior, worstReply: reply};
  }).sort((a,b) => b.score-a.score || moveId(a.move).localeCompare(moveId(b.move)));
  // The beam policy never selects an unsearched root. Give those roots an
  // explicit trailing order (learned prior order) for complete policy-rank
  // diagnostics, without pretending their minimax values were computed.
  const searched = new Set(result.map(r => moveId(r.move)));
  const policyOrder = [...result.map(r => r.move), ...roots.filter(r => !searched.has(moveId(r.move))).map(r => r.move)];
  return {ranked: result, policyOrder, nodes, legalRootCount: roots.length, config};
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
