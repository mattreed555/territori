# Common-state strategy probe

100 metered labels: the same 20 positions evaluated under each of Jev's five
strategies. No new played games, training fits, or acceptance results. Live
version 14, public audience and Jev default are unchanged.

## Findings

Jev does respond differently to strategy on these common boards: pairs disagree
on 2–8 of 20 choices (10–40%). Expansive's chosen moves expand the occupied
bounding box by 3.6 squares on average, versus Aggressive's 1.7. Aggressive removes
six times versus five for each other strategy. These are small, targeted-sample
diagnostics, not established population effects; there is no repeated-response
control to separate all provider variability from strategy conditioning.

The first teacher shifts are now recorded: all five strategies shift 53→52 on
the SAME random-play position. This establishes legal shift coverage, not a
distinct Fluid preference. Cautious and Expansive still choose identically under
the local search policy on this sample despite four teacher-choice differences.
No style-readiness claim is justified yet.

Search-v2 agreement with the teacher: Aggressive15%, Cautious30%, Expansive30%,
Fluid30%, Balanced25%. Complete policy ranks average 10.50, 9.75, 9.30, 10.55,
11.05 respectively. Unlike the earlier capture-heavy match states, these varied
positions expose a large imitation gap. Probability-weighted features, hard
choices, per-strategy ranks and pairwise distribution differences are retained
in `probe/analysis.json.gz`.

## A real search defect found and fixed

One saved late-game state has a shift that defers a visible terminal loss, while
every non-shift loses within two plies. Version 1's learned/static root beam
excluded every shift and accepted the loss. All five teacher prompts also chose
placements in this particular state, so imitating Jev would not fix this defect.

**Search version 2** now widens to every root move whenever all initial beam
options are visible terminal losses. All five local strategies select a shift
in the regression fixture. This defers the immediate loss; it does NOT prove a
long-term win. Normal choices remain bounded. Offline seeded replay reproduces
all 250 local choices from the ten previous development wins exactly, with no
widening in those games. That is replay evidence, not new Jev matches.

33 tests and TypeScript pass, including the new safety regression and separation
of counterfactual labels from played-game training data. Worst-case/mobile
latency must still be measured, including the new full-width fallback.

## Positions and data integrity

The 20 frozen positions comprise 12 phase/color-stratified saved teacher states,
one saved terminal-loss avoidance case, and seven seeded random-play states
selected for relatively promising shift values. The random shift-value gaps are
still negative versus other moves: the sampling proxy is NOT proof of optimal
shifting. Positions cover 14 source-game groups, 14 Blue turns and 6 Red turns.
This intentionally targeted sample is not a balanced strength tournament.

`positions.json.gz` contains exact states; `random-traces.jsonl.gz` preserves
legal generating traces. The report independently replays generated positions
and matches saved positions to their source records. Every paid response matches
the usage journal and a legal choice. There are no invented final outcomes.

Each label has a separate `kind: counterfactual` wrapper with source `groupId`,
position identity, category, and a full decision/teacher-response record. The
nested strategy-specific game ID is NOT a splitting unit. Group all labels from
one source game together, including that game's original ordinary decisions.
Existing training readers intentionally ignore counterfactual events until an
explicit, leakage-safe adapter is added.

`probe/analysis-v1.json.gz` preserves the initial diagnostic before the safety
fix. `probe/analysis.json.gz` is the final version-2 report. Collection source was
frozen in `d462e746a4abe3f2e4789514f5f04a61b1fa8038`; no collection code changed
while requests were running. The new safety fix changes local inference only.

## Cost

[Official pricing](https://docs.typesafe.ai/models) was rechecked 2026-09-24:
Jev1.13.0, $0.042/million input tokens, free output, 64k total request limit.
100 calls used 1,294,040 input and 72,633 output tokens: **$0.054349680**.
No retries, errors, incomplete labels or uncertain charges.

Cumulative added spend **$0.660659874**; remaining **$3.589340126**, including
the unchanged **$3.25 acceptance reserve**. Discretionary development budget is
$0.339340126. Do not treat this as the live provider account balance.

## Reproduction and next step

All commands run from the repository root. Paid collection must use a NEW durable
reservation/run ID, never reuse this closed batch.

```sh
node scripts/ai/prepare-probe.mjs \
  --data experiments/jev-replacement/20260921-all-strategies-01/decisions.jsonl.gz \
  --extra experiments/jev-replacement/20260921-shared-03/dev-matches/decisions.jsonl.gz \
  --out experiments/jev-replacement/20260924-style-06 --seed 2406

node scripts/ai/report-probe.mjs \
  --run experiments/jev-replacement/20260924-style-06/probe \
  --positions experiments/jev-replacement/20260924-style-06/positions.json.gz \
  --model experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json

node scripts/ai/replay-search.mjs \
  --run experiments/jev-replacement/20260924-search-05/dev-matches \
  --model experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json \
  --out experiments/jev-replacement/20260924-style-06/search-v2-replay.json
```

Next, use matched-state teacher differences to improve strategy preferences,
with source-group-safe splits. Compare a small strategy residual or a learned
preference among tactically close moves, rather than adding arbitrary style
quirks or merely collecting more capture-loop games. Validate with free local
games first. Measure constrained-browser latency before freezing a candidate
and spending the independent evaluation reserve. No heavyweight model or major
architecture change is currently justified. **Replacement is not ready.**
