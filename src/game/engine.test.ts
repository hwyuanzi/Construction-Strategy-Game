import { describe, expect, it } from 'vitest'
import { BRICK_BUDGET, bricksLeft, createMatch, delivery, playMove, ROUNDS, SKIP_TURN, turnsUntilOpen } from './engine'
import type { Match } from './engine'
import { chooseMove, HARD_NODE_LIMIT, searchMove } from './planner'

function perfectMargin(match: Match, memo = new Map<string, number>()): number {
  const load = delivery(match)
  if (!load) return 0

  const closed = match.sites.map((_, site) => turnsUntilOpen(match, site))
  const key = [match.moves.length, match.progress, match.reserves, closed].join(':')
  const cached = memo.get(key)
  if (cached !== undefined) return cached

  let best = -perfectMargin(playMove(match, SKIP_TURN), memo)
  for (const site of match.sites.keys()) {
    if (closed[site]) continue
    const limit = Math.min(load.bricks, bricksLeft(match, site))
    for (let bricks = 1; bricks <= limit; bricks++) {
      const next = playMove(match, { site, bricks })
      best = Math.max(best, next.moves.at(-1)!.stars - perfectMargin(next, memo))
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
        const site = offset % match.sites.length
        expect(delivery(match)).toEqual({ player, round, bricks })
        match = playMove(match, bricks && !turnsUntilOpen(match, site) ? { site, bricks } : SKIP_TURN)
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

  it('lets every player skip without changing scores, sites, or inventory', () => {
    const initial = createMatch({ startingBricks: [2, 2, 2] })
    let match = initial
    for (let turn = 0; turn < 3 * ROUNDS; turn++) {
      match = playMove(match, SKIP_TURN)
      expect(match.moves.at(-1)).toEqual({ player: turn % 3, site: null, bricks: 0, stars: 0 })
      expect(match.progress).toBe(initial.progress)
      expect(match.scores).toBe(initial.scores)
      expect(match.reserves).toBe(initial.reserves)
    }
    expect(delivery(match)).toBeUndefined()
    expect(playMove(match, SKIP_TURN)).toBe(match)
  })

  it('caps later turns at the remaining inventory and permits passing at zero', () => {
    let match = createMatch({ startingBricks: [7, 2] })
    for (const action of [{ site: 2, bricks: 7 }, { site: 1, bricks: 3 }, { site: 2, bricks: 2 }]) {
      match = playMove(playMove(match, action), SKIP_TURN)
    }
    expect(delivery(match)?.bricks).toBe(1)
    expect(playMove(match, { site: 2, bricks: 2 })).toBe(match)
    match = playMove(playMove(match, { site: 2, bricks: 1 }), SKIP_TURN)
    expect(delivery(match)?.bricks).toBe(0)
    expect(playMove(match, { site: 2, bricks: 1 })).toBe(match)
    expect(playMove(match, SKIP_TURN).moves).toHaveLength(9)
  })

  it('gives the starter a one-star edge with best play and several openings that can draw', () => {
    for (const firstPlayer of [0, 1]) {
      const match = createMatch({ firstPlayer })
      const memo = new Map<string, number>()
      expect(perfectMargin(match, memo)).toBe(1)
      for (const action of [{ site: 0, bricks: 2 }, SKIP_TURN]) {
        const next = playMove(match, action)
        expect(next.moves[0].stars - perfectMargin(next, memo)).toBe(0)
      }
      const next = playMove(match, { site: 1, bricks: 1 })
      expect(-perfectMargin(next, memo)).toBe(1)
    }

    const overbuilt = playMove(createMatch(), { site: 1, bricks: 2 })
    expect(bricksLeft(overbuilt, 1)).toBe(2)
    expect(perfectMargin(overbuilt)).toBe(4)
  })
})

describe('computer strategies', () => {
  it('lets Normal choose fewer bricks than Easy for the same site', () => {
    const match = createMatch({ sites: ['skyscraper'], startingBricks: [3, 3], laterLoads: [2, 3] })
    expect(chooseMove(match, 'easy')).toEqual({ site: 0, bricks: 3 })
    expect(chooseMove(match, 'normal')).toEqual({ site: 0, bricks: 2 })
  })

  it('skips a turn to avoid handing the opponent a finish', () => {
    const match = createMatch({ sites: ['commercial'], startingBricks: [2, 3], laterLoads: [] })
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
    const match = createMatch({ sites: ['house', 'library', 'skyscraper'], startingBricks: [2, 3], laterLoads: [3, 1, 2] })
    const normal = searchMove(match, 'normal')!
    const hard = searchMove(match, 'hard')!
    expect(normal.depth).toBe(3)
    expect(hard.depth).toBe(8)
    expect(hard.nodes).toBeGreaterThan(normal.nodes)
    const next = playMove(match, hard.action)
    expect(next.moves[0].stars - perfectMargin(next)).toBe(perfectMargin(match))
  })

  it('can solve the default opening within the Hard search budget', () => {
    expect(searchMove(createMatch(), 'hard')).toMatchObject({
      action: { site: 1, bricks: 1 },
      depth: 2 * ROUNDS,
    })
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
