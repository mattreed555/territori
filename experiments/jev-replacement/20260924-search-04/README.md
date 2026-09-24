# Two-ply local search — development only

No Jev calls or new dependencies. Live version 14 remains public and uses Jev.
This session reuses the frozen shared-prior model and saved development states;
it does not train new weights or count toward independent acceptance.

## What changed

`lib/ai/search.ts` ranks a union of the top 12 learned-policy moves and top 8
immediate board-value moves, plus every terminal move. It considers **every**
legal opponent reply, including placements and shifts. The worst reply's board
value is combined with a small learned-strategy preference. Terminal values use
the actual finish-round, repetition, territory and connected-area tiebreak rules.
Exploration only selects close alternatives and cannot discard a visible win.

The board-value heuristic is territory margin + 0.25 × stone margin − 0.5 ×
exposure margin + 0.1 × unused-supply margin. It is an interpretable development
heuristic, not a trained value function or a guarantee against longer tactics.
The prior preference is normalized rank, weighted by 0.75 by default.

`legalSuccessors` shares the same private transition as `applyMove`; it avoids
rechecking an entire move list for every sibling. Seeded exhaustive successor
checks preserve transition semantics. Saved decisions before and after this
optimization are identical. No rule, live engine selection, or UI changed.

## Results

- Default search vs the frozen linear policy: **20 wins / 20 completed games**,
  four per strategy with balanced colors. No aborts, truncations, or repetitions;
  mean 53.3 turns. This is a weak local opponent, **not Jev strength evidence**.
  The all-win bootstrap interval degenerates to [1,1]; use the conservative
  color-pair Hoeffding interval [0.571,1] instead (independent-seed assumption).
- Prior weight 3 vs default search: 5 wins, 9 draws, 6 losses in 20 completed
  games, 47.5% score; paired bootstrap [32.5%,62.5%]. No incomplete/repetition games.
- On 269 saved teacher states from the prior Jev development matches, default
  search agrees **28.25%**, versus 52.79% for its underlying linear model on the
  same states. Stronger prior agrees 29.37%. Strength and imitation differ.
- Default beam includes 261/269 teacher moves; mean teacher rank among those
  included is 6.59. This is a **conditional beam rank**, not a full legal-move rank.
  Reports retain exclusion counts rather than pretending omitted moves were ranked.
- On 269 saved *local* decisions, search avoids 3 visible two-ply terminal losses.
  This is counterfactual analysis, not three newly won games. Full positions and
  original outcomes remain in the referenced input dataset.
- Latest unthrottled Node 24 audit: 538 decisions, p50 20.9 ms, p95 34.0 ms,
  max 128.8 ms. Earlier measurements vary with host load. **Not a mobile gate**.
- Styles remain too similar: on 54 common states default policies differ on only
  0–6 choices per pair; prior weight 3 raises this to 3–9. None shifts on those
  common states. Mean feature comparisons are saved, but recognizable styles,
  especially Fluid, are not validated. No acceptance claim.
- 30 tests and TypeScript pass, including full-width reference search, both-color
  final rounds, terminal wins, repetitions, deterministic randomness, invalid
  options and successor parity. Invalid collector search configuration fails
  before creating the meter or contacting a teacher.

## Artifacts and reproduction

Run from the repository root. Model (unchanged):
`experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json`.
Input: `../20260921-shared-03/dev-matches/decisions.jsonl.gz` (538 decisions,
269 teacher and 269 local, from ten DEVELOPMENT games). No training game IDs
are included in the search audit. This is not a newly independent test split.

```sh
node scripts/ai/local-tournament.mjs \
  --candidate experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json \
  --baseline experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json \
  --search '{}' --pairs 2 --seed 2404 \
  --out experiments/jev-replacement/20260924-search-04/search-vs-prior

node scripts/ai/local-tournament.mjs \
  --candidate experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json \
  --baseline experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json \
  --search '{"priorWeight":3}' --baseline-search '{}' --pairs 2 --seed 2405 \
  --out experiments/jev-replacement/20260924-search-04/strong-prior-vs-search

node scripts/ai/audit-search.mjs \
  --data experiments/jev-replacement/20260921-shared-03/dev-matches/decisions.jsonl.gz \
  --model experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json \
  --out experiments/jev-replacement/20260924-search-04/final-student-state-audit.json
```

Tournament `.jsonl.gz` files preserve every choice, state and outcome; `.json`
files contain results and seeds. Audit `.json.gz` files contain individual ranks,
selected moves, worst replies, hashes and same-state style comparisons. Initial
and optimized audits preserve the timing investigation; the `final-` audit is
authoritative for default search diagnostics. The strong-prior audit predates
the extra recorded-move counterfactual fields. Regenerated timings will vary.

## Next bounded session

1. Reconcile sources, lease and ledger again; do not overlap a worker.
2. A small **development** search-vs-Jev batch is now justified by free tests,
   not the 200-game acceptance suite. `collect.mjs --search '{}'` supports this
   and records the search configuration and source hash. Refresh official pricing
   first (last verification is stale), reserve a bounded cap durably, and preserve
   the $3.25 acceptance reserve. Do not use the unmetered simulator for paid work.
3. Improve style training on the 269 existing student-influenced teacher choices
   and/or targeted common-state labels. Shift coverage is still missing. Search
   may need stronger learned preferences or a learned leaf evaluator; avoid
   adding arbitrary style quirks solely to claim differentiation.
4. Measure constrained-browser latency and fix it if necessary. Full-legal-move
   rank evaluation, independent 200-match acceptance, no-API UI integration,
   production build/browser checks and deployment remain pending.

Cost this session: **$0**. Cumulative added spend $0.457669296; remaining
$3.792330704, of which $3.25 remains reserved for independent evaluation.
Replacement is **not ready**.
