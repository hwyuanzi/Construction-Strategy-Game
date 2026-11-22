import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Map as MapIcon, Navigation, Star } from 'lucide-react'
import { BUILDINGS, bricksLeft, delivery, isCopyCoolingDown, ROUNDS, turnsUntilOpen } from '../game/engine'
import type { Match } from '../game/engine'
import { BUILD_DURATION, completionTime, createTownRenderer, plots, TOWN_HEIGHT, TOWN_WIDTH, townProjection } from './town'
import type { BuildAnimation } from './town'

function TownCanvas({ match, focused, reduced }: { match: Match; focused?: number; reduced: boolean | null }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const background = useRef<HTMLCanvasElement>(null)
  const [renderer, setRenderer] = useState<ReturnType<typeof createTownRenderer>>()
  const focusRef = useRef(focused)
  const refresh = useRef<() => void>(undefined)
  const lastMatch = useRef(match)
  const animationsRef = useRef(new Map<number, BuildAnimation>())

  useEffect(() => {
    const ground = canvas.current
    const back = background.current
    const context = ground?.getContext('2d')
    const backContext = back?.getContext('2d', { alpha: false })
    if (!ground || !back || !context || !backContext) return

    const resize = () => {
      const width = Math.round(Math.min(TOWN_WIDTH * 2, ground.clientWidth * devicePixelRatio))
      if (!width || ground.width === width) return
      const height = Math.round(width * TOWN_HEIGHT / TOWN_WIDTH)
      ground.width = back.width = width
      ground.height = back.height = height
      context.setTransform(width / TOWN_WIDTH, 0, 0, height / TOWN_HEIGHT, 0, 0)
      backContext.setTransform(context.getTransform())
      setRenderer(createTownRenderer(context, backContext))
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(ground)
    window.addEventListener('resize', resize)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', resize)
    }
  }, [])

  useEffect(() => {
    if (!renderer) return
    renderer.drawEnvironment()
    const element = background.current
    if (reduced || !element) return

    let visible = false
    let frame = 0
    let elapsed = 0
    let lastTime = 0
    function draw(now: number) {
      if (now - lastTime >= 42) {
        elapsed += (now - lastTime) / 1000
        lastTime = now
        renderer?.drawEnvironment(elapsed)
      }
      frame = requestAnimationFrame(draw)
    }
    function sync() {
      cancelAnimationFrame(frame)
      if (visible && !document.hidden) {
        lastTime = performance.now()
        frame = requestAnimationFrame(draw)
      }
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      sync()
    })
    observer.observe(element)
    document.addEventListener('visibilitychange', sync)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener('visibilitychange', sync)
    }
  }, [reduced, renderer])

  useEffect(() => {
    if (!renderer) return
    const previous = lastMatch.current
    const latest = match.moves.at(-1)
    const animations = animationsRef.current
    if (previous.sites !== match.sites || reduced) animations.clear()
    else if (latest && latest.site !== null && match.moves.length > previous.moves.length) {
      animations.set(latest.site, { move: latest, start: performance.now() })
    }
    lastMatch.current = match

    let frame = 0
    function draw(now: number) {
      for (const [site, { start }] of animations) {
        if (now >= start + BUILD_DURATION) animations.delete(site)
      }
      renderer?.drawTown(match, now, animations, focusRef.current)
    }
    function animate(now: number) {
      draw(now)
      if (animations.size) frame = requestAnimationFrame(animate)
    }
    refresh.current = () => draw(performance.now())
    animate(performance.now())
    return () => {
      cancelAnimationFrame(frame)
      refresh.current = undefined
    }
  }, [match, reduced, renderer])

  useEffect(() => {
    focusRef.current = focused
    refresh.current?.()
  }, [focused])

  return <>
    <canvas ref={background} width={1} height={1} aria-hidden="true" />
    <canvas ref={canvas} width={1} height={1} aria-hidden="true" />
  </>
}

export function City({ match, disabled, focused, focus, build }: {
  match: Match
  disabled: boolean
  focused: number | undefined
  focus: (site?: number) => void
  build: (site: number) => void
}) {
  const reduced = useReducedMotion()
  const round = delivery(match)?.round
  const recent = match.moves.slice(-2)
  const lots = plots(match.sites.length)
  const projectSite = townProjection(match.sites, lots)
  const depthOrder = lots.map(([x, y], site) => ({ depth: x + y, site }))
    .sort((a, b) => a.depth - b.depth).map(({ site }) => site)

  return <section className="city" aria-labelledby="city-title">
    <div className="city-scene">
      <TownCanvas match={match} focused={focused} reduced={reduced} />
      <header className="map-toolbar">
        <h2 id="city-title" className="glass"><MapIcon size={16} aria-hidden="true" /> City map</h2>
        <div className="round glass">
          <strong>Round {round ?? ROUNDS} <span>of {ROUNDS}</span></strong>
          <div className="round-track" aria-hidden="true">{Array.from({ length: ROUNDS }, (_, index) =>
            <i key={index} className={!round || index + 1 < round ? 'settled' : index + 1 === round ? 'current' : ''} />,
          )}</div>
        </div>
      </header>
      <span className="compass glass" aria-hidden="true"><Navigation size={13} /> N</span>
      {lots.map(([x, y], site) => {
        const [left, top] = projectSite(x, y + .31)
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
          <button type="button" className={`map-target type-${kind}${focused === site ? ' highlighted' : ''}${closed ? ' site-closed' : ''}`}
            disabled={disabled || closed}
            aria-label={`Map site ${site + 1}, ${project.name}, ${remaining} ${remaining === 1 ? 'brick' : 'bricks'} left, ${project.stars} stars`}
            aria-description={reopening ? `Reopens in ${reopening} ${reopening === 1 ? 'turn' : 'turns'}` : closed ? 'Cooldown for 1 turn' : undefined}
            onPointerEnter={() => focus(site)} onPointerLeave={() => focus()} onFocus={() => focus(site)} onBlur={() => focus()}
            onClick={() => build(site)}>
            <span className="site-badge" aria-hidden="true">{site + 1}</span>
          </button>
          {recent.map((move, index) => move.site === site && move.stars > 0 && <motion.span
            key={match.moves.length - recent.length + index} className="map-reward" aria-hidden="true"
            initial={{ opacity: 0, y: 4 }} animate={reduced ? { opacity: [0, 1, 0] } : { opacity: [0, 1, 1, 0], y: [4, 0, -14, -24], scale: [.87, 1, 1, 1] }}
            transition={reduced ? { duration: .68 } : { delay: completionTime(move.bricks) / 1000, duration: .70, times: [0, .20, .68, 1] }}>
            +{move.stars} <Star size={14} />
          </motion.span>)}
        </div>
      })}
    </div>
  </section>
}
