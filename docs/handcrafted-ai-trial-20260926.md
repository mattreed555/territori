# Rules-based local AI trial (2026-09-26)

Candidate `capture-points-v2-handcrafted-search1` replaces the normal bot's earlier Jev-trained policy/style ranking. It uses the unchanged capture-points v2 game rules and no network or learned assets. Historical models, datasets, and uploaded linear-policy support remain archived/optional; the old 200-game Jev acceptance does **not** apply to this candidate.

The bounded two-ply search proposes 18 roots by current-rules one-ply points/control and, for a newly capturable placement, its exact immediate-removal reply. It also includes the best three removes and shifts of each kind, all immediate terminal moves, and widens to every move if its beam sees only forced terminal losses. For each proposed root it evaluates every legal opposing reply, including capture, placement, shift, repetition, and final-round outcomes. Tactical value is primary; five authored preferences order moves only within half a board point of the best searched value. Aggressive favors pressure and legal captures; Cautious favors supported stones; Expansive favors control growth and open reach; Fluid favors useful shifts; Balanced favors growth, support, and captures. Terminal wins remain exclusive even under exploration. The strategy terms never make a move outside the small tactical band eligible.

`node scripts/ai/evaluate-handcrafted.mjs` compares the frozen published v17 source `78a9ecc6b47948a86ee5563942d64aa9f0d4623b` and the current implementation under identical v2 rules, epsilon .03, seeds 2412/2413, all 25 ordered strategy pairings per seed (50 selfplays per policy). It also runs 20 same-strategy old-versus-new games, both colors, two seeds. All games ended by supply within 160 plies, with no illegal/aborted/truncated results. This is exploratory local development, not an independent strength claim.

| Measure, 50 selfplays | Published v17 | New rules-based bot |
| --- | ---: | ---: |
| Immediate place→opponent-capture pairs | 859 | 9 |
| Identical-board empty capture exchanges | 859 | 9 |
| Mean unique placement cells/game | 30.08 | 42.82 |
| Mean peak controlled cells/game | 50.42 | 52.30 |
| Mean final controlled cells/game | 49.20 | 50.96 |
| Mean final stones on board/game | 23.82 | 34.52 |
| Mean plies/game | 80.72 | 68.84 |
| Truncated | 0 | 0 |

For Aggressive–Balanced in both color orders on seeds 2412/2413, the old bot had 19–32 immediate pairs per game; the new bot had zero in all four. Seed 2414 likewise had 31 and 18 old versus zero new in the two color orders. The new-versus-old same-strategy games yielded 20/20 points for the new bot, zero new stones immediately recaptured versus 261 old stones; this is secondary and opponent-specific, not a general win-rate estimate. On 20 shared intermediate states sampled at plies 12/20 across ten local openings, strategies chose different moves in 8 states (up to three distinct choices); their distinctions are modest and tactical equality can make all five agree.

Unthrottled Node comparison on 30 shared Balanced positions: old 300 ms, new 98 ms total; this is not measured mobile p95. Tests cover all five local/no-fetch choices, known repeat trajectory, visible terminal wins under epsilon, loss-deferring shift, capture-points and existing rules. No Jev calls, new dependencies, or rules changes. The initial handcrafted beam without the immediate-recapture proposal was rejected: 1,173 pairs in 50 games, worse than v17's 859. It was not shipped.
