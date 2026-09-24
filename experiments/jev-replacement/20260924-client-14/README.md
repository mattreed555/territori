# Client integration checkpoint — 2026-09-24

The frozen candidate is wired into normal game play as an explicit AI-lab option.
This source is **not published**. Jev is still the default, and all readiness
gates remain in force. No model fitting, policy changes, or paid calls occurred.

## Changes

- Added a lazy bundled candidate and a local-only preparation boundary.
- Kept uploaded linear models and existing settings compatible.
- Validate both assets/all five policies before starting a candidate game;
  missing code or corrupt/incompatible assets produce an explicit error,
  never a Jev fallback. Invalid stored settings no longer trigger a status fetch.
- Disable start/player controls during model loading and ignore stale completion.
- Normal local decision records retain the local-policy ID and epsilon.
- No layout, color, rules, animation, package, audience or production changes.
  AI-lab wording distinguishes experimentation from readiness.

## Evidence and limits

59 tests pass; the final candidate version/config guard also passes all six new
adapter tests. Nonincremental TypeScript and final production build pass.

Ten deterministic Node games through the actual local adapter: five bot/bot and
five random simulated-human/bot games, covering all five strategies. All finish
by supply: 634 actions (467 local choices,167 simulated-human choices), no illegal
moves, truncations, aborts or repetition endings. Exact regeneration matches all
states, actions and results. A fetch trap sees zero calls, including a missing
chunk failure. These are not human trials, browser interaction tests, or Jev
acceptance games. Tests separately prove seeded parity with the frozen hybrid
and exact model-object equality with its original files.

Actual emitted client JS across both routes and lazy chunks:
- Before:571,045 bytes; sum of per-file gzip176,209 bytes.
- After:592,710 bytes; sum of per-file gzip185,694 bytes.
- Delta:+21,665 bytes raw, **+9,485 bytes gzip**.
- Candidate lazy chunk:19,531 bytes /8,642 gzip, including embedded models and
  added tactical code; some shared code remains in other chunks.
- Existing dependencies only. These figures are build-output totals, not a
  browser network trace or first-load measurement. Original formatted model
  files remain6,280 bytes combined gzip, far below500KB.

No browser/mobile result is claimed. Required managed-preview control-browser
skill was absent from the complete executor AND cloud inventories; no alternate
browser-control path was improvised. Candidate computation is currently
synchronous; check real slow/full-width cases and responsiveness before release.
No acceptance games have been run.

## Source reconciliation and cost

Started from GitHub03c4b5d3abe4f6cbfb6be361e816a6f952129d36, with local
a2cf4c81991deeda5e0af2cef29d0b0d1e29816e sharing tree
9f0e28b3b8766e1f5e34f12bcc8186ec1655c082. The existing generated
tsconfig.tsbuildinfo modification was preserved and not included.

Sites metadata still reports public version14 and exact saved source
85174b8ed3cbcf6a0cf88da79278e12d222535d4. The source-opening helper failed
three times with HTTP503; no source was pushed, overwritten, or deployed.
Work continued locally against the reconciled GitHub checkout; re-open/reconcile
the Sites source again before any eventual publication.

Exclusive zero-budget lease: e3fd2d73043bce633d8af7db517b820bc947dbf9.
Session cost$0; cumulative upper spend$0.876801366, remaining$3.373198634;
protected acceptance reserve$3.25. No financial reservations or unknown charges.
Do not count the earlier ten development wins as acceptance.

## Reproduce

```sh
npm test
npx tsc --noEmit --incremental false
node scripts/ai/audit-client.mjs --out experiments/jev-replacement/20260924-client-14 --verify
npm run build
node scripts/ai/audit-client.mjs --out /tmp/territori-bundle-check --bundle-only
```

Regeneration has no API dependency. Bundle hash names/build IDs may differ;
saved manifests record the exact measurements above. Runtime source hashes are
in adapter-audit.json. games.jsonl.gz is the exact mixed event stream, with
simulated human actions explicitly marked, not teacher training labels.

Next: restore supported browser QA, profile constrained CPU/full-width cases,
and handle responsiveness if needed without changing the frozen decision
semantics. Preserve the evaluation reserve. Then freeze runtime/configuration
for independently seeded, balanced-color40completed Jev matches per strategy;
do not promote until all gates, browser checks and deployment verification pass.
