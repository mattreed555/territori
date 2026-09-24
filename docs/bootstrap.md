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
# Bounded replacement work

Read `experiments/jev-replacement/work-session.json` as well as the ledger before
starting; acquire an exclusive durable lease for offline work too. An expired
lease is not permission to overlap an unreconciled worker. `compare.mjs --shared`
tests pooled tactical priors with strategy-specific adjustments. The bounded
collector supports `--mode local-vs-jev --model FILE --epsilon 0.03` in batches of
ten (all five strategies, both colors). These are explicitly development games.
Use `report-matches.mjs --run DIRECTORY` to summarize saved compressed logs.

Opt-in shallow search is available in the offline tools, not the live UI:
`collect.mjs --search '{}'` adds a full opponent-reply search over a bounded
candidate set. `local-tournament.mjs` accepts `--search` and `--baseline-search`
JSON options; neither option makes API calls in that tool. Options are
`policyBeam` (12), `staticBeam` (8), and `priorWeight` (0.75).
`policyBeam: 0` searches every root move; terminal root moves are always included.
Search uses actual final-round/repetition endings, every legal opponent reply,
and a small board-value heuristic plus the learned strategy ranking. Exploration
is restricted to close search alternatives, unlike the original uniform epsilon.
This is two plies, not a proof against longer tactics. Strategy differentiation
and mobile latency remain open gates. `audit-search.mjs` reports beam coverage
and conditional ranks explicitly; these are not full-legal-move teacher ranks.
It also reports a complete **policy order**: searched moves first by search score,
then unsearched moves by learned-prior rank. This accounts for every legal move
without claiming full-width minimax values, and leaves the chosen move unchanged.

`retrain-student.mjs --data FILE --data FILE --baseline MODEL --out DIRECTORY`
reuses a saved model's whole-game development holdout while adding teacher data
from student-visited games. Local decisions are excluded. `verify-session.mjs
--run DIRECTORY` independently replays every saved game and checks each paid
request, response usage and charge against the compressed journal. It rejects
uncertain sessions rather than treating their costs as exact.

Common-state strategy probes use `prepare-probe.mjs`, `collect-probe.mjs` and
`report-probe.mjs`. They record a separate `counterfactual` event kind, not played
games. Every label retains the source `groupId`; final results stay null. The
ordinary JSONL reader ignores these events. The explicit `trainingDecisions`
adapter validates them and annotates their source group without rewriting their
identities or inventing outcomes. Both split helpers honor that annotation,
including overlap with ordinary teacher-game data. Model split IDs therefore
identify source groups, not the probe's strategy-specific synthetic game IDs.
See `experiments/jev-replacement/20260924-style-06/README.md` for the first probe.

`train-probe.mjs --data PLAYED.jsonl.gz --probes LABELS.jsonl.gz --baseline MODEL
--out DIRECTORY` compares three small all-strategy refits and the frozen baseline.
It retains the original whole-game development holdout, reserves two additional
random-trace groups, and reports ordinary and matched-state agreement separately.
It compares search prior weights 0.75 and 3, records choices/feature tendencies in
identical positions, and reports repeated training contexts. These small,
repeatedly inspected development folds are not the independent acceptance suite.

`fit-style.mjs --probes LABELS.jsonl.gz --policy MODEL --split comparison.json
--out DIRECTORY` is an opt-in matched-state style experiment. Small ridge fits
learn log-probability differences between the five teacher strategies on identical
positions; common tactics cancel. Source-group holdouts and training-only scaling
remain mandatory. `style.ts` reranks searched moves within a bounded tactical
margin and preserves visible terminal wins. It does not broaden the search beam
or prove long-term safety. The residual is a separate, validated tiny JSON asset;
neither it nor the new policy is enabled in normal play.

Free `local-tournament.mjs` accepts `--style MODEL --style-options
'{"weight":0.5,"margin":1}'` for the candidate only. Use `verify-local.mjs --run
PREFIX --candidate POLICY --baseline POLICY --style MODEL` to reproduce every
saved state, seeded choice and result. Omitting style keeps the old policy path.

Search version 2 expands to all root moves if every initial beam move permits
a terminal loss within two plies. This prevents a low-ranked but necessary shift
from being excluded. `replay-search.mjs` compares new search code with a saved
batch's local choices using the original seeds, without making API calls.

Offline comparisons: `scripts/ai/compare.mjs` fits the original and optional
capture-reply features with hard or normalized soft teacher targets. See
`experiments/jev-replacement/20260921-tactical-02/README.md` for commands and
limitations. `local-tournament.mjs` compares two local models with balanced colors;
it makes no API calls and must not be reported as local-versus-Jev evidence.

The authoritative goal is [jev-replacement-goal.md](jev-replacement-goal.md).
The optional `lib/ai/intent.ts` layer adds transparent **authored** strategy
preferences over the frozen learned policy/residual; it is not a distilled model
or the live default. `local-tournament.mjs --style FILE --intent
'{"strength":1,"margin":1}'` tests it locally; `verify-local.mjs` checks its
source hash and replays choices. `audit-intent.mjs`, `intent-selfplay.mjs`, and
`audit-intent-selfplay.mjs` preserve common-state and all-pairing evidence.
See `experiments/jev-replacement/20260924-intent-11/README.md` and the broader
`20260924-varied-12` checkpoint. The budgeted collector now accepts `--style FILE
--intent '{"strength":1,"margin":1}'` with exact model/source/config provenance.
`--dry-run` validates all strategies and prints the plan without opening the
ledger, creating output or making requests; it does NOT validate available funds.
For new local-agent batches, `verify-session.mjs --run DIR --model FILE --style
FILE` also replays every seeded local choice and rejects incompatible metadata.
`audit-varied.mjs` generates and replays synthetic common states;
`build-local-runtime.mjs` measures a standalone dependency-free ESM bundle, not
the final application delta or mobile latency. All remain separate from play.
`audit-hybrid-matches.mjs` reports exact-hybrid agreement/rank by strategy and
teacher move type, plus training-context overlap, on saved metered matches.
See `experiments/jev-replacement/20260924-hybrid-13/README.md` for the ten-game
development evaluation; it is not the independent acceptance suite.

`prepare-shift-probe.mjs`, `collect-repeat-probe.mjs` and
`analyze-repeat-probe.mjs` add a bounded two-pass counterfactual experiment.
The distinct `repeated-counterfactual` wrapper preserves repeat identity; it is
not silently fed to ordinary trainers. Only the predeclared first pass enters
the grouped style fit, while the second measures same-input provider variation.
`diagnose-shifts.mjs` separates omitted root moves from scoring preferences.
See `experiments/jev-replacement/20260924-shift-10/README.md`; the refit was not
promoted. All these tools remain separate from normal play.

Read `experiments/jev-replacement/PROGRESS.md` and `budget.json` before paid work.
The older `simulate` CLI does not enforce a budget; use the bounded collector for
replacement data generation:

```sh
node scripts/ai/collect.mjs --run-id RUN_ID --out experiments/jev-replacement/RUN_ID --ledger experiments/jev-replacement/budget.json --teacher-url https://territori.matthew-l-reed.chatgpt.site/api/robot --source-commit SOURCE_SHA --games 10 --seed 511 --max-turns 160
```

First commit one exclusive `reserved` session to the shared private repository,
including its maximum spend and expiry. Re-read HEAD and use a non-forced branch
update to avoid overlapping workers. An expired lease must be reconciled, not
automatically replaced. Pricing must have been checked within 24 hours. The
collector writes and syncs a request reservation before calling, records provider
usage afterward, and preserves the full bound on errors. Never rerun the same
session directory. Persist the reconciled ledger and compressed datasets before
beginning another session. The seed controls matchup scheduling, not Jev sampling.

Collection/validation games are development data, not independent acceptance
tests. Public-site play is outside this offline ledger: these figures bound this
project's additional spending, not the provider account's live balance.

## Bundled candidate (unpublished development)

The normal game now supports an opt-in `candidate` engine from the AI lab,
alongside Jev and uploaded linear policies. **Jev remains the default; the live
Site has not changed.** Both game modes use the same local adapter. A missing
chunk, incompatible asset, or incomplete uploaded policy stops with an error;
local play never silently calls Jev. New local records include policy ID and
exploration probability. Assets are lazy-loaded at start, before any move.

Candidate `hybrid-search2-intent1-residual08-v1` copies the complete original
JSON objects into `lib/ai/candidate-assets.ts`; tests check exact equality:

- Policy: `20260921-shared-03/tactical-soft-prior-strong.json`, SHA256
  `53b12f62523451c442432c7374a1126746649ef244ffc90d88f20c916cc5f4cb`.
- Residual: `20260924-residual-08/style-ridge-0.1.json`, SHA256
  `75d075adcae50d9a51ef686488f9ee49631e2549c739e2e0ecdec83e429be3db`.
- Search version2: policy beam12, static beam8, prior0.75. Intent version1:
  strength1, margin1; learned residual weight0.5. Preferences are authored,
  not a claim of perfect teacher imitation. Default exploration is0.03.

The adapter currently computes synchronously on the main thread after loading.
Browser responsiveness, mobile-class latency, independent Jev acceptance and
deployment checks remain required before changing the default. Node simulations
do not establish those gates. No new dependency was introduced.

```sh
node scripts/ai/audit-client.mjs --out experiments/jev-replacement/20260924-client-14 --verify
npm run build
node scripts/ai/audit-client.mjs --out /tmp/territori-bundle-check --bundle-only
```

The saved before/after manifests measure every emitted client JS file, including
lazy code and both routes, using per-file gzip. They are not network-transfer or
first-load measurements. The compressed event stream preserves simulated-human
actions under a distinct kind; do not feed them to teacher training.

### Runtime profiling and exact parity

`compare-runtime.mjs --ref FULL_LOCAL_COMMIT --out DIR` loads immutable Git
source alongside current source and interleaves their timings on the same
84 saved positions, all five strategies. It requires exact complete rank-output
hashes, not just the best move. `audit-runtime-parity.mjs` additionally compares
canonical successors and teacher request bodies. Neither tool calls Jev.
Both accept a full commit SHA present in the local clone; see the performance-15
README for the equivalent private-repository baseline commit.

The current search updates leaf value terms only around the changed squares;
scoring and position keys avoid temporary sets/arrays. The reference full-board
evaluator and regression tests remain. This changes computation, not strategy,
rules, search width or outcome semantics. Shared-host Node measurements are
diagnostic only: mobile/browser verification is still required before release.
