# Authored strategy intent, offline development

This experiment adds an explicit, bounded preference layer on top of the frozen learned policy and learned strategy residual. These preferences are **authored from the strategy descriptions, not learned from Jev**. No new teacher calls, model fitting, dependencies, rules, UI changes or deployment. Jev remains the live default. Replacement is not ready.

## Candidate

- Policy: `../20260921-shared-03/tactical-soft-prior-strong.json`, SHA256 `53b12f62523451c442432c7374a1126746649ef244ffc90d88f20c916cc5f4cb`.
- Learned residual: `../20260924-residual-08/style-ridge-0.1.json`, SHA256 `75d075adcae50d9a51ef686488f9ee49631e2549c739e2e0ecdec83e429be3db`. The rejected shift-10 refit is not used.
- Intent version1: `lib/ai/intent.ts`, SHA256 `ca8f36b5e3a149d12f41e9822961c07ba575ea24293a051852951e87a77db2b4`.
- Provisional development configuration: strength1, tactical margin1, learned style weight0.5, default search version2. Seeded exploration0.03 in games, greedy in common-state audits.

Aggressive rewards captures, threats and opponent territory loss. Cautious rewards reduced exposure and grouping. Expansive rewards territory and spread without rewarding extra exposure. Fluid rewards only shifts that improve territory, exposure, threats or grouping, and never a shift back into a known position. Balanced keeps the learned residual unchanged. Scores are bounded; choices/exploration stay within one searched tactical point of the best move. Visible terminal wins and the existing full-width loss-deferral fallback remain protected. Strength0 reproduces the learned-style baseline. This does not guarantee deeper tactical safety or faithful imitation.

Model files remain 5,885 bytes combined gzip. The new authored module is code, not a model asset; production bundle impact and mobile-class latency remain unmeasured.

## Saved development states

Reused 160 first-pass labels from32 positions: original100 style-06 labels and60 shift-10 labels, excluding repeated responses. Existing source-group split is unchanged (20 training/12 held-out positions). No weights were refit; strength selection uses these DEVELOPMENT results, so this is not an independent test.

| Intent strength | Held-out teacher agreement | Mean teacher rank | Mean tactical concession | Useful Fluid shifts /12 |
|---|---:|---:|---:|---:|
| 0 | 23.33% | 7.93 | 0.0083 | 0 |
| 0.5 | 23.33% | 7.93 | 0.0450 | 0 |
| 1 | 21.67% | 8.00 | 0.0883 | 4 |
| 2 | 20.00% | 8.00 | 0.1200 | 4 |

Strength1 increases matched-state Aggressive threats (mean opponent exposure change0.333→0.833), Cautious safety (own exposure change0→−0.333), and Expansive spread (3.5→4.917). All strategy pairs differ on3–10/12 held-out boards, versus2–5/12 without intent. Teacher shift agreement remains0/4: these are clearer authored behaviors, **not improved imitation**. Complete per-strategy/move-type metrics, choices and source hashes are in `audit.json` and `choices.json.gz`.

Unthrottled Node p95 at strength1 was37.52ms, max47.77ms on this small targeted audit. Warmup/shared-host contention differed between configurations; timings do not establish a speedup and do not satisfy the mobile gate.

## Free games and independent replay

Same seed2411, two color-paired seeds per strategy,20 games/configuration, candidate versus frozen base search without a residual. These are local-only development matches, not Jev evidence.

| Strength | W / D / L | Score | Paired bootstrap95 | Mean turns | Replayed decisions |
|---|---|---:|---|---:|---:|
| 0 | 3 /13 /4 | 47.5% | 40–55% | 59.7 | 1,194 |
| 1 | 6 /9 /5 | 52.5% | 40–65% | 58.4 | 1,168 |
| 2 | 3 /9 /8 | 37.5% | 22.5–52.5% | 65.1 | 1,302 |

The reports also retain conservative paired Hoeffding intervals (strength1:9.55–95.45%). Samples are tiny and uncertain; no statistical strength advantage is claimed. Strength1 per-strategy scores: Aggressive25%, Cautious62.5%, Expansive75%, Fluid50%, Balanced50%, each only4games. Strength2 loses all4 Expansive games; do not promote it. Strength1 is only a provisional candidate, not accepted or deployed.

Another25 games cover every ordered strategy pairing with both players using strength1, seed2412. All complete, mean61.6 turns, max94;1,540 decisions independently replay exactly. Fluid shifts9times in these games, but raw action counts are confounded by different boards/opponents and are not matched-state style evidence.

Across this session: **85/85 games completed; 5,204 decisions and all outcomes replayed exactly; zero illegal moves, aborts, truncations or repetition endings.** Game logs, reports and integrity hashes are retained here. Replay is a separate deterministic rerun using the same rules engine, not an independent implementation of the rules. These games count toward zero of the required200 independent Jev matches.

## Fresh common-state check

Selected one state from each new selfplay game using a fixed ply formula19+(index%3)*10+index%2, before inspecting results, without outcome filtering. All five strategies choose on the same25 boards; no teacher labels, fitting or policy changes followed this check. The positions are candidate-generated, not representative independent human-play states.

Strength1 versus0: Aggressive opponent territory loss3.44 versus3.20; Cautious own exposure change−0.72 versus−0.56; Expansive territory gain3.00 versus1.92 and spread6.20 versus1.56. Balanced unchanged. Pair differences range1–18/25.

Fluid takes no shifts in either configuration on these25 boards. Crucially, **none contains an eligible useful shift within the searched tactical margin**, so this check supplies no new evidence for or against conditional Fluid preference. Fluid/Balanced differ only1/25. The targeted4/12 result and9 played shifts are promising but do not establish robust all-five style validation. See `fresh-common-state-audit.json`, frozen positions and choices.

## Verification and reproduction

49 tests, TypeScript and production build passed. Four new tests cover intent bounds, useful/nonrepeating Fluid conditions, zero-strength parity, legal complete ordering, seeded exploration, option validation and terminal/fallback safety. No browser test or deployment in this session.

Run from repository root (use a new output directory to preserve these artifacts):

```sh
P=experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json
S=experiments/jev-replacement/20260924-residual-08/style-ridge-0.1.json
O=experiments/jev-replacement/intent-reproduction
node scripts/ai/audit-intent.mjs --policy "$P" --style "$S" --out "$O"
for N in 0 1 2; do
  node scripts/ai/local-tournament.mjs --candidate "$P" --baseline "$P" --style "$S" --intent "{\"strength\":$N,\"margin\":1}" --baseline-search '{}' --pairs 2 --seed 2411 --out "$O/intent-$N-vs-base"
  node scripts/ai/verify-local.mjs --run "$O/intent-$N-vs-base" --candidate "$P" --baseline "$P" --style "$S"
done
node scripts/ai/intent-selfplay.mjs --policy "$P" --style "$S" --seed 2412 --out "$O/selfplay"
node scripts/ai/intent-selfplay.mjs --policy "$P" --style "$S" --out "$O/selfplay" --verify
node scripts/ai/audit-intent-selfplay.mjs --run "$O/selfplay" --policy "$P" --style "$S" --out "$O"
npm test
npx tsc --noEmit
npm run build
```

Cost **$0**. Cumulative additional spend **$0.727300182**, remaining **$3.522699818**, protected acceptance reserve **$3.25**, discretionary **$0.272699818**. No financial reservation, uncertain charges or new paid calls. No attempt was made to infer the provider balance after public play.

Next: evaluate this provisional hybrid on varied human-like/random states with real shift opportunities, and obtain a supported mobile-class runtime measurement. Consider one SMALL metered Jev development comparison only after adding exact intent/residual support and provenance to the budgeted collector, rechecking pricing and reserving a fresh exclusive session. Do not reuse the earlier10/10 wins as evidence for this changed candidate, repeat blind shift-label purchases, spend the200-match reserve on an unfrozen candidate, or lower readiness gates. All-five behavior, independent200-game strength, client-only integration and deployment remain unfinished.
