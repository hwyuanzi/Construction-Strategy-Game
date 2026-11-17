# Construction Strategy Game

A browser strategy game about managing two construction sites, bidding for a shared crane, and racing to finish a skyline. The company with the most cash wins.

## Run locally

Use Node.js 22 and npm.

```sh
npm ci
npm run dev
```

The first screen is a playable Quick Match against Greedy. **New match** selects Quick (8 weeks) or Standard (12 weeks), AI or two-player pass-and-play, and the city seed. Reusing a seed reproduces the same market and tie priority. Choose projects, decide whether to bid, and review the crew plan before locking each week.

- The crane goes to the highest bid, and the winner pays their bid.
- Finishing a job earns cash and frees a slot for next week's permit. Both starter sites have work available in week one.
- Emergency overtime buys one more shift and consumes a limited charge only if used.
- A company below $8 can use a shift to earn up to $4 toward its recovery.
- The first completed skyscraper earns a $12 skyline prize. Finishes in the same week split it.

## Verify

```sh
npm test
npx playwright install chromium
npm run test:e2e
npm run build
npm run preview
```

The production build in `dist/` can be served by a static server. The browser and headless tests share the deterministic TypeScript engine in `src/game/`.

Phase 1 includes both match lengths and the Greedy opponent. Larger browser matches, stronger bots, replays, and the tournament CLI are later phases.
