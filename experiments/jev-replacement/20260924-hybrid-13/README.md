# Fixed hybrid versus Jev: development batch

The current hybrid won **10/10 development games**, two per strategy with balanced colors. This evaluates the actual intent-11/varied-12 candidate, not the older search-only policy. It is encouraging, but **not the independent acceptance suite and not readiness**. Jev remains the public live default, version14. No policy weights, rules, UI, dependencies or audience changed; no deployment.

## Frozen setup

Runtime/collector source was already durable in GitHub commit `01150c218357db1128a38d305f8d3eaa469d0ef7`. Exclusive work lease and a **$0.22 maximum** financial reservation were committed as `7a443f6903640c36578a243509fb6d4264a7f65e` before any requests. The protected independent-evaluation reserve stayed at$3.25.

Candidate: original shared learned policy (`53b12f62523451c442432c7374a1126746649ef244ffc90d88f20c916cc5f4cb`) + learned residual08 (`75d075adcae50d9a51ef686488f9ee49631e2549c739e2e0ecdec83e429be3db`) + authored intent version1(strength1,margin1,learned style weight0.5) + default search2(policy beam12,static beam8,prior weight0.75). Exploration0.03. Seed2414 controls matchup order and local exploration, not Jev sampling. Same strategy on both sides of each game; five local-Blue and five local-Red games. Maximum160turns. Exact source hashes, settings and matchup schedule are in `dev-matches/provenance.json`.

Jev1.13.0 responded to all252 requests. No retries, unknown usage or API failures. The existing hosted `/api/robot` endpoint kept the key server-side. No secret was read or saved.

## Outcomes and integrity

| Strategy | Completed | Local W / D / L | Score | Conservative95 score interval |
|---|---:|---|---:|---|
| Aggressive | 2 | 2 /0 /0 | 100% | 4.0–100% |
| Cautious | 2 | 2 /0 /0 | 100% | 4.0–100% |
| Expansive | 2 | 2 /0 /0 | 100% | 4.0–100% |
| Fluid | 2 | 2 /0 /0 | 100% | 4.0–100% |
| Balanced | 2 | 2 /0 /0 | 100% | 4.0–100% |
| Overall | 10 | 10 /0 /0 | 100% | 57.1–100% |

Intervals use the documented Hoeffding bound assuming independent runs. Only two games per strategy cannot establish that every strategy exceeds its40% acceptance threshold. No aborted, truncated, unstarted or repetition-ending games. Mean50.4turns, maximum52;10distinct trajectories.

All504 decisions, board transitions and final outcomes independently replay under the same rules engine. The exact hybrid reproduces all252 seeded local choices. Every252teacher decision matches its request context, recorded response, usage and cost; no uncertain charges. Integrity is not an independent implementation of the game rules.

The wins remain narrow and sacrifice-heavy: local made250 placements and2 captures, while Jev made57 placements and195 captures. Nine wins have1–4territory-point margins; Aggressive as Red wins a7–7territory tie with a5–4largest-area advantage. Finishing the piece supply while ahead explains these outcomes; this is not evidence that captures or shifts are generally bad. Neither side shifted in this batch, so this adds no Fluid repositioning evidence. Keep the broader common-state behavior audits separate from raw action frequencies.

## Imitation diagnostics, no refitting

All252teacher-turn states are analyzed with the exact frozen hybrid. These student-influenced, capture-heavy states are not a representative independent test set.

| Teacher move type | States | Exact agreement | Mean teacher rank |
|---|---:|---:|---:|
| Place | 57 | 21.05% | 6.33 |
| Remove | 195 | 95.90% | 1.23 |
| Shift | 0 | Unmeasured | Unmeasured |
| All | 252 | 78.97% | 2.38 |

Agreement by strategy: Aggressive80.39%, Cautious80.00%, Expansive82.00%, Fluid78.00%, Balanced74.51%. Complete rank orders scored searched roots before unsearched roots in learned-prior order; this is not full-width minimax. The teacher move is in the searched beam in251/252states.

Compared with the336labels that trained the frozen base/residual, five states reuse board/supply/turn and four reuse the full strategy/board/supply/captured/final-round/last/repetition context. Removing exact training-context overlaps leaves248states,80.24%agreement and2.35mean rank. No exact context repeats within this batch. `teacher-audit.json` and compressed per-decision metrics preserve these definitions and input hashes. No new weights were fit or selected from this batch.

## Cost

Reverified **2026-09-24 at11:09UTC**: [official model pricing/context](https://docs.typesafe.ai/models) lists Jev1.13.0 at$0.042per million **input** tokens, output free,64k total request context. [Official response documentation](https://docs.typesafe.ai/api) defines the versioned model and input/output usage fields. The meter reserved65,536input tokens per in-flight request and stopped on unexpected versions/usage; it made no automatic retries.

-252calls;3,559,552input tokens;191,680free output tokens.
-Exact added cost: **$0.149501184**.
-Cumulative added spend: **$0.876801366**.
-Remaining allowance: **$3.373198634**, including **$3.25** reserved for acceptance; discretionary **$0.123198634**.
-No active financial reservation or uncertain charges. Public-site play is outside this ledger; these amounts are not a provider-account balance assertion.

The observed mean projects to about$2.99for200similarly long matches, but that is **not a guaranteed cost bound**. The independent suite must retain per-request/session caps and stop before exceeding the allowance even if it cannot finish. Do not request a top-up automatically.

## Verification and reproduction

53tests and a nonincremental TypeScript check pass. This session changes only offline reports/diagnostics and experiment artifacts; production code/model inputs remain as in the previously passing build. No browser/mobile test or new deployment. The pre-existing generated `tsconfig.tsbuildinfo` worktree change is unrelated build cache and was not included in this checkpoint.

These commands only reanalyze the saved data and cost nothing:

```sh
P=experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json
S=experiments/jev-replacement/20260924-residual-08/style-ridge-0.1.json
R=experiments/jev-replacement/20260924-hybrid-13
node scripts/ai/verify-session.mjs --run "$R/dev-matches" --model "$P" --style "$S"
node scripts/ai/report-matches.mjs --run "$R/dev-matches"
node scripts/ai/audit-hybrid-matches.mjs --run "$R/dev-matches" --model "$P" --style "$S" --out "$R"
npm test
npx tsc --noEmit --incremental false
```

Original paid command, recorded for provenance only—**do not rerun this closed session or reuse its directory**:

```sh
node scripts/ai/collect.mjs --run-id 20260924-hybrid-13-devmatches --out experiments/jev-replacement/20260924-hybrid-13/dev-matches --ledger experiments/jev-replacement/budget.json --teacher-url https://territori.matthew-l-reed.chatgpt.site/api/robot --source-commit 01150c218357db1128a38d305f8d3eaa469d0ef7 --mode local-vs-jev --model experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json --style experiments/jev-replacement/20260924-residual-08/style-ridge-0.1.json --intent '{"strength":1,"margin":1}' --games 10 --seed 2414 --max-turns 160
```

## Next

No more paid development batches are justified now. Preserve the remaining budget for the independent200-game suite. First prepare opt-in client-only integration/testing, clear corrupt/missing-model behavior without an API fallback, actual integrated bundle measurement, and a supported constrained-browser/mobile timing test including full-width slow cases. Keep Jev the live default. The managed-preview control-browser skill was unavailable in previous inventory checks; recheck supported tooling before browser work rather than improvising.

Freeze the final runtime/settings only after integration and latency checks, then acquire a fresh durable evaluation reservation and use independent seeds for40completed games per strategy, balanced colors. These ten development wins and the earlier search-only ten wins count as **zero** acceptance games. All readiness gates in `docs/jev-replacement-goal.md` remain unchanged.
