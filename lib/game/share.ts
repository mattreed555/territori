import { RULES, score, title, type Game, type Color } from './rules';
import type { Player } from './strategies';

export function shareResult(game: Game, players: Record<Color, Player>) {
  const result = score(game.board,game.captured);
  const board = Array.from({ length: RULES.size }, (_, row) => result.land
    .slice(row * RULES.size, (row + 1) * RULES.size)
    .map(c => c === 'blue' ? '●' : c === 'red' ? '◎' : '□').join('')).join('\n');
  return [
    'Territori',
    result.winner ? `${title(result.winner)} wins!` : 'A draw!',
    `Teal (${players.blue}) ${result.points.blue} · Apricot (${players.red}) ${result.points.red} points`,
     `Territory: ${result.totals.blue}–${result.totals.red} · Captures: ${result.captures.blue}–${result.captures.red}`,
    ...(result.points.blue === result.points.red ? [`Largest area: Teal ${result.largest.blue} · Apricot ${result.largest.red}`] : []),
    `${Math.ceil(game.ply / 2)} rounds · ${game.ply} moves`,
    '', '● Teal · ◎ Apricot · □ Neutral', board, '', 'https://territori.matthew-l-reed.chatgpt.site',
  ].join('\n');
}
