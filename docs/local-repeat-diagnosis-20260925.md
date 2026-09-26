# Local Aggressive–Balanced replay (2026-09-25)

This is a bounded diagnosis, not an independent strength evaluation or a change to game rules/AI policy. It uses the published bundled policy and residual assets, search v2 (`policyBeam:12`, `staticBeam:8`, `priorWeight:.75`), intent v1 (`strength:1`, `margin:1`), and exploration probability .03. Blue is Aggressive; red is Balanced. Each side uses a separately seeded deterministic random stream (`seed`, `seed+37`). No network or Jev calls.

| Seed | Result | Turns | Blue placement immediately captured by red | Supply at end |
| --- | --- | ---: | ---: | --- |
| 2412 | Draw, 17–17 | 54 | 20 pairs | Blue 0, red 18 |
| 2413 | Blue win, 20–19 | 58 | 20 pairs | Blue 0, red 17 |
| 2414 | Red win, 3–28 | 60 | 20 pairs | Blue 0, red 19 |

At seed 2412, ply 4, Blue placed at board index 17 and Red captured 17; this repeated on plies 6–9 and beyond. Blue's scorer explicitly anticipated `remove_17` as the worst opposing reply. It rated that move `searchValue = -0.1` but final preference score `1.280`; alternatives `place_29` and `place_28` had better two-ply search values `0` yet final scores only `0.743` and `0.732`. At ply 6, the same square scored `1.180` versus `0.643` for `place_29`, despite both changing no lasting board ownership after a capture. Thus this is not an illegal capture or a missing one-reply calculation: the ranking allows learned/style/intent preferences to overpower a small tactical difference, while the two-ply score counts supply only lightly. Permanent depletion and the later terminal consequence are not evaluated beyond that horizon.

A single intervention choosing `place_29` instead at seed 2412's ply 4 reduced immediate place–capture pairs from 20 to 19, but the rest of the policy still drew 17–17. This is not evidence that one specific alternative wins. The next fix should be separately evaluated against multiple local opponents/seeded positions, with finite supply and terminal outcomes assessed, before changing policy weights or repetition rules. The observed game can end by supply depletion without triggering the threefold repetition rule because supplies change after placements.

The earlier sealed Jev acceptance is historical and is not revalidated by this replay. The preserved source commit preceding live Jev removal (`c7a1c4264a3f24f4480495d49e4de4c1da2b6908`) is needed to reproduce its exact hashed protocol; historical datasets and offline teacher/evaluation scripts remain in the repository but are not imported by the web app.
