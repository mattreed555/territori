import { applyMove, coordinate, isCapturable, legalMoves, moveId, movedBoard, other, RULES, score, type Game, type Move } from './rules';
import { STRATEGIES, type Strategy } from './strategies';


/** Evaluate legal capture replies, including stones left behind by a shift.
 * This is a concrete one-reply scenario, not a prediction of the opponent.
 */
export function captureOutcome(game: Game, move: Move) {
  const next = applyMove(game, move);
  if (next.ended || next.turn === game.turn) return null;
  const before = score(game.board);
  const replies = legalMoves(next).filter(m => m.type === 'remove').map(reply => {
    const result = applyMove(next, reply), tally = score(result.board);
    return { reply, result, tally, margin: tally.totals[game.turn] - tally.totals[next.turn] };
  });
  replies.sort((a, b) => a.margin - b.margin ||
    (a.tally.largest[game.turn] - a.tally.largest[next.turn]) - (b.tally.largest[game.turn] - b.tally.largest[next.turn]));
  const worst = replies[0];
  if (!worst) return null;
  return {
    opponentCaptures: coordinate(worst.reply.to),
    territoryAfterReply: worst.tally.totals,
    myNetTerritoryGain: worst.tally.totals[game.turn] - before.totals[game.turn],
    myTerritoryLeadAfterReply: worst.margin,
    myLargestAreaAfterReply: worst.tally.largest[game.turn],
    myUnusedPiecesAfterReply: worst.result.supply[game.turn],
    myPermanentlyLostPiecesAfterReply: worst.result.captured[game.turn],
    boardReturnsToCurrentPosition: worst.result.board.every((c, i) => c === game.board[i]),
    gameEndsAfterReply: worst.result.ended,
    winnerIfGameEnds: worst.result.ended ? worst.tally.winner : null,
  };
}

/** All legal moves are supplied; Jev, not a local heuristic, chooses the move. */
export function decisionRequest(game: Game, strategy: Strategy, repetitionCounts: Record<string, number> = {}) {
  const moves = legalMoves(game);
  if (moves.length > 255) throw new Error('This ruleset exceeds Jev’s choice limit.');
  const current = score(game.board), opponent = other(game.turn);
  const criteria = Object.fromEntries(moves.map(m => {
    const board = movedBoard(game.board, game.turn, m), after = score(board);
    const reply = captureOutcome(game, m);
    const vulnerable = board.reduce((n, c, i) => n + Number(c === game.turn && isCapturable(board, i)), 0);
    return [moveId(m), { captureReply: reply ? [reply.opponentCaptures, reply.territoryAfterReply.blue, reply.territoryAfterReply.red, reply.myNetTerritoryGain, reply.myLargestAreaAfterReply, reply.myUnusedPiecesAfterReply, reply.myPermanentlyLostPiecesAfterReply, reply.boardReturnsToCurrentPosition, reply.gameEndsAfterReply, reply.winnerIfGameEnds] : null, action: m.type, destination: coordinate(m.to), ...(m.type === 'shift' ? { origin: coordinate(m.from) } : {}), territoryAfter: after.totals, myTerritoryGain: after.totals[game.turn] - current.totals[game.turn], opponentTerritoryGain: after.totals[opponent] - current.totals[opponent], myCapturablePiecesAfter: vulnerable, movedStoneCanBeCaptured: m.type !== 'remove' && isCapturable(board, m.to), repeatsJustCapturedPlacement: m.type === 'place' && game.last?.color === opponent && game.last.move.type === 'remove' && game.last.move.to === m.to, myLargestAreaAfter: after.largest[game.turn], endsGameByRepetition: (repetitionCounts[moveId(m)] || 0) >= RULES.repetitions - 1, startsFinalRound: m.type === 'place' && game.supply[game.turn] === 1 }];
  }));
  return { moves, body: {
    model: 'jev-latest',
    state: { captureReplyFields: ['opponentCapturesSquare', 'blueTerritoryAfterReply', 'redTerritoryAfterReply', 'myNetTerritoryGain', 'myLargestAreaAfterReply', 'myUnusedPiecesAfterReply', 'myPermanentlyLostPiecesAfterReply', 'boardReturnsToCurrentPosition', 'gameEndsAfterReply', 'winnerIfGameEnds'], game: 'Territori', size: RULES.size, currentPlayer: game.turn, strategy, strategyGuidance: STRATEGIES[strategy], board: Array.from({ length: RULES.size }, (_, r) => game.board.slice(r * RULES.size, (r + 1) * RULES.size).map(c => c === 'blue' ? 'B' : c === 'red' ? 'R' : '.').join('')), coordinates: `Columns A-${String.fromCharCode(64 + RULES.size)} left to right, rows 1-${RULES.size} top to bottom. B=blue, R=red, .=empty.`, unusedPieces: game.supply, capturedPieces: game.captured, territory: current.totals, finalRound: game.finalRound,
    rules: 'Start with an empty board and 25 unused stones each. Alternate one-action turns, Blue first. There is no special opening phase. Place an unused piece, remove an opponent piece whose adjacent enemies outnumber its adjacent allies, or shift one own piece one square orthogonally into an empty square. For capture, count only the target stone’s up, down, left, and right neighbors, not the target itself. More attacking neighbors than defending neighbors is required. Ties are safe; an isolated stone with no neighbors is safe. Capturing takes your whole turn and removes only the chosen stone; captures are never automatic. Captures are permanent. Pieces own their occupied square and reach adjacent orthogonal empty squares. Empty squares reached by both colors or neither are neutral. Most territory wins, then largest orthogonally connected controlled area. Placing the last unused piece triggers the final round: red completes its turn then score. Three occurrences of the same board, unused supplies, and player to move also end the game. Prefer progress over undoing the previous move.', lastMove: game.last, opening: game.board.filter(Boolean).length < 4 },
    questions: { move: { type: 'choice', instructions: `Which legal move best advances ${game.turn}'s ${strategy.toLowerCase()} strategy and chances of winning? ${STRATEGIES[strategy]} Your strategy is a preference, not an obligation. Prioritize winning over stylistic preferences. Do not shift pointlessly, capture merely because you can, or mix actions just for variety. Choose a winning move over one that only fits your style. Use the supplied immediate consequences and captureReply (ordered values defined by captureReplyFields); choose a single move. That field shows the legal opposing capture that leaves you the lowest territory lead (then smallest connected-area lead). It is a possible reply, not a guaranteed move or a full search. Null means no immediate capture reply is legal. Prefer lasting territory after that reply over temporary territoryAfter. A placement that returns the board to its current position while permanently losing a stone wastes supply; prefer a safe expansion when available. Check winnerIfGameEnds before sacrificing a stone in the final round. Avoid ending in a draw by repetition when you can improve your position. Avoid repeatedly replacing a vulnerable stone the opponent just captured: permanent captures waste your finite supply. Build local support and create numerical advantages when possible, while respecting your strategy.`, criteria } }
  } };
}
