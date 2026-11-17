import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowRight, Bot, CalendarDays, CircleHelp, ClipboardList, Construction, Dices, HardHat, Plus, ShieldCheck, Trophy, Users, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { getPlayerView, onlyPass, standings } from '../game/engine'
import { legalPass } from '../game/planner'
import { BUILDINGS, MODES } from '../game/rules'
import type { Mode } from '../game/rules'
import { useGame } from '../game/store'
import type { Opponent } from '../game/store'
import type { GameEvent, MatchState, WeekReport } from '../game/types'
import { City } from './City'
import { Planner } from './Planner'

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])
  return <dialog ref={ref} className="dialog" aria-labelledby="dialog-title"
    onCancel={event => { event.preventDefault(); onClose() }}
    onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <article className="dialog-body">
      <header><h2 id="dialog-title">{title}</h2><button type="button" aria-label="Close dialog" className="icon-button" onClick={onClose}><X size={20} /></button></header>
      {children}
    </article>
  </dialog>
}

function Help({ close }: { close: () => void }) {
  return <Dialog title="How to play" onClose={close}>
    <p className="dialog-lead">Pick a project. Bid for a crane. Send your crews to build. Finished jobs earn cash. Most cash wins.</p>
    <ol className="guide-list">
      <li><span><ClipboardList size={19} /></span><div><strong>Choose projects</strong><p>Finish your starter house to make room for a new job. Each ordinary permit goes to one company.</p></div></li>
      <li><span><Construction size={19} /></span><div><strong>Compete for resources</strong><p>The highest secret bid wins the crane. If you lose, you keep your cash and your crews can use a backup assignment.</p></div></li>
      <li><span><HardHat size={19} /></span><div><strong>Build</strong><p>You get three shifts a week. Use them to finish stages and get paid. A late finish pays less.</p></div></li>
    </ol>
    <details className="rules-detail">
      <summary>Overtime, skyscrapers, and cash recovery</summary>
      <p>Emergency overtime adds a fourth shift for $3 plus build costs. Your charge is spent only if the shift works.</p>
      <p>The first skyscraper earns a $12 bonus, split if rivals finish the same week. Skyscrapers also pay at key stages.</p>
      <p>Below $8, one regular shift can earn up to $4 on a subcontract to help you get back to $8. A permit is paid only if awarded. Late work has two grace weeks.</p>
    </details>
    <button type="button" className="button primary wide" onClick={close}>Back to the site <ArrowRight size={17} /></button>
  </Dialog>
}

function Setup({ close }: { close: () => void }) {
  const match = useGame(state => state.match)
  const currentOpponent = useGame(state => state.opponent)
  const start = useGame(state => state.start)
  const [mode, setMode] = useState(match.mode)
  const [opponent, setOpponent] = useState(currentOpponent)
  const [seed, setSeed] = useState(() => crypto.getRandomValues(new Uint32Array(1))[0])
  return <Dialog title="New match" onClose={close}>
    <p className="dialog-lead">Choose a season and who you’ll build against.</p>
    <fieldset className="setup-group"><legend>Match length</legend>
      <div className="setup-options">{(Object.keys(MODES) as Mode[]).map(key => <button type="button" key={key}
        className={mode === key ? 'selected' : ''} aria-pressed={mode === key} onClick={() => setMode(key)}>
        <CalendarDays size={19} /><strong>{MODES[key].label}</strong><span>{MODES[key].weeks} weeks</span>
      </button>)}</div>
    </fieldset>
    <fieldset className="setup-group"><legend>Opponent</legend>
      <div className="setup-options">{(['bot', 'hotseat'] as Opponent[]).map(key => <button type="button" key={key}
        className={opponent === key ? 'selected' : ''} aria-pressed={opponent === key} onClick={() => setOpponent(key)}>
        {key === 'bot' ? <Bot size={19} /> : <Users size={19} />}<strong>{key === 'bot' ? 'Play against AI' : 'Pass and play'}</strong><span>{key === 'bot' ? 'Greedy opponent' : 'Two players, one device'}</span>
      </button>)}</div>
    </fieldset>
    <div className="seed-row">
      <label>City seed <input type="number" min={0} max={4294967295} value={seed} onChange={event => setSeed(Math.trunc(Math.max(0, Math.min(0xffffffff, Number(event.target.value)))))} /></label>
      <button type="button" className="icon-button" aria-label="Randomize city seed" onClick={() => setSeed(crypto.getRandomValues(new Uint32Array(1))[0])}><Dices size={18} /></button>
    </div>
    <button type="button" className="button primary wide" onClick={() => { start(mode, opponent, seed); close() }}>Start match <ArrowRight size={17} /></button>
  </Dialog>
}

function CompanyScores({ match, opponent, active }: { match: MatchState; opponent: Opponent; active?: number }) {
  return <div className="company-grid" aria-label="Company cash">
    {match.companies.map(company => <div className={`company-score seat-${company.seat} ${company.seat === active ? 'active-company' : ''}`} key={company.seat}>
      <i className={`legend-dot seat-${company.seat}`} aria-hidden="true" />
      <div><strong>{company.name}</strong><small>{company.seat === active ? (opponent === 'bot' ? 'You' : 'Your turn') : company.seat === 1 && opponent === 'bot' ? 'Rival' : 'Cash'}</small></div>
      <strong className="company-cash">${company.cash}</strong>
    </div>)}
  </div>
}

function eventMessage(event: GameEvent, match: MatchState) {
  const company = match.companies[event.seat].name
  const site = 'site' in event ? match.projects.find(project => project.id === event.site)?.name : undefined
  switch (event.kind) {
    case 'auction': return `${company} ${event.won ? 'won the crane for' : 'missed the crane with'} $${event.amount}.`
    case 'work': return `${company} put ${event.shifts} ${event.shifts === 1 ? 'shift' : 'shifts'} into ${site?.toLowerCase()}.`
    case 'stage': return `${company} finished the ${event.stage.toLowerCase()} stage.`
    case 'income': return `${company} earned $${event.amount} ${{
      completion: 'for completing ' + site?.toLowerCase(),
      milestone: 'at a construction milestone',
      prize: 'from the skyline prize',
      subcontract: 'from a subcontract',
    }[event.source]}.`
    case 'overtime': return `${company} used an overtime charge.`
    case 'project': return event.action === 'completed' ? undefined : `${company}’s ${site?.toLowerCase()} ${event.action === 'expired' ? 'expired' : 'was abandoned'}.`
    case 'permit': return event.result === 'awarded'
      ? `${company} picked up the ${BUILDINGS[event.type].label.toLowerCase()} permit.`
      : `${company} missed the ${BUILDINGS[event.type].label.toLowerCase()} permit. ${event.result === 'full' ? 'Both sites are occupied.' : 'A rival claimed it.'}`
  }
}

function Recap({ match, report, next }: { match: MatchState; report: WeekReport; next: () => void }) {
  const auctions = report.events.filter(event => event.kind === 'auction')
  const highlights = report.events.filter(event => event.kind === 'income' || event.kind === 'permit' || (event.kind === 'project' && event.action !== 'completed'))
  const activity = report.events.filter(event => event.kind === 'work' || event.kind === 'stage' || event.kind === 'overtime')
  return <motion.section className="panel recap-panel" aria-labelledby="recap-title" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
    <header className="recap-top"><h2 id="recap-title">Week {report.week} results</h2></header>
    <div className="recap-content">
      {auctions.length > 0 && <>
        <h3>Crane auction</h3>
        <div className="auction-results">{auctions.map(event => <div key={event.seat} className={event.won ? 'won-auction' : ''}>
          <span>{match.companies[event.seat].name}</span><strong>${event.amount}</strong><small>{event.won ? 'Won crane' : 'Missed crane'}</small>
        </div>)}</div>
      </>}
      {highlights.length > 0 && <ul className="event-list highlights">{highlights.map((event, index) =>
        <li key={index}>{eventMessage(event, match)}</li>
      )}</ul>}
      {activity.length > 0 && <details className="disclosure">
        <summary>Site activity</summary>
        <ul className="event-list">{activity.map((event, index) => <li key={index}>{eventMessage(event, match)}</li>)}</ul>
      </details>}
      {!report.events.length && <p>Crews stood by this week.</p>}
    </div>
    <div className="planner-footer"><button type="button" className="button primary wide" onClick={next}>{match.finished ? 'See final results' : 'Next week'} <ArrowRight size={18} /></button></div>
  </motion.section>
}

function Results({ match, setup }: { match: MatchState; setup: () => void }) {
  const rank = standings(match)
  const wins = rank.filter(company => company.cash === rank[0].cash)
  return <motion.section className="panel outcome-panel" aria-labelledby="outcome-title" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
    <div className="outcome-header"><div className="trophy"><Trophy size={37} /></div><p>Final results</p><h2 id="outcome-title">{wins.length > 1 ? 'It’s a tie!' : `${wins[0].name} wins!`}</h2><span>After {MODES[match.mode].weeks} weeks of construction</span></div>
    <ol className="score-list">{rank.map(company => <li key={company.seat}>
      <span className={`legend-dot seat-${company.seat}`} /><span><strong>{company.name}</strong><small>{match.projects.filter(site => site.seat === company.seat && site.status === 'complete').length} projects completed</small></span><strong>${company.cash}</strong>
    </li>)}</ol>
    <div className="planner-footer"><button type="button" className="button primary wide" onClick={setup}>Play again <ArrowRight size={17} /></button></div>
  </motion.section>
}

export function App() {
  const game = useGame()
  const [modal, setModal] = useState<'help' | 'setup'>()
  const { match, phase, report, previous, viewer, opponent, serial, lock } = game
  const mode = MODES[match.mode]
  const view = useMemo(() => getPlayerView(match, viewer), [match, viewer])
  const week = phase === 'recap' && report ? report.week : match.week
  const active = phase === 'planning' ? viewer : undefined
  const autoPass = phase === 'planning' && onlyPass(view)

  useEffect(() => {
    if (autoPass) void lock(legalPass(view))
  }, [autoPass, lock, view])

  return <>
    <header className="main-header">
      <div className="shell header-inner">
        <div className="brand"><Construction size={27} strokeWidth={1.6} aria-hidden="true" /><strong>Construction Strategy Game</strong></div>
        <div className="header-actions">
          <button type="button" className="header-help" aria-label="How to play" onClick={() => setModal('help')}><CircleHelp size={17} /> <span>How to play</span></button>
          <button type="button" className="header-new" onClick={() => setModal('setup')}><Plus size={17} /> New match</button>
        </div>
      </div>
    </header>
    <main className="shell">
      <section className="district-heading" aria-labelledby="district-title">
        <div><p>{mode.label} <span aria-hidden="true">/</span> {opponent === 'bot' ? 'vs. AI' : 'Pass and play'}</p><h1 id="district-title">The district</h1></div>
        <div className="week-strip">
          <div><strong>Week {week}</strong><span>of {mode.weeks}</span></div>
          <div className="week-track" aria-hidden="true">{Array.from({ length: mode.weeks }, (_, index) => <i key={index} className={index < week - 1 ? 'settled' : index === week - 1 ? 'now' : ''} />)}</div>
        </div>
      </section>
      <div className="game-layout">
        <div className="game-board">
          <City key={serial} match={match} previous={phase === 'recap' ? previous : undefined} activeSeat={active} building={phase === 'recap'} />
          <CompanyScores match={match} opponent={opponent} active={active} />
          <p className="skyline-prize"><Trophy size={15} /> {match.prizeWeek ? `Skyline prize awarded in week ${match.prizeWeek}` : '$12 for the first skyscraper'}</p>
        </div>
        <aside className="action-area">
          {phase === 'planning' && !autoPass && <Planner key={`${serial}-${week}-${viewer}`} view={view} lock={lock} />}
          {phase === 'handoff' && <section className="panel center-panel"><span className="center-icon"><ShieldCheck size={28} /></span><h2>Pass the device</h2><p>{match.companies[viewer].name} plans next.</p><button type="button" className="button primary wide" onClick={game.ready}>I’m ready <ArrowRight size={17} /></button></section>}
          {(phase === 'settling' || autoPass) && <section className="panel center-panel" aria-live="polite"><span className="center-icon"><Construction size={28} /></span><h2>Settling the week</h2><p>Opening sealed bids and sending crews to work.</p></section>}
          {phase === 'recap' && report && <Recap match={match} report={report} next={game.next} />}
          {phase === 'results' && <Results match={match} setup={() => setModal('setup')} />}
        </aside>
      </div>
    </main>
    {modal === 'help' && <Help close={() => setModal(undefined)} />}
    {modal === 'setup' && <Setup close={() => setModal(undefined)} />}
  </>
}
