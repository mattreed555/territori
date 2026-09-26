import { applyMove, coordinate, legalMoves, score, type Game, type Move } from './rules';

/** Evaluate legal opposing capture replies, including stones left by a shift. */
export function captureOutcome(game: Game, move: Move) {
  const next = applyMove(game, move);
  if (next.ended || next.turn === game.turn) return null;
  const before = score(game.board);
  const replies = legalMoves(next).filter(m => m.type === 'remove').map(reply => {
    const result = applyMove(next, reply), tally = score(result.board,result.captured);
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
    myTerritoryLeadAfterReply: worst.tally.totals[game.turn]-worst.tally.totals[next.turn],
    myLargestAreaAfterReply: worst.tally.largest[game.turn],
    myUnusedPiecesAfterReply: worst.result.supply[game.turn],
    myPermanentlyLostPiecesAfterReply: worst.result.captured[game.turn],
    boardReturnsToCurrentPosition: worst.result.board.every((c, i) => c === game.board[i]),
    gameEndsAfterReply: worst.result.ended,
    winnerIfGameEnds: worst.result.ended ? worst.tally.winner : null,
  };
}
