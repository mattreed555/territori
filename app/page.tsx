'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play, Plus, X, Move as MoveIcon, RotateCcw, Copy, Check } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle } from '@/components/ui/alert-dialog';
import Help from './help';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { applyMove, coordinate, isCapturable, legalMoves, moveId, moveLabel, neighbors, newGame, nextPositionKey, other, RULES, score, title, type Color, type Game, type Move } from '@/lib/game/rules';
import { PLAYERS, type Player } from '@/lib/game/strategies';

import { saveEvent, readSettings, newGameId, type Settings } from '@/lib/ai/browser';
import { recordDecision, recordResult, type TeacherMetadata } from '@/lib/ai/dataset';
import { prepareLocalPlayer, type LocalPlayer } from '@/lib/ai/local-player';
import type { Strategy } from '@/lib/game/strategies';
import { shareResult } from '@/lib/game/share';

type Mode = Move['type'];
type Motion = { move: Move; color: Color; id: number };
const MOVE_DURATION = 650;
export default function Home() {
  const [game, setGame] = useState<Game>(newGame), [players, setPlayers] = useState<Record<Color, Player>>({ blue: 'Human', red: 'Balanced' });
  const [started, setStarted] = useState(false), [paused, setPaused] = useState(false), [help, setHelp] = useState(false), [reset, setReset] = useState(false);
  const [mode, setMode] = useState<Mode>('place'), [selected, setSelected] = useState<number | null>(null), [focusCell, setFocusCell] = useState(0);
  const [thinking, setThinking] = useState(false), [error, setError] = useState(''), [hint, setHint] = useState(''), [ready, setReady] = useState<boolean | null>(null), [retry, setRetry] = useState(0);
  const [motion, setMotion] = useState<Motion | null>(null), [showResult, setShowResult] = useState(false);
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'manual'>('idle');
  const [clearing, setClearing] = useState<number[] | null>(null);
  const gameId = useRef('');
  const aiSettings = useRef<Settings>({engine:'jev',epsilon:.03,model:null});
  const localPlayer = useRef<LocalPlayer | null>(null);
  const starting = useRef(false), startSequence = useRef(0);
  const [preparing, setPreparing] = useState(false);
  const sequence = useRef(0), restartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boardRef = useRef<HTMLDivElement>(null), current = useRef({ game, players, started, paused, help, reset, motion, clearing });
  current.current = { game, players, started, paused, help, reset, motion, clearing };
  const result = score(game.board), humanTurn = players[game.turn] === 'Human';
  const canPlay = started && !game.ended && humanTurn && !paused && !help && !reset && !motion && !clearing;
  const commit = useCallback((move: Move) => {
    const before = current.current.game, next = applyMove(before, move);
    const animation = { move, color: before.turn, id: ++sequence.current };
    current.current = { ...current.current, game: next, motion: animation };
    if (next.ended) void saveEvent(recordResult(gameId.current, next)).catch(() => setError('The result could not be saved to the training dataset.'));
    setMotion(animation); setGame(next); setSelected(null); setHint(''); setMode('place');
  }, []);
  useEffect(() => { if (!motion) return; const timer = setTimeout(() => setMotion(null), MOVE_DURATION); return () => clearTimeout(timer); }, [motion]);
  useEffect(() => { if (!game.ended || clearing) return; const timer = setTimeout(() => setShowResult(true), MOVE_DURATION + 150); return () => clearTimeout(timer); }, [game.ended, clearing]);
  useEffect(() => () => { startSequence.current++; if (restartTimer.current) clearTimeout(restartTimer.current); }, []);
  useEffect(() => { try { if (readSettings().engine !== 'jev') { setReady(true); return; } } catch { setError('AI settings could not be read. Open the AI lab to reset them.'); return; } let alive = true; fetch('/api/status').then(r => r.json() as Promise<{ ready: boolean }>).then(d => { if (alive) setReady(d.ready); }).catch(() => { if (alive) setReady(null); }); return () => { alive = false; }; }, [retry]);
  useEffect(() => {
    if (!started || game.ended || humanTurn || paused || help || reset || error || motion || clearing) return;
    const controller = new AbortController(); let alive = true;
    const timer = window.setTimeout(async () => {
      setThinking(true);
      try {
        let data: { error?: string; move: Move; teacher?: TeacherMetadata };
        if (aiSettings.current.engine !== 'jev') {
          if (!localPlayer.current) throw new Error('Local AI is not loaded. Open the AI lab or start a new game. No API fallback was used.');
          data = { move: localPlayer.current.choose(game, players[game.turn] as Strategy) };
        } else {
        const response = await fetch('/api/robot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ board: game.board, turn: game.turn, supply: game.supply, captured: game.captured, finalRound: game.finalRound, strategy: players[game.turn], last: game.last, repetitionCounts: Object.fromEntries(legalMoves(game).map(m => [moveId(m), game.positions[nextPositionKey(game, m)] || 0]).filter(([, count]) => Number(count) > 0)) }), signal: controller.signal });
        data = await response.json() as { error?: string; move: Move; teacher?: TeacherMetadata };
        if (!response.ok) throw new Error(data.error || 'The robot could not move. Please retry.');

        }
        if (!data.move || !legalMoves(game).some(m => moveId(m) === moveId(data.move))) throw new Error('The robot returned an invalid move. Please retry.');
        if (alive) {
          const decision = recordDecision(gameId.current, game, players[game.turn] as Strategy, data.move, aiSettings.current.engine === 'jev' ? 'jev' : 'local', data.teacher || null);
          if (localPlayer.current && aiSettings.current.engine !== 'jev') decision.localPolicy = {id:localPlayer.current.id,epsilon:aiSettings.current.epsilon};
          await saveEvent(decision);
          if (alive) { setReady(true); commit(data.move); }
        }
      } catch (e) { if (alive) setError(e instanceof Error ? e.message : 'Please retry this move.'); }
      finally { if (alive) setThinking(false); }
    }, 700);
    return () => { alive = false; window.clearTimeout(timer); controller.abort(); setThinking(false); };
  }, [game, started, humanTurn, paused, help, reset, players, error, retry, commit, motion, clearing]);

  useEffect(() => {
    type Context = { registerTool: (tool: { name: string; description: string; inputSchema: object; annotations: object; execute: (input: unknown) => unknown }, options: { signal: AbortSignal }) => unknown };
    const context = (document as Document & { modelContext?: Context }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const read = { name: 'read_territori_game', description: 'Read the current Territori board, score, players, status, and legal moves. Coordinates are zero-based indices row by row.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute: () => { const c = current.current; return { board: c.game.board, turn: c.game.turn, supply: c.game.supply, captured: c.game.captured, players: c.players, started: c.started, paused: c.paused, ended: c.game.ended, score: score(c.game.board).totals, moves: legalMoves(c.game) }; } };
    const move = { name: 'play_territori_move', description: 'Play one legal move for the human player in an active Territori game. Fails on robot turns or while paused.', inputSchema: { type: 'object', properties: { type: { enum: ['place', 'remove', 'shift'] }, to: { type: 'integer', minimum: 0, maximum: RULES.size ** 2 - 1 }, from: { type: 'integer', minimum: 0, maximum: RULES.size ** 2 - 1 } }, required: ['type', 'to'], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: async (input: unknown) => { const c = current.current, m = input as Move; if (!c.started || c.paused || c.help || c.reset || c.motion || c.clearing || c.players[c.game.turn] !== 'Human' || !m || !legalMoves(c.game).some(x => moveId(x) === moveId(m))) throw new Error('Move unavailable.'); const next = applyMove(c.game, m); commit(m); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); return { turn: next.turn, score: score(next.board).totals, ended: next.ended }; } };
    for (const tool of [read, move]) { try { Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); } catch {} }
    return () => lifecycle.abort();
  }, [commit]);

  function choosePlayer(color: Color, value: Player) { setPlayers(p => ({ ...p, [color]: value, ...(value === 'Human' && p[other(color)] === 'Human' ? { [other(color)]: 'Balanced' } : {}) })); }
  async function copyResult() {
    if (!game.ended) return;
    const text = shareResult(game, players);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      setShareStatus('copied');
    } catch {
      setShareStatus('manual');
    }
  }
  async function start() {
    if (starting.current) return;
    starting.current = true; setPreparing(true); const token = ++startSequence.current;
    try {
      const settings = readSettings();
      const prepared = settings.engine === 'jev' ? null : await prepareLocalPlayer(settings, Object.values(players).filter((p):p is Strategy => p !== 'Human'));
      if (token !== startSequence.current) return;
      aiSettings.current = settings; localPlayer.current = prepared;
      gameId.current = newGameId(); setStarted(true); setPaused(false); setError(''); setHint('');
    } catch (e) { if (token === startSequence.current) setError(e instanceof Error ? e.message : 'AI could not start. Open the AI lab.'); }
    finally { if (token === startSequence.current) { starting.current = false; setPreparing(false); } }
  }
  function restart(playAgain = false) {
    if (clearing) return;
    if (started && !game.ended) void saveEvent(recordResult(gameId.current, game, 'aborted', 'new-game')).catch(() => {});
    setShowResult(false); setShareStatus('idle'); setReset(false); setPaused(true); setMotion(null);
    // Shuffle once per reset, so the disappearing stones never follow reading order.
    const order = game.board.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const delays = Array(RULES.size ** 2).fill(0); order.forEach((cell, n) => { delays[cell] = n * 4; });
    setClearing(delays);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    restartTimer.current = setTimeout(() => {
      const fresh = newGame(); gameId.current = newGameId();
      current.current = { ...current.current, game: fresh, started: playAgain, paused: false, reset: false, motion: null, clearing: null };
      setGame(fresh); setClearing(null); setStarted(playAgain); setPaused(false); setThinking(false); setSelected(null); setMode('place'); setError(''); setHint(''); setRetry(n => n + 1);
      requestAnimationFrame(() => (boardRef.current?.querySelector('[data-cell="0"]') as HTMLButtonElement)?.focus());
    }, reduced ? 0 : 680);
  }
  function cellClick(i: number) {
    if (!canPlay) return;
    const piece = game.board[i]; let move: Move;
    if (mode === 'shift') {
      if (piece === game.turn) { setSelected(selected === i ? null : i); setHint(''); return; }
      if (selected === null) { setHint('First choose one of your pieces.'); return; }
      move = { type: 'shift', from: selected, to: i };
    } else move = { type: mode, to: i };
    if (!legalMoves(game).some(m => moveId(m) === moveId(move))) { setHint(mode === 'remove' ? 'Choose an opponent stone with more of your neighbors than theirs.' : mode === 'shift' ? 'Choose an adjacent empty square.' : 'Choose an empty square.'); return; }
    commit(move);
  }
  function keyboard(e: React.KeyboardEvent, i: number) {
    let next = i;
    if (e.key === 'ArrowRight' && i % RULES.size < RULES.size - 1) next++;
    else if (e.key === 'ArrowLeft' && i % RULES.size > 0) next--;
    else if (e.key === 'ArrowDown' && i < RULES.size * (RULES.size - 1)) next += RULES.size;
    else if (e.key === 'ArrowUp' && i >= RULES.size) next -= RULES.size;
    else if (e.key === 'Escape') { setSelected(null); return; }
    else return;
    e.preventDefault(); setFocusCell(next); (boardRef.current?.querySelector(`[data-cell="${next}"]`) as HTMLButtonElement)?.focus();
  }
  const instruction = clearing ? 'Clearing the board…' : !started ? (preparing ? 'Loading local AI…' : 'Choose your players, then start.') : game.ended ? (game.ended === 'repetition' ? 'Same board and supplies repeated three times.' : 'Final round complete.') : paused ? 'Resume whenever you’re ready.' : error ? '' : !humanTurn ? (thinking ? 'Choosing a move…' : 'Next move…') : hint || (mode === 'place' ? 'Tap an empty square to place a piece.' : mode === 'remove' ? 'Remove a stone where your neighbors outnumber theirs.' : selected === null ? 'Tap one of your pieces to shift it.' : 'Tap an adjacent empty square.');
  const heading = game.ended ? result.winner ? `${title(result.winner)} wins` : 'A draw' : !started ? 'Ready to play?' : paused ? 'Game paused' : `${title(game.turn)}’s turn`;
  return <div className="site-shell"><header className="masthead"><div className="masthead-inner"><div className="masthead-spacer"/><h1>Territori</h1><Help open={help} onOpenChange={setHelp}/></div></header><main className="game-shell"><section className="players" aria-label="Players and scores">{(['blue', 'red'] as const).map(color => <div key={color} className={`player-panel ${color} ${started && !game.ended && game.turn === color ? 'active-player' : ''}`}><div className="player-heading"><h2><i className={`small-stone ${color}`} />{title(color)}</h2><div key={result.totals[color]} className="score-value score-change" aria-label={`${title(color)} controls ${result.totals[color]} squares`}>{result.totals[color]}<span>territory</span></div></div><Select value={players[color]} onValueChange={v => choosePlayer(color, v as Player)} disabled={started || preparing}><SelectTrigger className="player-select" aria-label={`${title(color)} player`}><SelectValue /></SelectTrigger><SelectContent position="popper">{PLAYERS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select><div className="piece-counts"><span aria-label={`${game.supply[color]} ${title(color)} stones available to place`}><strong>{game.supply[color]}</strong> left to place</span><span aria-label={`${game.captured[color]} ${title(color)} stones captured and permanently out of play`}>{game.captured[color]} out of play</span></div></div>)}</section><section className="board-section" aria-label="Game"><div className="turn-line"><h2 aria-live="polite">{heading}</h2><span className="round-label">{game.ended ? 'Game over' : game.finalRound ? 'Final round' : `Round ${Math.floor(game.ply / 2) + 1}`}</span></div><div className={`move-announcement ${game.last?.color || ''}`} role="status" aria-live="polite"><span key={game.ply} className="move-caption">{clearing ? 'A fresh board…' : game.last ? <><i className={`small-stone ${game.last.color}`} />{title(game.last.color)} {moveLabel(game.last.move)}</> : 'Your board awaits.'}</span>{thinking && !clearing && <span className="thinking-dots" aria-label={`${title(game.turn)} is thinking`}><i/><i/><i/></span>}</div><div className={`board ${canPlay ? 'interactive' : ''} ${clearing ? 'clearing-board' : ''} mode-${mode}`} ref={boardRef} role="group" aria-label={`Territori board, ${RULES.size} rows and ${RULES.size} columns`} style={{ gridTemplateColumns: `repeat(${RULES.size}, 1fr)` }}>{game.board.map((piece, i) => {
    const target = canPlay && (mode === 'remove' ? piece === other(game.turn) && isCapturable(game.board, i) : mode === 'shift' && selected !== null ? !piece && neighbors(selected).includes(i) : false);
    const moving = motion?.move.to === i ? motion : null;
    const shifted = moving?.move.type === 'shift' ? moving.move : null;
    const stoneStyle = { '--shift-x': shifted ? `calc(${(shifted.from % RULES.size - i % RULES.size) * 153.846}% + ${(shifted.from % RULES.size - i % RULES.size) * 1.538}px)` : '0px', '--shift-y': shifted ? `calc(${(Math.floor(shifted.from / RULES.size) - Math.floor(i / RULES.size)) * 153.846}% + ${(Math.floor(shifted.from / RULES.size) - Math.floor(i / RULES.size)) * 1.538}px)` : '0px', animationDelay: clearing ? `${clearing[i]}ms` : undefined } as React.CSSProperties;
    return <button key={i} data-cell={i} className={`cell land-${result.land[i] || 'neutral'} ${moving ? `move-flash ${moving.color}` : ''} ${selected === i ? 'selected' : ''} ${target ? 'legal-target' : ''} ${game.last?.move.to === i ? 'last-move' : ''}`} tabIndex={focusCell === i ? 0 : -1} onFocus={() => setFocusCell(i)} aria-disabled={!canPlay} aria-label={`${coordinate(i)}: ${piece ? `${title(piece)} piece${isCapturable(game.board, i) ? ', capturable' : ', safe'}` : result.land[i] ? `empty, ${title(result.land[i]!)} territory` : 'empty, neutral'}${selected === i ? ', selected' : ''}`} onClick={() => cellClick(i)} onKeyDown={e => keyboard(e, i)}>{piece && <span key={moving?.id || 'rest'} style={stoneStyle} className={`stone ${piece} ${clearing ? 'stone-clear' : moving ? `stone-${moving.move.type}` : ''}`} />}{moving?.move.type === 'remove' && <span key={moving.id} className={`stone capture-ghost ${other(moving.color)}`} aria-hidden="true"/>}{target && !piece && <span className="target-dot"/>}</button>;
  })}</div><div className="under-board"><span>Pale squares count as territory</span><span>{RULES.size} × {RULES.size}</span></div><div className="game-controls">{!started ? <button className="primary-button start-button" disabled={preparing} onClick={start}><Play size={17} fill="currentColor"/> {players.blue !== 'Human' && players.red !== 'Human' ? 'Watch game' : 'Start game'}</button> : game.ended ? <div className="result-block"><p>{result.totals.blue === result.totals.red ? `Largest area: Teal ${result.largest.blue} · Apricot ${result.largest.red}` : `${result.winner ? title(result.winner) : ''} controls ${Math.max(result.totals.blue, result.totals.red)} squares to ${Math.min(result.totals.blue, result.totals.red)}.`}</p><button className="primary-button" disabled={!!clearing} onClick={() => restart(true)}>Play again</button><button className="text-button view-result" disabled={!!clearing} onClick={() => setShowResult(true)}>View results</button></div> : <><RadioGroup value={mode} onValueChange={v => { setMode(v as Mode); setSelected(null); setHint(''); }} className="actions" aria-label="Your action" disabled={!canPlay}>{([['place', 'Place', Plus], ['remove', 'Remove', X], ['shift', 'Shift', MoveIcon]] as const).map(([value, label, Icon]) => <label key={value} className={`action-option ${mode === value ? 'chosen' : ''} ${!canPlay ? 'inactive' : ''}`}><RadioGroupItem className="action-radio" value={value} aria-label={label}/><Icon size={18}/><span>{label}</span></label>)}</RadioGroup><div className="playback"><button className="text-button" onClick={() => setPaused(p => !p)}>{paused ? <Play size={16}/> : <Pause size={16}/>} {paused ? 'Resume' : 'Pause'}</button><button className="text-button" onClick={() => setReset(true)}><RotateCcw size={15}/> New game</button></div></>}<p className="instruction" role="status">{instruction}</p>{error && <div className="error-message" role="alert"><p>{error}</p><button className="text-button" onClick={() => { setError(''); setRetry(n => n + 1); }}>Retry move</button></div>}{!started && ready === false && <p className="connection-note">Robot players are not connected yet.</p>}</div></section><footer className="game-footer"><span>25 pieces each. One move at a time.</span> <a href="/training">AI lab</a></footer></main><Dialog open={showResult} onOpenChange={setShowResult}><DialogContent className="winner-dialog" onCloseAutoFocus={e => { e.preventDefault(); if (!clearing) (boardRef.current?.querySelector('[data-cell="0"]') as HTMLButtonElement)?.focus(); }}>
    <div className="winner-mark" aria-hidden="true">{result.winner ? <i className={`small-stone ${result.winner}`}/> : <><i className="small-stone blue"/><i className="small-stone red"/></>}</div>
    <DialogTitle className="winner-title">{result.winner ? `${title(result.winner)} wins!` : 'A draw!'}</DialogTitle>
    <DialogDescription className="winner-description">{result.totals.blue === result.totals.red ? result.winner ? 'Territory tied. The largest connected area decides it.' : 'Equal territory. Equal largest areas.' : 'The most territory takes the game.'}</DialogDescription>
    <div className="final-scores">{(['blue','red'] as const).map(c => <div key={c} className={c}><span className="final-player"><i className={`small-stone ${c}`}/>{title(c)}</span><strong>{result.totals[c]}</strong><span>territory</span></div>)}</div>
    <table className="result-stats"><thead><tr><th scope="col">Final board</th><th scope="col">Teal</th><th scope="col">Apricot</th></tr></thead><tbody><tr><th scope="row">Largest area</th><td>{result.largest.blue}</td><td>{result.largest.red}</td></tr><tr><th scope="row">Stones on board</th><td>{game.board.filter(c => c === 'blue').length}</td><td>{game.board.filter(c => c === 'red').length}</td></tr><tr><th scope="row">Stones lost</th><td>{game.captured.blue}</td><td>{game.captured.red}</td></tr></tbody></table>
    <p className="result-length">{Math.ceil(game.ply / 2)} rounds · {game.ply} moves{game.ended === 'repetition' ? ' · Repeated position' : ''}</p>
    <div className="result-buttons"><button className="primary-button" onClick={() => restart(true)}>Play again</button><button className="share-button" onClick={copyResult}>{shareStatus === 'copied' ? <Check size={17}/> : <Copy size={17}/>} {shareStatus === 'copied' ? 'Copied!' : 'Share'}</button></div>
    <span className="sr-only" role="status">{shareStatus === 'copied' ? 'Result copied. Paste it anywhere to share.' : ''}</span>
    {shareStatus === 'manual' && <div className="manual-share"><p role="status">Select and copy your result below.</p><textarea aria-label="Result to copy" readOnly value={shareResult(game, players)} onFocus={e => e.currentTarget.select()}/></div>}
    <button className="text-button" onClick={() => setShowResult(false)}>View board</button>
  </DialogContent></Dialog><AlertDialog open={reset} onOpenChange={setReset}><AlertDialogContent><AlertDialogTitle>Start a new game?</AlertDialogTitle><AlertDialogDescription>This board will be cleared and both players will receive 25 pieces.</AlertDialogDescription><AlertDialogFooter><AlertDialogCancel>Keep playing</AlertDialogCancel><AlertDialogAction onClick={() => restart()}>New game</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>;
}
