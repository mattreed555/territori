# Compact handoff — Jev replacement

Read `docs/jev-replacement-goal.md`, `acceptance-v1/protocol.json`, `acceptance-v1/report.json`, `budget.json`, and `work-session.json` fresh; reconcile remote `main` and local tree before changes. Last session `20260924-acceptance-17` is CLOSED. The sealed protocol SHA256 is `e55f94b12ce651c93aebd1c7001c9175f6bde226746117361daa6935feec6bb9`. Candidate/source/model/configuration are frozen; no refitting or variant selection from acceptance games. Keep hourly automation paused.

Two of ten batches completed: 40/200 games, 39W/1L, eight per strategy/four per color. Both batches verify exact replay and usage; no failures or uncertain charges. Aggregate gate remains incomplete. Budget allowance $4.25, spent $1.476009360, available $2.773990640. The protocol's $3.25 total has $2.650792006 remaining; no active reservation. Refresh official Jev price (`docs.typesafe.ai/models`: currently $0.042/M input, free output, 64k request bound) before more paid work. Maximum $0.40 per batch; reserve full cap durably before calls and leave cap charged on uncertain outcome.

**Next exact batch:** `acceptance-v1-03`, seed `260926900`, 20 games, max160 turns. First commit a new exclusive work lease plus `purpose:evaluation`, protocol-hashed $0.40 financial reservation to private GitHub after head/ledger check. From repo root run:

```sh
node scripts/ai/collect.mjs --protocol experiments/jev-replacement/acceptance-v1/protocol.json --run-id acceptance-v1-03 --out experiments/jev-replacement/acceptance-v1/acceptance-v1-03 --ledger experiments/jev-replacement/budget.json --teacher-url https://territori.matthew-l-reed.chatgpt.site/api/robot --source-commit e4843b77120ccec82020195f84cfcdf8c0f798ba --mode local-vs-jev --model experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json --style experiments/jev-replacement/20260924-residual-08/style-ridge-0.1.json --intent '{"strength":1,"margin":1}' --games 20 --seed 260926900
```

Compress raw JSONL with `gzip -n`, run `scripts/ai/report-acceptance.mjs` over all present batches and `scripts/ai/audit-hybrid-matches.mjs` for the new batch, then durably persist raw data, audit, reconciled ledger and closed lease. The README under `acceptance-v1/` contains exact report commands. Do not rerun a paid batch, replace failed attempts, or alter the protocol. No new source edits mean no need to repeat full tests/build.

Jev remains the live/default agent on public Site version14/source `85174b8ed3cbcf6a0cf88da79278e12d222535d4`. The replacement is not ready. Beyond all 200 verified games, mobile-class p95 <100ms, supported browser/small-screen UI verification, normal-mode integration/default switch, production build and deployment checks remain. Never change default, audience, or deploy on partial strength evidence. The mobile/browser gate cannot be inferred from Node timings.
