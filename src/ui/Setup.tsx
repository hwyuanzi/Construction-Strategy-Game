import { useState } from 'react'
import { ArrowRight, Bot, Minus, Plus, Star, Users } from 'lucide-react'
import { BRICK_BUDGET, BUILDINGS, BUILDING_TYPES, DEFAULT_STARTING_BRICKS, MAX_PLAYERS, MAX_SITES, MAX_STARTING_BRICKS, MIN_PLAYERS, TURN_LIMIT } from '../game/engine'
import type { Building } from '../game/engine'
import { DIFFICULTIES, DIFFICULTY_NAMES } from '../game/planner'
import type { Difficulty } from '../game/planner'
import { BuildingArt } from './BuildingArt'
import { Dialog } from './Dialog'

export interface GameSetup {
  mode: 'computer' | 'friends'
  difficulty: Difficulty
  players: number
  firstPlayer: 0 | 1
  firstTrucks: readonly number[]
  buildings: Record<Building, number>
}

export const DEFAULT_SETUP: GameSetup = {
  mode: 'computer',
  difficulty: 'normal',
  players: 2,
  firstPlayer: 0,
  firstTrucks: Array.from({ length: MAX_PLAYERS }, () => DEFAULT_STARTING_BRICKS),
  buildings: { house: 1, library: 0, commercial: 1, apartment: 0, skyscraper: 1 },
}

export function playerCount(setup: GameSetup) {
  return setup.mode === 'computer' ? 2 : setup.players
}

export function playerName(setup: GameSetup, player: number) {
  if (setup.mode === 'friends') return `Player ${player + 1}`
  return player === 0 ? 'You' : 'Computer'
}

const difficultyHelp = {
  easy: 'Grabs the most stars it can win now.',
  normal: 'Plans a move, your reply, and its next move.',
  hard: 'Searches up to twelve moves.',
}

export function Setup({ initial, start, close }: {
  initial: GameSetup
  start: (setup: GameSetup) => void
  close: () => void
}) {
  const [draft, setDraft] = useState(initial)
  const total = BUILDING_TYPES.reduce((sum, building) => sum + draft.buildings[building], 0)
  const count = playerCount(draft)

  function changeBuildings(kind: Building, change: number) {
    setDraft(current => {
      const count = current.buildings[kind] + change
      const nextTotal = Object.values(current.buildings).reduce((sum, value) => sum + value, 0) + change
      if (count < 0 || nextTotal > MAX_SITES) return current
      return { ...current, buildings: { ...current.buildings, [kind]: count } }
    })
  }

  return <Dialog title="Set up your city" wide onClose={close}>
    <div className="setup-grid">
      <div className="setup-players">
        <fieldset>
          <legend>Who’s playing?</legend>
          <div className="mode-options">
            <button type="button" aria-pressed={draft.mode === 'computer'} onClick={() => setDraft({ ...draft, mode: 'computer' })}>
              <Bot size={19} /> Vs. computer
            </button>
            <button type="button" aria-pressed={draft.mode === 'friends'} onClick={() => setDraft({ ...draft, mode: 'friends' })}>
              <Users size={19} /> Pass &amp; play
            </button>
          </div>
        </fieldset>
        {draft.mode === 'computer' ? <><fieldset>
          <legend>Computer difficulty</legend>
          <div className="segment">
            {DIFFICULTIES.map(difficulty => <button type="button" key={difficulty} aria-pressed={draft.difficulty === difficulty}
              onClick={() => setDraft({ ...draft, difficulty })}>{DIFFICULTY_NAMES[difficulty]}</button>)}
          </div>
          <p className="field-note">{difficultyHelp[draft.difficulty]}</p>
        </fieldset><fieldset>
          <legend>Who starts?</legend>
          <div className="segment">
            <button type="button" aria-pressed={draft.firstPlayer === 0} onClick={() => setDraft({ ...draft, firstPlayer: 0 })}>You</button>
            <button type="button" aria-pressed={draft.firstPlayer === 1} onClick={() => setDraft({ ...draft, firstPlayer: 1 })}>Computer</button>
          </div>
        </fieldset></> : <fieldset>
          <legend>Number of players</legend>
          <div className="segment">
            {Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, index) => index + MIN_PLAYERS).map(players =>
              <button type="button" key={players} aria-pressed={draft.players === players}
                onClick={() => setDraft({ ...draft, players })}>{players}</button>,
            )}
          </div>
          <p className="field-note">Take turns on this device.</p>
        </fieldset>}
        <fieldset>
          <legend>First-turn limits</legend>
          <p className="field-note opening-limit-note">Each player has {BRICK_BUDGET} bricks for the game. Later turns have a limit of {TURN_LIMIT}.</p>
          <div className="load-options">
            {Array.from({ length: count }, (_, index) => {
              const name = playerName(draft, index)
              return <label key={index} className={`load-option player-${index}`}>
                <span><i className="player-dot" /> {name}</span>
                <select aria-label={`First-turn limit for ${name}`} value={draft.firstTrucks[index]} onChange={event => {
                  const bricks = Number(event.target.value)
                  setDraft(current => ({ ...current, firstTrucks: current.firstTrucks.map((value, player) => player === index ? bricks : value) }))
                }}>
                  {Array.from({ length: MAX_STARTING_BRICKS }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
                </select>
              </label>
            })}
          </div>
        </fieldset>
      </div>
      <section className="setup-buildings" aria-labelledby="buildings-title">
        <header><h3 id="buildings-title">City buildings</h3><span aria-live="polite">{total} / {MAX_SITES} sites</span></header>
        <div className="building-options">
          {BUILDING_TYPES.map(kind => {
            const { name, stars, bricks } = BUILDINGS[kind]
            const qty = draft.buildings[kind]
            return <div className="building-option" key={kind}>
              <div className={`option-art type-${kind}`}><BuildingArt type={kind} /></div>
              <div className="building-info">
                <strong>{name}</strong>
                <small>{bricks} bricks <span aria-hidden="true">·</span> <Star size={11} aria-label="stars" /> {stars}</small>
              </div>
              <div className="stepper" aria-label={`${name} count`}>
                <button type="button" aria-label={`Remove ${name}`} disabled={!qty} onClick={() => changeBuildings(kind, -1)}><Minus size={15} /></button>
                <output aria-label={name + ' quantity'}>{qty}</output>
                <button type="button" aria-label={`Add ${name}`} disabled={total >= MAX_SITES} onClick={() => changeBuildings(kind, 1)}><Plus size={15} /></button>
              </div>
            </div>
          })}
        </div>
      </section>
    </div>
    <footer className="setup-footer">
      {total === 0 && <p>Choose at least one building.</p>}
      <button type="button" className="button primary" disabled={total === 0} onClick={() => start(draft)}>Start game <ArrowRight size={17} /></button>
    </footer>
  </Dialog>
}
