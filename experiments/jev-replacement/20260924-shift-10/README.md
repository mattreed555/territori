# Shift opportunities and repeat controls

Development experiment, 2026-09-24. Live Jev, rules, UI and public audience stay
unchanged. This is not independent acceptance evaluation.

## Plan fixed before paid calls

Select twelve legal positions from twelve new deterministic random-play source
groups, six in each color. Favor shifts within one point of the best non-shift
under full two-ply evaluation, excluding terminal values and supplies below two.
This is a targeted sampling proxy, not a claim that the shift is objectively best.
The first 48-trace and 96-trace candidate pools did not supply six qualifying
groups in both colors; the final teacher-blind pool uses 512 traces, seed 2410,
with placement rates 0.9, 0.6 and 0.4. No teacher label informed selection.

Ask each of the five strategies twice with identical inputs (two complete passes,
120 calls maximum). Compare within-strategy repeat variation with between-strategy
variation on those same boards. Preserve raw distributions, choices, usage and
repeat identity. Counterfactual outcomes remain null, not fabricated game results.

Reserve every third selected source group for validation (four groups). Only pass
zero may feed the existing ridge-0.1 style fitter; pass one is a repeat control,
not another independent training example. Add pass-zero labels to the previous
100 matched labels, preserving their original holdout and the base policy's unseen
groups. Runtime weight 0.5 and tactical margin 1 remain fixed. Compare base search,
the previous residual and the refit on the same held-out states. These are inspected
development folds, not the future independent game-strength suite.

All calls go through the existing hosted teacher and cumulative metered collector;
no API key enters the repository. Session cap $0.12, no retry, $3.25 independent
evaluation reserve untouched. Pricing and response usage fields rechecked on
2026-09-24: [models](https://docs.typesafe.ai/models),
[API reference](https://docs.typesafe.ai/api). Jev 1.13.0 costs $0.042 per million
input tokens; output tokens are free. Each request is conservatively reserved at
65,536 input tokens until valid reported usage settles it.

Source/inputs must be committed before calling. On interruption, reconcile the
journal rather than rerunning the same directory or releasing an uncertain cap.

## Results

Pending the bounded collection and analysis. Replacement is not ready.
