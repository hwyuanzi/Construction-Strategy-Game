# Last Brick

Each player starts with 12 bricks for the entire game and gets six turns. On your turn, choose how many bricks to place and pick one site. The default opening limit is 2 bricks per player, and later turns have a base limit of 3. You can skip up to twice to save your supply. If you have no legal build, **Pass turn** costs no skip.

After a player places bricks, other sites of the same type cool down for the next turn. The next player can still build on the same site if it’s unfinished. Whoever places the last brick takes the building’s stars. That site reopens with an empty foundation after everyone takes one more turn. Most stars wins.

Each player gets one **Double Load** card and one **Brick Cart** card. Double Load doubles your placement limit for one build, up to your remaining supply. Brick Cart supplies the first two bricks for free and lets you spend your usual allowance on top. Select one card before building. It is spent when you place the bricks.

## Play

Use Node.js 22 and npm.

```sh
npm ci
npm run dev
```

Select a number next to **Choose bricks**, then click a building on the isometric map or in the site list. The scoreboard shows each player’s remaining bricks, skips, and cards. The site list marks cooldowns and flags when your selected amount could leave a finish for the next player, including their available bonuses.

**New game** lets you play against the computer or with two to six people on one device. Choose up to 12 sites from five building types, set each player’s opening limit to one to seven bricks, and choose who starts in a computer game. Rematches rotate the starting player.

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

Run `npm run build:drecco` to build the standalone Dr. Ecco version. Open `dist/drecco/iframe.html` directly in a browser to play it.
