import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { askJev } from '@/lib/ai/teacher';
import { newGame, RULES, type Game } from '@/lib/game/rules';
import { STRATEGIES, type Strategy } from '@/lib/game/strategies';

const counts = z.object({ blue: z.number().int().min(0).max(RULES.pieces), red: z.number().int().min(0).max(RULES.pieces) });
const index = z.number().int().min(0).max(RULES.size ** 2 - 1);
const moveSchema = z.discriminatedUnion('type', [z.object({ type: z.literal('place'), to: index }), z.object({ type: z.literal('remove'), to: index }), z.object({ type: z.literal('shift'), from: index, to: index })]);
const inputSchema = z.object({ board: z.array(z.enum(['blue', 'red']).nullable()).length(RULES.size ** 2), turn: z.enum(['blue', 'red']), supply: counts, captured: counts, finalRound: z.boolean(), last: z.object({ color: z.enum(['blue', 'red']), move: moveSchema }).nullable().optional(), repetitionCounts: z.record(z.string().max(30), z.number().int().min(0).max(2)).default({}), strategy: z.enum(Object.keys(STRATEGIES) as [Strategy, ...Strategy[]]) });
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'Request not allowed.' }, 403);
  if (Number(request.headers.get('content-length') || 0) > 12000) return json({ error: 'Request too large.' }, 413);
  let raw: string; try { raw = await request.text(); } catch { return json({ error: 'Invalid request.' }, 400); }
  if (raw.length > 12000) return json({ error: 'Request too large.' }, 413);
  let parsed; try { parsed = inputSchema.safeParse(JSON.parse(raw)); } catch { return json({ error: 'Invalid game state.' }, 400); }
  if (!parsed.success) return json({ error: 'Invalid game state.' }, 400);
  const data = parsed.data;
  for (const color of ['blue', 'red'] as const) {
    if (data.board.filter(c => c === color).length + data.supply[color] + data.captured[color] !== RULES.pieces) return json({ error: 'Piece counts do not match.' }, 400);
  }
  if (data.supply[data.turn] === 0 || (data.finalRound && data.turn === 'blue')) return json({ error: 'The game is already complete.' }, 400);
  const key = (env as unknown as Record<string, string>).TYPESAFE_API_KEY;
  if (!key) return json({ error: 'Robot players are not connected yet.', code: 'NOT_CONFIGURED' }, 503);
  if (Object.keys(data.repetitionCounts).length > 255) return json({ error: 'Invalid game state.' }, 400);
  const game: Game = { ...newGame(), ...data, last: data.last ?? null };
  try {
    const choice = await askJev(game, data.strategy, key, request.signal, data.repetitionCounts);
    return json(choice);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    return json({ error: message.includes('(429)') || message.includes('(529)') ? 'Jev is busy. Wait a moment, then retry.' : 'Jev could not make this move. Please retry.', code: 'UPSTREAM_ERROR' }, 502);
  }
}
