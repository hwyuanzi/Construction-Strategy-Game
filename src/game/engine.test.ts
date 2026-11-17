import { describe, expect, it } from 'vitest'
import { createMatch, getPlayerView, resolveWeek, standings, validatePlan } from './engine'
import { greedyPlan, suggestPlan } from './planner'
import { MODES } from './rules'
import type { Mode } from './rules'
import type { MatchState, Project, WeekPlan } from './types'

const pass = (): WeekPlan => ({ work: {} })
const starter = (type: 'house' | 'commercial', seat: number) => `starter-${type}-${seat}`
const makeMatch = (mode: Mode = 'quick', seed = 17, seats = 2) => createMatch({ mode, seed, seats })
const plan = (seat: number, bid: number, frame: number, house = 0): WeekPlan => ({
  work: { [starter('commercial', seat)]: frame, [starter('house', seat)]: house },
  bid: { site: starter('commercial', seat), amount: bid },
})

describe('opening and competition', () => {
  it.each(['quick', 'standard'] as const)('opens %s with an immediate crane contest and three permits', mode => {
    const match = makeMatch(mode)
    const opening = getPlayerView(match, 0)
    expect(opening.offers.filter(offer => offer.rush)).toHaveLength(1)
    expect(opening.offers.map(offer => offer.type)).toEqual(['house', 'commercial', 'skyscraper'])
    const bid = { site: starter('commercial', 0), amount: 2 }
    const house = starter('house', 0)
    expect(suggestPlan(opening, { bid, focus: house }).work[house]).toBe(mode === 'quick' ? 1 : 2)
    expect(suggestPlan(opening, { bid, focus: bid.site }).work[bid.site]).toBe(3)
    const result = resolveWeek(match, [plan(0, 2, 1), plan(1, 3, 3)])
    expect(result.report.events.filter(event => event.kind === 'auction').map(event => event.seat)).toEqual([1, 0])
    expect(result.state.projects.find(site => site.id === bid.site)!.work).toBe(1)
    expect(result.state.projects.find(site => site.id === starter('commercial', 1))!.stage).toBe(2)
    expect(result.state.week).toBe(2)
  })

  it('handles rotating bid ties and lets the loser redirect work without paying', () => {
    const start = makeMatch()
    const first = getPlayerView(start, 0).priority[0]
    const plans = [0, 1].map(seat => ({ ...plan(seat, 2, 3), fallback: { site: starter('house', seat), shifts: 1 } }))
    const result = resolveWeek(start, plans)
    expect(result.state.companies[first].cash).toBe(29)
    expect(result.state.companies[1 - first].cash).toBe(51)
    expect(result.state.projects.find(site => site.id === starter('house', 1 - first))!.status).toBe('complete')
    expect(getPlayerView(result.state, 0).priority[0]).toBe(1 - first)
    expect(start.companies.map(company => company.cash)).toEqual([40, 40])
  })

  it('charges a contested permit only to the claimant with priority and space', () => {
    const start = makeMatch()
    const first = getPlayerView(start, 0).priority[0]
    const plans = [0, 1].map((seat): WeekPlan => ({ permit: 'house', work: { [starter('house', seat)]: 1 } }))
    const result = resolveWeek(start, plans)
    expect(result.state.companies[first].cash).toBe(47)
    expect(result.state.companies[1 - first].cash).toBe(51)
    expect(result.state.projects.find(site => site.id.startsWith('site-'))).toMatchObject({ seat: first, started: 2, work: 0 })
    const full = plans.map((weekPlan, seat) => seat === first ? { ...weekPlan, work: {} } : weekPlan)
    expect(resolveWeek(start, full).state.projects.find(site => site.id.startsWith('site-'))?.seat).toBe(1 - first)
  })

  it('awards two cranes with four companies and gives every eligible seat a skyscraper permit', () => {
    const start = makeMatch('quick', 84, 4)
    const plans = [0, 1, 2, 3].map((seat): WeekPlan => ({
      ...plan(seat, seat + 1, 2, 1),
      permit: 'skyscraper',
    }))
    const { state, report } = resolveWeek(start, plans)
    expect(report.events.flatMap(event => event.kind === 'auction' && event.won ? [event.seat] : [])).toEqual([3, 2])
    expect(state.companies.every(company => company.signedTower)).toBe(true)
    expect(state.projects.filter(site => site.type === 'skyscraper')).toHaveLength(4)
    expect(getPlayerView(state, 0).offers.some(offer => offer.type === 'skyscraper')).toBe(false)
  })
})

describe('crew scheduling', () => {
  it('checks the more expensive loss branch and the held permit fee', () => {
    const match = makeMatch('standard')
    const tower = match.projects[0]
    Object.assign(tower, { type: 'skyscraper', stage: 0, work: 0 })
    match.companies[0].cash = 15
    const weekPlan = {
      ...plan(0, 1, 3), fallback: { site: tower.id, shifts: 3 }, permit: 'house' as const,
    }
    const view = getPlayerView(match, 0)
    expect(validatePlan(view, weekPlan)).toMatchObject({ win: { spend: 10 }, lose: { spend: 12 }, reserve: 4, errors: [expect.stringMatching(/Opening cash/)] })
    expect(validatePlan(view, { ...weekPlan, permit: undefined }).errors).toEqual([])
    expect(validatePlan(view, { ...weekPlan, fallback: { site: tower.id, shifts: 4 } }).errors).toContain('Redirect only freed shifts to an eligible crane-free stage.')
  })

  it('consumes an overtime charge only on the executed fourth shift', () => {
    const match = makeMatch()
    const player = { ...plan(0, 2, 3, 1), overtime: true }
    const loss = resolveWeek(match, [player, plan(1, 3, 2)]).state
    const win = resolveWeek(match, [player, pass()]).state
    expect(loss.companies[0]).toMatchObject({ overtime: 1, cash: 51 })
    expect(win.companies[0]).toMatchObject({ overtime: 0, cash: 37 })
    expect(win.projects.find(site => site.id === starter('commercial', 0))).toMatchObject({ stage: 2, work: 0 })
    expect(validatePlan(getPlayerView(match, 0), { ...player, overtime: false }).errors).toContain('The plan exceeds your available shifts.')
  })

  it('rejects cross-company work, late-stage spill, and assignments to an abandoned site', () => {
    const view = getPlayerView(makeMatch(), 0)
    expect(validatePlan(view, { work: { [starter('house', 1)]: 1 } }).errors).not.toEqual([])
    expect(validatePlan(view, { work: { [starter('house', 0)]: 2 } }).errors).not.toEqual([])
    expect(validatePlan(view, { work: { [starter('house', 0)]: 1 }, abandon: [starter('house', 0)] }).errors).not.toEqual([])
  })

  it('pays skyscraper draws when the stage ends and splits the first completion prize', () => {
    const start = makeMatch()
    const tower = (seat: number, stage: number, work: number): Project => ({
      id: `tower-${seat}`, seat, type: 'skyscraper', name: 'Skyscraper', stage, work,
      due: 6, payout: 82, started: 1, status: 'active',
    })
    const drawMatch = { ...start, projects: [tower(0, 0, 2)] }
    const foundation = resolveWeek(drawMatch, [{ work: { 'tower-0': 1 } }, pass()])
    expect(foundation.state.companies[0].cash).toBe(48)
    expect(foundation.report.events).toContainEqual({ kind: 'income', seat: 0, amount: 12, source: 'milestone', site: 'tower-0' })
    const finishMatch = { ...start, week: 7, projects: [tower(0, 3, 1), tower(1, 3, 1)] }
    const result = resolveWeek(finishMatch, [{ work: { 'tower-0': 1 } }, { work: { 'tower-1': 1 } }])
    expect(result.state.prizeWeek).toBe(7)
    expect(result.state.companies.map(company => company.cash)).toEqual([80, 80])
    expect(result.report.events.filter(event => event.kind === 'income' && event.source === 'prize')).toHaveLength(2)
    expect(resolveWeek({ ...finishMatch, prizeWeek: 6 }, [{ work: { 'tower-0': 1 } }, { work: { 'tower-1': 1 } }]).state.companies[0].cash).toBe(74)
  })

  it('pays a completion on the final grace week and match week before expiring other jobs', () => {
    const start = makeMatch()
    start.week = 8
    for (const site of start.projects) site.due = 6
    const result = resolveWeek(start, [{ work: { [starter('house', 0)]: 1 } }, pass()])
    expect(result.state.finished).toBe(true)
    expect(result.state.projects.find(site => site.id === starter('house', 0))?.status).toBe('complete')
    expect(result.state.projects.filter(site => site.status === 'expired')).toHaveLength(3)
    expect(standings(result.state).map(company => company.cash)).toEqual([41, 40])
    expect(() => resolveWeek(result.state, [pass(), pass()])).toThrow(/open week/)
  })
})

describe('subcontract recovery', () => {
  it.each([0, 1, 2, 3, 4, 5, 6, 7, 8])('handles opening cash of $%i without exceeding the recovery target', cash => {
    let match = makeMatch()
    match.companies[0].cash = cash
    for (let week = 0; week < 2; week++) {
      const payout = match.companies[0].cash < 8
      match = resolveWeek(match, [{ work: {}, subcontract: payout }, pass()]).state
    }
    expect(match.companies[0].cash).toBe(8)
    expect(validatePlan(getPlayerView(match, 0), { work: {}, subcontract: true }).errors).toContain('Subcontracting opens below $8.')
  })

  it('rejects duplicate or forged claims and counts a subcontract against the crew', () => {
    const match = makeMatch()
    match.companies[0].cash = 7
    const view = getPlayerView(match, 0)
    const forged = { work: {}, subcontract: 2 } as unknown as WeekPlan
    expect(validatePlan(view, forged).errors).toContain('Choose at most one subcontract.')
    expect(() => resolveWeek(match, [pass(), pass(), pass()])).toThrow(/Every company/)
    expect(validatePlan(view, { ...plan(0, 1, 3), subcontract: true }).errors).toContain('The plan exceeds your available shifts.')
  })

  it('lets a cash-starved company recover and finish its fallback after a crane loss', () => {
    let match = makeMatch()
    match.companies[0].cash = 0
    for (let week = 0; week < 2; week++) {
      const opening = getPlayerView(match, 0)
      const bid = week ? { site: starter('commercial', 0), amount: 1 } : undefined
      const player = suggestPlan(opening, { bid })
      const result = resolveWeek(match, [player, plan(1, 3, 1)])
      expect(result.report.events).toContainEqual({ kind: 'income', seat: 0, amount: 4, source: 'subcontract', site: undefined })
      match = result.state
    }
    expect(match.companies[0].cash).toBe(19)
    expect(match.projects.find(site => site.id === starter('house', 0))?.status).toBe('complete')
    expect(validatePlan(getPlayerView(match, 0), plan(0, 1, 1)).errors).toContain('Assign whole shifts within each active stage.')
    expect(validatePlan(getPlayerView(match, 0), { work: { [starter('commercial', 0)]: 1 }, bid: { site: starter('commercial', 0), amount: 1 } }).errors).toEqual([])
  })

  it('prevents a higher bid from generating free cash through deliberate spend-down', () => {
    function afterRecovery(bid: number) {
      const match = makeMatch()
      match.companies[0].cash = 13
      const afterBid = resolveWeek(match, [plan(0, bid, 1), pass()]).state
      return resolveWeek(afterBid, [{ work: {}, subcontract: afterBid.companies[0].cash < 8 }, pass()]).state
    }
    const cheaper = afterRecovery(1)
    const spendDown = afterRecovery(3)
    expect(spendDown.projects).toEqual(cheaper.projects)
    expect(cheaper.companies[0].cash).toBe(9)
    expect(spendDown.companies[0].cash).toBe(8)
  })
})

describe('deterministic matches', () => {
  function autoplay(initial: MatchState) {
    let match = initial
    while (!match.finished) {
      const plans = match.companies.map(({ seat }) => greedyPlan(getPlayerView(match, seat)))
      match = resolveWeek(match, plans).state
      expect(match.companies.every(company => company.cash >= 0 && company.overtime >= 0)).toBe(true)
    }
    return match
  }

  it.each(['quick', 'standard'] as const)('completes repeatable %s runs in all supported engine seat counts', mode => {
    for (let seats = 2; seats <= 4; seats++) {
      for (let seed = 0; seed < 12; seed++) {
        const result = autoplay(makeMatch(mode, seed, seats))
        expect(result.history).toHaveLength(MODES[mode].weeks)
        expect(result.history[0].events.filter(event => event.kind === 'auction')).toHaveLength(seats)
        expect(result.projects.some(site => site.status === 'complete')).toBe(true)
        if (seed === 0) expect(autoplay(makeMatch(mode, seed, seats))).toEqual(result)
      }
    }
  })
})
