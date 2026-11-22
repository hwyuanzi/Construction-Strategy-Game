import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Bot, Building2, Check, ChevronDown, CircleHelp, Clock3, History, Lightbulb, Plus, ShoppingCart, SkipForward, Star, Trophy, Truck, UserRound, Volume2, VolumeX } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { BONUS_CARDS, BRICK_BUDGET, BUILDINGS, BUILDING_TYPES, buildLimit, bricksLeft, canPlaceBricks, CARD_TYPES, createMatch, delivery, isCopyCoolingDown, isSiteOpen, maxBuildLimit, playMove, SKIP_TURN, turnsUntilOpen } from '../game/engine'
import type { BonusCard, Match, Move, TurnAction } from '../game/engine'
import HardWorker from '../game/bot.worker?worker&inline'
import { chooseMove, DIFFICULTY_NAMES } from '../game/planner'
import { BuildingArt } from './BuildingArt'
import { City } from './City'
import { Guide } from './Guide'
import { DEFAULT_SETUP, playerCount, playerName, Setup } from './Setup'
import type { GameSetup } from './Setup'
import { useGameAudio } from './useGameAudio'

function Stars({ count }: { count: number }) {
  return <span className="stars"><Star size={16} aria-hidden="true" /><b>{count}</b><span className="sr-only"> stars</span></span>
}

function SiteList({ match, amount, disabled, focused, focus, build }: {
  match: Match
  amount: number
  disabled: boolean
  focused?: number
  focus: (site?: number) => void
  build: (site: number) => void
}) {
  const rivalLimit = maxBuildLimit(match, delivery(match, 1))
  return <div className="site-list" aria-label="Building sites">
    {match.sites.map((kind, site) => {
      const project = BUILDINGS[kind]
      const remaining = bricksLeft(match, site)
      const reopening = turnsUntilOpen(match, site)
      const onCooldown = isCopyCoolingDown(match, site)
      const blocked = disabled || reopening > 0 || onCooldown
      const canFinish = !blocked && remaining <= amount
      const exposesFinish = !blocked && !canFinish && remaining - amount <= rivalLimit
      const preview = reopening ? `Reopens in ${reopening} ${reopening === 1 ? 'turn' : 'turns'}`
        : onCooldown ? 'Cooldown · 1 turn'
        : canFinish ? (remaining < amount ? `Finish with ${remaining}` : 'Finish now')
        : exposesFinish ? 'Next can finish' : undefined
      return <button type="button" className={`site-card type-${kind}${focused === site ? ' highlighted' : ''}${reopening || onCooldown ? ' site-closed' : ''}`}
        key={site} disabled={blocked} data-sound="handled" onClick={() => build(site)}
        onPointerEnter={() => focus(site)} onPointerLeave={() => focus()} onFocus={() => focus(site)} onBlur={() => focus()}
        aria-label={`Build ${project.name}, site ${site + 1}, ${remaining} ${remaining === 1 ? 'brick' : 'bricks'} left, ${project.stars} stars`}
        aria-description={preview}>
        <span className="site-badge" aria-hidden="true">{site + 1}</span>
        <span className="site-art"><BuildingArt type={kind} /></span>
        <span className="site-info">
          <strong>{project.name}</strong>
          <span className="site-progress">
            <span className="site-need">{remaining} {remaining === 1 ? 'brick' : 'bricks'} left</span>
            <span className="brick-track" aria-hidden="true">
              {Array.from({ length: project.bricks }, (_, brick) => <i key={brick} className={brick < match.progress[site] ? 'filled' : ''} />)}
            </span>
          </span>
          {preview && <span className={`finish-flag${exposesFinish ? ' risk-flag' : ''}${reopening || onCooldown ? ' reopening-flag' : ''}`}>
            {canFinish && <Check size={12} aria-hidden="true" />}{(reopening > 0 || onCooldown) && <Clock3 size={11} aria-hidden="true" />}{preview}
          </span>}
        </span>
        <span className="site-value"><Stars count={project.stars} /></span>
      </button>
    })}
  </div>
}

function TurnControls({ match, setup, amount, card, disabled, sitesOpen, chooseAmount, chooseCard, skip }: {
  match: Match
  setup: GameSetup
  amount: number
  card?: BonusCard
  disabled: boolean
  sitesOpen: boolean
  chooseAmount: (amount: number) => void
  chooseCard: (card: BonusCard) => void
  skip: () => void
}) {
  const load = delivery(match)
  if (!load) return null
  const name = playerName(setup, load.player)
  const turn = name === 'You' ? 'Your turn' : name === 'Computer' ? 'Computer’s turn' : `${name}’s turn`
  const upcoming = [delivery(match, 1), delivery(match, 2)].filter(item => item !== undefined)
  const limit = buildLimit(match, load, card)
  const forced = !canPlaceBricks(match, load)
  const unavailable = !sitesOpen ? (match.sites.some((_, site) => isCopyCoolingDown(match, site)) ? 'No sites available this turn' : 'All sites are reopening')
    : (forced ? 'Out of bricks' : 'Use Brick Cart to build')

  return <section className={`turn-card glass player-${load.player}`} aria-labelledby="turn-title">
    <header className="turn-header">
      <span className="section-icon" aria-hidden="true">{disabled ? <Bot size={19} /> : <Truck size={19} />}</span>
      <div className="truck-current" aria-live="polite">
        <h2 id="turn-title">{turn}</h2>
        <p>{disabled ? 'Choosing a move…' : sitesOpen && limit > 0 ? `Up to ${limit} ${limit === 1 ? 'brick' : 'bricks'} this turn` : unavailable}</p>
      </div>
    </header>
    {sitesOpen && (!forced || limit > 0) && <div className="turn-options">
      {limit > 0 && <div className="brick-picker" role="group" aria-label="Bricks to place">
        <h3>{amount > 0 ? 'Choose a site on the map or list' : 'Choose bricks'}</h3>
        <div className="brick-options">
          {Array.from({ length: limit }, (_, index) => {
            const count = index + 1
            return <button key={count} type="button" disabled={disabled} aria-pressed={count === amount}
              aria-label={`Place ${count} ${count === 1 ? 'brick' : 'bricks'}`}
              onClick={() => chooseAmount(count)}>{count}</button>
          })}
        </div>
      </div>}
      <div className="bonus-tools">
        <h3>Bonus cards</h3>
        <div className="bonus-cards" role="group" aria-label="Bonus cards">
          {CARD_TYPES.map(kind => {
            const used = !match.cards[load.player].includes(kind)
            const bonus = BONUS_CARDS[kind]
            const Icon = kind === 'doubleLoad' ? Truck : ShoppingCart
            return <button key={kind} type="button" className="bonus-card" data-sound="wood"
              disabled={disabled || used || buildLimit(match, load, kind) <= load.bricks}
              aria-pressed={card === kind} onClick={() => chooseCard(kind)}>
              <span className="card-icon"><Icon size={16} aria-hidden="true" /></span>
              <span><strong>{bonus.name}</strong><small>{used ? 'Used' : kind === 'doubleLoad' ? '2× turn limit' : '2 free bricks'}</small></span>
              {card === kind && <Check className="card-check" size={12} aria-hidden="true" />}
            </button>
          })}
        </div>
      </div>
    </div>}
    <footer className="turn-footer">
      {upcoming.length > 0 && <details className="truck-next">
        <summary>Upcoming limits <ChevronDown size={13} aria-hidden="true" /></summary>
        <ul>{upcoming.map((item, index) =>
          <li key={index}>{playerName(setup, item.player)} <b>{item.bricks} {item.bricks === 1 ? 'brick' : 'bricks'}</b></li>,
        )}</ul>
      </details>}
      <button type="button" className={`button ${forced ? 'primary' : 'skip-turn'}`}
        disabled={disabled || (!forced && match.skips[load.player] === 0)} data-sound="handled" onClick={skip}
        aria-describedby="skip-description">
        <SkipForward size={15} aria-hidden="true" /> {forced ? 'Pass turn' : 'Skip turn'}
        {!forced && <span className="skip-count" aria-hidden="true">{match.skips[load.player]} left</span>}
      </button>
      <span id="skip-description" className="sr-only">{forced ? 'Passing is free.' : `${match.skips[load.player]} skips left`}</span>
    </footer>
  </section>
}

function PlayerIcon({ setup, player }: { setup: GameSetup; player: number }) {
  return <span className="score-icon" aria-hidden="true">{setup.mode === 'computer' && player === 1 ? <Bot size={19} /> : <UserRound size={18} />}</span>
}

function Scoreboard({ match, setup }: { match: Match; setup: GameSetup }) {
  const load = delivery(match)
  return <section className="scoreboard" aria-label="Scoreboard" data-players={match.scores.length}>
    {match.scores.map((score, player) => {
      const active = load?.player === player
      const difficulty = setup.mode === 'computer' && player === 1 ? DIFFICULTY_NAMES[setup.difficulty] : undefined
      const skips = match.skips[player]
      const cards = match.cards[player].length
      return <div key={player} className={`score player-${player}${active ? ' active' : ''}`}>
        <div className="score-identity">
          <div className="score-name"><span className="player-dot" aria-hidden="true" /><strong>{playerName(setup, player)}</strong></div>
          {(active || difficulty) && <div className="score-meta">
            {active && <span className="score-turn">Current turn</span>}
            {difficulty && <span>{difficulty}</span>}
          </div>}
        </div>
        <span className="score-value"><Stars count={score} /></span>
        <div className="score-stock">
          <span><b>{match.reserves[player]}</b> / {BRICK_BUDGET} bricks</span>
          <span>{skips} {skips === 1 ? 'skip' : 'skips'} · {cards} {cards === 1 ? 'card' : 'cards'}</span>
        </div>
      </div>
    })}
  </section>
}

function MoveNote({ move, match, setup }: { move: Move; match: Match; setup: GameSetup }) {
  const name = playerName(setup, move.player)
  const action = move.site === null ? (move.forced ? 'passed with no legal build.' : `skipped ${name === 'You' ? 'your' : 'their'} turn.`)
    : move.stars ? `finished site ${move.site + 1} (${BUILDINGS[match.sites[move.site]].name.toLowerCase()}).`
    : `added ${move.bricks} ${move.bricks === 1 ? 'brick' : 'bricks'} to site ${move.site + 1}.`
  return <li className={`move-note player-${move.player}`}>
    <span className="player-dot" aria-hidden="true" />
    <span><strong>{name}</strong> {action}{move.site !== null && move.card && <> Used {BONUS_CARDS[move.card].name}.</>}</span>
    {move.stars > 0 && <span className="earned">+<Stars count={move.stars} /></span>}
  </li>
}

function StrategyTips({ match }: { match: Match }) {
  const { easy, normal } = useMemo(() => ({
    easy: chooseMove(match, 'easy'),
    normal: match.scores.length === 2 ? chooseMove(match, 'normal') : undefined,
  }), [match])
  if (easy === undefined) return null
  function describe(action: TurnAction) {
    if (action.site === null) return canPlaceBricks(match) ? 'Skip turn' : 'Pass turn'
    const name = BUILDINGS[match.sites[action.site]].name
    const bonus = action.card ? ` · ${BONUS_CARDS[action.card].name}` : ''
    return `${name} #${action.site + 1} · ${action.bricks} ${action.bricks === 1 ? 'brick' : 'bricks'}${bonus}`
  }

  return <details className="strategy">
    <summary><Lightbulb size={16} aria-hidden="true" /> Think it through <ChevronDown size={14} aria-hidden="true" /></summary>
    <p>Check the next player’s bonus cards before leaving an open site close to completion.</p>
    <dl>
      <div><dt>Easy <strong>{describe(easy)}</strong></dt><dd>Grabs the most stars it can win right now.</dd></div>
      {normal !== undefined && <div><dt>Normal <strong>{describe(normal)}</strong></dt><dd>Looks three moves ahead and weighs star opportunities and remaining bricks.</dd></div>}
    </dl>
    <p>Save your skips for turns that would hand someone else a finish. Even when matching sites cool down, the last site worked on stays playable until it’s finished.</p>
  </details>
}

function Results({ match, setup, restart }: { match: Match; setup: GameSetup; restart: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null)
  const reduced = useReducedMotion()
  useEffect(() => heading.current?.focus(), [])
  const standings = match.scores.map((score, player) => ({ score, player })).sort((a, b) => b.score - a.score)
  const top = standings[0]
  const name = playerName(setup, top.player)
  const title = standings[1]?.score === top.score ? 'A tie!' : name === 'You' ? 'You win!' : `${name} wins!`
  return <motion.section className="results" aria-labelledby="results-title" initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }}>
    <header className="results-header">
      <span className="trophy-icon"><Trophy size={24} aria-hidden="true" /></span>
      <h2 ref={heading} tabIndex={-1} id="results-title">{title}</h2>
      <button type="button" className="button primary" data-sound="wood" onClick={restart}>Play again <ArrowRight size={16} aria-hidden="true" /></button>
    </header>
    <h3 id="leaderboard-title">Leaderboard</h3>
    <ol className="leaderboard" aria-labelledby="leaderboard-title" role="list">
      {standings.map(({ score, player }) => {
        const rank = standings.findIndex(entry => entry.score === score) + 1
        return <li className={`standing player-${player}`} key={player}>
          <span className="standing-rank"><span className="sr-only">Rank </span>{rank}</span>
          <PlayerIcon setup={setup} player={player} />
          <strong>{playerName(setup, player)}</strong>
          <Stars count={score} />
        </li>
      })}
    </ol>
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
  const [chosenCard, chooseCard] = useState<BonusCard>()
  const { match, setup } = session
  const audio = useGameAudio(match, setup.mode === 'computer')
  const load = delivery(match)
  const botTurn = load?.player === 1 && setup.mode === 'computer'
  const amount = chosenBricks ?? 0
  const sitesOpen = match.sites.some((_, site) => isSiteOpen(match, site))
  const canChooseBricks = Boolean(load && !botTurn && sitesOpen && buildLimit(match, load, chosenCard) > 0)
  const canBuild = canChooseBricks && amount > 0

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
        worker = new HardWorker()
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
    chooseCard(undefined)
    focus(undefined)
    setModal(undefined)
  }

  function takeTurn(action: TurnAction) {
    if (!load || botTurn) return
    const next = playMove(match, action)
    if (next === match) return
    setSession(current => current === session ? { ...current, match: next } : current)
    chooseBricks(undefined)
    chooseCard(undefined)
    focus(undefined)
  }

  function build(site: number) {
    if (canBuild) takeTurn({ site, bricks: amount, card: chosenCard })
  }

  function toggleCard(card: BonusCard) {
    if (!load) return
    const next = chosenCard === card ? undefined : card
    if (amount > buildLimit(match, load, next)) chooseBricks(undefined)
    chooseCard(next)
  }

  return <div onClickCapture={event => {
    const control = event.target instanceof Element && event.target.closest('button:not(:disabled), summary')
    const cue = control && control.getAttribute('data-sound')
    if (control && cue !== 'handled') audio.click(cue === 'wood')
  }}>
    <header className="shell main-header">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
        <h1><span>Last</span>{' '}<span>Brick</span></h1>
      </div>
      <div className="header-actions">
        <button type="button" className="button glass header-sound" aria-label="Game sound" aria-pressed={audio.enabled}
          title={audio.enabled ? 'Mute sound' : 'Turn sound on'} data-sound="handled" onClick={audio.toggle}>
          {audio.enabled ? <Volume2 size={17} aria-hidden="true" /> : <VolumeX size={17} aria-hidden="true" />}
        </button>
        <button type="button" className="button glass header-action header-help" onClick={() => setModal('help')}><CircleHelp size={17} aria-hidden="true" /> How to play</button>
        <button type="button" className="button primary header-action" data-sound="wood" onClick={() => setModal('setup')}><Plus size={17} aria-hidden="true" /> New game</button>
      </div>
    </header>
    <main className="shell game-layout">
      <div className="world">
        {load ? <Scoreboard match={match} setup={setup} /> : <Results match={match} setup={setup} restart={() => start(setup, true)} />}
        <City match={match} disabled={!canBuild} focused={focused} focus={focus} build={build} />
        {load && <TurnControls match={match} setup={setup} amount={amount} card={chosenCard} disabled={botTurn} sitesOpen={sitesOpen}
          chooseAmount={chooseBricks} chooseCard={toggleCard} skip={() => takeTurn(SKIP_TURN)} />}
        <div className="activity" role="status">
          {match.moves.length > 0 && <>
            <h2><History size={15} aria-hidden="true" /> Recent moves</h2>
            <ul>{match.moves.slice(-2).map((move, index, moves) =>
              <MoveNote key={match.moves.length - moves.length + index} move={move} match={match} setup={setup} />,
            )}</ul>
          </>}
        </div>
      </div>
      <div className="site-rail">
        <aside className={`site-panel${canBuild ? ' ready' : ''}`} aria-labelledby="site-title">
          <header aria-live="polite">
            <span className="section-icon" aria-hidden="true"><Building2 size={19} /></span>
            <h2 id="site-title">{canBuild ? 'Pick a site' : 'Building sites'}</h2>
          </header>
          <SiteList match={match} amount={amount} disabled={!canBuild} focused={focused} focus={focus} build={build} />
          {load && <StrategyTips match={match} />}
        </aside>
      </div>
    </main>
    {modal === 'help' && <Guide close={() => setModal(undefined)} />}
    {modal === 'setup' && <Setup initial={setup} start={start} close={() => setModal(undefined)} />}
  </div>
}
