# Independent acceptance, v1

`protocol.json` seals the already-selected hybrid candidate before any acceptance calls. It fixes learned assets, runtime and collection-source SHA256s, epsilon0.03, teacher model, rules, 200 games, fresh local RNG seeds, same-strategy opponents and equal color counts. These games are evaluation-only; no refitting or configuration selection may use them. Tagged records are rejected by both training entry points.

Ten sequential batches each schedule20 games: four per strategy, two per color. Jev itself is not seeded. No request retries, replacement games, cherry-picking, or retrospective development-to-test relabeling. Incomplete, truncated and failed attempts remain reported. All200 completed games and every strategy/color quota must pass before the strength gate can pass. Strength is NOT deployment readiness; mobile/browser/runtime/default-switch checks remain separate.

The protocol has a $3.25 cumulative ceiling within the existing $4.25 project allowance. Each batch permits at most $0.40, bounded additionally by settled prior acceptance spend and remaining project funds. Each batch requires a separately committed evaluation reservation; the schedule alone authorizes no calls. Freshly verify official pricing and require response-model/usage reconciliation. Unknown calls retain their full bound and halt paid work.

Run from repository root, replacing SOURCE with the committed collection source SHA and advancing batch/seed only in sealed order:

```sh
node scripts/ai/collect.mjs --protocol experiments/jev-replacement/acceptance-v1/protocol.json --run-id acceptance-v1-01 --out experiments/jev-replacement/acceptance-v1/acceptance-v1-01 --ledger experiments/jev-replacement/budget.json --teacher-url https://territori.matthew-l-reed.chatgpt.site/api/robot --source-commit SOURCE --mode local-vs-jev --model experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json --style experiments/jev-replacement/20260924-residual-08/style-ridge-0.1.json --intent '{"strength":1,"margin":1}' --games 20 --seed 260924900
```

Add `--dry-run` for code/candidate preflight without outputs, ledger access or paid requests. Preserve raw decision and usage JSONL (gzip allowed), provenance, summaries and replay evidence in each batch directory.

Aggregate verification replays every present batch, recomputes costs/choices/results, and reports all failures:

```sh
node scripts/ai/report-acceptance.mjs --protocol experiments/jev-replacement/acceptance-v1/protocol.json --runs experiments/jev-replacement/acceptance-v1 --model experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json --style experiments/jev-replacement/20260924-residual-08/style-ridge-0.1.json --out experiments/jev-replacement/acceptance-v1/report.json
```

Report move agreement/ranks and exact-context/trajectory duplicates separately. Do not treat repeated contexts or agreement as proof of strength. Hoeffding intervals report mean reward with draws worth half; their independence assumption is explicit. No production changes are authorized by an intermediate favorable batch.

Official pricing and API references: https://docs.typesafe.ai/models and https://docs.typesafe.ai/api. Rechecked2026-09-24: jev-1.13.0 input$0.042/M, outputfree; request reserve65536inputtokens.
