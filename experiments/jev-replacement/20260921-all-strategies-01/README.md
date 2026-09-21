# First five-strategy baseline

Ten Jev-vs-Jev games, collected September 21, 2026. All finished by supply exhaustion in 50–62 turns. Each strategy played twice as Teal and twice as Apricot against different opponents. Seeds determine matchup order, not Jev's decisions.

The dataset has 562 teacher decisions: 160 opening, 240 middle, 162 late. Five whole games train the model; five are **development validation**, not an independent readiness test. Split seed 511 and 60 epochs were fixed before inspecting fit results. The original Balanced smoke dataset was not included.

| Strategy | Validation states | Exact agreement | Mean teacher rank |
|---|---:|---:|---:|
| Aggressive | 60 | 51.7% | 6.18 |
| Cautious | 57 | 43.9% | 6.75 |
| Expansive | 27 | 55.6% | 5.22 |
| Fluid | 55 | 50.9% | 7.00 |
| Balanced | 87 | 32.2% | 7.76 |
| Overall | 286 | 44.4% | 6.84 |

Capture agreement is 94.1%; placement agreement is 28.9%. No teacher chose a shift. That is a coverage problem, not evidence that Fluid is learned. Repeated openings are common: 60 validation states share a board/supply/turn with training, and 28 share the full recorded decision context including strategy and repetition history. Removing those exact-context repeats leaves 258 states, 47.7% agreement and mean rank 4.89. No symmetry-equivalent overlap analysis was done.

Twenty local-vs-local smoke games with seed 912 and epsilon 0.03 all finished by supply exhaustion, with no illegal moves or truncation. Six draws. These matches check execution only; they say nothing about strength versus Jev. No independent local-vs-Jev acceptance matches have been run for these policies.

The five-policy JSON is 10,218 bytes (3,456 gzipped). A Node 24 Linux/x64 server measurement over 286 validation states gave p95 6.67 ms and max 8.35 ms. This was not a mobile-class/browser test and is not a passed runtime gate. No application dependency or runtime code changed; the normal game still uses Jev.

## Cost and artifacts

562 successful calls, 7,373,815 input tokens, 416,792 output tokens. At [$0.042 per million input tokens, output free](https://docs.typesafe.ai/models), the added cost is **$0.309700230**. Pricing and the 64k request context bound were checked on September 21. Every response reported `jev-1.13.0` and valid usage. No retries or unknown charges. See the cumulative `../budget.json`; its remaining allowance is not a live provider-account balance.

- `decisions.jsonl.gz`: complete teacher decisions, probability distributions and result events.
- `usage.jsonl.gz`: request reservations and exact response usage, joined by game and turn.
- `provenance.json`: rules, prompt/strategy hashes, source/deployment versions, seed and matchups.
- `games.json`, `summary.json`: teacher outcomes and cost totals.
- `linear-policy.json`, `linear-validation.json`: all five fits and held-out metrics.
- `audit.json`: hashes, coverage, overlap, phase metrics and runtime measurements.
- `local-smoke.jsonl.gz`, `local-smoke-report.json`: free execution checks.

## Reproduce offline

```sh
gzip -dk experiments/jev-replacement/20260921-all-strategies-01/decisions.jsonl.gz
node scripts/ai/cli.mjs train --data experiments/jev-replacement/20260921-all-strategies-01/decisions.jsonl --out data/reproduced-policy.json --report data/reproduced-validation.json --seed 511 --test-fraction 0.5 --epochs 60
node scripts/ai/audit.mjs --data experiments/jev-replacement/20260921-all-strategies-01/decisions.jsonl.gz --model data/reproduced-policy.json --out data/reproduced-audit.json
```

If the uncompressed file already exists, skip decompression. Audit timings vary. The model should reproduce exactly. Improve placement/capture-reply reasoning and investigate missing shift/style coverage before spending the reserved evaluation budget. **Not ready to replace Jev.**
