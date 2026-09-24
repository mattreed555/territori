# Search versus Jev — development checkpoint

The frozen shared-prior model plus default two-ply search won **10/10** Jev
development matches (two per strategy, one per color). This is promising, but
it is **not** the 200-game independent acceptance suite. No live change.

All ten games ended on supply at 50 turns, with no aborts, truncations or
repetition endings. The conservative 95% bounded-score interval is [57.1%,100%]
overall and [4.0%,100%] per strategy, under an independent-game assumption.
Only nine distinct move trajectories occurred; the tiny sample and deterministic
opponent limit generalization. Do not report 100% as an established win rate.

## What happened

The local side placed on all 250 turns. Jev placed 56 times and captured 194
times. The local side often sacrificed stones while using its supply to finish
ahead in territory. Winning margins were only 1–2 territory points. This batch
tests that particular interaction, not diverse human play or recognizable styles.

`dev-matches/integrity.json` independently replays all 500 states/moves and ten
final results, validates legality, and matches every one of the 250 paid requests
to its response usage and teacher choice. Raw provider answers, distributions,
game results, and the usage journal are preserved in the `.jsonl.gz` artifacts.

Same-state diagnostics still fail to establish five distinct styles: Cautious,
Expansive and Fluid choose identical moves on the 50 sampled common positions.
No teacher shift has occurred in any saved replacement batch. This remains a
readiness gap, not a reason to silently lower the goal.

## Imitation and runtime

On the 250 new teacher states, search agreement is 81.6%, average complete policy
rank 1.928. By strategy: Aggressive 80%, Cautious 82%, Expansive 82%, Fluid 80%,
Balanced 84%. This high overall agreement is dominated by captures: 98.97% on
194 capture states versus 21.43% on 56 placement states; no shift estimate.

Search audits now provide a complete policy order: searched moves by search
score, followed by unsearched moves in learned-prior order. This is **not** full-
width minimax evaluation. All 250 teacher moves happened to be in the beam here.
The new ordering is diagnostic only and does not change move selection. It was
added after the paid batch; that batch's exact pre-change source hash is recorded
in its provenance, and the original source is commit
`f5916a591eddc9b8a85057a0abc188c0d229e8e3`.

Unthrottled Node 24 over 500 states: p50 21.64 ms, p95 33.20 ms, max 72.15 ms.
These are **not** mobile-class measurements. No new runtime dependencies.

## Training experiment

The new explicit-holdout option preserves the original five development-validation
games while adding the prior 269 student-state teacher decisions to training.
831 total teacher decisions: 545 train (15 games), 286 validation (5 games).
Training coverage: Aggressive 106, Cautious 114, Expansive 135, Fluid 108, Balanced 82.
The newly collected 250 decisions above were NOT used for these fits.

Four new tactical linear models are saved under `retrained/`. Validation agreement:
hard 41.26%, soft 43.36%, soft+weak shared prior 43.71%, soft+strong shared prior 43.71%.
All regress the frozen model's 48.25% on that same holdout. Do not promote them.
This suggests merely adding more of these narrow student-state choices does not
solve the representation/strategy problem. The frozen model remains the candidate.

31 tests and TypeScript pass, including explicit-holdout leakage checks and full
policy-order coverage. Normal UI, Jev default, public audience and live version14
are unchanged. Independent evaluation, recognizable styles, mobile/browser gates,
production integration/build/deployment remain pending. **Not ready.**

## Cost

Official [pricing](https://docs.typesafe.ai/models) and
[response usage](https://docs.typesafe.ai/api) rechecked 2026-09-24:
Jev1.13.0 costs $0.042 per million input tokens; outputs are free. The per-request
64k bound was retained, and unexpected/missing usage would have stopped the batch.
No retries or uncertain charges occurred.

3,539,069 input tokens + 190,355 free output tokens = **$0.148640898**.
Cumulative added spend: **$0.606310194** of $4.25.
Remaining: **$3.643689806**, including the unchanged **$3.25 acceptance reserve**.
Discretionary development amount: $0.393689806. This is the project allowance,
not a claim about the provider account balance after unrelated public play.

## Reproduce

The paid batch command is recorded for provenance, **not permission to rerun an
old reservation**. Always acquire a new durable lease/cap, verify pricing, use a
new output directory and run ID, and read the cumulative ledger first.

```sh
node scripts/ai/collect.mjs \
  --run-id 20260924-search-05-devmatches \
  --out experiments/jev-replacement/20260924-search-05/dev-matches \
  --ledger experiments/jev-replacement/budget.json \
  --teacher-url https://territori.matthew-l-reed.chatgpt.site/api/robot \
  --games 10 --seed 24051 --max-turns 160 \
  --source-commit f5916a591eddc9b8a85057a0abc188c0d229e8e3 \
  --mode local-vs-jev \
  --model experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json \
  --search '{}' --epsilon 0.03

node scripts/ai/retrain-student.mjs \
  --data experiments/jev-replacement/20260921-all-strategies-01/decisions.jsonl.gz \
  --data experiments/jev-replacement/20260921-shared-03/dev-matches/decisions.jsonl.gz \
  --baseline experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json \
  --out experiments/jev-replacement/20260924-search-05/retrained

node scripts/ai/verify-session.mjs \
  --run experiments/jev-replacement/20260924-search-05/dev-matches
node scripts/ai/report-matches.mjs \
  --run experiments/jev-replacement/20260924-search-05/dev-matches
node scripts/ai/audit-search.mjs \
  --data experiments/jev-replacement/20260924-search-05/dev-matches/decisions.jsonl.gz \
  --model experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json \
  --out experiments/jev-replacement/20260924-search-05/search-audit.json
```

## Next

Before the acceptance spend, probe Jev's five strategies on **identical**, varied
positions, including useful shifts. A small metered common-state label batch can
distinguish weak learned style conditioning from indistinct teacher behavior.
Keep labels explicitly counterfactual (no invented final outcomes), preserve
whole-source-game grouping, and do not relabel development samples as acceptance.
Then improve the local style preferences if justified, test constrained-browser
latency, and freeze the exact candidate/config before independently seeded matches.
No heavyweight dependency or architectural change is currently justified.
