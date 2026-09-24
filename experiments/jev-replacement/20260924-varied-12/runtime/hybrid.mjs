var d = {
  size: 8,
  pieces: 25,
  repetitions: 3
}, E = (e) => e === "blue" ? "red" : "blue";
function N(e, t = d.size) {
  const a = Math.floor(e / t), o = e % t;
  return [
    a > 0 ? e - t : -1,
    a < t - 1 ? e + t : -1,
    o > 0 ? e - 1 : -1,
    o < t - 1 ? e + 1 : -1
  ].filter((r) => r >= 0);
}
var F = Array.from({ length: d.size ** 2 }, (e, t) => N(t)), R = (e, t) => t === d.size && Number.isInteger(e) && e >= 0 && e < F.length ? F[e] : N(e, t), z = (e, t, a) => `${t}:${a.blue}:${a.red}:` + e.map((o) => o === "blue" ? "B" : o === "red" ? "R" : ".").join("");
function C(e, t, a = d.size) {
  const o = e[t];
  if (!o) return !1;
  let r = 0, n = 0;
  for (const s of R(t, a)) e[s] === o ? r++ : e[s] === E(o) && n++;
  return n > r;
}
function J(e, t = d.size) {
  return e.map((a, o) => {
    if (a) return a;
    const r = new Set(R(o, t).map((n) => e[n]).filter(Boolean));
    return r.size === 1 ? [...r][0] : null;
  });
}
function M(e, t = d.size) {
  const a = J(e, t), o = {
    blue: 0,
    red: 0
  }, r = {
    blue: 0,
    red: 0
  }, n = /* @__PURE__ */ new Set();
  a.forEach((i, l) => {
    if (!i || (o[i]++, n.has(l))) return;
    const c = [l];
    n.add(l);
    let m = 0;
    for (; c.length; ) {
      const y = c.pop();
      m++, R(y, t).forEach((f) => {
        !n.has(f) && a[f] === i && (n.add(f), c.push(f));
      });
    }
    r[i] = Math.max(r[i], m);
  });
  const s = o.blue - o.red || r.blue - r.red;
  return {
    land: a,
    totals: o,
    largest: r,
    winner: s > 0 ? "blue" : s < 0 ? "red" : null
  };
}
function w(e) {
  if (e.ended) return [];
  const t = [];
  return e.board.forEach((a, o) => {
    !a && e.supply[e.turn] > 0 && t.push({
      type: "place",
      to: o
    }), a === E(e.turn) && C(e.board, o) && t.push({
      type: "remove",
      to: o
    }), a === e.turn && R(o, d.size).forEach((r) => {
      e.board[r] || t.push({
        type: "shift",
        from: o,
        to: r
      });
    });
  }), t;
}
var h = (e) => e.type === "shift" ? `shift_${e.from}_${e.to}` : `${e.type}_${e.to}`;
function G(e, t, a) {
  const o = [...e];
  return a.type === "shift" && (o[a.from] = null), o[a.to] = a.type === "remove" ? null : t, o;
}
var U = (e) => E(e.turn);
function Q(e, t) {
  const a = { ...e.supply };
  return t.type === "place" && a[e.turn]--, z(G(e.board, e.turn, t), U(e), a);
}
function k(e, t) {
  if (!w(e).some((a) => h(a) === h(t))) throw new Error("That move is not legal.");
  return P(e, t);
}
function* B(e) {
  for (const t of w(e)) yield {
    move: t,
    game: P(e, t)
  };
}
function P(e, t) {
  const { board: a, supply: o, turn: r, finalRound: n, key: s, ended: i } = _(e, t), l = { ...e.captured };
  t.type === "remove" && l[E(e.turn)]++;
  const c = {
    ...e.positions,
    [s]: (e.positions[s] || 0) + 1
  };
  return {
    board: a,
    supply: o,
    captured: l,
    turn: r,
    ply: e.ply + 1,
    finalRound: n,
    ended: i,
    positions: c,
    last: {
      color: e.turn,
      move: t
    }
  };
}
function* X(e) {
  for (const t of w(e)) {
    const { board: a, supply: o, ended: r } = _(e, t);
    yield {
      move: t,
      state: {
        board: a,
        supply: o,
        ended: r
      }
    };
  }
}
function _(e, t) {
  const a = G(e.board, e.turn, t), o = { ...e.supply };
  t.type === "place" && o[e.turn]--;
  const r = U(e), n = e.finalRound || o[e.turn] === 0, s = z(a, r, o);
  return {
    board: a,
    supply: o,
    turn: r,
    finalRound: n,
    key: s,
    ended: n && e.turn === "red" ? "supply" : (e.positions[s] || 0) + 1 >= d.repetitions ? "repetition" : null
  };
}
var Z = (e) => String.fromCharCode(65 + e % d.size) + (Math.floor(e / d.size) + 1), ee = {
  Aggressive: "Create local numerical advantages. Threaten captures and pressure contested territory.",
  Cautious: "Reinforce threatened stones. Keep friendly neighbors at least equal to enemy neighbors around your stones. Prefer stable territory.",
  Expansive: "Claim open space efficiently. Establish new footholds without giving away easy captures.",
  Fluid: "Shift to escape threats, reinforce allies, or create capture opportunities.",
  Balanced: "Weigh lasting territory, stone safety, and useful captures. Adapt to the position."
}, pe = ["Human", ...Object.keys(ee)];
function te(e, t) {
  const a = k(e, t);
  if (a.ended || a.turn === e.turn) return null;
  const o = M(e.board), r = w(a).filter((s) => s.type === "remove").map((s) => {
    const i = k(a, s), l = M(i.board);
    return {
      reply: s,
      result: i,
      tally: l,
      margin: l.totals[e.turn] - l.totals[a.turn]
    };
  });
  r.sort((s, i) => s.margin - i.margin || s.tally.largest[e.turn] - s.tally.largest[a.turn] - (i.tally.largest[e.turn] - i.tally.largest[a.turn]));
  const n = r[0];
  return n ? {
    opponentCaptures: Z(n.reply.to),
    territoryAfterReply: n.tally.totals,
    myNetTerritoryGain: n.tally.totals[e.turn] - o.totals[e.turn],
    myTerritoryLeadAfterReply: n.margin,
    myLargestAreaAfterReply: n.tally.largest[e.turn],
    myUnusedPiecesAfterReply: n.result.supply[e.turn],
    myPermanentlyLostPiecesAfterReply: n.result.captured[e.turn],
    boardReturnsToCurrentPosition: n.result.board.every((s, i) => s === e.board[i]),
    gameEndsAfterReply: n.result.ended,
    winnerIfGameEnds: n.result.ended ? n.tally.winner : null
  } : null;
}
var S = (e, t) => e.reduce((a, o, r) => a + Number(o === t && C(e, r)), 0);
function $(e, t) {
  const a = /* @__PURE__ */ new Set();
  let o = 0;
  return e.forEach((r, n) => {
    if (r !== t || a.has(n)) return;
    const s = [n];
    a.add(n);
    let i = 0;
    for (; s.length; ) {
      const l = s.pop();
      i++;
      for (const c of N(l)) e[c] === t && !a.has(c) && (a.add(c), s.push(c));
    }
    o = Math.max(o, i);
  }), o;
}
function j(e, t) {
  const a = e.flatMap((n, s) => n === t ? [s] : []);
  if (!a.length) return 0;
  const o = a.map((n) => Math.floor(n / d.size)), r = a.map((n) => n % d.size);
  return (Math.max(...o) - Math.min(...o) + 1) * (Math.max(...r) - Math.min(...r) + 1);
}
function W(e) {
  const t = /* @__PURE__ */ new Map(), a = {
    exposure: S,
    largestGroup: $,
    spread: j
  };
  return {
    before: M(e.board),
    beforeMetric: (o, r) => {
      const n = o + r;
      return t.has(n) || t.set(n, a[o](e.board, r)), t.get(n);
    }
  };
}
function K(e, t, a = W(e), o = k(e, t)) {
  const r = e.turn, n = E(r);
  let s;
  return {
    game: e,
    move: t,
    next: o,
    me: r,
    opponent: n,
    ...a,
    after: M(o.board),
    capture: () => s === void 0 ? s = te(e, t) : s
  };
}
var g = {
  territoryGain: (e) => e.after.totals[e.me] - e.before.totals[e.me],
  opponentTerritoryLost: (e) => e.before.totals[e.opponent] - e.after.totals[e.opponent],
  ownExposureChange: (e) => S(e.next.board, e.me) - e.beforeMetric("exposure", e.me),
  opponentExposureChange: (e) => S(e.next.board, e.opponent) - e.beforeMetric("exposure", e.opponent),
  ownGroupChange: (e) => $(e.next.board, e.me) - e.beforeMetric("largestGroup", e.me),
  largestTerritoryChange: (e) => e.after.largest[e.me] - e.before.largest[e.me],
  ownMobility: (e) => w({
    ...e.next,
    turn: e.me
  }).length,
  opponentMobility: (e) => w(e.next).length,
  spreadChange: (e) => j(e.next.board, e.me) - e.beforeMetric("spread", e.me),
  centerDistance: (e) => Math.abs(e.move.to % d.size - (d.size - 1) / 2) + Math.abs(Math.floor(e.move.to / d.size) - (d.size - 1) / 2),
  ownPiecesRemaining: (e) => e.next.supply[e.me],
  opponentPiecesRemaining: (e) => e.next.supply[e.opponent],
  place: (e) => +(e.move.type === "place"),
  remove: (e) => +(e.move.type === "remove"),
  shift: (e) => +(e.move.type === "shift"),
  placeReserve: (e) => +(e.move.type === "place") * e.game.supply[e.me] / d.pieces,
  removeReserve: (e) => +(e.move.type === "remove") * e.game.supply[e.me] / d.pieces,
  shiftReserve: (e) => +(e.move.type === "shift") * e.game.supply[e.me] / d.pieces,
  terminalWin: (e) => +(!!e.next.ended && e.after.winner === e.me),
  terminalLoss: (e) => +(!!e.next.ended && e.after.winner === e.opponent),
  repetitionCount: (e) => e.game.positions[Q(e.game, e.move)] || 0
}, T = Object.keys(g), q = {
  movedStoneExposed: (e) => Number(e.move.type !== "remove" && C(e.next.board, e.move.to)),
  captureReplyAvailable: (e) => +(e.capture() !== null),
  captureReplyOwnGain: (e) => e.capture()?.myNetTerritoryGain ?? e.after.totals[e.me] - e.before.totals[e.me],
  captureReplyOpponentLoss: (e) => e.before.totals[e.opponent] - (e.capture()?.territoryAfterReply[e.opponent] ?? e.after.totals[e.opponent]),
  captureReplyLargestChange: (e) => (e.capture()?.myLargestAreaAfterReply ?? e.after.largest[e.me]) - e.before.largest[e.me],
  captureReplyWastesStone: (e) => +(e.move.type === "place" && !!e.capture()?.boardReturnsToCurrentPosition),
  captureReplyTerminalWin: (e) => +(!!e.capture()?.gameEndsAfterReply && e.capture()?.winnerIfGameEnds === e.me),
  captureReplyTerminalLoss: (e) => +(!!e.capture()?.gameEndsAfterReply && e.capture()?.winnerIfGameEnds === e.opponent),
  movedStoneSupport: (e) => e.move.type === "remove" ? 0 : N(e.move.to).filter((t) => e.next.board[t] === e.me).length,
  territoryLeadLastSupply: (e) => (e.after.totals[e.me] - e.after.totals[e.opponent]) * +(e.next.supply[e.me] <= 2)
};
Object.assign(g, q);
var ce = [...T, ...Object.keys(q)];
function D(e, t, a = T) {
  const o = K(e, t);
  return a.map((r) => {
    if (!g[r]) throw new Error(`Unknown feature ${r}`);
    return g[r](o);
  });
}
function re(e, t = T) {
  const a = W(e);
  return [...B(e)].map(({ move: o, game: r }) => {
    const n = K(e, o, a, r);
    return {
      move: o,
      values: t.map((s) => {
        if (!g[s]) throw new Error(`Unknown feature ${s}`);
        return g[s](n);
      })
    };
  });
}
function ne(e, t, a) {
  const o = a.strategies[t];
  if (!o) throw new Error(`No trained policy for ${t}`);
  return re(e, a.features).map(({ move: r, values: n }) => ({
    move: r,
    score: n.reduce((s, i, l) => s + o.weights[l] * (i - o.mean[l]) / o.scale[l], 0)
  })).sort((r, n) => n.score - r.score || h(r.move).localeCompare(h(n.move)));
}
var I = {
  policyBeam: 12,
  staticBeam: 8,
  priorWeight: 0.75
}, oe = Array.from({ length: d.size ** 2 }, (e, t) => N(t)), x = 1e4;
function L(e, t) {
  const a = E(t);
  let o = 0, r = 0, n = 0;
  for (let s = 0; s < e.board.length; s++) {
    const i = e.board[s];
    let l = 0, c = 0;
    for (const m of oe[s]) e.board[m] === t ? l++ : e.board[m] === a && c++;
    i === t ? (o++, r++, n += +(c > l)) : i === a ? (o--, r--, n -= +(l > c)) : o += l && !c ? 1 : c && !l ? -1 : 0;
  }
  if (e.ended) {
    const s = o === 0 ? M(e.board).winner : o > 0 ? t : a;
    return s === t ? x : s === null ? 0 : -x;
  }
  return o + 0.25 * r - 0.5 * n + 0.1 * (e.supply[t] - e.supply[a]);
}
function H(e, t, a, o = {}) {
  if (!o || typeof o != "object" || Array.isArray(o) || Object.keys(o).some((u) => !Object.hasOwn(I, u))) throw new Error("Unknown or invalid search options");
  const r = {
    ...I,
    ...o
  };
  for (const u of ["policyBeam", "staticBeam"]) if (!Number.isSafeInteger(r[u]) || r[u] < 0) throw new Error("Search beams must be nonnegative integers");
  if (!Number.isFinite(r.priorWeight) || r.priorWeight < 0 || r.priorWeight > 10) throw new Error("Search prior weight must be between 0 and 10");
  const n = ne(e, t, a), s = new Map([...B(e)].map((u) => [h(u.move), u.game])), i = n.map(({ move: u }, p) => {
    const v = s.get(h(u));
    return {
      move: u,
      next: v,
      value: L(v, e.turn),
      prior: (n.length - p) / n.length
    };
  }), l = new Set(i.slice(0, r.policyBeam || i.length).map((u) => h(u.move)));
  for (const u of [...i].sort((p, v) => v.value - p.value).slice(0, r.staticBeam)) l.add(h(u.move));
  let c = i.length;
  const m = (u) => {
    let p = u.value, v = null;
    for (const O of X(u.next)) {
      const V = L(O.state, e.turn);
      c++, (v === null || V < p) && (p = V, v = O.move);
    }
    return {
      move: u.move,
      score: p + r.priorWeight * u.prior,
      searchValue: p,
      immediateValue: u.value,
      prior: u.prior,
      worstReply: v
    };
  }, y = i.filter((u) => u.next.ended || l.has(h(u.move))).map(m), f = y.length > 0 && y.every((u) => u.searchValue === -x) && y.length < i.length;
  if (f) {
    const u = new Set(y.map((p) => h(p.move)));
    y.push(...i.filter((p) => !u.has(h(p.move))).map(m));
  }
  y.sort((u, p) => p.score - u.score || h(u.move).localeCompare(h(p.move)));
  const b = new Set(y.map((u) => h(u.move)));
  return {
    ranked: y,
    policyOrder: [...y.map((u) => u.move), ...i.filter((u) => !b.has(h(u.move))).map((u) => u.move)],
    nodes: c,
    legalRootCount: i.length,
    config: r,
    expandedForSafety: f
  };
}
function ae(e, t, a, o = {}, r = 0, n = Math.random) {
  if (!Number.isFinite(r) || r < 0 || r > 1) throw new Error("Randomness must be between 0 and 1");
  const { ranked: s } = H(e, t, a, o);
  if (!s.length) throw new Error("No legal moves");
  const i = s[0], l = s.filter((c) => c.searchValue >= i.searchValue - 1 && (i.searchValue < x || c.searchValue === x));
  return r > 0 && n() < r ? l[Math.floor(n() * l.length)].move : i.move;
}
function se(e, t, a, o) {
  return D(e, t, o.features).reduce((r, n, s) => r + n / o.scale[s] * o.weights[a][s], 0);
}
function A(e, t, a, o, r = {}) {
  if (!r || typeof r != "object" || Array.isArray(r) || Object.keys(r).some((p) => ![
    "margin",
    "weight",
    "search"
  ].includes(p))) throw new Error("Unknown style options");
  const { margin: n = 1, weight: s = 1, search: i = {} } = r;
  if (!Number.isFinite(n) || n < 0 || n > 2 || !Number.isFinite(s) || s < 0 || s > 3) throw new Error("Invalid style margin or weight");
  const l = H(e, t, a, i);
  if (s === 0 || !l.ranked.length) return {
    ...l,
    styleOptions: {
      margin: n,
      weight: s
    },
    eligibleMoves: l.ranked.length
  };
  const c = Math.max(...l.ranked.map((p) => p.searchValue)), m = (p) => p.searchValue >= c - n && (c < 1e4 || p.searchValue === 1e4), y = l.ranked.map((p) => ({
    r: p,
    raw: se(e, p.move, t, o)
  })), f = y.reduce((p, v) => p + v.raw, 0) / y.length, b = y.map(({ r: p, raw: v }) => ({
    ...p,
    styleResidual: v - f,
    score: p.score + s * Math.tanh(v - f),
    eligible: m(p)
  })).sort((p, v) => Number(v.eligible) - Number(p.eligible) || v.score - p.score || h(p.move).localeCompare(h(v.move))), u = new Set(b.map((p) => h(p.move)));
  return {
    ...l,
    ranked: b,
    policyOrder: [...b.map((p) => p.move), ...l.policyOrder.filter((p) => !u.has(h(p)))],
    styleOptions: {
      margin: n,
      weight: s
    },
    eligibleMoves: b.filter((p) => p.eligible).length
  };
}
function ie(e, t, a, o, r = {}, n = 0, s = Math.random) {
  if (!Number.isFinite(n) || n < 0 || n > 1) throw new Error("Randomness must be between 0 and 1");
  if (r.weight === 0)
    return A(e, t, a, o, r), ae(e, t, a, r.search, n, s);
  const i = A(e, t, a, o, r);
  if (!i.ranked.length) throw new Error("No legal moves");
  const l = Math.max(...i.ranked.map((m) => m.searchValue)), c = i.ranked.filter((m) => m.searchValue >= l - Math.min(1, i.styleOptions.margin) && (l < 1e4 || m.searchValue === 1e4));
  return n > 0 && s() < n ? c[Math.floor(s() * c.length)].move : i.ranked[0].move;
}
var fe = 1, Y = [
  "territoryGain",
  "opponentTerritoryLost",
  "ownExposureChange",
  "opponentExposureChange",
  "ownGroupChange",
  "spreadChange",
  "movedStoneExposed",
  "remove",
  "shift",
  "repetitionCount"
];
function le(e, t) {
  if (t.length !== Y.length || t.some((f) => !Number.isFinite(f))) throw new Error("Invalid intent features");
  const [a, o, r, n, s, i, l, c, m, y] = t;
  switch (e) {
    case "Aggressive":
      return Math.tanh(0.8 * c + 0.5 * n + 0.2 * o - 0.1 * Math.max(0, r));
    case "Cautious":
      return Math.tanh(-0.7 * r + 0.2 * s - 0.2 * l);
    case "Expansive":
      return Math.tanh(0.3 * a + 0.1 * i - 0.35 * Math.max(0, r));
    case "Fluid":
      return m > 0 && y === 0 && (r < 0 || n > 0 || s > 0 || a > 0) ? 1 : 0;
    case "Balanced":
      return 0;
    default:
      throw new Error("Unknown intent strategy");
  }
}
function ue(e, t, a, o, r = {}) {
  if (!r || typeof r != "object" || Array.isArray(r) || Object.keys(r).some((f) => ![
    "strength",
    "margin",
    "search"
  ].includes(f))) throw new Error("Unknown intent options");
  const { strength: n = 1, margin: s = 1, search: i = {} } = r;
  if (!Number.isFinite(n) || n < 0 || n > 2 || !Number.isFinite(s) || s < 0 || s > 1) throw new Error("Invalid intent strength or margin");
  const l = A(e, t, a, o, {
    weight: 0.5,
    margin: s,
    search: i
  }), c = Math.max(...l.ranked.map((f) => f.searchValue)), m = l.ranked.map((f) => {
    const b = n === 0 ? 0 : le(t, D(e, f.move, Y)), u = f.searchValue >= c - s && (c < 1e4 || f.searchValue === 1e4);
    return {
      ...f,
      intentScore: b,
      intentEligible: u,
      score: f.score + n * b
    };
  }).sort((f, b) => Number(b.intentEligible) - Number(f.intentEligible) || b.score - f.score || h(f.move).localeCompare(h(b.move))), y = new Set(m.map((f) => h(f.move)));
  return {
    ...l,
    ranked: m,
    policyOrder: [...m.map((f) => f.move), ...l.policyOrder.filter((f) => !y.has(h(f)))],
    intent: {
      version: 1,
      strength: n,
      margin: s
    }
  };
}
function he(e, t, a, o, r = {}, n = 0, s = Math.random) {
  if (!Number.isFinite(n) || n < 0 || n > 1) throw new Error("Randomness must be between zero and one");
  const i = ue(e, t, a, o, r);
  if (!i.ranked.length) throw new Error("No legal moves");
  if (r.strength === 0) return ie(e, t, a, o, {
    weight: 0.5,
    margin: r.margin ?? 1,
    search: r.search
  }, n, s);
  const l = i.ranked.filter((c) => c.intentEligible);
  return n > 0 && s() < n ? l[Math.floor(s() * l.length)].move : i.ranked[0].move;
}
export {
  Y as INTENT_FEATURES,
  fe as INTENT_VERSION,
  he as chooseIntentMove,
  le as intentPreference,
  ue as rankIntentMoves
};
