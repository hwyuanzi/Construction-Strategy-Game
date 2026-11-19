import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CircleHelp, Construction, Lightbulb, Plus, SkipForward, Star, Trophy, Truck } from 'lucide-react'
import { motion } from 'framer-motion'
import { BRICK_BUDGET, BUILDINGS, BUILDING_TYPES, bricksLeft, createMatch, delivery, playMove, ROUNDS, SKIP_TURN, TURN_LIMIT, turnsUntilOpen } from '../game/engine'
import type { Match, Move, TurnAction } from '../game/engine'
import { chooseMove, DIFFICULTY_NAMES } from '../game/planner'
import { City } from './City'
import { Dialog } from './Dialog'
import { DEFAULT_SETUP, playerCount, playerName, Setup } from './Setup'
import type { GameSetup } from './Setup'

function Stars({ count }: { count: number }) {
  return <span className="stars"><Star size={16} aria-hidden="true" /><b>{count}</b><span className="sr-only"> stars</span></span>
}

function Help({ close }: { close: () => void }) {
  return <Dialog title="How to play" onClose={close}>
    <ol className="rules">
      <li>Each player starts with {BRICK_BUDGET} bricks for the game. After the opening round, you can spend up to {TURN_LIMIT} per turn.</li>
      <li>Choose an amount and pick one site, or skip to save your bricks. Only bricks placed come out of your supply.</li>
      <li>Place the last brick to win the building’s stars. The site reopens after everyone takes one more turn. Most stars after {ROUNDS} rounds wins.</li>
    </ol>
    <button type="button" className="button primary" onClick={close}>Let’s build <ArrowRight size={16} /></button>
  </Dialog>
}

function SiteList({ match, amount, disabled, focused, focus, build }: {
  match: Match
  amount: number
  disabled: boolean
  focused?: number
  focus: (site?: number) => void
  build: (site: number) => void
}) {
  const rivalLimit = delivery(match, 1)?.bricks ?? 0
  return <div className="site-list" aria-label="Building sites">
    {match.sites.map((kind, site) => {
      const project = BUILDINGS[kind]
      const remaining = bricksLeft(match, site)
      const reopening = turnsUntilOpen(match, site)
      const blocked = disabled || reopening > 0
      const canFinish = !blocked && remaining <= amount
      const exposesFinish = !blocked && !canFinish && remaining - amount <= rivalLimit
      const preview = reopening ? `Reopens in ${reopening} ${reopening === 1 ? 'turn' : 'turns'}`
        : canFinish ? (remaining < amount ? `Finish with ${remaining}` : 'Finish now')
        : exposesFinish ? 'Next can finish' : undefined
      return <button type="button" className={`site-card type-${kind}${focused === site ? ' highlighted' : ''}`}
        key={site} disabled={blocked} onClick={() => build(site)}
        onPointerEnter={() => focus(site)} onPointerLeave={() => focus()} onFocus={() => focus(site)} onBlur={() => focus()}
        aria-label={`Build ${project.name}, site ${site + 1}, ${remaining} ${remaining === 1 ? 'brick' : 'bricks'} left, ${project.stars} stars`}
        aria-description={preview}>
        <span className="site-number" aria-hidden="true">{site + 1}</span>
        <span className="site-info">
          <strong>{project.name}</strong>
          <span className="site-need">{remaining} {remaining === 1 ? 'brick' : 'bricks'} left</span>
          <span className="brick-track" aria-hidden="true">
            {Array.from({ length: project.bricks }, (_, brick) => <i key={brick} className={brick < match.progress[site] ? 'filled' : ''} />)}
          </span>
        </span>
        <span className="site-value"><Stars count={project.stars} />
          {preview && <span className={`finish-flag${exposesFinish ? ' risk-flag' : ''}${reopening ? ' reopening-flag' : ''}`}>{preview}</span>}
        </span>
      </button>
    })}
  </div>
}

function TruckBanner({ match, setup, amount, disabled, sitesOpen, chooseAmount, skip }: {
  match: Match
  setup: GameSetup
  amount: number
  disabled: boolean
  sitesOpen: boolean
  chooseAmount: (amount: number) => void
  skip: () => void
}) {
  const load = delivery(match)
  if (!load) return null
  const name = playerName(setup, load.player)
  const turn = name === 'You' ? 'Your turn' : name === 'Computer' ? 'Computer’s turn' : `${name}’s turn`
  const upcoming = [delivery(match, 1), delivery(match, 2)].filter(item => item !== undefined)

  return <div className={`truck-banner player-${load.player}`}>
    <div className="truck-icon"><Truck size={26} aria-hidden="true" /></div>
    <div className="truck-current" aria-live="polite">
      <strong>{turn}</strong>
      <span>{load.bricks === 0 ? 'Out of bricks' : !sitesOpen ? 'All sites are reopening'
        : `Up to ${load.bricks} ${load.bricks === 1 ? 'brick' : 'bricks'} this turn`}</span>
    </div>
    {upcoming.length > 0 && <div className="truck-next" aria-label="Upcoming turn limits">
      <small>Upcoming limits</small>
      <div>{upcoming.map((item, index) => <span key={index}>{playerName(setup, item.player)} <b>{item.bricks}</b></span>)}</div>
    </div>}
    <div className="truck-actions">
      {load.bricks > 0 && sitesOpen && <div className="brick-picker" role="group" aria-label="Bricks to place">
        <span>Choose bricks</span>
        <div className="brick-options">
          {Array.from({ length: load.bricks }, (_, index) => {
            const count = index + 1
            return <button key={count} type="button" disabled={disabled} aria-pressed={count === amount}
              aria-label={`Place ${count} ${count === 1 ? 'brick' : 'bricks'}`}
              onClick={() => chooseAmount(count)}>{count}</button>
          })}
        </div>
      </div>}
      <button type="button" className="button skip-turn" disabled={disabled} onClick={skip}>
        <SkipForward size={15} aria-hidden="true" /> Skip turn
      </button>
    </div>
  </div>
}

function Scoreboard({ match, setup }: { match: Match; setup: GameSetup }) {
  const load = delivery(match)
  return <div className="scoreboard" aria-label="Stars earned">
    {match.scores.map((score, player) => <div key={player} className={`score player-${player}${load?.player === player ? ' active' : ''}`}>
      <span className="player-dot" aria-hidden="true" />
      <div className="score-name"><strong>{playerName(setup, player)}</strong>
        {setup.mode === 'computer' && player === 1 && <small>{DIFFICULTY_NAMES[setup.difficulty]}</small>}
        <small className="score-stock">{match.reserves[player]} / {BRICK_BUDGET} bricks</small>
      </div>
      <span className="score-value"><Stars count={score} /></span>
    </div>)}
  </div>
}

function MoveNote({ move, match, setup }: { move: Move; match: Match; setup: GameSetup }) {
  const name = playerName(setup, move.player)
  const action = move.site === null ? `skipped ${name === 'You' ? 'your' : 'their'} turn.`
    : move.stars ? `finished site ${move.site + 1} (${BUILDINGS[match.sites[move.site]].name.toLowerCase()}).`
    : `added ${move.bricks} ${move.bricks === 1 ? 'brick' : 'bricks'} to site ${move.site + 1}.`
  return <li className={`move-note player-${move.player}`}>
    <span className="player-dot" aria-hidden="true" />
    <span><strong>{name}</strong> {action}</span>
    {move.stars > 0 && <span className="earned">+<Stars count={move.stars} /></span>}
  </li>
}

function StrategyTips({ match }: { match: Match }) {
  const { easy, normal } = useMemo(() => ({
    easy: chooseMove(match, 'easy'),
    normal: match.scores.length === 2 ? chooseMove(match, 'normal') : undefined,
  }), [match])
  if (easy === undefined) return null
  const current = delivery(match)
  const rival = delivery(match, 1)
  const next = delivery(match, 2)
  let prompt = 'Before building, check what the next player could finish. A skip keeps your bricks for a later turn.'
  if (normal && current && rival && next) {
    for (const [site, kind] of match.sites.entries()) {
      if (turnsUntilOpen(match, site)) continue
      const left = bricksLeft(match, site)
      const setup = Math.max(1, left - next.bricks)
      const futureLimit = Math.min(next.bricks, match.reserves[current.player] - setup)
      if (left > current.bricks && left - current.bricks <= rival.bricks && setup <= current.bricks &&
        left - setup > rival.bricks && left - setup <= futureLimit) {
        prompt = `Try ${setup} ${setup === 1 ? 'brick' : 'bricks'} on site ${site + 1} (${BUILDINGS[kind].name}). It leaves ${left - setup}, within your next turn’s limit and out of your rival’s reach.`
        break
      }
    }
  }
  function describe({ site, bricks }: TurnAction) {
    if (site === null) return 'Skip turn'
    const name = BUILDINGS[match.sites[site]].name
    return `${name} #${site + 1} · ${bricks} ${bricks === 1 ? 'brick' : 'bricks'}`
  }

  return <details className="strategy">
    <summary><Lightbulb size={17} aria-hidden="true" /> Think it through</summary>
    <p>{prompt}</p>
    <dl>
      <div><dt>Easy <strong>{describe(easy)}</strong></dt><dd>Grabs the most stars it can win right now.</dd></div>
      {normal !== undefined && <div><dt>Normal <strong>{describe(normal)}</strong></dt><dd>Looks three moves ahead and weighs star opportunities and remaining bricks.</dd></div>}
    </dl>
    <p>A useful heuristic is to spend the fewest bricks that secure the stars, then check what you can afford next round.</p>
  </details>
}

function Results({ match, setup, restart }: { match: Match; setup: GameSetup; restart: () => void }) {
  const best = Math.max(...match.scores)
  const winners = match.scores.flatMap((score, player) => score === best ? [player] : [])
  const name = playerName(setup, winners[0])
  const title = winners.length > 1 ? 'A tie!' : name === 'You' ? 'You win!' : `${name} wins!`
  const subtitle = winners.length > 1 ? `${winners.map(player => playerName(setup, player)).join(', ')} · ${best} stars each` : `${best} stars`
  return <motion.section className="results" aria-labelledby="results-title" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
    <Trophy size={31} aria-hidden="true" />
    <div><h2 id="results-title">{title}</h2><p>{subtitle}</p></div>
    <button type="button" className="button primary" onClick={restart}>Play again <ArrowRight size={16} /></button>
  </motion.section>
}

interface Session {
  match: Match
  setup: GameSetup
}

export function App() {
  const [session, setSession] = useState<Session>(() => ({ match: createMatch(), setup: DEFAULT_SETUP }))
  const [modal, setModal] = useState<'help' | 'setup'>()
  const [focused, focus] = useState<number>()
  const [chosenBricks, chooseBricks] = useState<number>()
  const { match, setup } = session
  const load = delivery(match)
  const botTurn = load?.player === 1 && setup.mode === 'computer'
  const round = load?.round ?? ROUNDS
  const amount = chosenBricks ?? 0
  const sitesOpen = match.reopensAt.some(turn => turn <= match.moves.length)
  const canBuild = Boolean(load && !botTurn && sitesOpen && amount > 0)

  useEffect(() => {
    if (!botTurn || modal) return
    let worker: Worker | undefined
    let fallbackTimer: number | undefined
    const submit = (action: TurnAction | undefined) => {
      window.clearTimeout(fallbackTimer)
      worker?.terminate()
      if (action) setSession(current =>
        current === session ? { ...current, match: playMove(match, action) } : current)
    }
    const fallback = () => submit(chooseMove(match, 'normal'))
    const timer = window.setTimeout(() => {
      if (setup.difficulty !== 'hard') {
        submit(chooseMove(match, setup.difficulty))
        return
      }
      try {
        worker = new Worker(new URL('../game/bot.worker.ts', import.meta.url), { type: 'module' })
        worker.onmessage = (event: MessageEvent<TurnAction | undefined>) => submit(event.data ?? chooseMove(match, 'normal'))
        worker.onerror = fallback
        fallbackTimer = window.setTimeout(fallback, 3500)
        worker.postMessage(match)
      } catch {
        fallback()
      }
    }, 790)
    return () => {
      window.clearTimeout(timer)
      window.clearTimeout(fallbackTimer)
      worker?.terminate()
    }
  }, [botTurn, match, modal, session, setup.difficulty])

  function start(next: GameSetup, rematch = false) {
    const count = playerCount(next)
    const sites = BUILDING_TYPES.flatMap(kind => Array.from({ length: next.buildings[kind] }, () => kind))
    const nextMatch = createMatch({
      sites,
      startingBricks: next.firstTrucks.slice(0, count),
      firstPlayer: rematch ? (match.firstPlayer + 1) % count : next.mode === 'computer' ? next.firstPlayer : 0,
    })
    setSession({ match: nextMatch, setup: next })
    chooseBricks(undefined)
    focus(undefined)
    setModal(undefined)
  }

  function takeTurn(action: TurnAction) {
    if (!load || botTurn) return
    const next = playMove(match, action)
    if (next === match) return
    setSession(current => current === session ? { ...current, match: next } : current)
    chooseBricks(undefined)
    focus(undefined)
  }

  function build(site: number) {
    if (canBuild) takeTurn({ site, bricks: amount })
  }

  return <>
    <header className="main-header">
      <div className="shell header-inner">
        <div className="brand"><Construction size={24} aria-hidden="true" /><strong>Construction Strategy Game</strong></div>
        <div className="header-actions">
          <button type="button" className="header-help" aria-label="How to play" onClick={() => setModal('help')}><CircleHelp size={18} /> <span>How to play</span></button>
          <button type="button" className="button button-outline" onClick={() => setModal('setup')}><Plus size={17} /> New game</button>
        </div>
      </div>
    </header>
    <main className="shell">
      <section className="game-heading" aria-labelledby="game-title">
        <div><h1 id="game-title">Last Brick</h1><p>Place the last brick. Win the building’s stars.</p></div>
        <div className="round"><strong>Round {round} <span>of {ROUNDS}</span></strong>
          <div className="round-track" aria-hidden="true">{Array.from({ length: ROUNDS }, (_, index) =>
            <i key={index} className={index + 1 < round || !load ? 'settled' : index + 1 === round ? 'current' : ''} />,
          )}</div>
        </div>
      </section>
      <Scoreboard match={match} setup={setup} />
      <div className="game-layout">
        <div className="world">
          {load ? <TruckBanner match={match} setup={setup} amount={amount} disabled={botTurn} sitesOpen={sitesOpen}
            chooseAmount={chooseBricks} skip={() => takeTurn(SKIP_TURN)} />
            : <Results match={match} setup={setup} restart={() => start(setup, true)} />}
          <City match={match} disabled={!canBuild} focused={focused} focus={focus} build={build} />
          <div className="activity" role="status" aria-label="Latest moves">
            {match.moves.length > 0 && <ul>{match.moves.slice(-2).map((move, index) =>
              <MoveNote key={match.moves.length - 2 + index} move={move} match={match} setup={setup} />,
            )}</ul>}
          </div>
        </div>
        <aside className="turn-panel" aria-labelledby="site-title">
          <header><h2 id="site-title">{canBuild ? 'Pick a site' : 'Building sites'}</h2>
            {load && !botTurn && (canBuild ? <p>Choose a building on the map or here.</p>
              : load.bricks > 0 && sitesOpen && <p>Choose how many bricks to place first.</p>)}
          </header>
          <SiteList match={match} amount={amount} disabled={!canBuild} focused={focused} focus={focus} build={build} />
          {load && <StrategyTips match={match} />}
        </aside>
      </div>
    </main>
    {modal === 'help' && <Help close={() => setModal(undefined)} />}
    {modal === 'setup' && <Setup initial={setup} start={start} close={() => setModal(undefined)} />}
  </>
}
