# Learning from Jev

This is an imitation experiment. The first policy is a weighted sum of move features, fitted separately for Aggressive, Cautious, Expansive, Fluid, and Balanced. It learns Jev's choices, not optimal play. Jev stays the default until you load and select a trained model.

No ML framework or training service is required. Run the commands below from the project root with Node 24 and installed dependencies.

## 1. Collect decisions

Normal games save each accepted AI decision in IndexedDB on that browser. Open `/training` (AI lab) to export JSONL. The data stays on that device and origin; clearing browser data deletes it. Storage failure pauses an AI turn rather than silently dropping its decision. Closing a tab can leave a game without a result. Human moves are represented in subsequent states, but are not teacher examples.

For headless Jev games, set `TYPESAFE_API_KEY` in your shell, or use Node's `--env-file=.env`. Never put the key in a command argument, model, dataset, or commit.

```sh
node --env-file=.env scripts/ai/cli.mjs simulate \
  --games 100 --random-matchups --seed 42 \
  --out data/teacher.jsonl
```

Alternatively, reuse the hosted site's server-side key:

```sh
pnpm ai simulate --games 10 --random-matchups --seed 42 \
  --teacher-url https://territori.matthew-l-reed.chatgpt.site/api/robot \
  --out data/teacher.jsonl
```

Fixed matchup: `--teal Aggressive --apricot Cautious`. Defaults are Balanced vs Balanced. Games run sequentially. Each successful decision is appended and flushed to disk immediately. Files are appended, not overwritten. Each run gets a unique ID; supply `--run-id` only if you will keep it unique. Batches stop on an API/storage error, recording an aborted result where possible. Existing rows remain usable. There is no automatic retry that could produce a second teacher answer for the same turn.

`--max-turns 300` is the default safeguard. A game hitting the limit is **truncated**, not scored as a win or draw. Its decisions still support imitation training. Seeds control matchup selection, training shuffles, and local exploration. Jev responses are not guaranteed deterministic; the stored choices are the reproducible record.

## 2. Dataset

Each decision has:

- `version`, `ruleset`, `id`, `gameId`, and one-based `turnNumber`;
- `state`: board, current player (`turn`), remaining supplies, captured counts, move history needed for repetition, and last move;
- all `legalMoves`, `strategy`, `source`, and `chosenMove`;
- `teacher`: reported model, the raw move-answer object, full provider response (including any score/probability), and usage when returned;
- `finalResult`: completed outcome or explicit truncated/aborted status, initially null.

There is no invented confidence value. Raw scores are provider metadata, not assumed calibrated probabilities. Internal `blue`/`red` IDs mean the displayed Teal/Apricot players. The ruleset ID guards against accidentally mixing future rule revisions; increment it when rules change. Teacher prompts are currently the shared `lib/game/jev.ts` prompt. Keep the source commit with your experiment.

Headless JSONL is append-only: a final `kind: "result"` event joins earlier decisions by game ID. Browser export already joins them. To make a file with one finalized decision per line:

```sh
pnpm ai finalize --data data/teacher.jsonl --out data/finalized.jsonl
```

No result means unknown, not a draw. Local decisions are logged too but are excluded from teacher training/evaluation. JSONL contains game data only, no key, IP address, or player identity. Do not treat browser-provided datasets as trusted tournament evidence.

## 3. Fit the baseline

```sh
pnpm ai train --data data/teacher.jsonl --seed 42 --epochs 60 \
  --out data/policy.json --report data/evaluation.json
```

The split holds out 20% of **whole games** before fitting. Normalization uses training data only. At least two games are required. Random matchups do not guarantee every strategy appears in both splits: inspect per-strategy counts and collect more data. Missing training strategies get no policy; missing test strategies get no performance claim.

The optimizer is ordinary listwise softmax cross-entropy with L2 regularization and seeded SGD. Every state contributes one example regardless of its number of legal choices. This is supervised imitation, not reinforcement learning. Tiny datasets can test the plumbing but cannot establish playing strength. Repeated opening states can appear in different games; exact-match agreement there may overstate generalization. Keep an independently collected batch for a later assessment.

`lib/ai/features.ts` is the feature registry. It includes territory changes, capturable-stone changes, largest connected stone-group change, largest territory change, hypothetical legal follow-up counts, occupied bounding-box expansion, Manhattan center distance, supplies, move-type indicators, supply/type interactions, terminal outcomes, and prior occurrence count of the resulting position. Mobility is measured before the opponent's response, not a search. State-constant features such as opponent supply cancel in a within-state linear ranking; interactions allow supply to influence preferences. Bump `FEATURE_VERSION` when changing meanings.

The JSON model stores feature names, per-strategy weights, training means/scales, sample counts, and split game IDs. Positive weights favor larger standardized feature values. Correlated features mean weights are descriptive, not causal explanations.

## 4. Evaluate

The training report includes top-1 teacher agreement, agreement by strategy and **teacher move type**, average one-based teacher rank, sample counts, and unsupported states. Ties use move-ID order consistently. Evaluation uses no exploration.

```sh
pnpm ai evaluate --data data/independent.jsonl --model data/policy.json \
  --report data/independent-report.json
pnpm ai simulate --mode local-vs-jev --model data/policy.json \
  --games 20 --teal Balanced --apricot Balanced --seed 77 --epsilon 0.03 \
  --teacher-url https://territori.matthew-l-reed.chatgpt.site/api/robot \
  --out data/matches.jsonl --report data/matches-report.json
```

Evaluation excludes game IDs recorded as training games. Local-vs-Jev alternates which color the local engine controls, keeping configured strategies attached to their colors. Use same-strategy matches to compare engines fairly, then expand to cross-strategy matchups. The match report gives wins, losses, draws, truncated games, and individual scores/outcomes; only completed games count as wins/losses/draws. Agreement and strength are different measures.

For API-free simulator checks, use `--mode local-vs-local` with a model covering the selected strategies.

## 5. Run in the browser

Open `/training`, load `policy.json`, select Local policy, set exploration (default 0.03), and save. Return to the game. Every robot uses that local model; a missing strategy prevents starting rather than falling back to paid API calls. Select Jev in the lab to return to the teacher. No model is shipped as trained until you actually fit one.

`epsilon` is the probability of choosing a uniformly random legal move instead of the highest-scoring move. Use zero for deterministic comparisons. Browser policy code uses only the rules, features, and a small JSON weight file; there are no inference requests or ML dependencies.

## Files

- `lib/ai/teacher.ts`: shared Jev transport and answer metadata.
- `dataset.ts`, `browser.ts`: versioned events and browser storage/export.
- `features.ts`, `policy.ts`: pure client-side inference.
- `training.ts`: optimizer, held-out split, agreement metrics.
- `simulator.ts`: pure headless game loop with pluggable agents/sink.
- `scripts/ai/cli.mjs`: file I/O, batches, reports.

Generated files under `data/` are ignored by Git. Keep datasets and model/report pairs together in your own durable storage. The pipeline is designed for modest bootstrap batches; it loads training data into memory. Optimize only if measured dataset size or runtime warrants it.
