import { BUILDINGS, delivery, deliveryAt } from './engine'
import type { BuildAction, Match } from './engine'

export const DIFFICULTIES = ['easy', 'normal', 'hard'] as const
export type Difficulty = typeof DIFFICULTIES[number]

export const DIFFICULTY_NAMES: Record<Difficulty, string> = {
  easy: 'Easy', normal: 'Normal', hard: 'Hard',
}

interface Candidate extends BuildAction {
  reward: number
  stars: number
  left: number
}

function candidates(match: Match, progress: readonly number[], bricks: number): Candidate[] {
  const seen = new Set<string>()
  return match.sites.flatMap((kind, site) => {
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
}

const NORMAL_DEPTH = 3
const HARD_DEPTH = 10
export const HARD_NODE_LIMIT = 60_000
const LIMIT_REACHED = Symbol('search budget reached')

interface SearchResult {
  action: BuildAction
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
  const options = candidates(match, progress, load.bricks)
  const cache = new Map<string, Entry>()
  let nodes = 0

  // Ready buildings are promising for the builder about to receive a truck.
  // This estimate stays smaller than a single star.
  function estimate(bricks: number) {
    let opportunity = 0
    for (const [site, kind] of match.sites.entries()) {
      const project = BUILDINGS[kind]
      const left = project.bricks - progress[site]
      opportunity = Math.max(opportunity, project.stars / (1 + Math.max(0, left - bricks)))
    }
    return opportunity / 20
  }

  function search(turn: number, depth: number, alpha: number, beta: number): number {
    if (nodes >= HARD_NODE_LIMIT) throw LIMIT_REACHED
    nodes++
    const next = deliveryAt(match, turn)
    if (!next) return 0
    if (depth === 0) return estimate(next.bricks)

    const key = `${turn}:${depth}:${progress.join('')}`
    const stored = cache.get(key)
    if (stored?.bound === 'exact') return stored.value
    if (stored?.bound === 'lower') alpha = Math.max(alpha, stored.value)
    if (stored?.bound === 'upper') beta = Math.min(beta, stored.value)
    if (alpha >= beta && stored) return stored.value
    const lower = alpha
    const upper = beta
    let value = -Infinity
    for (const candidate of candidates(match, progress, next.bricks)) {
      value = Math.max(value, evaluateMove(candidate, turn, depth, alpha, beta))
      alpha = Math.max(alpha, value)
      if (alpha >= beta) break
    }
    const bound = value <= lower ? 'upper' : value >= upper ? 'lower' : 'exact'
    cache.set(key, { value, bound })
    return value
  }

  // The only AI matches are one-on-one. A gain for one builder is a
  // loss for the other, so each reply flips the sign of the score.
  function evaluateMove(candidate: Candidate, turn: number, depth: number, alpha: number, beta: number) {
    const { site, bricks, reward } = candidate
    const before = progress[site]
    progress[site] = reward ? 0 : before + bricks
    try {
      return reward - search(turn + 1, depth - 1, reward - beta, reward - alpha)
    } finally {
      progress[site] = before
    }
  }

  let best = options[0]
  let depthReached = 0
  const firstDepth = Math.min(NORMAL_DEPTH, depthLimit)
  try {
    for (let depth = firstDepth; depth <= depthLimit; depth++) {
      let bestScore = -Infinity
      // Use the previous iteration's best move to tighten the first bound.
      const ordered = [best, ...options.filter(option => option !== best)]
      let winner = best
      for (const candidate of ordered) {
        const value = evaluateMove(candidate, firstTurn, depth, bestScore, Infinity)
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
  return { action: { site: best.site, bricks: best.bricks }, depth: depthReached, nodes }
}

export function chooseMove(match: Match, difficulty: Difficulty): BuildAction | undefined {
  if (difficulty !== 'easy') return searchMove(match, difficulty)?.action
  const load = delivery(match)
  if (!load) return
  const { site, bricks } = candidates(match, match.progress, load.bricks)[0]
  return { site, bricks }
}
