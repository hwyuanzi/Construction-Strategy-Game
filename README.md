# Last Brick

A turn-based construction game by Haowen Yuan for NYU's Heuristic Problem Solving course. Place the last brick at a building site to earn its stars. Play against the computer or share one device with up to six players.

## Run locally

Use Node.js 22 and npm. From the repository root, run:

```sh
npm ci
npm run dev
```

Open [http://localhost:5173](http://localhost:5173), or the local URL Vite prints. Click the speaker button to enable the ambient music and game cues. Sound starts off on every page load.

## Play

Choose a brick count, then select a building on the map or in **Building sites**. Each player starts with 12 bricks and gets six turns. The default opening limit is 2 bricks per player, and later turns allow up to 3 before bonuses. You can skip twice. If you have no legal build, **Pass turn** is free.

After you place bricks, the other sites of the same type cool down for the next player. That player can continue your site if it's unfinished. The player who places the last brick takes the site's stars, and the site reopens with an empty foundation after every player has taken one more turn.

Select a bonus card before you build. **Double Load** doubles the current placement limit using your own brick supply. **Brick Cart** adds up to two bricks to the limit and pays for the first two. Each card can be used once per game.

The live scoreboard above the map tracks stars and remaining resources. The final leaderboard ranks players by stars and gives tied players the same rank. Open **How to play** for the full rules. Use **New game** to change the game mode, difficulty, sites, or opening limits.

## Computer strategies

The computer can pick a site and an amount, play a bonus card, or use an available skip.

- **Easy** takes the biggest immediate prize. If it can’t score, it builds toward the biggest prize.
- **Normal** searches three actions, including your strongest reply, and uses scoring opportunities and remaining bricks to break ties in projected stars.
- **Hard** uses the same estimate with iterative deepening, alpha–beta pruning, and cached positions. It searches up to twelve actions, including the current one, in a worker with a 120,000-node budget.

Open **Think it through** to compare the Easy and Normal suggestions. When sizing a placement, check whether the next player can finish with a bonus card. A well-timed skip can preserve the option to finish an open site yourself.

## Verify

```sh
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

`npm run build` generates the standard static site in `dist/`. Use `npm run preview` to serve that build locally.

## Build the Dr. Ecco submission

With `zip` installed, run:

```sh
npm run package:drecco
```

The build creates `dist/drecco/last-brick.zip` and `dist/drecco/content/games/2026/last-brick/` with these three files:

| File | Contents |
| --- | --- |
| `iframe.html` | Standalone game with inline JavaScript, CSS, fonts, and the Hard-mode worker. Web Audio synthesizes sound locally after the player switches it on. |
| `index.md` | Zola metadata, English rules, and the Haowen Yuan credit. The 768 px frame container gives six-player games room for all turn controls. |
| `thumbnail.png` | A 320 × 240 preview of the game map. |

Open `dist/drecco/content/games/2026/last-brick/iframe.html` directly in a browser to test it offline. For an iframe preview, copy the generated `last-brick/` folder to `content/games/2026/` in a local checkout of Dr. Ecco. Run `zola serve` from that checkout and visit [the local game page](http://127.0.0.1:1111/games/2026/last-brick/).

Submit the folder in a pull request titled **2026: Last Brick** or send the ZIP to the maintainer. [Dr. Ecco submission guide](https://github.com/shela-wu/drecco/blob/master/CONTRIBUTING.md)
