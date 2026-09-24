# Fixed hybrid: varied states and collector support

Offline only. The intent-11 candidate is unchanged: original shared learned policy + residual08 at weight0.5 + authored intent version1 at strength1/margin1 + default search2. No weights, rules, live defaults or audience changed; no new dependencies, teacher calls or deployment. **Replacement is not ready.**

## Broader common-state evidence

Generated80 reproducible synthetic legal traces, seed2413:20 each with place-heavy, mixed, shift-heavy and noisy immediate-territory-greedy action selection. Sampled every nonterminal scheduled ply12,25,38,51 without selecting by candidate outputs, outcomes or shift opportunities. One game ended before the final scheduled sample, leaving319 positions. These are synthetic states, not actual human play or completed strength matches.

All five strategies chose on each board, with authored intent strengths0 and1:3,190 greedy choices. No training, teacher labels or policy retuning. Separate regeneration/replay reproduced all4,926 trace moves,319 states and3,190 choices exactly. Every choice was legal and within the searched tactical margin; visible terminal wins remained protected.

| Behavior on the same319 boards | Intent0 | Intent1 |
|---|---:|---:|
| Aggressive: opponent territory lost | 1.9185 | 2.3166 |
| Aggressive: opponent exposure change | 0.0094 | 0.1411 |
| Cautious: own exposure change | −0.1536 | −0.4545 |
| Expansive: territory gained | 3.0721 | 3.3605 |
| Expansive: spread gained | 1.8401 | 3.1317 |
| Fluid: shifts selected | 0 | 2 |

Aggressive threat, Cautious safety and Expansive spread directions hold separately in all four generator profiles. Balanced remains unchanged, as intended. Strategy pairs differ on54–214/319 boards; Fluid/Balanced is the least different pair at54. These are descriptive comparisons within80 correlated traces, not319 independent observations or proof of strength.

Fluid had only **two** boards with a searched, tactically eligible useful shift; it selected one in both, with zero searched tactical concession. Both are Red-to-move late place-heavy states from separate traces. One shift gains territory while creating some exposure; the other reduces exposure. This is evidence of conditional repositioning, not a claim that Fluid shifts frequently in general or that two cases validate every situation. Prior targeted intent-11 evidence remains separate. No teacher was queried on these states, so there is no new agreement/rank metric.

There are **zero board/supply/turn overlaps and zero full decision-context overlaps** with the five earlier paid-development datasets (including local turns and repeated counterfactual labels). `overlap.json` records exact input hashes and the context definition. This does not turn the synthetic audit into the independent local-v-Jev acceptance suite.

The raw audit's unthrottled shared-host Node p95 was45.08ms, maximum388.73ms. This single pass has no controlled warmup/CPU isolation and overlapped other checks. It is NOT a mobile-class result. No browser testing: the managed-preview instructions require the control-browser skill, still absent from the full available executor skill inventory. No unsupported browser path was substituted.

## Exact hybrid collection, without paid calls

`scripts/ai/local-agent.mjs` now prepares linear, search, or exact hybrid agents. It validates every strategy and option before the collector opens a budget journal. Hybrid requires an explicit residual and intent configuration; recorded metadata includes both model hashes, source hashes, search/intent versions, settings and the authored/learned distinction.

The budgeted collector accepts `--style FILE --intent '{"strength":1,"margin":1}'`. Existing non-hybrid choices retain seeded parity. `--dry-run` validates the engine and prints provenance without opening the ledger, writing the output directory or calling the endpoint. It explicitly says `budgetValidated:false`; a successful dry-run is NOT a paid-work authorization or balance check. `collector-preflight.json` is such a dry-run, with an intentionally non-commit source marker. Before any real call, freeze source durably, record its actual commit, refresh pricing and acquire a new financial reservation.

`verify-session.mjs` requires exact models for new local-agent batches, reconstructs seeds, checks model/config/source metadata, player/strategy mapping, and replays local choices in addition to its existing state/result/teacher-usage reconciliation. Legacy datasets remain readable without inventing missing provenance. A mock-teacher integration test verifies6 local choices and rejects a changed implementation version. Mock usage exists only in temporary test fixtures and never enters the real cost ledger or game evidence.

**53 tests, TypeScript and the production build pass.** Four new tests cover agent parity, invalid options before paid work, the no-side-effect preflight and exact hybrid replay. An initially over-broad test assumption—that changing strength necessarily changes a short opening trajectory—was corrected to test an actual incompatible implementation version. No candidate behavior changed.

## Client bundle measurement

Using the already installed Vite dependency, built standalone ESM with zero external or dynamic imports:

| Standalone code | Bytes | Gzip bytes |
|---|---:|---:|
| Linear policy | 11,500 | 3,990 |
| Full hybrid | 18,089 | 5,713 |

The standalone compressed code difference is1,723bytes. The two saved, formatted model files gzip to6,280bytes combined; compact JSON serialization is5,885bytes, explaining the smaller earlier reports. Code plus separately compressed formatted models is11,993bytes. No runtime dependency was added. **This is not the final application bundle delta**: shared chunks and production integration can change it. The real integrated bundle still needs measurement.

Saved the exact standalone bundles and hashes under `runtime/`. The bundled hybrid matches the source runtime on125 choices (all five strategies on25 regularly sampled varied states). This executes in Node, not a browser, and supplies no mobile timing evidence.

## Reproduce

From the repository root; use a fresh output directory to preserve the saved evidence:

```sh
P=experiments/jev-replacement/20260921-shared-03/tactical-soft-prior-strong.json
S=experiments/jev-replacement/20260924-residual-08/style-ridge-0.1.json
O=experiments/jev-replacement/varied-reproduction
node scripts/ai/audit-varied.mjs --policy "$P" --style "$S" --out "$O" --seed 2413
node scripts/ai/audit-varied.mjs --policy "$P" --style "$S" --out "$O" --seed 2413 --verify
node scripts/ai/overlap-varied.mjs --run "$O"
node scripts/ai/build-local-runtime.mjs --out "$O/runtime" --positions "$O/positions.json.gz" --policy "$P" --style "$S"
node scripts/ai/collect.mjs --run-id offline-preflight --out .sites-runtime/no-paid-output --ledger .sites-runtime/nonexistent-ledger.json --teacher-url https://territori.matthew-l-reed.chatgpt.site/api/robot --source-commit offline-preflight-not-a-paid-source --mode local-vs-jev --model "$P" --style "$S" --intent '{"strength":1,"margin":1}' --games 10 --seed 2414 --dry-run
npm test
npx tsc --noEmit
npm run build
```

## Budget and next step

Spent **$0** this session. Cumulative additional spend **$0.727300182**, remaining **$3.522699818**, protected evaluation reserve **$3.25**, discretionary **$0.272699818**. No active financial reservation or uncertain charges. Pricing was not refreshed because no paid work occurred. These figures do not include unrelated public-site play.

This fixed hybrid now has broader recorded style evidence and an exact, budgeted collection/replay path. A SMALL balanced-color Jev DEVELOPMENT comparison is the next justified paid experiment, after a fresh lease/pricing/budget check; use the hybrid configuration explicitly and do not count the older search-only10/10 wins for it. Preserve the200-match evaluation reserve. Also obtain a supported mobile/browser measurement, including slow/full-width cases. The200 independent Jev matches, client-only normal-play integration, actual app bundle impact, browser and deployment verification remain unfinished. Do not replace the live Jev default yet.
