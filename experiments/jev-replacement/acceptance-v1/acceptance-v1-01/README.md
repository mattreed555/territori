# Acceptance batch 1 of 10

**19 wins, 1 loss, no draws; 20/200 scheduled acceptance games completed. Replacement is not ready.** Every strategy has four games, two per color. Aggressive scores75%; the other strategies100%. Overall95% score, conservative95% interval64.63–100%; per-strategy samples are far too small for a readiness claim. The sealed full suite must finish before the strength gate can pass.

Protocol SHA256: `e55f94b12ce651c93aebd1c7001c9175f6bde226746117361daa6935feec6bb9`. Protocol, fixed candidate/pipeline and$0.40 reservation were committed before requests in `d92dfa52fb4ce3ec752b012c0d095fdfc2287b00`. Candidate source was `e4843b77120ccec82020195f84cfcdf8c0f798ba`. Seed260924900, same-strategy opponents, epsilon0.03,160turn cap. No model/configuration refits or selection followed these results.

All1,018 decisions/states/results replay exactly, including509 local seeded choices and509 teacher requests/responses/usage entries. All20 games finish on supply; mean50.9turns,max64. No illegal moves, aborted/truncated/unstarted games, API errors, retries or unknown charges.18distinct trajectories: two complete-trajectory repeats are retained, not silently replaced. Aggressive's one loss as Red lasts64turns. Local makes500placements,2captures,7shifts; Jev117placements,392captures,0shifts. These frequencies are not a comparable-state strategy analysis.

Teacher-turn agreement70.53%, complete mean rank2.53. By strategy: Aggressive78.90%, Cautious76%, Expansive44%, Fluid78%, Balanced75%. Placements22.22% on117states; captures84.95% on392; shifts unmeasured. Rank orders searched roots first, then remaining legal moves by learned prior—not full-width minimax. Eight full training-context overlaps and157 within-batch context repeats are explicitly recorded. Excluding both leaves348states,71.55%agreement,meanrank2.61. Exact agreement is not a strength or readiness substitute.

Cost:509calls,7,154,742input tokens,385,487free output tokens at official Jev1.13 pricing$0.042/M input. Exact **$0.300499164**. Total project spend **$1.177300530**, remaining **$3.072699470**; protocol evaluation budget remaining **$2.949500836**, separate discretionary remainder$0.123198634. These are task-budget figures, not provider-account balances after public-site traffic. No active financial reservation or uncertainty remains after checkpoint closure.

Raw append-only events, probability/response metadata and usage are compressed without content changes. `integrity.json` records replay and unique trajectories. `teacher-audit.json` and compressed per-decision choices record agreement/overlap definitions and input hashes. Parent `report.json` reruns verification and explicitly says complete=false,strengthPass=false,readyForDeployment=false. Never count previous development games toward this suite.

Validation this session:67tests pass; nonincremental TypeScript and production build pass. Six new acceptance tests cover frozen protocol/settings, balance, ordered budget caps, dry-run/no-network behavior, incomplete/failed gates and training contamination rejection. No runtime weights/rules/UI changes, new dependencies, Site deployment, default or audience changes. Public version14 still uses Jev. Mobile/browser gates remain outstanding.

Offline reproduction:

```sh
node scripts/ai/report-acceptance.mjs --protocol experiments/jev-replacement/acceptance-v1/protocol.json --runs experiments/jev-replacement/acceptance-v1 --model experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json --style experiments/jev-replacement/20260924-residual-08/style-ridge-0.1.json --out experiments/jev-replacement/acceptance-v1/report.json
node scripts/ai/audit-hybrid-matches.mjs --run experiments/jev-replacement/acceptance-v1/acceptance-v1-01 --model experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json --style experiments/jev-replacement/20260924-residual-08/style-ridge-0.1.json --out experiments/jev-replacement/acceptance-v1/acceptance-v1-01
npm test
npx tsc --noEmit --incremental false
npm run build
```

Do not rerun this paid batch. Next is exactly `acceptance-v1-02`,seed260925900,20games after a fresh durable lease/reservation and source/pricing/budget checks. Continue frozen candidate; do not tune against acceptance results. The original protocol remains unchanged.
