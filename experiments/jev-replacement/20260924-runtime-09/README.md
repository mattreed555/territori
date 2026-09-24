# Faster search, unchanged decisions

Offline development session, 2026-09-24. No API calls, model changes, dependencies,
deployment or audience changes. Live version 14 still defaults to Jev. **Not ready.**

## Changes

The runtime now shares immutable board topology and call-scoped starting-board
features across legal moves. It enumerates validated root successors once rather
than rechecking each sibling's legality. Two-ply leaf evaluations share the exact
engine transition logic but do not copy unused history, capture counts or last-move
records. Repetition and final-round endings are still calculated. Terminal values
compute connected-area tiebreaks only when territory totals tie.

No feature, rule, model or search semantics changed. Search remains version 2,
including every opposing reply and the full-width loss-deferring safety fallback.
The leaf type is deliberately not a full Game and cannot be advanced another turn.
No cache survives the current feature-extraction call or depends on board identity.

## Evidence

The benchmark reuses the 20 saved common positions from style-06, all five strategies,
base search and the ridge-0.1 style residual (weight 0.5, margin 1). Each configuration
gets one warm-up round and three measured rounds: 300 measurements per policy mode,
600 total. Thirty per mode invoke the full-width safety fallback.

| Node p95, milliseconds | Before | Shared work | Compact leaves | Final |
| --- | ---: | ---: | ---: | ---: |
| Base search, all | 93.21 | 79.61 | 48.01 | 29.27 |
| Styled search, all | 102.00 | 85.90 | 49.32 | 34.60 |
| Base search, fallback only | 143.92 | 134.79 | 69.38 | 41.65 |
| Styled search, fallback only | 126.03 | 131.58 | 80.77 | 78.69 |

`before.json`, `after.json`, `leaf-optimized.json` and `final.json` retain every timing,
complete-output fingerprint, node count, input hash and source hash. All three
optimized stages match **600/600 complete outputs exactly**, including scores,
ordering, worst replies and safety flags. The baseline source is GitHub commit
`a7424bfa51b48bbcda86cd68ec785857391c1ca2`; the final source accompanies this report.
Intermediate timings are development observations, not separate published versions.

Environment: Linux x64, Node 24.19.0, Intel Xeon Platinum 8573C, no CPU throttling.
This is a shared development host, not a controlled mobile device. Timing noise and
outliers remain; do not scale these numbers to claim a mobile result. Final maximum
latencies were 43.38 ms base and 81.75 ms styled. The mobile/browser gate is **unmeasured**.

The optimized engine also reproduces all **2,550 saved decisions and 40 outcomes**
from both residual-08 tournaments, including seeded exploration. The new replay
reports are `residual-replay.json` and `strong-residual-replay.json`; older evidence
was not overwritten. These are replays, not 40 new matches or Jev acceptance games.

All **44 tests**, the TypeScript check and production build pass. Added tests compare
batched versus single-move features, more than 10,000 compact/full leaf transitions,
2,000 terminal boards in both colors, repetition/final-round behavior and mutation
isolation. Production build succeeded with the existing proxy warning and vinext's
route-classification notice. No dependency or model-asset increase. Normal-play
client bundle impact for a future local-default integration is not measured here.

The Sites managed-preview instructions require a control-browser skill before
browser actions. That skill was not available in this session's discovered skill
inventory, so no browser path was improvised and no mobile gate was claimed. This
does not prevent the remaining offline/teacher-data work.

## Reproduce

From the repository root, with installed dependencies; all commands are offline:

```sh
node scripts/ai/benchmark-policy.mjs --positions experiments/jev-replacement/20260924-style-06/positions.json.gz --policy experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json --style experiments/jev-replacement/20260924-residual-08/style-ridge-0.1.json --out /tmp/territori-runtime.json --compare experiments/jev-replacement/20260924-runtime-09/before.json

node scripts/ai/verify-local.mjs --run experiments/jev-replacement/20260924-residual-08/residual-vs-base --candidate experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json --baseline experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json --style experiments/jev-replacement/20260924-residual-08/style-ridge-0.1.json --out /tmp/territori-replay.json

node scripts/ai/verify-local.mjs --run experiments/jev-replacement/20260924-residual-08/strong-residual-vs-base --candidate experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json --baseline experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json --style experiments/jev-replacement/20260924-residual-08/style-ridge-0.1.json --out /tmp/territori-strong-replay.json

node --test tests/*.test.mjs
pnpm exec tsc --noEmit --incremental false
pnpm build
```

## Remaining work

Fluid generalization and recognizable all-five styles remain unproven. Next, after
fresh pricing/budget/lease checks, consider a small targeted shift-position teacher
probe with repeated-response controls. Do not invent style distinctions from random
provider variation. A documented constrained-browser benchmark, independent 200-game
Jev evaluation, no-API UI integration and deployment checks are still required.

Session cost $0. Cumulative added spend **$0.660659874**; remaining **$3.589340126**,
including the untouched **$3.25** evaluation reserve. No financial reservation or
uncertain charge. This is the task ledger, not the provider balance after public play.
