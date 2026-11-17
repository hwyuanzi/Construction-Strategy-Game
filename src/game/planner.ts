import { activeSites, currentStage, validatePlan } from './engine'
import { BUILDINGS, MODES, SUBCONTRACT_LIMIT, minimumWeeks } from './rules'
import type { PlayerView, Project, WeekPlan } from './types'

interface PlanOptions extends Omit<WeekPlan, 'work' | 'fallback'> {
  focus?: string
}

export function remainingWeeks(view: PlayerView, site: Project) {
  const stages = MODES[view.mode].contracts[site.type].stages.slice(site.stage)
  if (!stages.length) return 0
  stages[0] = { ...stages[0], work: stages[0].work - site.work }
  return minimumWeeks(stages, view.companies[view.seat].overtime)
}

export function suggestPlan(view: PlayerView, options: PlanOptions = {}): WeekPlan {
  const { focus, ...intent } = options
  const sites = activeSites(view).filter(site => !intent.abandon?.includes(site.id))
  const company = view.companies[view.seat]
  const subcontract = intent.subcontract ?? company.cash < SUBCONTRACT_LIMIT
  const ordered = [...sites].sort((a, b) => {
    const slack = (site: Project) => site.due - view.week + 1 - remainingWeeks(view, site)
    return slack(a) - slack(b) || a.id.localeCompare(b.id, 'en')
  })
  const caps = sites.map(site => {
    const stage = currentStage(view.mode, site)
    return stage.crane && intent.bid?.site !== site.id ? 0 : Math.min(4, stage.work - site.work)
  })
  let best: { plan: WeekPlan; rank: number[] } | undefined
  for (let first = 0; first <= (caps[0] ?? 0); first++) {
    for (let second = 0; second <= (caps[1] ?? 0); second++) {
      const work: Record<string, number> = {}
      if (first) work[sites[0].id] = first
      if (second) work[sites[1].id] = second
      if (intent.bid && !work[intent.bid.site]) continue
      const base = { ...intent, subcontract, work }
      const target = intent.bid && sites.find(site => !currentStage(view.mode, site).crane)
      const maxFallback = target && intent.bid
        ? Math.min(work[intent.bid.site], currentStage(view.mode, target).work - target.work - (work[target.id] ?? 0))
        : 0
      for (let shifts = maxFallback; shifts >= 0; shifts--) {
        const plan = shifts && target ? { ...base, fallback: { site: target.id, shifts } } : base
        const check = validatePlan(view, plan)
        if (check.errors.length) continue
        const completedStages = sites.filter(site => site.work + (work[site.id] ?? 0) === currentStage(view.mode, site).work)
        const completedJobs = completedStages.filter(site => site.stage === MODES[view.mode].contracts[site.type].stages.length - 1)
        const rank = [
          focus ? work[focus] ?? 0 : 0,
          completedJobs.length,
          completedStages.length,
          ...ordered.map(site => work[site.id] ?? 0),
          shifts,
          -check.win.spend,
        ]
        const firstDifference = best?.rank.findIndex((value, index) => value !== rank[index]) ?? -1
        if (!best || (firstDifference >= 0 && rank[firstDifference] > best.rank[firstDifference])) {
          best = { plan, rank }
        }
        break
      }
    }
  }
  return best?.plan ?? { ...intent, subcontract, work: {} }
}

export function legalPass(view: PlayerView): WeekPlan {
  return { work: {}, subcontract: view.companies[view.seat].cash < SUBCONTRACT_LIMIT }
}

export function greedyPlan(view: PlayerView): WeekPlan {
  const me = view.companies[view.seat]
  const sites = activeSites(view)
  const craneSite = sites.find(site => currentStage(view.mode, site).crane)
  const bids = craneSite && me.cash >= BUILDINGS[craneSite.type].unit + 2
    ? [{ site: craneSite.id, amount: 2 }, undefined]
    : [undefined]
  const permitOrder = view.week <= 2 && me.cash >= 32
    ? ['skyscraper', 'commercial', 'house']
    : ['commercial', 'house', 'skyscraper']
  const offers = [...view.offers].sort((a, b) => permitOrder.indexOf(a.type) - permitOrder.indexOf(b.type))
  for (const bid of bids) {
    const base = suggestPlan(view, { bid })
    const baseCheck = validatePlan(view, base)
    if (baseCheck.errors.length) continue
    for (const offer of offers) {
      const available = MODES[view.mode].weeks - view.week
      if (offer.type === 'skyscraper' && me.cash < 30) continue
      if (minimumWeeks(MODES[view.mode].contracts[offer.type].stages, me.overtime) > available) continue
      let candidate = suggestPlan(view, { bid, permit: offer.type })
      let check = validatePlan(view, candidate)
      const compressesStage = craneSite && bid && currentStage(view.mode, craneSite).work - craneSite.work === 4
      if (compressesStage && me.overtime && !check.win.overtime) {
        const accelerated = suggestPlan(view, { bid, permit: offer.type, overtime: true, focus: craneSite.id })
        const faster = validatePlan(view, accelerated)
        if (!faster.errors.length && faster.win.work[craneSite.id] === 4 && (faster.win.slot || !check.win.slot)) {
          candidate = accelerated
          check = faster
        }
      }
      if (!check.errors.length && (check.win.slot || check.lose.slot)) return candidate
    }
    if (craneSite && bid && me.overtime && currentStage(view.mode, craneSite).work - craneSite.work === 4) {
      const accelerated = suggestPlan(view, { bid, overtime: true, focus: craneSite.id })
      const faster = validatePlan(view, accelerated)
      if (!faster.errors.length && faster.win.work[craneSite.id] === 4) return accelerated
    }
    return base
  }
  return legalPass(view)
}
