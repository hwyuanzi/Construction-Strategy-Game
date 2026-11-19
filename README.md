# Last Brick

Each player starts with 12 bricks for the entire game and gets six turns. On your turn, choose how many bricks to place and pick one site, or select **Skip turn** to save your supply. The default opening limit is 2 bricks per player, and later turns have a fixed limit of 3. You spend only the bricks actually placed.

Whoever places the last brick takes the building’s stars. The site reopens with an empty foundation after everyone takes one more turn. Most stars wins.

## Play

Use Node.js 22 and npm.

```sh
npm ci
npm run dev
```

Select a number next to **Choose bricks**, then click a building on the isometric map or in the site list. The scoreboard shows each player’s remaining bricks, and the site list flags when your selected amount could leave a finish for the next player.

**New game** lets you play against the computer or with two to six people on one device. Choose up to 12 sites from five building types, set each player’s opening limit to one to seven bricks, and choose who starts in a computer game. Rematches rotate the starting player.

## Computer strategies

The computer can pick a site and an amount or skip its turn.

- **Easy** takes the biggest immediate prize. If it can’t score, it builds toward the biggest prize.
- **Normal** searches three actions, including your strongest reply, and uses scoring opportunities and remaining bricks to break ties in projected stars.
- **Hard** uses the same estimate with iterative deepening, alpha–beta pruning, and cached positions. It searches up to twelve actions, including the current one, in a worker with a 120,000-node budget.

Open **Think it through** to compare the Easy and Normal suggestions. On the default two-player board, exhaustive search finds that opening with one brick on the Workshop gives the starter a one-star edge with best play. It leaves three bricks to finish, outside the rival’s opening limit and within the starter’s next limit. Putting two bricks there lets the rival finish immediately. Finishing the House or skipping on the opening turn can secure a draw with best play.

## Verify

```sh
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```
