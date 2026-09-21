# Territori

A small strategy game about controlling space. Play against Jev or watch two robots compete, each with one of five styles: Aggressive, Cautious, Expansive, Fluid, or Balanced.

[Play Territori](https://territori.matthew-l-reed.chatgpt.site)

## Rules

Start with an empty 8×8 board and 25 stones each. Teal goes first. On your turn, choose one action:

- **Place** an unused stone on an empty square.
- **Remove** an opponent’s stone when more of your stones than theirs sit beside it. Count only up, down, left, and right. Ties are safe; captured stones stay out of play.
- **Shift** one of your stones to an adjacent empty square, again without moving diagonally.

A stone controls its own square. An empty square counts as territory if it touches stones of only one color. Squares touched by both colors, or neither, are neutral.

When either player places their last unused stone, finish the round. Most territory wins. A tie goes to the largest connected area, then a draw. Repeating the same board, remaining supplies, and player to move three times also ends the game.

## How Jev plays

The server sends Jev the board, strategy, and every legal move. Each option includes its immediate territory score and the consequences of the opponent’s strongest immediate capture. Jev chooses; the game checks that its response is legal. There is no substitute bot if the API fails.

Strategies are preferences, not obligations. Winning takes priority over following a style.

## Run locally

Use Node.js 24 and pnpm (the version is pinned in `package.json`).

```sh
pnpm install
cp .env.example .env
# Add your TYPESAFE_API_KEY to .env.
pnpm dev
```

Open `http://localhost:5173`. The app uses React, TypeScript, Vinext, and a Cloudflare Workers backend. The API key stays on the server; never put it in browser code or commit `.env`.

```sh
node --experimental-strip-types --test tests/*.test.mjs
pnpm build
```

## Where things live

- `lib/game/rules.ts` — board size, moves, captures, scoring, and endings.
- `lib/game/strategies.ts` — descriptions shared by the help and robot prompts.
- `lib/game/jev.ts` — legal choices and capture lookahead.
- `app/api/robot/route.ts` — server-side Jev call and validation.
- `app/page.tsx` — board, animations, controls, and results.
- `lib/game/share.ts` — copyable results and emoji territory map.

Games live in page memory; refreshing starts over. The live version is hosted on ChatGPT Sites. Its `TYPESAFE_API_KEY` is configured separately in secret storage and is not included in this repository.

## Local AI bootstrap

Jev decisions are saved in the playing browser. The [AI lab](https://territori.matthew-l-reed.chatgpt.site/training) exports JSONL and can load a trained local policy. Headless collection, feature extraction, linear imitation training, and evaluation are documented in [docs/bootstrap.md](docs/bootstrap.md). Jev remains the default.
