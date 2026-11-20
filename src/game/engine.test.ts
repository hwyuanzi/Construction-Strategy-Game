import { describe, expect, it } from 'vitest'
import { BRICK_BUDGET, buildLimit, bricksLeft, createMatch, delivery, isCopyCoolingDown, isSiteOpen, playMove, ROUNDS, SKIP_LIMIT, SKIP_TURN, turnsUntilOpen } from './engine'
import type { Match } from './engine'
import { chooseMove, HARD_NODE_LIMIT, searchMove } from './planner'

function perfectMargin(match: Match, memo = new Map<string, number>()): number {
  const load = delivery(match)
  if (!load) return 0

  const closed = match.sites.map((_, site) => turnsUntilOpen(match, site))
  const copies = match.sites.map((_, site) => isCopyCoolingDown(match, site))
  const key = JSON.stringify([match.moves.length, match.progress, match.reserves, closed, copies, match.skips, match.cards])
  const cached = memo.get(key)
  if (cached !== undefined) return cached

  const skipped = playMove(match, SKIP_TURN)
  let best = skipped === match ? -Infinity : -perfectMargin(skipped, memo)
  for (const site of match.sites.keys()) {
    if (!isSiteOpen(match, site)) continue
    for (const card of [undefined, ...match.cards[load.player]]) {
      const limit = Math.min(buildLimit(match, load, card), bricksLeft(match, site))
      for (let bricks = 1; bricks <= limit; bricks++) {
        const next = playMove(match, { site, bricks, card })
        best = Math.max(best, next.moves.at(-1)!.stars - perfectMargin(next, memo))
      }
    }
  }
  memo.set(key, best)
  return best
}

describe('a match', () => {
  it.each([2, 3, 4, 5, 6])('rotates all %i builders for six turns with their own first trucks', count => {
    const startingBricks = Array.from({ length: count }, (_, index) => index + 1)
    const firstPlayer = count - 1
    let match = createMatch({ startingBricks, firstPlayer })

    for (let round = 1; round <= ROUNDS; round++) {
      for (let offset = 0; offset < count; offset++) {
        const player = (firstPlayer + offset) % count
        const limit = round === 1 ? startingBricks[player] : match.laterLoads[round - 2]
        const bricks = Math.min(limit, match.reserves[player])
        expect(delivery(match)).toEqual({ player, round, bricks })
        const site = match.sites.findIndex((_, site) => isSiteOpen(match, site))
        match = playMove(match, site >= 0 ? { site, bricks: 1 } : SKIP_TURN)
      }
    }
    expect(delivery(match)).toBeUndefined()
    expect(match.moves.filter(move => move.player === firstPlayer)).toHaveLength(ROUNDS)
    expect(playMove(match, { site: 0, bricks: 1 })).toBe(match)
  })

  it('awards the last brick and refreshes only the chosen copy of a custom building', () => {
    const initial = createMatch({ sites: ['library', 'library', 'apartment'], startingBricks: [7, 1] })
    const claimed = playMove(initial, { site: 1, bricks: 7 })
    expect(claimed.moves.at(-1)).toEqual({ player: 0, site: 1, before: 1, bricks: 3, stars: 3 })
    expect(claimed.progress).toEqual([1, 0, 2])
    expect(claimed.scores).toEqual([3, 0])
    expect(claimed.reserves).toEqual([BRICK_BUDGET - 3, BRICK_BUDGET])
    expect(initial.reserves).toEqual([BRICK_BUDGET, BRICK_BUDGET])
    expect(initial.progress).toEqual([1, 1, 2])
    expect(delivery(claimed)?.bricks).toBe(1)
    expect(turnsUntilOpen(claimed, 1)).toBe(2)
    expect(turnsUntilOpen(claimed, 0)).toBe(0)
    expect(playMove(claimed, { site: 1, bricks: 1 })).toBe(claimed)
    const next = playMove(claimed, SKIP_TURN)
    expect(turnsUntilOpen(next, 1)).toBe(1)
    expect(turnsUntilOpen(playMove(next, SKIP_TURN), 1)).toBe(0)
  })

  it('rejects invalid setup and invalid moves without spending a turn', () => {
    expect(() => createMatch({ sites: [] })).toThrow()
    expect(() => createMatch({ sites: Array.from({ length: 13 }, () => 'house') })).toThrow()
    expect(() => createMatch({ startingBricks: [1, 8] })).toThrow()
    expect(() => createMatch({ startingBricks: [1] })).toThrow()

    const match = createMatch()
    for (const site of [-1, 1.5, 3]) {
      expect(playMove(match, { site, bricks: 1 })).toBe(match)
    }
    for (const bricks of [-1, 0, 1.5, 3]) {
      expect(playMove(match, { site: 0, bricks })).toBe(match)
    }
  })

  it('places just the chosen bricks and carries unspent bricks across turns', () => {
    const initial = createMatch()
    const first = playMove(initial, { site: 1, bricks: 1 })
    const second = playMove(first, { site: 0, bricks: 1 })
    expect(first.moves[0].bricks).toBe(1)
    expect(first.reserves).toEqual([BRICK_BUDGET - 1, BRICK_BUDGET])
    expect(bricksLeft(first, 1)).toBe(3)
    expect(first.scores).toEqual([0, 0])
    expect(delivery(first)?.bricks).toBe(2)
    expect(delivery(second)?.bricks).toBe(3)
  })

  it('blocks other matching sites for one turn and lets the next player finish the worked site', () => {
    const initial = createMatch({ sites: ['house', 'house', 'library'] })
    const first = playMove(initial, { site: 0, bricks: 1 })
    expect(first.scores).toEqual([0, 0])
    expect(playMove(first, { site: 1, bricks: 1 })).toBe(first)
    expect(playMove(first, { site: 1, bricks: 1, card: 'brickCart' })).toBe(first)
    const finished = playMove(first, { site: 0, bricks: 1 })
    expect(finished.scores).toEqual([0, 2])
    expect(turnsUntilOpen(finished, 0)).toBe(2)
    const reply = playMove(first, { site: 2, bricks: 1 })
    expect([0, 1].every(site => isSiteOpen(reply, site))).toBe(true)
  })

  it('keeps a single-type board playable and releases matching sites after a free pass', () => {
    const initial = createMatch({ sites: ['house', 'house'] })
    const first = playMove(initial, { site: 0, bricks: 1 })
    expect(isSiteOpen(first, 0)).toBe(true)
    expect(playMove(first, SKIP_TURN).skips).toEqual([SKIP_LIMIT, SKIP_LIMIT - 1])
    const finished = playMove(first, { site: 0, bricks: 1 })
    expect(isSiteOpen(finished, 1)).toBe(false)
    const passed = playMove(finished, SKIP_TURN)
    expect(passed.moves.at(-1)).toMatchObject({ forced: true })
    expect(passed.skips).toBe(initial.skips)
    expect(isSiteOpen(passed, 1)).toBe(true)
  })

  it('lets each player skip twice without changing scores, sites, or inventory', () => {
    const initial = createMatch({ startingBricks: [2, 2, 2] })
    let match = initial
    for (let turn = 0; turn < 3 * SKIP_LIMIT; turn++) {
      match = playMove(match, SKIP_TURN)
      expect(match.moves.at(-1)).toEqual({ player: turn % 3, site: null, bricks: 0, stars: 0 })
      expect(match.progress).toBe(initial.progress)
      expect(match.scores).toBe(initial.scores)
      expect(match.reserves).toBe(initial.reserves)
    }
    expect(match.skips).toEqual([0, 0, 0])
    expect(playMove(match, SKIP_TURN)).toBe(match)
  })

  it('passes for free when sites are unavailable, including after both skips have been used', () => {
    let match = createMatch({ sites: ['house'] })
    for (let turn = 0; turn < 4; turn++) match = playMove(match, SKIP_TURN)
    const closed = playMove(match, { site: 0, bricks: 2 })
    const passed = playMove(closed, SKIP_TURN)
    expect(passed.moves.at(-1)).toMatchObject({ player: 1, site: null, forced: true })
    expect(passed.skips).toBe(closed.skips)
    expect(isSiteOpen(playMove(passed, SKIP_TURN), 0)).toBe(true)
  })

  it('spends Double Load once and only charges the bricks that fit the site', () => {
    const initial = createMatch()
    const action = { site: 1, bricks: 4, card: 'doubleLoad' } as const
    expect(playMove(initial, { site: 1, bricks: 4 })).toBe(initial)
    expect(playMove(initial, { ...action, bricks: 5 })).toBe(initial)
    const first = playMove(initial, { ...action, site: 0 })
    expect(first.moves[0]).toMatchObject({ bricks: 2, stars: 2, card: 'doubleLoad' })
    expect(first.reserves).toEqual([10, 12])
    expect(first.cards).toEqual([['brickCart'], ['doubleLoad', 'brickCart']])
    const p1 = playMove(first, action)
    expect(p1.cards[1]).toEqual(['brickCart'])
    expect(playMove(p1, { ...action, site: 2 })).toBe(p1)
  })

  it('makes the first two Cart bricks free and can build with the Cart at zero inventory', () => {
    const initial = createMatch()
    const finished = playMove(initial, { site: 1, bricks: 4, card: 'brickCart' })
    expect(finished.reserves[0]).toBe(10)
    expect(finished.cards[0]).toEqual(['doubleLoad'])

    const empty: Match = { ...initial, reserves: [0, 12] }
    expect(playMove(empty, { site: 0, bricks: 1, card: 'doubleLoad' })).toBe(empty)
    expect(playMove(empty, SKIP_TURN).skips[0]).toBe(1)
    const cart = playMove(empty, { site: 0, bricks: 2, card: 'brickCart' })
    expect(cart.reserves[0]).toBe(0)
    expect(cart.scores[0]).toBe(2)
    const next = playMove(cart, SKIP_TURN)
    expect(playMove(next, SKIP_TURN).moves.at(-1)).toMatchObject({ player: 0, site: null, forced: true })
  })
})

describe('computer strategies', () => {
  it('lets Normal choose fewer bricks than Easy for the same site', () => {
    const match = { ...createMatch({ sites: ['skyscraper'], startingBricks: [3, 3], laterLoads: [2, 3] }), cards: [[], []] }
    expect(chooseMove(match, 'easy')).toEqual({ site: 0, bricks: 3 })
    const normal = chooseMove(match, 'normal')!
    expect(normal.site).toBe(0)
    expect(normal.bricks).toBeLessThan(3)
  })

  it('skips a turn to avoid handing the opponent a finish', () => {
    const match = { ...createMatch({ sites: ['commercial'], startingBricks: [2, 3], laterLoads: [] }), cards: [[], []] }
    expect(chooseMove(match, 'easy')).toEqual({ site: 0, bricks: 2 })
    expect(chooseMove(match, 'normal')).toEqual(SKIP_TURN)
    expect(chooseMove(match, 'hard')).toEqual(SKIP_TURN)
  })

  it('passes at every difficulty when the only site is closed', () => {
    const match = playMove(createMatch({ sites: ['house'] }), { site: 0, bricks: 2 })
    for (const difficulty of ['easy', 'normal', 'hard'] as const) {
      expect(chooseMove(match, difficulty)).toEqual(SKIP_TURN)
    }
  })

  it('searches deeper on Hard and matches exhaustive play through a short custom game', () => {
    const match = createMatch({ sites: ['house', 'library', 'library'], startingBricks: [2, 3], laterLoads: [3, 1] })
    const normal = searchMove(match, 'normal')!
    const hard = searchMove(match, 'hard')!
    expect(normal.depth).toBe(3)
    expect(hard.depth).toBe(6)
    expect(hard.nodes).toBeGreaterThan(normal.nodes)
    const next = playMove(match, hard.action)
    expect(next.moves[0].stars - perfectMargin(next)).toBe(perfectMargin(match))
  })

  it('uses available cards for a finish and avoids exhausted skips at every difficulty', () => {
    const match = { ...createMatch({ sites: ['commercial'], laterLoads: [] }), skips: [0, 0] }
    for (const difficulty of ['easy', 'normal', 'hard'] as const) {
      const action = chooseMove(match, difficulty)!
      expect(action).toMatchObject({ site: 0, bricks: 4 })
      expect(playMove(match, action).scores[0]).toBe(4)
    }
  })

  it('keeps Hard within a fixed work budget even on a full board', () => {
    const match = createMatch({
      sites: ['house', 'library', 'commercial', 'apartment', 'skyscraper', 'house',
        'library', 'commercial', 'apartment', 'skyscraper', 'commercial', 'apartment'],
      startingBricks: [7, 7],
    })
    const hard = searchMove(match, 'hard')!
    expect(hard.depth).toBeGreaterThan(3)
    expect(hard.nodes).toBeLessThanOrEqual(HARD_NODE_LIMIT)
    expect(playMove(match, hard.action).moves).toHaveLength(1)
  })

  it('takes the highest reward on the final turn at every difficulty', () => {
    const match = playMove(createMatch({ startingBricks: [3, 3], laterLoads: [] }), { site: 2, bricks: 3 })
    for (const difficulty of ['easy', 'normal', 'hard'] as const) {
      expect(chooseMove(match, difficulty)).toEqual({ site: 2, bricks: 3 })
    }
  })
})
