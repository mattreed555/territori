# Replace Jev in Territori

Deliver a reliable, lightweight local AI for all five strategies—Aggressive, Cautious, Expansive, Fluid, and Balanced—so normal human-versus-computer and computer-versus-computer games need no Jev calls.

## Starting point

The bootstrap pipeline is implemented. See docs/bootstrap.md and experiments/bootstrap-smoke/. Only Balanced has experimental weights: 112 teacher decisions, 37.5% held-out exact-move agreement, and one win in two local-versus-Jev matches. This is not sufficient evidence of readiness. The other four strategies have no trained policy.

## Work

1. Collect diverse teacher games across all five strategies, both colors, varied matchups, and game phases. Preserve every decision and its outcome. Track cumulative token usage, estimated cost, prompt/rules versions, seeds, and dataset provenance.
2. Train and compare the existing linear baseline first. Improve features, use teacher probabilities, add shallow search, or try a modest nonlinear model when evidence warrants it. Keep independent test games separate from training and model selection; measure repeated-state overlap.
3. Evaluate move agreement, agreement by strategy and move type, teacher-move rank, illegal moves, repetition/turn-limit rates, latency, and game results. Measure strategy tendencies in comparable states, not raw move frequencies alone.
4. Integrate the selected models into the normal game, test on small-screen layouts and constrained CPU, preserve the existing rules and UI, and retain a reversible version of the Jev implementation.

## Ready means

- All five strategies have trained, versioned local policies and recognizable strategy behavior supported by recorded comparisons.
- Both normal play modes work with no Jev inference calls or silent API fallback. Missing/corrupt models are handled clearly.
- An independently seeded evaluation includes at least 40 completed local-versus-Jev games per strategy, balanced across colors. Draws count as half a point. Target at least 50% overall score and no strategy below 40%; report confidence intervals and failed/truncated games separately. Do not turn a small or selected sample into a strength claim.
- Exact-move agreement is reported, but matching Jev is not a substitute for playing well.
- No illegal choices or unexplained stalls in the test suite and evaluation runs. Investigate regressions in repetitions and game length.
- Target local move latency below 100 ms at the 95th percentile in a documented mobile-class test, and total compressed model assets below 500 KB. Report measured bundle/dependency impact.
- Tests, build, browser checks, deployment, and a concise evaluation report are complete. Publish local play as the default only once these gates pass, then notify Matt with the result and any remaining limitations.

These are working acceptance criteria. Do not silently lower them to declare success; explain any proposed material revision.

## Authority and limits

Proceed autonomously with data generation, feature changes, more capable small models, modest search, and lightweight dependencies. Ask before a major architectural change or a heavyweight model/runtime dependency.

The total additional Jev budget is $4.25 across all runs, not per batch or scheduled run. Use the existing server-side secret; never place it in code, datasets, model files, logs, or prompts. Verify applicable pricing and meter response usage. Maintain a durable cumulative ledger, reserve funds for evaluation, and stop before exhausting the balance. If usage/cost cannot be bounded reliably, pause paid work. Ask before any top-up or spending above the cap. Prefer useful, staged batches over spending the whole balance at once.

Persist source, datasets, models, reports, cost ledger, and a short progress checkpoint in the private mattreed555/territori repository. Reuse the existing Site appgprj_6ab0465ff30081919f07a4eb2d13014b; never recreate it or change its audience. Reconcile GitHub and Sites source changes before writing; do not overwrite newer work.

Notify Matt when the replacement is ready, when his approval is needed, or when a real blocker prevents progress. Otherwise continue quietly and leave durable checkpoints. Stop the recurring task after completion or while awaiting approval.
