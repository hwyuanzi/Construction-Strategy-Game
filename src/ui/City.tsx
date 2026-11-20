import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Map, Navigation, Star } from 'lucide-react'
import { BUILDINGS, bricksLeft, isCopyCoolingDown, turnsUntilOpen } from '../game/engine'
import type { Match } from '../game/engine'
import { BUILD_DURATION, BUILDING_COLORS, paintTown, plots, projectPoint, TOWN_HEIGHT, TOWN_WIDTH } from './town'

export function City({ match, disabled, focused, focus, build }: {
  match: Match
  disabled: boolean
  focused: number | undefined
  focus: (site?: number) => void
  build: (site: number) => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const focusRef = useRef(focused)
  const refresh = useRef<() => void>(undefined)
  const reduced = useReducedMotion()
  const latest = match.moves.at(-1)
  const lots = plots(match.sites.length)
  const depthOrder = lots.map(([x, y], site) => ({ depth: x + y, site }))
    .sort((a, b) => a.depth - b.depth).map(({ site }) => site)

  useEffect(() => {
    const element = canvas.current
    const context = element?.getContext('2d')
    if (!element || !context) return
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    element.width = TOWN_WIDTH * ratio
    element.height = TOWN_HEIGHT * ratio
    context.setTransform(ratio, 0, 0, ratio, 0, 0)

    let time = latest && latest.site !== null && !reduced ? 0 : 1
    let frame = 0
    const start = performance.now()
    const draw = () => paintTown(context, match, time, focusRef.current)
    const animate = (now: number) => {
      time = Math.min(1, (now - start) / BUILD_DURATION)
      draw()
      if (time < 1) frame = requestAnimationFrame(animate)
    }
    refresh.current = draw
    draw()
    if (time < 1) frame = requestAnimationFrame(animate)
    return () => {
      window.cancelAnimationFrame(frame)
      refresh.current = undefined
    }
  }, [latest, match, reduced])

  useEffect(() => {
    focusRef.current = focused
    refresh.current?.()
  }, [focused])

  return <section className="city" aria-labelledby="city-title">
    <header className="city-header">
      <h2 id="city-title"><Map size={19} aria-hidden="true" /> City map</h2>
      {disabled ? <span>{match.sites.length} {match.sites.length === 1 ? 'site' : 'sites'}</span>
        : <span className="map-prompt">Pick a numbered site</span>}
    </header>
    <div className="city-scene">
      <canvas ref={canvas} width={TOWN_WIDTH} height={TOWN_HEIGHT} aria-hidden="true" />
      <span className="compass" aria-hidden="true"><Navigation size={14} /> N</span>
      {lots.map(([x, y], site) => {
        const [left, top] = projectPoint(x, y + .31)
        const kind = match.sites[site]
        const project = BUILDINGS[kind]
        const remaining = bricksLeft(match, site)
        const reopening = turnsUntilOpen(match, site)
        const closed = reopening > 0 || isCopyCoolingDown(match, site)
        const position = {
          left: (left / TOWN_WIDTH * 100) + '%',
          top: (top / TOWN_HEIGHT * 100) + '%',
          '--lot-layer': depthOrder.indexOf(site) + 1,
        } as CSSProperties
        return <div key={site} className="map-lot" style={position}>
          <button type="button" className={`map-target type-${kind}${focused === site ? ' highlighted' : ''}${closed ? ' map-closed' : ''}`}
            disabled={disabled || closed} style={{ color: BUILDING_COLORS[kind] }}
            aria-label={`Map site ${site + 1}, ${project.name}, ${remaining} ${remaining === 1 ? 'brick' : 'bricks'} left, ${project.stars} stars`}
            aria-description={reopening ? `Reopens in ${reopening} ${reopening === 1 ? 'turn' : 'turns'}` : closed ? 'Cooldown for 1 turn' : undefined}
            onPointerEnter={() => focus(site)} onPointerLeave={() => focus()} onFocus={() => focus(site)} onBlur={() => focus()}
            onClick={() => build(site)}>
            <span>{site + 1}</span>
          </button>
          {latest?.site === site && latest.stars > 0 && <motion.span key={match.moves.length} className="map-reward" aria-hidden="true"
            initial={{ opacity: 0, y: 4 }} animate={reduced ? { opacity: [0, 1, 0] } : { opacity: [0, 1, 1, 0], y: [4, 0, -20, -30] }}
            transition={{ duration: .92 }}>
            +{latest.stars} <Star size={14} />
          </motion.span>}
        </div>
      })}
    </div>
  </section>
}
