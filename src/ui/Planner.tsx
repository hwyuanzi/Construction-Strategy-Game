import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Building2, Check, ChevronDown, CircleDollarSign, Construction, HardHat, House, LockKeyhole, Minus, Plus, TowerControl, Zap } from 'lucide-react'
import { activeSites, currentStage, validatePlan } from '../game/engine'
import { remainingWeeks, suggestPlan } from '../game/planner'
import { BUILDINGS, MODES, REGULAR_SHIFTS, SUBCONTRACT_LIMIT, minimumWeeks, subcontractPayout } from '../game/rules'
import type { Building } from '../game/rules'
import type { PlayerView, WeekPlan } from '../game/types'
import { PermitArt } from './PermitArt'

export const projectIcons = { house: House, commercial: Building2, skyscraper: TowerControl }
const steps = ['Projects', 'Crane', 'Build']

export function Planner({ view, lock }: { view: PlayerView; lock: (plan: WeekPlan) => void }) {
  const company = view.companies[view.seat]
  const [step, setStep] = useState(0)
  const [permit, setPermit] = useState<Building>()
  const [bidChoice, setBidChoice] = useState<'bid' | 'skip'>()
  const [bidSite, setBidSite] = useState<string>()
  const [bidAmount, setBidAmount] = useState(2)
  const [overtime, setOvertime] = useState(false)
  const [subcontract, setSubcontract] = useState(company.cash < SUBCONTRACT_LIMIT)
  const [abandon, setAbandon] = useState<string[]>([])
  const [focus, setFocus] = useState<string>()
  const [manual, setManual] = useState<WeekPlan>()
  const [advanced, setAdvanced] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const previousStep = useRef(step)
  const recoveryPay = subcontractPayout(company.cash)

  useEffect(() => {
    if (previousStep.current !== step) heading.current?.focus()
    previousStep.current = step
  }, [step])

  const sites = activeSites(view)
  const workSites = sites.filter(site => !abandon.includes(site.id))
  const reserve = permit ? BUILDINGS[permit].permit : 0
  const craneSites = workSites.filter(site => currentStage(view.mode, site).crane && company.cash >= reserve + BUILDINGS[site.type].unit + 1)
    .sort((first, second) => first.due - remainingWeeks(view, first) - (second.due - remainingWeeks(view, second)))
  const selectedCrane = craneSites.find(site => site.id === bidSite) ?? craneSites[0]
  const maxBid = selectedCrane ? company.cash - reserve - BUILDINGS[selectedCrane.type].unit : 0
  const bid = bidChoice === 'bid' && selectedCrane ? { site: selectedCrane.id, amount: Math.min(maxBid, bidAmount) } : undefined
  const intent = { permit, bid, overtime, subcontract, abandon }
  const suggested = suggestPlan(view, { ...intent, focus })
  const plan = manual ?? suggested
  const check = validatePlan(view, plan)
  const recentBids = view.history.at(-1)?.events.flatMap(event => event.kind === 'auction' && event.won ? [event.amount] : []) ?? []
  const canBid = craneSites.length > 0

  const alternatives = workSites.map(site => {
    const candidate = suggestPlan(view, { ...intent, focus: site.id })
    return { site, plan: candidate, shifts: candidate.work[site.id] ?? 0 }
  }).filter(choice => choice.shifts > 0 && !validatePlan(view, choice.plan).errors.length)
  const signature = (candidate: WeekPlan) => workSites.map(site => candidate.work[site.id] ?? 0).join(',')
  const hasTradeoff = new Set(alternatives.map(choice => signature(choice.plan))).size > 1

  function changePermit(type?: Building) {
    setPermit(type)
    setManual(undefined)
    setFocus(undefined)
    setBidChoice(undefined)
  }

  function startBuild() {
    if (!canBid) setBidChoice('skip')
    setStep(2)
  }

  function editWork(id: string, count: number) {
    const work = { ...plan.work }
    if (count) work[id] = count
    else delete work[id]
    const target = workSites.find(site => site.id === plan.fallback?.site)
    const maxFallback = target && plan.bid ? Math.min(
      work[plan.bid.site] ?? 0, currentStage(view.mode, target).work - target.work - (work[target.id] ?? 0),
    ) : 0
    const fallback = plan.fallback && maxFallback > 0
      ? { ...plan.fallback, shifts: Math.min(plan.fallback.shifts, maxFallback) }
      : undefined
    setManual({ ...plan, work, fallback })
  }

  const permitWarning = permit && minimumWeeks(MODES[view.mode].contracts[permit].stages, company.overtime - Number(check.win.overtime)) > MODES[view.mode].weeks - view.week
  const selectedOffer = view.offers.find(offer => offer.type === permit)
  const rivalNeedsCrane = view.projects.some(site => site.seat !== view.seat && site.status === 'active' && currentStage(view.mode, site).crane)
  const fallbackSite = workSites.find(site => site.id === plan.fallback?.site)

  return <section className="planner panel" aria-labelledby="planner-title">
    <nav className="steps" aria-label="Planning steps">
      {steps.map((label, index) => <button type="button" key={label}
        className={`step ${step === index ? 'current' : ''} ${step > index ? 'past' : ''}`}
        aria-current={step === index ? 'step' : undefined} disabled={step <= index} onClick={() => setStep(index)}>
        {step > index && <Check size={13} />}{label}
      </button>)}
    </nav>
    {step === 0 && <>
      <div className="planner-content">
        <div className="planner-heading"><h2 id="planner-title" ref={heading} tabIndex={-1}>Choose a project</h2><p>{view.offers.length ? 'Pick one permit for next week, or keep building.' : 'The permit market is closed.'}</p></div>
        <div className="permit-list">
          {view.offers.map(offer => {
            const cost = BUILDINGS[offer.type].permit
            const selected = permit === offer.type
            return <button type="button" key={offer.type} aria-pressed={selected} disabled={company.cash < cost}
              className={`permit-card type-${offer.type} ${selected ? 'selected' : ''}`} onClick={() => changePermit(selected ? undefined : offer.type)}>
              <PermitArt type={offer.type} />
              {offer.rush && <span className="rush-tag"><Zap size={10} fill="currentColor" /> Rush</span>}
              <span className="permit-name">{offer.name}</span>
              <span className="permit-money"><strong>${offer.payout}</strong><small>payout</small></span>
              <span className="permit-meta">${cost} permit</span>
            </button>
          })}
        </div>
        {view.offers.length > 0 && <button type="button" className="inline-action keep-projects" onClick={() => changePermit()} aria-pressed={!permit}>
          <span className={`pick-dot ${!permit ? 'checked' : ''}`}>{!permit && <Check size={11} />}</span> Keep current projects
        </button>}
        {selectedOffer && <p className="small-note" aria-live="polite">
          Due in {selectedOffer.duration} weeks · {selectedOffer.type === 'house' ? 'Crew only' : 'Needs a crane'}. Earliest finish is week {view.week + minimumWeeks(MODES[view.mode].contracts[selectedOffer.type].stages, company.overtime)}.
          {workSites.length >= 2 && ' You’ll need to free up a site.'}
          {selectedOffer.type !== 'skyscraper' && ' Only one company can claim this permit.'}
        </p>}
      </div>
      <div className="planner-footer">
        <button type="button" className="button primary wide" onClick={() => canBid ? setStep(1) : startBuild()}>
          {canBid ? 'Continue to bidding' : 'Review crew plan'} <ArrowRight size={17} />
        </button>
      </div>
    </>}
    {step === 1 && <>
      <div className="planner-content">
        <div className="planner-heading"><h2 id="planner-title" ref={heading} tabIndex={-1}>Compete for a crane</h2><p>{view.cranes === 1 ? 'One crane. The highest bidder wins and pays.' : `${view.cranes} cranes. The highest bidders win and pay.`}</p></div>
        <div className="bid-sites">
          {craneSites.map(site => <button type="button" key={site.id} className={`bid-site ${bidChoice === 'bid' && selectedCrane?.id === site.id ? 'selected' : ''}`}
            aria-pressed={bidChoice === 'bid' && selectedCrane?.id === site.id} onClick={() => { setBidSite(site.id); setBidChoice('bid'); setManual(undefined) }}>
            <span className="permit-icon type-commercial"><Construction size={19} /></span>
            <span><strong>{site.name}</strong><small>{currentStage(view.mode, site).name} · due week {site.due}</small></span>
            <span className="bid-site-label">{bidChoice === 'bid' && selectedCrane?.id === site.id ? 'Bidding' : 'Place bid'}</span>
          </button>)}
        </div>
        {selectedCrane && <div className="bid-amount">
          <div><strong>Your secret bid</strong><small>{recentBids.length ? `Last winning bid ${recentBids.map(amount => '$' + amount).join(', ')}` : rivalNeedsCrane ? 'A rival also needs a crane.' : 'No rival site needs a crane.'}</small></div>
          <div className="counter">
            <button type="button" aria-label="Decrease bid" disabled={Math.min(maxBid, bidAmount) <= 1} onClick={() => { setBidAmount(Math.max(1, Math.min(maxBid, bidAmount) - 1)); setBidChoice('bid'); setManual(undefined) }}><Minus size={15} /></button>
            <span aria-live="polite">${Math.min(maxBid, bidAmount)}</span>
            <button type="button" aria-label="Increase bid" disabled={bidAmount >= maxBid} onClick={() => { setBidAmount(Math.min(maxBid, bidAmount + 1)); setBidChoice('bid'); setManual(undefined) }}><Plus size={15} /></button>
          </div>
        </div>}
        <button type="button" className="inline-action" aria-pressed={bidChoice === 'skip'} onClick={() => { setBidChoice('skip'); setManual(undefined) }}>
          <span className={`pick-dot ${bidChoice === 'skip' ? 'checked' : ''}`}>{bidChoice === 'skip' && <Check size={11} />}</span> Skip crane this week
        </button>
        <details className="disclosure"><summary>Auction rules</summary><p>{view.companies[view.priority[0]].name} has first priority on ties this week.</p></details>
      </div>
      <div className="planner-footer action-row">
        <button type="button" className="button secondary" aria-label="Back to projects" onClick={() => setStep(0)}><ArrowLeft size={17} /></button>
        <button type="button" className="button primary wide" disabled={!bidChoice} onClick={startBuild}>Review crew plan <ArrowRight size={17} /></button>
      </div>
    </>}
    {step === 2 && <>
      <div className="planner-content">
        <div className="planner-heading"><h2 id="planner-title" ref={heading} tabIndex={-1}>Send your crews</h2><p>{hasTradeoff ? 'Pick which job gets first call on your crew.' : `${check.win.shifts} of ${REGULAR_SHIFTS + Number(check.win.overtime)} shifts assigned`}</p></div>
        {hasTradeoff && <div className="focus-list" aria-label="Crew priorities">
          {alternatives.map(choice => <button type="button" key={choice.site.id}
            className={`focus-choice ${signature(choice.plan) === signature(plan) ? 'selected' : ''}`}
            aria-pressed={signature(choice.plan) === signature(plan)}
            onClick={() => { setFocus(choice.site.id); setManual(undefined) }}>
            <strong>{choice.site.type === 'house' ? 'Prioritize house' : currentStage(view.mode, choice.site).name === 'Steel frame' ? 'Push steel frame' : `Prioritize ${choice.site.name.toLowerCase()}`}</strong>
            <small>{choice.shifts} {choice.shifts === 1 ? 'shift' : 'shifts'} on {currentStage(view.mode, choice.site).name.toLowerCase()}</small>
          </button>)}
        </div>}
        <div className="work-list">
          {workSites.map(site => {
            const stage = currentStage(view.mode, site)
            const count = check.win.work[site.id] ?? 0
            const Icon = projectIcons[site.type]
            return <div key={site.id} className="work-row">
              <span className={`work-icon type-${site.type}`}><Icon size={15} /></span>
              <span><strong>{site.name}</strong><small>{stage.name} · Due week {site.due}</small></span>
              <div className="shift-count">
                <span className="shift-marks" aria-hidden="true">{Array.from({ length: REGULAR_SHIFTS + Number(check.win.overtime) }, (_, index) => <i key={index} className={index < count ? 'assigned' : ''} />)}</span>
                <b>{count} {count === 1 ? 'shift' : 'shifts'}</b>
              </div>
            </div>
          })}
          {plan.subcontract && <div className="work-row"><span className="work-icon type-house"><CircleDollarSign size={15} /></span><span><strong>Subcontract</strong><small>Earn ${recoveryPay} at settlement</small></span><b>1 shift</b></div>}
          {!workSites.length && !plan.subcontract && <div className="info-box"><HardHat size={17} /> Your crews will wait for new work.</div>}
        </div>
        {company.overtime > 0 && <button type="button" className="inline-action overtime-action" aria-pressed={overtime}
          onClick={() => { setOvertime(!overtime); setManual(undefined) }}>
          <span className={`pick-dot ${overtime ? 'checked' : ''}`}>{overtime && <Check size={11} />}</span>
          <Zap size={15} /> Emergency overtime <small>{company.overtime} left · $3 if used</small>
        </button>}
        <p className="spend-summary"><span>{plan.bid ? 'Spend if you win' : 'Planned spend'}</span><strong>${check.win.spend}</strong></p>
        {plan.bid && <p className="small-note">{fallbackSite && plan.fallback
          ? `No crane? ${plan.fallback.shifts} backup ${plan.fallback.shifts === 1 ? 'shift goes' : 'shifts go'} to ${fallbackSite.name.toLowerCase()}.`
          : `No crane? ${check.lose.shifts === 0 ? 'Crews stand by.' : `${check.lose.shifts} ${check.lose.shifts === 1 ? 'shift still works' : 'shifts still work'}.`}`}</p>}
        {permit && (!check.win.slot || !check.lose.slot) && <p className="small-note">The permit needs an open site after work settles.</p>}
        {permitWarning && <p className="error-note">This project cannot finish by match end with your remaining overtime.</p>}
        <button type="button" className="inline-action advanced-toggle" aria-expanded={advanced} onClick={() => setAdvanced(!advanced)}>
          <ChevronDown size={15} className={advanced ? 'rotated' : ''} /> Budget &amp; crew controls
        </button>
        {advanced && <div className="manual-panel">
          <p><span>Cash on hand</span><strong>${company.cash}</strong></p>
          {plan.bid && <p><span>Spend if you lose</span><strong>${check.lose.spend}</strong></p>}
          {check.reserve > 0 && <p><span>Reserved for permit</span><strong>${check.reserve}</strong></p>}
          {workSites.map(site => {
            const stage = currentStage(view.mode, site)
            if (stage.crane && plan.bid?.site !== site.id) return null
            return <label className="manual-row" key={site.id}>{site.name} shifts
              <input type="number" min={0} max={stage.work - site.work} value={plan.work[site.id] ?? 0}
                onChange={event => editWork(site.id, Math.max(0, Math.min(stage.work - site.work, Number(event.target.value))))} />
            </label>
          })}
          {plan.bid && workSites.filter(site => !currentStage(view.mode, site).crane).map(site => {
            const amount = Math.min(plan.work[plan.bid!.site] ?? 0, currentStage(view.mode, site).work - site.work - (plan.work[site.id] ?? 0))
            return <label className="manual-row" key={site.id + '-fallback'}>Backup shifts to {site.name.toLowerCase()}
              <input type="number" min={0} max={amount} value={plan.fallback?.site === site.id ? plan.fallback.shifts : 0} onChange={event => {
                const shifts = Math.max(0, Math.min(amount, Number(event.target.value)))
                setManual({ ...plan, fallback: shifts ? { site: site.id, shifts } : undefined })
              }} />
            </label>
          })}
          {company.cash < SUBCONTRACT_LIMIT && <label className="manual-choice"><input type="checkbox" checked={subcontract}
            onChange={() => { setSubcontract(!subcontract); setManual(undefined) }} /> Take the ${recoveryPay} subcontract</label>}
          {sites.map(site => <label className="manual-choice" key={site.id + '-abandon'}>
            <input type="checkbox" checked={abandon.includes(site.id)} onChange={() => {
              setAbandon(abandon.includes(site.id) ? abandon.filter(id => id !== site.id) : [...abandon, site.id])
              if (selectedCrane?.id === site.id) setBidChoice('skip')
              setManual(undefined)
              setFocus(undefined)
            }} /> Abandon {site.name.toLowerCase()}
          </label>)}
          {manual && <button type="button" className="inline-action" onClick={() => setManual(undefined)}>Restore suggested shifts</button>}
        </div>}
        {!!check.errors.length && <p className="error-note" role="alert">{check.errors.join(' ')}</p>}
      </div>
      <div className="planner-footer action-row">
        <button type="button" className="button secondary" aria-label="Back one step" onClick={() => setStep(canBid ? 1 : 0)}><ArrowLeft size={17} /></button>
        <button type="button" className="button primary wide" disabled={!!check.errors.length} onClick={() => lock(plan)}>Lock week <LockKeyhole size={15} /></button>
      </div>
    </>}
  </section>
}
