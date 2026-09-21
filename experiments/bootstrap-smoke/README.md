# Bootstrap smoke experiment — 2026-09-21

This checks the pipeline, not whether the model is ready to replace Jev.

- Two Balanced-vs-Balanced teacher games, 56 turns each: 112 real Jev decisions.
- Seed 42; one whole game for training, one for testing; 60 optimizer epochs.
- Held-out exact-move agreement: **37.5%** (21/56).
- Average rank of Jev's chosen move: **7.30**.
- Place agreement: **20.51%** (8/39). Remove: **76.47%** (13/17). No shift examples.
- Ten board/player/supply states occurred in both games. This is a very small, partially overlapping test.
- Two Balanced local-vs-Jev matches, seed 77, epsilon 0.03, alternating local colors: **one local win, one Jev win**, no draws/truncations.
- The local policy won as Teal, 23–22; lost as Apricot, 22–28. Both games were won by the first player. Two matches cannot establish relative strength or first-player advantage.

Only Balanced has fitted weights. The other four strategies are supported by the trainer but have **not** been trained or evaluated in this smoke experiment. The model is not installed as the site's default.

Files include the actual model, machine-readable reports, and gzip-compressed JSONL decision/result events. Decompress before passing data to the CLI. Teacher responses include confidence and per-choice probabilities; the baseline trains only on the chosen move. No API key is present.

Reproduce training after decompression:

```sh
pnpm ai train --data data/teacher.jsonl --seed 42 --epochs 60 \
  --out data/policy.json --report data/agreement.json
```

Future evidence should use substantially more games, coverage of all five strategies and move types, randomized matchups, and an independent test batch.
