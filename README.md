# Last Brick

On your turn, choose how many bricks to place, from one to your truck’s full load, then pick one building. Whoever places the last brick takes that building’s stars. Any unused bricks stay behind, and a fresh building of the same type takes its place. Everyone gets six turns. Most stars wins.

## Play

Use Node.js 22 and npm.

```sh
npm ci
npm run dev
```

Select a number next to **Place**, then click a building on the isometric map or in the site list. The full load is selected at the start of each turn. **New game** lets you play against the computer or with two to six people on one device. Choose up to 12 sites from five building types and set each player’s first truck to one to seven bricks. The default deliveries are 2, 3, 3, 2, 2, and 1 brick per player. Rematches keep the deliveries and rotate the starting player.

## Computer strategies

The computer chooses both a site and how many bricks to place.

- **Easy** takes the biggest immediate prize. If it can’t score, it builds toward the biggest prize.
- **Normal** searches three actions, including your strongest reply, and estimates the next builder’s scoring opportunities from the resulting board.
- **Hard** uses the same estimate with iterative deepening, alpha–beta pruning, and cached positions. It searches up to ten total actions, including the current one, in a worker with a 60,000-node budget.

Open **Think it through** to compare the Easy and Normal suggestions for a two-player position. On the default board, finishing the House with two bricks or putting one brick on the Workshop can both secure a draw against perfect play. One brick on the Workshop leaves three to finish it, just out of reach of the rival’s first truck. Putting two there leaves the rival exactly enough to finish it.

## Verify

```sh
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```
