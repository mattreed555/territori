# Fixed-policy performance checkpoint

2026-09-24. No teacher calls, training, policy tuning or deployment.

## Result

The local candidate now computes the same decisions with less work:

- Reuse per-root value terms; a reply changes only the moved/captured squares
  and their neighbors. Canonical rules still decide supply, repetition and end.
- Avoid per-square sets in territory/connected-area scoring and the temporary
  map/join array in position keys.
- Keep the full-board reference evaluator, all replies, safety expansion,
  tie-breaking and search configuration unchanged.

An interleaved same-process comparison on84 saved positions, all five strategies,
measured3 rounds after1 warmup round. There were **zero full-output differences
in1,680 comparisons** (420 position/strategy pairs repeated4 times).

| Shared-host Node | Reference | Optimized |
| --- | ---: | ---: |
| Median |19.07ms|12.69ms|
| p95 |42.07ms|28.52ms|
| Safety-expansion p95 (30 measured samples) |90.91ms|43.86ms|
| Maximum |378.97ms|200.34ms|

Overall p95 is about32% lower in this run. These are noisy, unthrottled Xeon/Node
measurements, **not mobile/browser results**. The maximum still shows shared-host
jitter; do not treat the median or p95 as a guaranteed bound. No mobile gate is
claimed and no acceptance match has been run.

## Correctness evidence

-61 tests, nonincremental TypeScript and production build pass.
-New independent reference tests:2,000 random boards across3/5/8/10 sizes,
  both-color keys, full-width leaf values and first-worst-reply identities.
-339 saved states produce **23,470 identical complete successors** against the
  previous source.100 complete teacher request bodies also match exactly.
-80 existing synthetic traces regenerate all4,926 actions and319 saved states;
  all3,190 prior intent0/intent1 greedy choices and their features still match.
-Ten adapter games exactly reproduce the prior634-action event stream:
  467local decisions and167 simulated-human actions, all complete, no network
  calls/illegal moves/repetition/truncation. Both compressed game records and
  result JSON match client-14 byte-for-byte. No new strength claim is made.

Models, learned residual, authored preferences, policy ID, epsilon, prompt,
strategy wording, rules semantics and UI are unchanged. Search version remains2
because its complete computed output is unchanged; source hashes distinguish
this implementation. No new dependency.

## Built size

Final client JavaScript:593,445bytes; sum of per-file gzip185,983bytes.
Versus client-14: **+735raw / +289gzip bytes**. Versus the pre-integration build:
+22,400raw / +9,774gzip. These are all emitted client JS files across both routes,
not initial-load traffic. Model objects are unchanged (original JSON files
6,280bytes combined gzip).

## Artifacts and provenance

- `before.json.gz`: baseline300 measured samples per search/styled/intent mode,
  plus the original CPU profile in `baseline.cpuprofile.gz` and its summary.
- `incremental.json.gz`: first optimization only; noisy tails meant this was
  not sufficient to claim a speedup.
- `after.json.gz`: both optimizations;900 full-output hashes match baseline.
- `interleaved.json` / `interleaved-rows.json.gz`: primary, balanced-order
  comparison against immutable source, without profiling overhead.
- `rules-and-request-parity.json`: exact transitions/teacher-request comparison.
- `client-replay/`: exact games, results and current adapter source hashes.
- `app-bundle-after.json`: every client JS filename, size and SHA256.

Baseline local commit `a75fcc7fe502e14ae98efd6fa720042df3741780` is content-
equivalent to private-repository `937ef03dfffd8fd9b1338210c436e250f783484f`:
both tree `7cb348425a4b47097c88ac74a10e6ab3979840f6`. In a fresh GitHub clone,
use937ef03dfffd8fd9b1338210c436e250f783484f as the --ref argument below.
Local and connector commit histories differ; their source trees do not.

Exclusive offline lease 429ac5a933d53345801113371f75c0ad9129cc24.
Sites source opening recovered successfully this session and preserved the
current GitHub-backed checkout and dirty work; no conflicting source delta.
Public version14 / saved source85174b8ed3cbcf6a0cf88da79278e12d222535d4
remains unchanged. The pre-existing generated tsconfig.tsbuildinfo modification
was not staged.

## Reproduce

```sh
npm test
npx tsc --noEmit --incremental false
node scripts/ai/compare-runtime.mjs --ref 937ef03dfffd8fd9b1338210c436e250f783484f --out /tmp/territori-comparison
node scripts/ai/audit-runtime-parity.mjs --ref 937ef03dfffd8fd9b1338210c436e250f783484f --out /tmp/territori-rule-parity.json
node scripts/ai/audit-varied.mjs --policy experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json --style experiments/jev-replacement/20260924-residual-08/style-ridge-0.1.json --out experiments/jev-replacement/20260924-varied-12 --seed 2413 --verify
npm run build
node scripts/ai/audit-client.mjs --out /tmp/territori-client-replay
```

Historical stage reports reference uncompressed before.json. Decompress archived
reports with gzip -dk before using benchmark-policy's --compare option.

## Remaining work and budget

Supported control-browser skill remains absent from both complete skill
inventories. No alternate browser-control path or production test was attempted.
Main-thread responsiveness, calibrated constrained-CPU/mobile timing, small-screen
interactions and final browser/deployment checks still must pass.

Next: prepare a sealed independent acceptance protocol. The current collector
hardcodes development provenance: add explicit protocol-checked acceptance mode
before paying, not a retrospective relabel. Freeze this exact decision runtime,
models and settings; predeclare fresh seeds,40 completed games/strategy balanced
by color, exclusions, failure handling, overlap reports and budget caps. Run
bounded acceptance batches without refitting or choosing variants from results.
This offline evidence permits proceeding with that evaluation while browser QA
is unavailable, but **does not waive any publication gate**.

Session cost$0. Cumulative upper spend$0.876801366; remaining$3.373198634,
including$3.25 protected for acceptance. No active financial reservation or
uncertain charge. Reverify pricing before paid work; do not spend more on
development matches. Keep Jev live/default until every goal gate passes.
