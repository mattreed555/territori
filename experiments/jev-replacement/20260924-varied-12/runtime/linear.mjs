var l = {
  size: 8,
  pieces: 25,
  repetitions: 3
}, y = (e) => e === "blue" ? "red" : "blue";
function v(e, t = l.size) {
  const r = Math.floor(e / t), n = e % t;
  return [
    r > 0 ? e - t : -1,
    r < t - 1 ? e + t : -1,
    n > 0 ? e - 1 : -1,
    n < t - 1 ? e + 1 : -1
  ].filter((a) => a >= 0);
}
var M = Array.from({ length: l.size ** 2 }, (e, t) => v(t)), b = (e, t) => t === l.size && Number.isInteger(e) && e >= 0 && e < M.length ? M[e] : v(e, t), x = (e, t, r) => `${t}:${r.blue}:${r.red}:` + e.map((n) => n === "blue" ? "B" : n === "red" ? "R" : ".").join("");
function E(e, t, r = l.size) {
  const n = e[t];
  if (!n) return !1;
  let a = 0, o = 0;
  for (const s of b(t, r)) e[s] === n ? a++ : e[s] === y(n) && o++;
  return o > a;
}
function O(e, t = l.size) {
  return e.map((r, n) => {
    if (r) return r;
    const a = new Set(b(n, t).map((o) => e[o]).filter(Boolean));
    return a.size === 1 ? [...a][0] : null;
  });
}
function c(e, t = l.size) {
  const r = O(e, t), n = {
    blue: 0,
    red: 0
  }, a = {
    blue: 0,
    red: 0
  }, o = /* @__PURE__ */ new Set();
  r.forEach((i, u) => {
    if (!i || (n[i]++, o.has(u))) return;
    const p = [u];
    o.add(u);
    let R = 0;
    for (; p.length; ) {
      const z = p.pop();
      R++, b(z, t).forEach((d) => {
        !o.has(d) && r[d] === i && (o.add(d), p.push(d));
      });
    }
    a[i] = Math.max(a[i], R);
  });
  const s = n.blue - n.red || a.blue - a.red;
  return {
    land: r,
    totals: n,
    largest: a,
    winner: s > 0 ? "blue" : s < 0 ? "red" : null
  };
}
function f(e) {
  if (e.ended) return [];
  const t = [];
  return e.board.forEach((r, n) => {
    !r && e.supply[e.turn] > 0 && t.push({
      type: "place",
      to: n
    }), r === y(e.turn) && E(e.board, n) && t.push({
      type: "remove",
      to: n
    }), r === e.turn && b(n, l.size).forEach((a) => {
      e.board[a] || t.push({
        type: "shift",
        from: n,
        to: a
      });
    });
  }), t;
}
var h = (e) => e.type === "shift" ? `shift_${e.from}_${e.to}` : `${e.type}_${e.to}`;
function A(e, t, r) {
  const n = [...e];
  return r.type === "shift" && (n[r.from] = null), n[r.to] = r.type === "remove" ? null : t, n;
}
var N = (e) => y(e.turn);
function P(e, t) {
  const r = { ...e.supply };
  return t.type === "place" && r[e.turn]--, x(A(e.board, e.turn, t), N(e), r);
}
function g(e, t) {
  if (!f(e).some((r) => h(r) === h(t))) throw new Error("That move is not legal.");
  return C(e, t);
}
function* $(e) {
  for (const t of f(e)) yield {
    move: t,
    game: C(e, t)
  };
}
function C(e, t) {
  const { board: r, supply: n, turn: a, finalRound: o, key: s, ended: i } = j(e, t), u = { ...e.captured };
  t.type === "remove" && u[y(e.turn)]++;
  const p = {
    ...e.positions,
    [s]: (e.positions[s] || 0) + 1
  };
  return {
    board: r,
    supply: n,
    captured: u,
    turn: a,
    ply: e.ply + 1,
    finalRound: o,
    ended: i,
    positions: p,
    last: {
      color: e.turn,
      move: t
    }
  };
}
function j(e, t) {
  const r = A(e.board, e.turn, t), n = { ...e.supply };
  t.type === "place" && n[e.turn]--;
  const a = N(e), o = e.finalRound || n[e.turn] === 0, s = x(r, a, n);
  return {
    board: r,
    supply: n,
    turn: a,
    finalRound: o,
    key: s,
    ended: o && e.turn === "red" ? "supply" : (e.positions[s] || 0) + 1 >= l.repetitions ? "repetition" : null
  };
}
var F = (e) => String.fromCharCode(65 + e % l.size) + (Math.floor(e / l.size) + 1), S = {
  Aggressive: "Create local numerical advantages. Threaten captures and pressure contested territory.",
  Cautious: "Reinforce threatened stones. Keep friendly neighbors at least equal to enemy neighbors around your stones. Prefer stable territory.",
  Expansive: "Claim open space efficiently. Establish new footholds without giving away easy captures.",
  Fluid: "Shift to escape threats, reinforce allies, or create capture opportunities.",
  Balanced: "Weigh lasting territory, stone safety, and useful captures. Adapt to the position."
}, K = ["Human", ...Object.keys(S)];
function U(e, t) {
  const r = g(e, t);
  if (r.ended || r.turn === e.turn) return null;
  const n = c(e.board), a = f(r).filter((s) => s.type === "remove").map((s) => {
    const i = g(r, s), u = c(i.board);
    return {
      reply: s,
      result: i,
      tally: u,
      margin: u.totals[e.turn] - u.totals[r.turn]
    };
  });
  a.sort((s, i) => s.margin - i.margin || s.tally.largest[e.turn] - s.tally.largest[r.turn] - (i.tally.largest[e.turn] - i.tally.largest[r.turn]));
  const o = a[0];
  return o ? {
    opponentCaptures: F(o.reply.to),
    territoryAfterReply: o.tally.totals,
    myNetTerritoryGain: o.tally.totals[e.turn] - n.totals[e.turn],
    myTerritoryLeadAfterReply: o.margin,
    myLargestAreaAfterReply: o.tally.largest[e.turn],
    myUnusedPiecesAfterReply: o.result.supply[e.turn],
    myPermanentlyLostPiecesAfterReply: o.result.captured[e.turn],
    boardReturnsToCurrentPosition: o.result.board.every((s, i) => s === e.board[i]),
    gameEndsAfterReply: o.result.ended,
    winnerIfGameEnds: o.result.ended ? o.tally.winner : null
  } : null;
}
var w = (e, t) => e.reduce((r, n, a) => r + Number(n === t && E(e, a)), 0);
function T(e, t) {
  const r = /* @__PURE__ */ new Set();
  let n = 0;
  return e.forEach((a, o) => {
    if (a !== t || r.has(o)) return;
    const s = [o];
    r.add(o);
    let i = 0;
    for (; s.length; ) {
      const u = s.pop();
      i++;
      for (const p of v(u)) e[p] === t && !r.has(p) && (r.add(p), s.push(p));
    }
    n = Math.max(n, i);
  }), n;
}
function L(e, t) {
  const r = e.flatMap((o, s) => o === t ? [s] : []);
  if (!r.length) return 0;
  const n = r.map((o) => Math.floor(o / l.size)), a = r.map((o) => o % l.size);
  return (Math.max(...n) - Math.min(...n) + 1) * (Math.max(...a) - Math.min(...a) + 1);
}
function G(e) {
  const t = /* @__PURE__ */ new Map(), r = {
    exposure: w,
    largestGroup: T,
    spread: L
  };
  return {
    before: c(e.board),
    beforeMetric: (n, a) => {
      const o = n + a;
      return t.has(o) || t.set(o, r[n](e.board, a)), t.get(o);
    }
  };
}
function _(e, t, r = G(e), n = g(e, t)) {
  const a = e.turn, o = y(a);
  let s;
  return {
    game: e,
    move: t,
    next: n,
    me: a,
    opponent: o,
    ...r,
    after: c(n.board),
    capture: () => s === void 0 ? s = U(e, t) : s
  };
}
var m = {
  territoryGain: (e) => e.after.totals[e.me] - e.before.totals[e.me],
  opponentTerritoryLost: (e) => e.before.totals[e.opponent] - e.after.totals[e.opponent],
  ownExposureChange: (e) => w(e.next.board, e.me) - e.beforeMetric("exposure", e.me),
  opponentExposureChange: (e) => w(e.next.board, e.opponent) - e.beforeMetric("exposure", e.opponent),
  ownGroupChange: (e) => T(e.next.board, e.me) - e.beforeMetric("largestGroup", e.me),
  largestTerritoryChange: (e) => e.after.largest[e.me] - e.before.largest[e.me],
  ownMobility: (e) => f({
    ...e.next,
    turn: e.me
  }).length,
  opponentMobility: (e) => f(e.next).length,
  spreadChange: (e) => L(e.next.board, e.me) - e.beforeMetric("spread", e.me),
  centerDistance: (e) => Math.abs(e.move.to % l.size - (l.size - 1) / 2) + Math.abs(Math.floor(e.move.to / l.size) - (l.size - 1) / 2),
  ownPiecesRemaining: (e) => e.next.supply[e.me],
  opponentPiecesRemaining: (e) => e.next.supply[e.opponent],
  place: (e) => +(e.move.type === "place"),
  remove: (e) => +(e.move.type === "remove"),
  shift: (e) => +(e.move.type === "shift"),
  placeReserve: (e) => +(e.move.type === "place") * e.game.supply[e.me] / l.pieces,
  removeReserve: (e) => +(e.move.type === "remove") * e.game.supply[e.me] / l.pieces,
  shiftReserve: (e) => +(e.move.type === "shift") * e.game.supply[e.me] / l.pieces,
  terminalWin: (e) => +(!!e.next.ended && e.after.winner === e.me),
  terminalLoss: (e) => +(!!e.next.ended && e.after.winner === e.opponent),
  repetitionCount: (e) => e.game.positions[P(e.game, e.move)] || 0
}, I = Object.keys(m), k = {
  movedStoneExposed: (e) => Number(e.move.type !== "remove" && E(e.next.board, e.move.to)),
  captureReplyAvailable: (e) => +(e.capture() !== null),
  captureReplyOwnGain: (e) => e.capture()?.myNetTerritoryGain ?? e.after.totals[e.me] - e.before.totals[e.me],
  captureReplyOpponentLoss: (e) => e.before.totals[e.opponent] - (e.capture()?.territoryAfterReply[e.opponent] ?? e.after.totals[e.opponent]),
  captureReplyLargestChange: (e) => (e.capture()?.myLargestAreaAfterReply ?? e.after.largest[e.me]) - e.before.largest[e.me],
  captureReplyWastesStone: (e) => +(e.move.type === "place" && !!e.capture()?.boardReturnsToCurrentPosition),
  captureReplyTerminalWin: (e) => +(!!e.capture()?.gameEndsAfterReply && e.capture()?.winnerIfGameEnds === e.me),
  captureReplyTerminalLoss: (e) => +(!!e.capture()?.gameEndsAfterReply && e.capture()?.winnerIfGameEnds === e.opponent),
  movedStoneSupport: (e) => e.move.type === "remove" ? 0 : v(e.move.to).filter((t) => e.next.board[t] === e.me).length,
  territoryLeadLastSupply: (e) => (e.after.totals[e.me] - e.after.totals[e.opponent]) * +(e.next.supply[e.me] <= 2)
};
Object.assign(m, k);
var q = [...I, ...Object.keys(k)];
function B(e, t = I) {
  const r = G(e);
  return [...$(e)].map(({ move: n, game: a }) => {
    const o = _(e, n, r, a);
    return {
      move: n,
      values: t.map((s) => {
        if (!m[s]) throw new Error(`Unknown feature ${s}`);
        return m[s](o);
      })
    };
  });
}
function D(e) {
  const t = e;
  if (!t || t.version !== 1 || t.ruleset !== "8x8-25-permanent-majority-single-opening-v1" || t.featureVersion !== 1 || !Array.isArray(t.features) || !t.features.length || new Set(t.features).size !== t.features.length || t.features.some((r) => typeof r != "string" || !Object.hasOwn(m, r)) || !t.strategies || typeof t.strategies != "object") throw new Error("Incompatible policy model");
  for (const [r, n] of Object.entries(t.strategies)) if (!(r in S) || !n || ![
    n.weights,
    n.mean,
    n.scale
  ].every((a) => Array.isArray(a) && a.length === t.features.length && a.every(Number.isFinite)) || n.scale.some((a) => a <= 0)) throw new Error(`Invalid weights for ${r}`);
  if (!t.training || ![t.training.trainGameIds, t.training.testGameIds].every((r) => Array.isArray(r) && r.every((n) => typeof n == "string")) || t.training.trainGameIds.some((r) => t.training.testGameIds.includes(r))) throw new Error("Invalid training split metadata");
  if (!Object.keys(t.strategies).length) throw new Error("Model has no trained strategies");
  return t;
}
function W(e, t, r) {
  const n = r.strategies[t];
  if (!n) throw new Error(`No trained policy for ${t}`);
  return B(e, r.features).map(({ move: a, values: o }) => ({
    move: a,
    score: o.reduce((s, i, u) => s + n.weights[u] * (i - n.mean[u]) / n.scale[u], 0)
  })).sort((a, o) => o.score - a.score || h(a.move).localeCompare(h(o.move)));
}
function H(e, t, r, n = 0, a = Math.random) {
  if (!Number.isFinite(n) || n < 0 || n > 1) throw new Error("Randomness must be between 0 and 1");
  const o = W(e, t, r);
  if (!o.length) throw new Error("No legal moves");
  return n > 0 && a() < n ? o[Math.floor(a() * o.length)].move : o[0].move;
}
function V(e) {
  let t = e >>> 0;
  return () => {
    t += 1831565813;
    let r = t;
    return r = Math.imul(r ^ r >>> 15, r | 1), r ^= r + Math.imul(r ^ r >>> 7, r | 61), ((r ^ r >>> 14) >>> 0) / 4294967296;
  };
}
export {
  H as chooseLocalMove,
  W as rankMoves,
  V as seededRandom,
  D as validateModel
};
