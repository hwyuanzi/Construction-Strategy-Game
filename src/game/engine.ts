import {
  BUILDINGS, GRACE_WEEKS, MODES, OVERTIME_COST, REGULAR_SHIFTS,
  SKYLINE_PRIZE, SUBCONTRACT_LIMIT, minimumWeeks, subcontractPayout,
} from './rules'
import type { Building, Mode } from './rules'
import type { Branch, GameEvent, MatchState, Offer, PlanCheck, PlayerView, Project, WeekPlan, WeekReport } from './types'

const COMPANY_NAMES = ['Crestline Co.', 'Ironworks Co.', 'Eastbank Co.', 'Keystone Co.']

function draw(seed: number, key: number) {
  let value = (seed ^ Math.imul(key + 1, 0x9e3779b9)) >>> 0
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad)
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97)
  return (value ^ (value >>> 15)) >>> 0
}

export function createMatch({ mode, seed, seats = 2 }: { mode: Mode; seed: number; seats?: number }): MatchState {
  if (!Number.isInteger(seats) || seats < 2 || seats > 4) throw new Error('A match needs two to four companies.')
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff || !Object.hasOwn(MODES, mode)) {
    throw new Error('Invalid match setup.')
  }
  const rules = MODES[mode]
  const companies = Array.from({ length: seats }, (_, seat) => ({
    seat, name: COMPANY_NAMES[seat], cash: 40, overtime: rules.charges, signedTower: false,
  }))
  const projects: Project[] = companies.flatMap(({ seat }) => [
    {
      id: `starter-house-${seat}`, seat, type: 'house', name: 'Starter House',
      stage: 2, work: 0, due: 4, payout: rules.starters.house, started: 1, status: 'active',
    },
    {
      id: `starter-commercial-${seat}`, seat, type: 'commercial', name: 'Starter Commercial',
      stage: 1, work: 1, due: 3, payout: rules.starters.commercial, started: 1, status: 'active',
    },
  ])
  return { mode, seed, week: 1, finished: false, firstPriority: draw(seed, 0) % seats, companies, projects, history: [] }
}

function getOffers(state: MatchState, seat: number): Offer[] {
  if (state.finished) return []
  const rules = MODES[state.mode]
  const openingRush = draw(state.seed, 1) % 2
  const types: Building[] = ['house', 'commercial', 'skyscraper']
  return types.flatMap((type, index) => {
    const contract = rules.contracts[type]
    const minimum = minimumWeeks(contract.stages, rules.charges)
    if (state.week + minimum > rules.weeks || (type === 'skyscraper' && state.companies[seat].signedTower)) return []
    const rush = type !== 'skyscraper' && (state.week === 1 ? openingRush === index : draw(state.seed, state.week * 3 + index) % 3 === 0)
    return [{
      type, name: BUILDINGS[type].label, duration: rush ? contract.rushDue! : contract.due,
      payout: contract.payout + (rush ? contract.rushBonus! : 0), minimum, rush,
    }]
  })
}

export function getPlayerView(state: MatchState, seat: number): PlayerView {
  const count = state.companies.length
  if (!state.companies[seat]) throw new Error('Unknown company.')
  const priority = Array.from({ length: count }, (_, index) => (state.firstPriority + state.week - 1 + index) % count)
  return {
    mode: state.mode, week: state.week, finished: state.finished, seat, companies: state.companies,
    projects: state.projects, priority, cranes: count === 4 ? 2 : 1, offers: getOffers(state, seat),
    prizeWeek: state.prizeWeek, history: state.history,
  }
}

export function activeSites(view: PlayerView) {
  return view.projects.filter(site => site.seat === view.seat && site.status === 'active')
}

export function currentStage(mode: Mode, site: Project) {
  return MODES[mode].contracts[site.type].stages[site.stage]
}

export function onlyPass(view: PlayerView) {
  const cash = view.companies[view.seat].cash
  return !activeSites(view).length && cash >= SUBCONTRACT_LIMIT && view.offers.every(offer => BUILDINGS[offer.type].permit > cash)
}

export function validatePlan(view: PlayerView, plan: WeekPlan): PlanCheck {
  const errors: string[] = []
  const company = view.companies[view.seat]
  const sites = activeSites(view)
  const abandoned = new Set(plan.abandon)
  const remaining = sites.filter(site => !abandoned.has(site.id))
  const offer = view.offers.find(item => item.type === plan.permit)
  const reserve = offer ? BUILDINGS[offer.type].permit : 0

  if (view.finished) errors.push('The match is over.')
  if (plan.permit && !offer) errors.push('This permit is unavailable.')
  if ([...abandoned].some(id => !sites.some(site => site.id === id)) || abandoned.size !== (plan.abandon?.length ?? 0)) {
    errors.push('Choose an active site to abandon.')
  }
  if (plan.subcontract !== undefined && typeof plan.subcontract !== 'boolean') errors.push('Choose at most one subcontract.')
  if (plan.subcontract && company.cash >= SUBCONTRACT_LIMIT) errors.push('Subcontracting opens below $8.')
  if (plan.overtime && company.overtime < 1) errors.push('No overtime charges left.')

  const bidSite = remaining.find(site => site.id === plan.bid?.site)
  const bidAmount = plan.bid?.amount ?? 0
  if (plan.bid && (!bidSite || !currentStage(view.mode, bidSite)?.crane || !Number.isSafeInteger(bidAmount) || bidAmount < 1)) {
    errors.push('Choose a crane-ready site and a positive whole-dollar bid.')
  }

  const work: Record<string, number> = {}
  for (const [id, shifts] of Object.entries(plan.work)) {
    const site = remaining.find(item => item.id === id)
    if (!site || !Number.isInteger(shifts) || shifts < 0 || shifts > currentStage(view.mode, site).work - site.work) {
      errors.push('Assign whole shifts within each active stage.')
    } else if (shifts) {
      if (currentStage(view.mode, site).crane && bidSite?.id !== id) errors.push('Crane work needs a bid for that site.')
      work[id] = shifts
    }
  }
  if (plan.bid && !work[plan.bid.site]) errors.push('Assign at least one shift to the crane bid.')

  const lossWork = { ...work }
  if (plan.bid) delete lossWork[plan.bid.site]
  if (plan.fallback) {
    const { site: id, shifts } = plan.fallback
    const target = remaining.find(item => item.id === id)
    if (!plan.bid || !target || currentStage(view.mode, target).crane ||
      !Number.isInteger(shifts) || shifts < 1 || shifts > (work[plan.bid.site] ?? 0) ||
      shifts + (lossWork[id] ?? 0) > currentStage(view.mode, target).work - target.work) {
      errors.push('Redirect only freed shifts to an eligible crane-free stage.')
    } else {
      lossWork[id] = (lossWork[id] ?? 0) + shifts
    }
  }

  const branch = (assignments: Record<string, number>, fee: number): Branch => {
    const shifts = (plan.subcontract ? 1 : 0) + Object.values(assignments).reduce((sum, count) => sum + count, 0)
    const overtime = shifts > REGULAR_SHIFTS
    let spend = fee + (overtime ? OVERTIME_COST : 0)
    let occupied = remaining.length
    for (const site of remaining) {
      const count = assignments[site.id] ?? 0
      spend += count * BUILDINGS[site.type].unit
      const stage = currentStage(view.mode, site)
      const completes = site.stage === MODES[view.mode].contracts[site.type].stages.length - 1 && site.work + count >= stage.work
      if (completes || view.week >= site.due + GRACE_WEEKS) occupied--
    }
    return { work: assignments, shifts, spend, overtime, slot: occupied < 2 }
  }
  const win = branch(work, bidAmount)
  const lose = branch(lossWork, 0)
  if (Math.max(win.shifts, lose.shifts) > REGULAR_SHIFTS + Number(!!plan.overtime)) errors.push('The plan exceeds your available shifts.')
  if (Math.max(win.spend, lose.spend) + reserve > company.cash) errors.push('Opening cash cannot cover this plan and permit.')
  return { errors: [...new Set(errors)], win, lose, reserve }
}

export function resolveWeek(state: MatchState, plans: readonly WeekPlan[]): { state: MatchState; report: WeekReport } {
  if (state.finished || plans.length !== state.companies.length) throw new Error('Every company needs a plan for an open week.')
  const views = state.companies.map(({ seat }) => getPlayerView(state, seat))
  const checks = views.map((view, seat) => validatePlan(view, plans[seat]))
  for (const [seat, check] of checks.entries()) {
    if (check.errors.length) throw new Error(`Company ${seat + 1}: ${check.errors.join(' ')}`)
  }

  const companies = state.companies.map(company => ({ ...company }))
  const projects = state.projects.map(site => ({ ...site }))
  const events: GameEvent[] = []
  const week = state.week
  const priority = views[0].priority
  const bids = priority.flatMap(seat => {
    const bid = plans[seat].bid
    return bid ? [{ ...bid, seat }] : []
  }).sort((a, b) => b.amount - a.amount)
  const winners = new Set(bids.slice(0, views[0].cranes).map(bid => bid.seat))
  for (const bid of bids) events.push({ kind: 'auction', ...bid, won: winners.has(bid.seat) })

  const credit = (seat: number, amount: number, source: 'milestone' | 'completion' | 'subcontract' | 'prize', site?: string) => {
    companies[seat].cash += amount
    events.push({ kind: 'income', seat, amount, source, site })
  }

  for (const company of companies) {
    const { seat } = company
    const plan = plans[seat]
    const branch = winners.has(seat) ? checks[seat].win : checks[seat].lose
    company.cash -= branch.spend
    if (branch.overtime) {
      company.overtime--
      events.push({ kind: 'overtime', seat, amount: OVERTIME_COST })
    }
    for (const site of projects.filter(site => site.seat === seat && site.status === 'active' && plan.abandon?.includes(site.id))) {
      site.status = 'abandoned'
      events.push({ kind: 'project', seat, site: site.id, action: 'abandoned' })
    }
  }

  const completedTowers: Project[] = []
  for (const site of projects) {
    const { seat, id } = site
    const check = checks[seat]
    const shifts = (winners.has(seat) ? check.win : check.lose).work[id] ?? 0
    if (site.status !== 'active' || !shifts) continue
    const stage = currentStage(state.mode, site)
    site.work += shifts
    events.push({ kind: 'work', seat, site: id, shifts, cost: shifts * BUILDINGS[site.type].unit })
    if (site.work < stage.work) continue
    events.push({ kind: 'stage', seat, site: id, stage: stage.name })
    if (stage.draw) credit(seat, stage.draw, 'milestone', id)
    site.work = 0
    site.stage++
    const contract = MODES[state.mode].contracts[site.type]
    if (site.stage === contract.stages.length) {
      site.status = 'complete'
      const draws = contract.stages.reduce((total, item) => total + (item.draw ?? 0), 0)
      credit(seat, site.payout - draws - BUILDINGS[site.type].late * Math.max(0, week - site.due), 'completion', id)
      events.push({ kind: 'project', seat, site: id, action: 'completed' })
      if (site.type === 'skyscraper') completedTowers.push(site)
    }
  }
  for (const company of companies) {
    if (plans[company.seat].subcontract) credit(company.seat, subcontractPayout(state.companies[company.seat].cash), 'subcontract')
  }

  let prizeWeek = state.prizeWeek
  if (prizeWeek === undefined && completedTowers.length) {
    prizeWeek = week
    for (const site of completedTowers) credit(site.seat, SKYLINE_PRIZE / completedTowers.length, 'prize', site.id)
  }

  for (const site of projects) {
    if (site.status === 'active' && week >= site.due + GRACE_WEEKS) {
      site.status = 'expired'
      events.push({ kind: 'project', seat: site.seat, site: site.id, action: 'expired' })
    }
  }

  const awarded = new Set<Building>()
  for (const seat of priority) {
    const type = plans[seat].permit
    if (!type) continue
    const offer = views[seat].offers.find(item => item.type === type)!
    if (projects.filter(site => site.seat === seat && site.status === 'active').length >= 2) {
      events.push({ kind: 'permit', seat, type, result: 'full' })
      continue
    }
    if (awarded.has(type) && type !== 'skyscraper') {
      events.push({ kind: 'permit', seat, type, result: 'claimed' })
      continue
    }
    companies[seat].cash -= BUILDINGS[type].permit
    if (type === 'skyscraper') companies[seat].signedTower = true
    awarded.add(type)
    const id = `site-${week}-${seat}`
    projects.push({
      id, seat, type, name: offer.name, stage: 0, work: 0, due: week + offer.duration, payout: offer.payout,
      started: week + 1, status: 'active',
    })
    events.push({ kind: 'permit', seat, type, site: id, result: 'awarded' })
  }

  const report: WeekReport = { week, events, cash: companies.map(company => company.cash) }
  const finished = week === MODES[state.mode].weeks
  return {
    state: { ...state, companies, projects, prizeWeek, week: finished ? week : week + 1, finished, history: [...state.history, report] },
    report,
  }
}

export function standings(state: MatchState) {
  return [...state.companies].sort((a, b) => b.cash - a.cash || a.seat - b.seat)
}
