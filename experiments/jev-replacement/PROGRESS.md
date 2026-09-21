# Jev replacement checkpoint

## 2026-09-21 — offline tactical/soft-target comparison (latest)

Session `20260921-tactical-02` is CLOSED and spent **$0**. Reconciled GitHub `2358f744caf86faca4d3fb4024afac4a1f1557dc`, local checkpoint `af815ec6ec2cdbf71b0c0ea455d47e2cabf2c408`, and unchanged Sites source `85174b8ed3cbcf6a0cf88da79278e12d222535d4`. No paid calls, new dependencies, deployment, or audience change. The live game is still version 14 and defaults to Jev.

Implemented optional capture-reply features, probability-target training, common-state style diagnostics, and reproducible local-vs-local comparisons. Existing feature semantics/defaults remain unchanged; the original hard-label model reproduces exactly. All 22 tests and the TypeScript check pass. Four five-strategy models and all 120 local comparison game logs are in `20260921-tactical-02/`.

Soft labels improve development agreement slightly (44.4% to 46.2%) but not demonstrated playing strength: 47.5% score against the old local baseline over 40 games. Tactical hard labels score 51.25% in another 40 games; uncertainty intervals overlap 50% broadly. Tactical soft labels regress Aggressive and are NOT a preferred candidate. All 120 games completed legally without truncation/repetition. These are local-only development matches, **not** any of the required 200 Jev acceptance matches.

Key finding: strategy/action coverage is sparse despite balanced game scheduling. Aggressive training contains only TWO states with legal captures, while validation contains sixteen. Balanced has only 27 training decisions. Adding features cannot reliably fix this. Jev probability maps total 0.99 in 407/562 records; soft training now explicitly normalizes discrepancies up to 1%, rejecting missing keys/invalid values/larger errors. Raw data is unchanged.

Next: try a shared tactical prior with regularized per-strategy adjustments (still tiny/interpretable), or a small targeted teacher batch on varied/student-generated states to cover captures, winning/endgame decisions and useful shifts. Compare against the saved candidates, not just exact agreement. Common-state diagnostics show differing local choices but do not yet validate faithful strategy intent; Fluid's no-shift teacher coverage remains unresolved. Preserve the $3.25 evaluation reserve. Total added cost remains **$0.309700230**, remaining **$3.940299770**. Independent Jev matches, mobile/browser checks, build/deployment, and no-API integration are pending. **Replacement is not ready.**

No work session is active. Read the authoritative goal and ledger again before the next session. This section supersedes the earlier next-step notes below.

## 2026-09-21 — first all-strategy collection

Read the goal and both current sources before work. GitHub `c49cb649d1b3a18d86e7c24821eaae0e1c9ca5ce` adds the goal to Sites `85174b8ed3cbcf6a0cf88da79278e12d222535d4`; no conflicting application edits were present. The public Site is still on Jev, with unchanged audience and UI.

Added an offline bounded collector and integer cost journal. Verified the official Jev 1.13 price, context cap, and usage fields. Nineteen tests and the TypeScript check pass; no new runtime dependencies. The journal settles real token usage, retains the full request bound on uncertainty, and never retries automatically. This is the first additional-budget session; older smoke experiments are not charged again.

Session `20260921-all-strategies-01` is CLOSED. Ten of ten Jev-vs-Jev games completed: 562 decisions, all five strategies twice in each color, no API errors or uncertain charges. Exact added spend: **$0.309700230** from 7,373,815 input tokens; 416,792 output tokens are free. Remaining project allowance: **$3.940299770**. Raised the evaluation reserve from $2.75 to **$3.25** after observing average teacher-game cost; about $0.69 remains for further development calls. This reserve is an estimate, not permission to exceed the total cap. Actual public-site spending is not visible in this offline ledger.

All five strategies now have experimental linear weights. Five games trained / five development-validation games: 44.4% exact agreement, average teacher rank 6.84; 47.7% agreement after excluding 28 exact training-context repeats. Captures agree 94.1%, placements 28.9%, and **no teacher shifts occurred**, including Fluid. Model assets gzip to 3,456 bytes. Unthrottled server p95 was 6.7 ms, not a mobile measurement. Twenty local-vs-local smoke games completed without illegal moves, turn limits, or repetition endings. None of this establishes strength against Jev or recognizable styles.

Artifacts and reproduction commands: `20260921-all-strategies-01/README.md`. Live Jev default, UI, audience and version 14 were left unchanged; only offline scripts, docs and experiment artifacts changed. GitHub contains the checkpoint; Sites source remains the earlier live source. Reconcile this GitHub delta when opening the Site next time rather than replacing it with the older Sites checkout.

Next bounded session: work offline first. Improve the poor placement decisions with the teacher's existing capture-reply features and/or soft probability targets, compare candidates on these same DEVELOPMENT validation games, and measure comparable-state style differences. Do not call these games an independent test. Consider a small, metered student-state/rare-action collection only after offline comparisons; reserve fresh seeds/games for the final 200-match acceptance suite. Baseline data lacks shifts, so report that coverage gap rather than claiming Fluid is validated. Independent match games, mobile/browser gates, and no-API production integration are all pending. **Replacement is not ready.**

Before later paid work, read the current goal, this checkpoint, `budget.json`, and the newest repository/Sites sources. No session is currently reserved. Acquire and commit a new exclusive reservation before calling. Do not overlap any reserved session; if scratch disappears, retain its entire cap until reconciled, and never silently release an expired reservation.
