import { RULES, score, title, type Game, type Color } from './rules';
import type { Player } from './strategies';

export function shareResult(game: Game, players: Record<Color, Player>) {
  const result = score(game.board);
  const board = Array.from({ length: RULES.size }, (_, row) => result.land
    .slice(row * RULES.size, (row + 1) * RULES.size)
    .map(c => c === 'blue' ? '🟦' : c === 'red' ? '🟥' : '⬜').join('')).join('\n');
  return [
    'Territori',
    result.winner ? `${title(result.winner)} wins!` : 'A draw!',
    `Blue (${players.blue}) ${result.totals.blue} · Red (${players.red}) ${result.totals.red}`,
    ...(result.totals.blue === result.totals.red ? [`Largest area: Blue ${result.largest.blue} · Red ${result.largest.red}`] : []),
    `${Math.ceil(game.ply / 2)} rounds · ${game.ply} moves`,
    '', board, '', 'https://territori.matthew-l-reed.chatgpt.site',
  ].join('\n');
}
