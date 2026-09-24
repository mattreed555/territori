# Learned strategy contrasts

Offline development session, 2026-09-24. No paid calls, dependencies, UI changes,
deployment or audience changes. The live game still uses Jev. **Not ready.**

## Implementation

`style-training.ts` fits a small ridge regression to differences between Jev's
five strategy distributions on identical positions. Log probabilities use an
explicit 0.001 floor; move-constant offsets and the common strategy average are
removed. Each position has equal weight. Feature scaling and fitting use only
training groups. A 14-by-14 linear solve fits five zero-sum coefficient vectors;
there is no ML dependency. Identical teacher distributions produce zero residuals.

`style.ts` validates the separate model and adds a bounded learned preference to
existing search scores. Only searched moves within one heuristic board point of
the best searched two-ply value can win this reranking. Visible terminal wins and
the full-width loss-deferring fallback remain protected. This does not prove
long-term safety or add omitted moves to the root beam. It is opt-in only.

## Evidence

Reused the same 100 counterfactual labels. Twelve positions train; eight positions
(40 labels) remain held out by source group. The baseline is the frozen
`20260921-shared-03/tactical-soft-prior-strong.json`; none of the held-out source
groups were used to train it. These are repeatedly inspected DEVELOPMENT folds,
not independent acceptance data. The grid is ridge 0.01/0.1/1 and runtime weight
0.5/1/2, with tactical margin 1.

Ridge 0.1 reduces held-out strategy-contrast MSE from the zero-residual baseline's
0.17489 to 0.15906 (about 9%). At runtime weight 0.5, teacher agreement remains
35%, equal to base search. All ten strategy pairs now differ on 1–4 of the eight
held-out positions; base search had one identical pair. Expansive's mean spread
gain is 5.25 versus Aggressive's 2.25 on these same positions. Cautious creates
less own exposure than Aggressive (0.375 versus 0.5). These are limited signs of
strategy differentiation, not proof of five validated styles or optimal play.

**Fluid remains unvalidated.** No held-out teacher shifts exist, and the local
policy still does not reproduce the single teacher-shift position. That shift
is already searched, even at the normal beam width, and lies inside the one-point
margin: its worst-reply value is -0.85 versus -0.2 for the selected placement.
All five teacher strategies chose it, so it offers no uniquely Fluid contrast.
`shift-diagnostic.json` records the normal/full-width comparison. More arbitrary
style strength is not a solution: weight 2 lowers held-out agreement to 25%.

Forty free balanced-color local games compare the residual against the same
underlying frozen policy, both with search version 2:

| Residual weight | W / D / L | Score | Mean turns | Conservative paired 95% interval |
| --- | --- | --- | --- | --- |
| 0.5 | 8 / 8 / 4 | 60% | 60.8 | 17.05%–100% |
| 1 | 7 / 9 / 4 | 57.5% | 66.7 | 14.55%–100% |

Each row has 20 games, four per strategy. No aborts, truncations, repetition
endings or illegal choices. Saved-model/seed replay reproduces every one of the
**2,550 decisions and 40 outcomes**. These are NOT Jev matches or acceptance games;
the intervals are wide and do not establish an advantage.

The chosen residual compresses to 1,320 bytes (plus the existing 4,565-byte base
policy). Latest unthrottled Node p95 is 72.0 ms, max 100.5 ms over all 100 probe
labels. This is not a controlled mobile-class benchmark and does not pass that
gate. Forty tests and TypeScript pass, including no validation-label leakage,
zero-sum/identical-teacher controls, malformed model rejection, tactical limits,
terminal wins and loss-deferring shifts. No new policy is promoted.

## Reproduce

Run from the repository root. All commands below are offline.

```sh
node scripts/ai/fit-style.mjs --probes experiments/jev-replacement/20260924-style-06/probe/labels.jsonl.gz --policy experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json --split experiments/jev-replacement/20260924-style-07/comparison.json --out experiments/jev-replacement/20260924-residual-08

node scripts/ai/local-tournament.mjs --candidate experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json --baseline experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json --style experiments/jev-replacement/20260924-residual-08/style-ridge-0.1.json --style-options '{"weight":0.5,"margin":1}' --search '{}' --baseline-search '{}' --out experiments/jev-replacement/20260924-residual-08/residual-vs-base --pairs 2 --seed 2408

node scripts/ai/verify-local.mjs --run experiments/jev-replacement/20260924-residual-08/residual-vs-base --candidate experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json --baseline experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json --style experiments/jev-replacement/20260924-residual-08/style-ridge-0.1.json

node --test tests/*.test.mjs
pnpm exec tsc --noEmit --incremental false
```

For the second tournament use weight 1 and output/run name
`strong-residual-vs-base`. `comparison.json` holds the full grid, input/code hashes,
per-strategy/type agreement, teacher rank, feature means and contrasts;
`choices.json.gz` holds every choice. Both tournaments include complete compressed
decision logs, outcome/interval reports and exact replay integrity records.

## Next

Prioritize measured runtime: profile the crowded/late positions and full-width
safety fallback, preserve choices with replay while removing repeated computation,
then measure in a documented constrained browser. In parallel with that line of
work, plan a small targeted Fluid/shift probe with repeated same-strategy controls
to distinguish actual strategy signal from provider variation. Do not purchase
more labels without a fresh durable lease and budget check. Do not spend the
independent evaluation reserve until a candidate is frozen and runtime/style
gaps are addressed. No heavyweight model is indicated by these results.

Cost: $0 this session; cumulative additional spend $0.660659874, remaining
$3.589340126 including the $3.25 independent-evaluation reserve. No uncertain
charges or active financial reservations. This does not track unrelated public
site usage. Site remains public, version 14, Jev default.
