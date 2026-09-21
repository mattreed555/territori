# Shared tactical prior: better imitation, weak play

September 21, 2026. The general tactical fit uses all 276 decisions in the existing five TRAINING games, then each strategy starts from it and is regularized toward it. The five development-validation games are excluded from both fitting stages. Coefficients are converted to each strategy's normalization, so the exported model still needs only one linear score per legal move. No new dependency or runtime architecture.

Five configurations were declared before fitting:

| Candidate | Prior strength | Development agreement | Mean Jev rank |
|---|---:|---:|---:|
| Original hard-label baseline | 0 | 44.41% | 6.84 |
| Original features, soft labels | 0.05 | 45.80% | 6.58 |
| Tactical features, hard labels | 0.05 | 44.76% | 6.87 |
| Tactical features, soft labels | 0.05 | 44.41% | 6.92 |
| Tactical features, soft labels | 0.2 | 48.25% | 6.36 |

The 0.2 candidate was selected by development agreement, not by game results. On the same 286 validation states it matches 35.3% of placements and 89.7% of captures. No teacher shifts appear in that validation data. The original baseline still reproduces exactly. Tests also change validation labels and confirm that neither shared nor strategy weights change.

## Actual games

The selected candidate played ten **development** games against Jev 1.13: one game in each color per strategy, same opposing strategy, seed 1703, epsilon 0.03. Results: **1 win, 1 draw, 8 losses; 15% score**. Aggressive scored 25%, Cautious 0%, Expansive 0%, Fluid 50%, Balanced 0%. These tiny per-strategy samples are not strength estimates. The conservative overall 95% Hoeffding interval is 0–57.9%; method and independence assumption are explicit in `dev-matches/evaluation.json`.

All ten finished by supply exhaustion, with no illegal moves, errors, unknown charges or turn limits. The candidate also played forty FREE games against the original local baseline: 16 wins, 6 draws, 18 losses, 47.5% score (paired bootstrap interval 32.5–62.5%). All forty completed normally. No acceptance games have been run.

**Do not deploy this candidate or start its full acceptance suite.** Shared knowledge helps agreement but does not solve playing strength. Next, test shallow lookahead that includes opposing placements and final-round outcomes, not just possible captures. The new teacher decisions are useful student-influenced development data, not independent holdout material.

## Cost and artifacts

The ten Jev matches made 269 requests with 3,523,073 input and 197,643 output tokens. At [$0.042 per million input tokens, output free](https://docs.typesafe.ai/models), reverified September 21, added cost is **$0.147969066**. Request journal, response usage and teacher decisions reconcile exactly. Cumulative project spend is **$0.457669296**; remaining allowance **$3.792330704**, of which $3.25 remains reserved for acceptance.

- `comparison.json` and five model files: exact fits, split IDs, coverage, same-state strategy diagnostics and server timings.
- `local-matches.json` / `.jsonl.gz`: all forty free comparison games and decisions.
- `dev-matches/`: all ten Jev game results, every decision (both sources), teacher probability maps, usage journal, source/prompt/model hashes and evaluation report.

Selected compact model: 4,565 gzipped bytes. Server p95 6.98 ms over 325 strategy/state calls; max 23.53 ms. This is not a mobile/browser measurement. Strategy differences on 65 common states are diagnostic only, not a passed faithful-style gate. Live site version 14, public audience and Jev default were unchanged throughout.

## Reproduce without spending

```sh
node scripts/ai/compare.mjs --shared --data experiments/jev-replacement/20260921-all-strategies-01/decisions.jsonl.gz --out data/shared-comparison
node scripts/ai/local-tournament.mjs --candidate data/shared-comparison/tactical-soft-prior-strong.json --baseline data/shared-comparison/baseline-hard.json --out data/shared-local-matches --pairs 4 --seed 955
node scripts/ai/report-matches.mjs --run experiments/jev-replacement/20260921-shared-03/dev-matches
```

Paid reproduction requires a NEW, committed budget reservation and run ID. Never rerun an old paid session. The metered collector now supports `--mode local-vs-jev --model FILE --epsilon 0.03`; batch size must be a multiple of ten for strategy/color balance. Default remains Jev-vs-Jev. All collector batches are labeled development, not acceptance evaluation.
