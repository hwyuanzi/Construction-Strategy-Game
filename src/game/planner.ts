import { BRICK_BUDGET, BUILDINGS, buildLimit, bricksLeft, delivery, isCopyCoolingDown, isSiteOpen, maxBuildLimit, playMove, SKIP_TURN, turnsUntilOpen } from './engine'
import type { BuildAction, Match, TurnAction } from './engine'

export const DIFFICULTIES = ['easy', 'normal', 'hard'] as const
export type Difficulty = typeof DIFFICULTIES[number]

export const DIFFICULTY_NAMES: Record<Difficulty, string> = {
  easy: 'Easy', normal: 'Normal', hard: 'Hard',
}

interface BuildCandidate {
  action: BuildAction
  reward: number
  stars: number
  left: number
}

function candidates(match: Match, load: NonNullable<ReturnType<typeof delivery>>): TurnAction[] {
  const seen = new Set<string>()
  const builds: BuildCandidate[] = []
  const base = load.bricks
  const cards = match.cards[load.player]
  for (const [site, kind] of match.sites.entries()) {
    if (!isSiteOpen(match, site)) continue
    const left = bricksLeft(match, site)
    const key = kind + left
    if (seen.has(key)) continue
    seen.add(key)
    const stars = BUILDINGS[kind].stars

    for (const card of [undefined, ...cards]) {
      const limit = Math.min(left, buildLimit(match, load, card))
      const first = card === 'doubleLoad' ? base + 1 : 1
      for (let bricks = first; bricks <= limit; bricks++) {
        const action = card ? { site, bricks, card } : { site, bricks }
        builds.push({ action, left, stars, reward: left === bricks ? stars : 0 })
      }
    }
  }

  builds.sort((a, b) => b.reward - a.reward || Number(Boolean(a.action.card)) - Number(Boolean(b.action.card)) ||
    b.stars - a.stars || a.left - b.left || b.action.bricks - a.action.bricks)
  const actions: TurnAction[] = builds.map(({ action }) => action)
  if (actions.length === 0 || match.skips[load.player] > 0) actions.push(SKIP_TURN)
  return actions
}

const NORMAL_DEPTH = 3
const HARD_DEPTH = 12
export const HARD_NODE_LIMIT = 120_000
const LIMIT_REACHED = Symbol('search budget reached')

interface SearchResult {
  action: TurnAction
  depth: number
  nodes: number
}

interface Entry {
  value: number
  bound: 'exact' | 'lower' | 'upper'
}

function opportunity(match: Match, bricks: number, ahead = 0) {
  if (bricks === 0) return 0
  let best = 0
  for (const [site, kind] of match.sites.entries()) {
    if (!isSiteOpen(match, site, ahead)) continue
    best = Math.max(best, BUILDINGS[kind].stars / (1 + Math.max(0, bricksLeft(match, site) - bricks)))
  }
  return best
}

export function searchMove(match: Match, difficulty: Exclude<Difficulty, 'easy'>): SearchResult | undefined {
  if (match.startingBricks.length !== 2) return
  const load = delivery(match)
  if (!load) return

  const remaining = (match.laterLoads.length + 1) * match.startingBricks.length - match.moves.length
  const depthLimit = Math.min(difficulty === 'normal' ? NORMAL_DEPTH : HARD_DEPTH, remaining)
  const options = candidates(match, load)
  const cache = new Map<string, Entry>()
  let nodes = 0

  function search(position: Match, depth: number, alpha: number, beta: number): number {
    if (nodes >= HARD_NODE_LIMIT) throw LIMIT_REACHED
    nodes++
    const next = delivery(position)
    if (!next) return 0
    if (depth === 0) {
      const rival = 1 - next.player
      const reply = delivery(position, 1)
      const reserveEdge = position.reserves[next.player] - position.reserves[rival]
      const cardEdge = position.cards[next.player].length - position.cards[rival].length
      const skipEdge = position.skips[next.player] - position.skips[rival]
      return opportunity(position, maxBuildLimit(position, next)) / 16 -
        opportunity(position, maxBuildLimit(position, reply), 1) / 32 +
        reserveEdge / (8 * BRICK_BUDGET) + cardEdge / 16 + skipEdge / 64
    }

    const closed = position.sites.map((_, site) =>
      `${turnsUntilOpen(position, site)}${isCopyCoolingDown(position, site) ? 'c' : ''}`).join(',')
    const hands = position.cards.map(hand => hand.map(card => card === 'doubleLoad' ? 'D' : 'C').join('')).join('/')
    const key = [position.moves.length, depth, position.reserves, position.progress, closed,
      position.skips, hands].join(':')
    const stored = cache.get(key)
    if (stored?.bound === 'exact') return stored.value
    if (stored?.bound === 'lower') alpha = Math.max(alpha, stored.value)
    if (stored?.bound === 'upper') beta = Math.min(beta, stored.value)
    if (alpha >= beta && stored) return stored.value
    const lower = alpha
    const upper = beta
    let value = -Infinity
    for (const action of candidates(position, next)) {
      value = Math.max(value, evaluateMove(position, action, depth, alpha, beta))
      alpha = Math.max(alpha, value)
      if (alpha >= beta) break
    }
    const bound = value <= lower ? 'upper' : value >= upper ? 'lower' : 'exact'
    cache.set(key, { value, bound })
    return value
  }

  // The only AI matches are one-on-one. Each reply flips the sign of the score.
  function evaluateMove(position: Match, action: TurnAction, depth: number, alpha: number, beta: number) {
    const next = playMove(position, action)
    const reward = next.moves.at(-1)!.stars
    return reward - search(next, depth - 1, reward - beta, reward - alpha)
  }

  let best = options[0]
  if (options.length === 1) return { action: best, depth: 0, nodes: 0 }
  let depthReached = 0
  const firstDepth = Math.min(NORMAL_DEPTH, depthLimit)
  try {
    for (let depth = firstDepth; depth <= depthLimit; depth++) {
      let bestScore = -Infinity
      // Use the previous iteration's best move to tighten the first bound.
      const ordered = [best, ...options.filter(option => option !== best)]
      let winner = best
      for (const action of ordered) {
        const value = evaluateMove(match, action, depth, bestScore, Infinity)
        if (value > bestScore) {
          bestScore = value
          winner = action
        }
      }
      best = winner
      depthReached = depth
    }
  } catch (error) {
    if (error !== LIMIT_REACHED) throw error
  }
  return { action: best, depth: depthReached, nodes }
}

export function chooseMove(match: Match, difficulty: Difficulty): TurnAction | undefined {
  if (difficulty !== 'easy') return searchMove(match, difficulty)?.action
  const load = delivery(match)
  if (load) return candidates(match, load)[0]
}
