# Shift opportunities and repeat controls

Development experiment, 2026-09-24. Live Jev, rules, UI and public audience stay
unchanged. This is not independent acceptance evaluation.

## Plan fixed before paid calls

Select twelve legal positions from twelve new deterministic random-play source
groups, six in each color. Favor shifts within one point of the best non-shift
under full two-ply evaluation, excluding terminal values and supplies below two.
This is a targeted sampling proxy, not a claim that the shift is objectively best.
The first 48-trace and 96-trace candidate pools did not supply six qualifying
groups in both colors; the final teacher-blind pool uses 512 traces, seed 2410,
with placement rates 0.9, 0.6 and 0.4. No teacher label informed selection.

Ask each of the five strategies twice with identical inputs (two complete passes,
120 calls maximum). Compare within-strategy repeat variation with between-strategy
variation on those same boards. Preserve raw distributions, choices, usage and
repeat identity. Counterfactual outcomes remain null, not fabricated game results.

Reserve every third selected source group for validation (four groups). Only pass
zero may feed the existing ridge-0.1 style fitter; pass one is a repeat control,
not another independent training example. Add pass-zero labels to the previous
100 matched labels, preserving their original holdout and the base policy's unseen
groups. Runtime weight 0.5 and tactical margin 1 remain fixed. Compare base search,
the previous residual and the refit on the same held-out states. These are inspected
development folds, not the future independent game-strength suite.

All calls go through the existing hosted teacher and cumulative metered collector;
no API key enters the repository. Session cap $0.12, no retry, $3.25 independent
evaluation reserve untouched. Pricing and response usage fields rechecked on
2026-09-24: [models](https://docs.typesafe.ai/models),
[API reference](https://docs.typesafe.ai/api). Jev 1.13.0 costs $0.042 per million
input tokens; output tokens are free. Each request is conservatively reserved at
65,536 input tokens until valid reported usage settles it.

Source/inputs must be committed before calling. On interruption, reconcile the
journal rather than rerunning the same directory or releasing an uncertain cap.

## Results

All 120 responses completed and reconcile exactly with the metered journal:
1,586,674 input tokens, 87,243 free output tokens, **$0.066640308**. No retries,
errors or uncertain charges. Every selected state replays from its saved legal
trace. All counterfactual outcomes remain null. The lease was committed as
`6d959e2f7230dba33c1461d7f9e605b6544e6970`; inputs, plan and collector were frozen
before calling in `fce006f6de837a46ae9acd9ad64ae11116046dc2`.

The repeat control matters. Four of sixty identical-input pairs changed their
chosen move. Mean within-strategy total variation was 0.0603; between-strategy
means were 0.0826–0.1660. This is descriptive evidence from twelve targeted states,
not a statistical separation of all styles. Aggressive, Cautious and Fluid chose
the exact same moves on all twelve first-pass positions. Expansive differed from
those three on three positions.

| Teacher | Placements / captures / shifts, both passes | Mean shift probability |
| --- | ---: | ---: |
| Aggressive | 6 / 16 / 2 | 8.38% |
| Cautious | 6 / 16 / 2 | 11.40% |
| Expansive | 10 / 14 / 0 | 9.37% |
| Fluid | 7 / 16 / 1 | 10.46% |
| Balanced | 6 / 16 / 2 | 9.97% |

These are paired repeated responses, not 24 independent positions per strategy.
**The teacher itself does not exhibit a distinctive Fluid shift preference here.**
Do not claim that more blind shift sampling will necessarily solve that gap.

The predeclared refit trains on twenty positions and holds out twelve (60 labels).
No held-out source group or exact board/history context leaks into style training;
the base model also has not trained on these held-out groups. Only repeat zero
enters the fitter. Held-out agreement is 21.67%, versus 23.33% for both base search
and the previous residual. On the original holdout it falls 35%→32.5%; all three
policies get 0/20 on the four new targeted holdout positions. Average teacher rank
is 7.97 versus 7.93 for the previous residual. Full strategy/type breakdowns and
choices are in `analysis.json` and `choices.json.gz`. These repeatedly inspected
development folds are not the independent acceptance suite.

No policy selects a shift on the twelve combined held-out Fluid positions. The
separate full-width diagnostic on all twelve new positions shows that only one
position omits every near-best shift from the normal beam; even full-width search
selects no shifts. In this sample the main limitation is the tactical/learned
scoring preference, not missing legal candidates. The near-best shifts trail by
0.15–0.65 heuristic points. A heavier model or wider beam is not justified by this
alone; recognizable Fluid behavior is still unresolved.

Forty free games compare the old and refitted residuals separately against the
same frozen base search, using the same seeds and colors. Both finish 5W/11D/4L
(52.5%) in twenty games, with identical outcomes for all twenty corresponding
matchups. Mean length is 62.1 versus 62.2 turns. Conservative paired 95% score
interval for each is [9.55%, 95.45%]; bootstrap interval [37.5%, 65%]. No illegal
moves, aborts, truncations or repetitions. Every one of the **2,486 decisions and
40 results** reproduces exactly. These are local-only comparisons, not Jev games,
and provide no evidence that the refit is stronger. **Do not promote this refit.**

The experimental residual is 1,357 bytes compressed. All 45 tests, TypeScript and
production build pass. No runtime dependency, UI/default or deployment changes.
Browser/mobile testing was not performed; that gate remains open.

## Reproduce and inspect

All commands below are offline. Do not rerun the paid collector into this session.

```sh
node scripts/ai/analyze-repeat-probe.mjs --dir experiments/jev-replacement/20260924-shift-10 --old-probes experiments/jev-replacement/20260924-style-06/probe/labels.jsonl.gz --policy experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json --style experiments/jev-replacement/20260924-residual-08/style-ridge-0.1.json

node scripts/ai/diagnose-shifts.mjs --positions experiments/jev-replacement/20260924-shift-10/positions.json --policy experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json --style experiments/jev-replacement/20260924-shift-10/style-ridge-0.1.json --out /tmp/territori-shift-diagnostic.json

node scripts/ai/local-tournament.mjs --candidate experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json --baseline experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json --style experiments/jev-replacement/20260924-shift-10/style-ridge-0.1.json --style-options '{"weight":0.5,"margin":1}' --search '{}' --baseline-search '{}' --out /tmp/territori-refit --pairs 2 --seed 2410

node scripts/ai/verify-local.mjs --run experiments/jev-replacement/20260924-shift-10/refit-vs-base --candidate experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json --baseline experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json --style experiments/jev-replacement/20260924-shift-10/style-ridge-0.1.json --out /tmp/territori-refit-integrity.json

node --test tests/*.test.mjs
pnpm exec tsc --noEmit --incremental false
pnpm build
```

For the previous-residual control use its model in `20260924-residual-08` and saved
run `previous-vs-base`. Raw teacher records and usage are compressed under `probe/`;
`probe/provenance.json` preserves the paid source/input hashes. The analysis later
added an exact-context overlap count; collection inputs and training settings did
not change. Both tournament reports include per-strategy results, intervals,
hashes and compressed complete logs. `provenance.json` inventories final artifacts.

## Next

Continue offline rather than buying another similar label batch. Investigate a
simple strategy-intent regularizer or alternative style score that can express
useful shifts among tactically close moves, while retaining the teacher baseline
and honestly distinguishing authored preferences from learned evidence. Measure
strength/style trade-offs in saved common states and free games before spending
the independent-evaluation reserve. Do not silently lower the all-five style gate.
Authorized constrained-browser latency, independent 200-game Jev evaluation,
no-API UI integration and deployment verification remain outstanding.

Cumulative additional spend is **$0.727300182**. Remaining **$3.522699818** includes
the unchanged **$3.25** independent-evaluation reserve; discretionary development
remaining **$0.272699818**. No active financial reservation or uncertain charge.
This is the task ledger, not the provider balance after unrelated public play.
**Replacement is not ready. Jev remains live.**
