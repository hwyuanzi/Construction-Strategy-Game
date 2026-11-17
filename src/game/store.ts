import { create } from 'zustand'
import { createMatch, getPlayerView, onlyPass, resolveWeek, validatePlan } from './engine'
import { greedyPlan, legalPass } from './planner'
import type { Mode } from './rules'
import type { MatchState, PlayerView, WeekPlan, WeekReport } from './types'

export type Opponent = 'bot' | 'hotseat'
type Phase = 'planning' | 'handoff' | 'settling' | 'recap' | 'results'

function runBot(view: PlayerView): Promise<WeekPlan> {
  return new Promise(resolve => {
    let worker: Worker
    try {
      worker = new Worker(new URL('./bot.worker.ts', import.meta.url), { type: 'module' })
    } catch {
      resolve(greedyPlan(view))
      return
    }
    const finish = (plan: WeekPlan) => {
      window.clearTimeout(timer)
      worker.terminate()
      resolve(plan)
    }
    const timer = window.setTimeout(() => finish(greedyPlan(view)), 1500)
    worker.onmessage = (event: MessageEvent<WeekPlan>) => finish(event.data)
    worker.onerror = () => finish(greedyPlan(view))
    worker.postMessage(view)
  })
}

interface GameStore {
  match: MatchState
  opponent: Opponent
  phase: Phase
  viewer: number
  serial: number
  locked: (WeekPlan | undefined)[]
  report?: WeekReport
  previous?: MatchState
  start: (mode: Mode, opponent: Opponent, seed: number) => void
  ready: () => void
  lock: (plan: WeekPlan) => Promise<void>
  next: () => void
}

export const useGame = create<GameStore>((set, get) => ({
  match: createMatch({ mode: 'quick', seed: 17 }),
  opponent: 'bot',
  phase: 'planning',
  viewer: 0,
  serial: 0,
  locked: [],
  start: (mode, opponent, seed) => {
    set({
      match: createMatch({ mode, seed }), opponent, phase: 'planning', viewer: 0,
      serial: get().serial + 1, locked: [], report: undefined, previous: undefined,
    })
  },
  ready: () => {
    if (get().phase === 'handoff') set({ phase: 'planning' })
  },
  lock: async plan => {
    const { phase, viewer, match, opponent, locked, serial } = get()
    if (phase !== 'planning' || validatePlan(getPlayerView(match, viewer), plan).errors.length) return
    const plans = [...locked]
    plans[viewer] = plan
    const other = getPlayerView(match, 1)
    if (opponent === 'hotseat' && !plans[1] && !onlyPass(other)) {
      set({ phase: 'handoff', viewer: 1, locked: plans })
      return
    }
    set({ phase: 'settling', locked: [] })
    if (!plans[1]) plans[1] = onlyPass(other) ? legalPass(other) : await runBot(other)
    if (get().serial !== serial) return
    const otherPlan = validatePlan(other, plans[1]).errors.length ? legalPass(other) : plans[1]
    const result = resolveWeek(match, [plans[0]!, otherPlan])
    set({ match: result.state, previous: match, report: result.report, phase: 'recap' })
  },
  next: () => {
    const { match, phase, opponent } = get()
    if (phase !== 'recap') return
    set({ viewer: 0, phase: match.finished ? 'results' : opponent === 'hotseat' ? 'handoff' : 'planning', locked: [] })
  },
}))
