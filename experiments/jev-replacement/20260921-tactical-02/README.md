# Tactical features and soft-label experiment

September 21, 2026. No Jev calls; cost $0. Same 562 recorded teacher decisions, five training games and five development-validation games as the previous experiment. No independent test games were used. This remains model-selection evidence, not a readiness result.

Four candidates were declared before fitting: the original 21 features or 31 features including the teacher's legal capture-reply analysis, each trained on hard choices or full teacher probabilities. Defaults, feature meanings, split seed 511 and 60 training epochs stay fixed. The original baseline reproduces exactly. Model files contain all five strategies. No new dependency is needed.

| Candidate | Exact agreement | Mean teacher rank | Score vs original local policy | 95% paired bootstrap interval |
|---|---:|---:|---:|---:|
| Original hard labels | 44.4% | 6.84 | — | — |
| Original + soft labels | 46.2% | 6.59 | 47.5% | 38.8–56.3% |
| Tactical + hard labels | 43.0% | 7.18 | 51.25% | 38.8–62.5% |
| Tactical + soft labels | 44.8% | 8.68 | 47.5% | 33.8–61.3% |

Each candidate played 40 local-only games against the original: eight per strategy, balanced colors, four paired seeds, epsilon 0.03. Draws count as half a point. Intervals use 2,000 color-pair cluster bootstrap resamples; they describe only this small local-opponent experiment. All 120 games completed, with no illegal choices, errors, turn limits or repetition endings. These matches do not count toward the Jev acceptance gate.

No candidate has demonstrated a clear strength improvement. Soft labels modestly improve placement agreement (28.9% to 33.5%) while reducing capture agreement (94.1% to 86.8%). Tactical-soft Aggressive is a regression: 28.3% agreement and no captures selected on 65 shared diagnostic states. Do not promote it based on its overall average.

## Why this is still weak

The training split has only two Aggressive capture-available states, versus sixteen in validation. Balanced has only 27 training decisions. Larger feature sets overfit these thin samples. More useful next steps are sharing general tactical knowledge between strategies or deliberately collecting underrepresented situations, rather than assuming a neural model is necessary.

Local strategies were compared on the same 65 held-out positions. The complete feature averages and pairwise disagreements are in `comparison.json`; these establish different choices, not faithful teacher styles. For example, the original Fluid and Expansive models differ on only four of those states. No teacher in the source dataset chose a shift. Style validation is still open.

407 of 562 Jev probability maps total 0.99, despite retaining all legal keys. Soft-label training renormalizes mass within 1% of one, and rejects larger deviations, missing keys or invalid values. Raw responses remain untouched. No labels were inferred or fabricated.

Compact gzipped candidate models range from 3,209 to 4,456 bytes. Server p95 move times range from 4.5 to 8.1 ms in the final comparison run. These are unthrottled Node/Linux measurements, not the mobile-class gate. There has been no production build or deployment of this experiment; the live default remains Jev.

## Reproduce

```sh
node scripts/ai/compare.mjs --data experiments/jev-replacement/20260921-all-strategies-01/decisions.jsonl.gz --out data/tactical-comparison
node scripts/ai/local-tournament.mjs --candidate data/tactical-comparison/baseline-soft.json --baseline data/tactical-comparison/baseline-hard.json --out data/soft-matches --pairs 4 --seed 954
```

Repeat the tournament with `tactical-hard.json` and `tactical-soft.json` for the other candidates. JSON reports contain model/data hashes, per-strategy metrics, seeds, outcomes and uncertainty estimates. Compressed JSONL files preserve every local decision and final result. Use fresh independent matches only after selecting a candidate; keep all these games classified as development data.
