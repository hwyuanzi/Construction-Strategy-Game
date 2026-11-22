import { ArrowRight, ChevronDown, Layers3, MapPin, Star } from 'lucide-react'
import { BRICK_BUDGET, ROUNDS, SKIP_LIMIT, TURN_LIMIT } from '../game/engine'
import { Dialog } from './Dialog'

export function Guide({ close }: { close: () => void }) {
  return <Dialog title="How to play" onClose={close}>
    <p className="guide-intro">Score the most stars in {ROUNDS} rounds.</p>
    <ol className="guide-steps" role="list">
      <li>
        <span className="guide-icon"><Layers3 size={20} aria-hidden="true" /></span>
        <div><strong>Choose bricks</strong><p>Pick how many bricks to place this turn.</p></div>
      </li>
      <li>
        <span className="guide-icon"><MapPin size={20} aria-hidden="true" /></span>
        <div><strong>Pick a site</strong><p>Choose one site on the map or in the list.</p></div>
      </li>
      <li>
        <span className="guide-icon"><Star size={20} aria-hidden="true" /></span>
        <div><strong>Claim the stars</strong><p>Place the last brick to earn the building’s stars.</p></div>
      </li>
    </ol>
    <details className="guide-rules">
      <summary>Full rules <ChevronDown size={16} aria-hidden="true" /></summary>
      <ol className="rules" role="list">
        <li><strong>Brick supply</strong><p>You get {BRICK_BUDGET} bricks for the game. After the opening round, you can use up to {TURN_LIMIT} per turn. If a site needs fewer bricks than you chose, you only use what it needs.</p></li>
        <li><strong>Skips and passes</strong><p>You can skip {SKIP_LIMIT} times to save your bricks. Passing is free when you have no legal build.</p></li>
        <li><strong>Matching sites</strong><p>After you build, other sites of the same type cool down for one turn. The next player can still build on your site if it’s unfinished.</p></li>
        <li><strong>Bonus cards</strong><p>You get one Double Load and one Brick Cart. Double Load doubles your turn limit using your supply. Brick Cart supplies the first two bricks for free. You can use one card per build.</p></li>
        <li><strong>Reopening sites</strong><p>A finished site reopens with an empty foundation after everyone takes one more turn.</p></li>
      </ol>
    </details>
    <footer className="guide-footer"><button type="button" className="button primary" onClick={close}>Let’s build <ArrowRight size={16} /></button></footer>
  </Dialog>
}
