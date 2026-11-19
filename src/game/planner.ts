import { BRICK_BUDGET, BUILDINGS, delivery, deliveryAt, reopeningTurn, SKIP_TURN } from './engine'
import type { BuildAction, Match, TurnAction } from './engine'

export const DIFFICULTIES = ['easy', 'normal', 'hard'] as const
export type Difficulty = typeof DIFFICULTIES[number]

export const DIFFICULTY_NAMES: Record<Difficulty, string> = {
  easy: 'Easy', normal: 'Normal', hard: 'Hard',
}

interface BuildCandidate extends BuildAction {
  reward: number
  stars: number
  left: number
}

const PASS = { ...SKIP_TURN, reward: 0 }
type Candidate = BuildCandidate | typeof PASS

function candidates(match: Match, progress: readonly number[], reopensAt: readonly number[], turn: number, bricks: number): Candidate[] {
  const seen = new Set<string>()
  const builds = match.sites.flatMap((kind, site) => {
    if (reopensAt[site] > turn) return []
    const project = BUILDINGS[kind]
    const left = project.bricks - progress[site]
    const key = kind + left
    if (seen.has(key)) return []
    seen.add(key)
    return Array.from({ length: Math.min(left, bricks) }, (_, index) => {
      const amount = index + 1
      return { site, bricks: amount, left, stars: project.stars, reward: left === amount ? project.stars : 0 }
    })
  }).sort((a, b) => b.reward - a.reward || b.stars - a.stars || a.left - b.left || b.bricks - a.bricks)
  return [...builds, PASS]
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

export function searchMove(match: Match, difficulty: Exclude<Difficulty, 'easy'>): SearchResult | undefined {
  if (match.startingBricks.length !== 2) return
  const load = delivery(match)
  if (!load) return

  const firstTurn = match.moves.length
  const remaining = (match.laterLoads.length + 1) * match.startingBricks.length - firstTurn
  const depthLimit = Math.min(difficulty === 'normal' ? NORMAL_DEPTH : HARD_DEPTH, remaining)
  const progress = [...match.progress]
  const reopensAt = [...match.reopensAt]
  const reserves = [...match.reserves]
  const options = candidates(match, progress, reopensAt, firstTurn, load.bricks)
  const cache = new Map<string, Entry>()
  let nodes = 0

  function opportunity(turn: number, bricks: number) {
    if (bricks === 0) return 0
    let best = 0
    for (const [site, kind] of match.sites.entries()) {
      if (reopensAt[site] > turn) continue
      const project = BUILDINGS[kind]
      const left = project.bricks - progress[site]
      best = Math.max(best, project.stars / (1 + Math.max(0, left - bricks)))
    }
    return best
  }

  function search(turn: number, depth: number, alpha: number, beta: number): number {
    if (nodes >= HARD_NODE_LIMIT) throw LIMIT_REACHED
    nodes++
    const next = deliveryAt(match, turn, reserves)
    if (!next) return 0
    if (depth === 0) {
      const reply = deliveryAt(match, turn + 1, reserves)
      const reserveEdge = reserves[next.player] - (reply ? reserves[reply.player] : 0)
      // Use threats and inventory to rank positions with the same star margin.
      return opportunity(turn, next.bricks) / 16 - opportunity(turn + 1, reply?.bricks ?? 0) / 32 + reserveEdge / (8 * BRICK_BUDGET)
    }

    const closed = reopensAt.map(open => Math.max(0, open - turn)).join('')
    const key = `${turn}:${depth}:${reserves.join(',')}:${progress.join('')}:${closed}`
    const stored = cache.get(key)
    if (stored?.bound === 'exact') return stored.value
    if (stored?.bound === 'lower') alpha = Math.max(alpha, stored.value)
    if (stored?.bound === 'upper') beta = Math.min(beta, stored.value)
    if (alpha >= beta && stored) return stored.value
    const lower = alpha
    const upper = beta
    let value = -Infinity
    for (const candidate of candidates(match, progress, reopensAt, turn, next.bricks)) {
      value = Math.max(value, evaluateMove(candidate, next.player, turn, depth, alpha, beta))
      alpha = Math.max(alpha, value)
      if (alpha >= beta) break
    }
    const bound = value <= lower ? 'upper' : value >= upper ? 'lower' : 'exact'
    cache.set(key, { value, bound })
    return value
  }

  // The only AI matches are one-on-one. A gain for one builder is a
  // loss for the other, so each reply flips the sign of the score.
  function evaluateMove(candidate: Candidate, player: number, turn: number, depth: number, alpha: number, beta: number) {
    const { site, bricks, reward } = candidate
    if (site === null) return -search(turn + 1, depth - 1, -beta, -alpha)
    const before = progress[site]
    const previousReopening = reopensAt[site]
    progress[site] = reward ? 0 : before + bricks
    if (reward) reopensAt[site] = reopeningTurn(match, turn)
    reserves[player] -= bricks
    try {
      return reward - search(turn + 1, depth - 1, reward - beta, reward - alpha)
    } finally {
      progress[site] = before
      reopensAt[site] = previousReopening
      reserves[player] += bricks
    }
  }

  let best = options[0]
  if (options.length === 1) return { action: SKIP_TURN, depth: 0, nodes: 0 }
  let depthReached = 0
  const firstDepth = Math.min(NORMAL_DEPTH, depthLimit)
  try {
    for (let depth = firstDepth; depth <= depthLimit; depth++) {
      let bestScore = -Infinity
      // Use the previous iteration's best move to tighten the first bound.
      const ordered = [best, ...options.filter(option => option !== best)]
      let winner = best
      for (const candidate of ordered) {
        const value = evaluateMove(candidate, load.player, firstTurn, depth, bestScore, Infinity)
        if (value > bestScore) {
          bestScore = value
          winner = candidate
        }
      }
      best = winner
      depthReached = depth
    }
  } catch (error) {
    if (error !== LIMIT_REACHED) throw error
  }
  return { action: best.site === null ? SKIP_TURN : { site: best.site, bricks: best.bricks }, depth: depthReached, nodes }
}

export function chooseMove(match: Match, difficulty: Difficulty): TurnAction | undefined {
  if (difficulty !== 'easy') return searchMove(match, difficulty)?.action
  const load = delivery(match)
  if (!load) return
  const { site, bricks } = candidates(match, match.progress, match.reopensAt, match.moves.length, load.bricks)[0]
  return site === null ? SKIP_TURN : { site, bricks }
}
