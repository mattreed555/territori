import { legalMoves, moveId, score, RULES, type Game, type Move } from '../game/rules';
import { STRATEGIES, type Strategy } from '../game/strategies';
export const DATA_VERSION = 1;
export const RULESET = '8x8-25-permanent-majority-single-opening-v1';
export type TeacherMetadata = { model: string; answer: unknown; response?: unknown; usage?: unknown };
export type Decision = { kind: 'decision'; version: 1; ruleset: string; id: string; gameId: string; turnNumber: number; source: 'jev' | 'local'; strategy: Strategy; state: Game; legalMoves: Move[]; chosenMove: Move; teacher: TeacherMetadata | null; finalResult: Result | null; localPolicy?: {id:string;epsilon:number}; evaluationProtocol?:string };
export type Result = { status: 'completed' | 'truncated' | 'aborted'; winner: ReturnType<typeof score>['winner']; territory: { blue: number; red: number }; largest: { blue: number; red: number }; reason: string; turns: number };
export type GameResult = { kind: 'result'; version: 1; ruleset: string; gameId: string; result: Result };
export type DatasetEvent = Decision | GameResult;
export function recordDecision(gameId: string, state: Game, strategy: Strategy, chosenMove: Move, source: Decision['source'], teacher: TeacherMetadata | null = null): Decision {
  const moves = legalMoves(state);
  if (!moves.some(m => moveId(m) === moveId(chosenMove))) throw new Error('Cannot log an illegal choice');
  return { kind: 'decision', version: DATA_VERSION, ruleset: RULESET, id: `${gameId}:${state.ply}`, gameId, turnNumber: state.ply + 1, source, strategy, state: structuredClone(state), legalMoves: moves, chosenMove, teacher, finalResult: null };
}
export function recordResult(gameId: string, game: Game, status: Result['status'] = game.ended ? 'completed' : 'truncated', reason = game.ended || 'turn-limit'): GameResult {
  const tally = score(game.board);
  return { kind: 'result', version: DATA_VERSION, ruleset: RULESET, gameId, result: { status, winner: status === 'completed' ? tally.winner : null, territory: tally.totals, largest: tally.largest, reason, turns: game.ply } };
}
/** Append-only result events join onto earlier decisions at export/train time. */
export function finalizedDecisions(events: DatasetEvent[]): Decision[] {
  const results = new Map(events.filter((e): e is GameResult => e.kind === 'result').map(e => [e.gameId, e.result]));
  const rows = new Map<string, Decision>();
  for (const e of events) if (e.kind === 'decision') {
    if (!(e.strategy in STRATEGIES) || !['jev','local'].includes(e.source) || typeof e.gameId !== 'string' || !e.gameId || e.id !== `${e.gameId}:${e.state.ply}`) throw new Error('Invalid decision identity or strategy');
    if (!Number.isInteger(e.state.ply) || e.state.ply < 0 || e.state.ended || !['blue','red'].includes(e.state.turn) || e.state.board.some(c => c !== null && c !== 'blue' && c !== 'red')) throw new Error('Invalid game state');
    for (const c of ['blue','red'] as const) {
      if (![e.state.supply[c],e.state.captured[c]].every(n=>Number.isInteger(n)&&n>=0&&n<=RULES.pieces) || e.state.board.filter(x=>x===c).length+e.state.supply[c]+e.state.captured[c]!==RULES.pieces) throw new Error('Invalid piece counts');
    }
    if (e.version !== DATA_VERSION || e.ruleset !== RULESET || e.state.board.length !== RULES.size ** 2) throw new Error('Incompatible dataset version or rules');
    const moves = legalMoves(e.state);
    if (e.turnNumber !== e.state.ply + 1 || JSON.stringify(moves) !== JSON.stringify(e.legalMoves) || !moves.some(m => moveId(m) === moveId(e.chosenMove))) throw new Error(`Invalid decision ${e.id}`);
    if (rows.has(e.id) && JSON.stringify(rows.get(e.id)?.chosenMove) !== JSON.stringify(e.chosenMove)) throw new Error(`Conflicting decision ${e.id}`);
    rows.set(e.id, { ...e, finalResult: results.get(e.gameId) || e.finalResult || null });
  }
  return [...rows.values()];
}
