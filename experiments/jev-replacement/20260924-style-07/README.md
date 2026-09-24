# Group-safe probe training

Offline development session, 2026-09-24. No Jev calls, new dependencies, deployment,
UI/default changes, or audience changes. Replacement is **not ready**.

## What changed

Added an explicit counterfactual training adapter. It validates legal choices and
provenance, rejects invented outcomes/conflicting duplicates, and preserves the
original records. Both split helpers now group the five alternative strategy
labels with their source game, including that game's ordinary decisions. Tests
check fold separation and that changing held-out labels cannot affect weights or
normalization. The ordinary JSONL reader still ignores counterfactual events.

Three all-strategy linear refits use the existing 562 played teacher decisions
and 100 probe labels. No new teacher data was purchased. The original five-game
development holdout is preserved; seeded selection holds out two new random-trace
groups. Training: 336 labels in 11 groups (276 played, 60 counterfactual).
Validation: 326 labels in seven groups (286 played, 40 counterfactual on eight
positions). The split is by source group, never synthetic per-strategy game ID.

## Results

The strong shared-prior soft-label refit raises ordinary linear agreement from
48.25% to **48.95%**, and lowers mean teacher rank from 6.36 to **5.94**. After
excluding 60 validation contexts repeated on the augmented training side, agreement
is 55.75% versus 53.98% for the frozen baseline on the same 226 decisions. All 40
probe validation labels have novel contexts relative to the training side.
Probe linear agreement is 52.5%, versus 50% baseline. The weak-prior refit reaches
55% probe agreement but has a slightly worse ordinary mean rank. These are small,
repeatedly inspected DEVELOPMENT folds; do not interpret the differences as
statistically established improvement or independent acceptance.

The default search largely overrides the learned style differences. On all 20
common positions, the strong refit's Aggressive, Cautious, Expansive and Fluid
choices are identical; Balanced differs on four positions. Raising search prior
weight from 0.75 to 3 increases variation but Aggressive and Fluid remain identical.
The weak refit with weight 3 has some differences for every pair over all positions,
but Aggressive/Fluid remain identical on the eight held-out positions. This does
not pass the recognizable-strategy gate. Fluid shift generalization is still
unproven: the only teacher-shift position is in training, not validation.

Forty free, balanced-color development games compare the strong refit with the
previous frozen model, both using search version 2:

| Candidate configuration | W / D / L | Score | Mean turns |
| --- | --- | --- | --- |
| Default search prior (0.75) | 6 / 13 / 1 | 62.5% | 61.3 |
| Stronger search prior (3) | 3 / 10 / 7 | 40% | 63.3 |

Each comparison contains 20 games (four per strategy). Conservative paired 95%
Hoeffding intervals are [19.55%, 100%] and [0%, 82.95%]; neither establishes a
strength advantage. No aborts, truncations, repetition endings or illegal choices.
Independent seeded replay reproduces **all 2,492 decisions and 40 outcomes** from
the saved logs. These are local-versus-local games, NOT Jev acceptance games.

The three models compress to 4,740–4,773 bytes. Thirty-six tests and TypeScript
pass. No mobile latency, production build, browser or deployment gate was run.
Do not promote the refit or raise the search prior based on this evidence alone.

## Artifacts and reproduction

`comparison.json` records inputs/code hashes, exact folds, all eight model/search
comparisons, agreement by strategy/type, ranks, same-position feature means,
pairwise move differences and context overlap. `choices.json.gz` contains every
probe choice. Three policy JSON files contain the actual trained weights.
Tournament JSON reports contain game outcomes and intervals; their JSONL gzip
files contain full decisions/results. Each `*-integrity.json` verifies exact
seeded reproduction, dataset/model hashes and zero paid calls.

Run from the repository root:

```sh
node scripts/ai/train-probe.mjs --data experiments/jev-replacement/20260921-all-strategies-01/decisions.jsonl.gz --probes experiments/jev-replacement/20260924-style-06/probe/labels.jsonl.gz --baseline experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json --out experiments/jev-replacement/20260924-style-07

node scripts/ai/local-tournament.mjs --candidate experiments/jev-replacement/20260924-style-07/probe-soft-prior-strong.json --baseline experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json --search '{}' --baseline-search '{}' --out experiments/jev-replacement/20260924-style-07/refit-vs-frozen --pairs 2 --seed 2407

node scripts/ai/local-tournament.mjs --candidate experiments/jev-replacement/20260924-style-07/probe-soft-prior-strong.json --baseline experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json --search '{"priorWeight":3}' --baseline-search '{}' --out experiments/jev-replacement/20260924-style-07/strong-prior-vs-frozen --pairs 2 --seed 2407

node scripts/ai/verify-local.mjs --run experiments/jev-replacement/20260924-style-07/refit-vs-frozen --candidate experiments/jev-replacement/20260924-style-07/probe-soft-prior-strong.json --baseline experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json

node scripts/ai/verify-local.mjs --run experiments/jev-replacement/20260924-style-07/strong-prior-vs-frozen --candidate experiments/jev-replacement/20260924-style-07/probe-soft-prior-strong.json --baseline experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json

node --test tests/*.test.mjs
pnpm exec tsc --noEmit --incremental false
```

## Next

Do not collect another large general imitation batch or spend the acceptance
reserve yet. Ordinary refitting improves agreement slightly but does not fix
search's style collapse. Investigate a small, regularized **matched-state style
residual** that learns differences between teacher strategies, then applies them
only among tactically close moves; compare it with these saved candidates on
group-held-out states and free games. Avoid artificial style quirks unsupported by
teacher labels. The current twenty-position sample cannot establish Fluid's shift
tendency. A small repeated-response/control probe may eventually be useful, but
only after fresh lease/budget checks. Measure constrained-browser latency including
the full-width loss-deferring fallback before independent acceptance spending.

Cost this session: **$0**. Cumulative additional Jev spend remains $0.660659874;
remaining $3.589340126, including $3.25 reserved for independent evaluation.
No financial reservation or uncertain charges. This is the task ledger, not a
claim about the provider balance after unrelated public-site games. Live Jev
remains public version 14.
