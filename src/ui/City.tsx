import { useEffect, useRef, useState } from 'react'
import { Check, Clock3, HardHat, Minus, Navigation, Plus, X } from 'lucide-react'
import { useReducedMotion } from 'framer-motion'
import { currentStage } from '../game/engine'
import type { MatchState, Project } from '../game/types'
import { TOWN_HEIGHT, TOWN_WIDTH, elevation, paintTown, plots, projectPoint } from './town'

function SiteDetail({ site, match, close }: { site: Project; match: MatchState; close: () => void }) {
  const stage = site.status === 'active' ? currentStage(match.mode, site) : undefined
  return <div className="site-detail">
    <div className="flex items-start justify-between gap-3">
      <div><div className="subtle-label">{match.companies[site.seat].name}</div><h3>{site.name}</h3></div>
      <button type="button" className="icon-button compact" aria-label="Close site details" onClick={close}><X size={15} /></button>
    </div>
    {stage ? <>
      <div className="site-stage"><HardHat size={15} /><span>{stage.name}</span><strong>{site.work}/{stage.work} shifts</strong></div>
      <progress className="site-progress" max={stage.work} value={site.work} aria-label={stage.name + ' progress'} />
      <div className="site-stage"><Clock3 size={14} /><span>Due week {site.due}</span><strong>{stage.crane ? 'Crane needed' : 'Crew only'}</strong></div>
    </> : <p className="site-stage"><Check size={15} /> {site.status === 'complete' ? 'Completed' : site.status}</p>}
  </div>
}

export function City({ match, previous, activeSeat, building }: {
  match: MatchState
  previous?: MatchState
  activeSeat?: number
  building: boolean
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const reduced = useReducedMotion()
  const [selected, select] = useState<string>()
  const [zoom, setZoom] = useState(1)
  const displayed = match.projects.find(site => site.id === selected)
  const targets = plots(match).filter(plot => plot.site && ['active', 'complete'].includes(plot.site.status))

  useEffect(() => {
    const element = canvas.current
    const context = element?.getContext('2d')
    if (!context || !element) return
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    element.width = TOWN_WIDTH * ratio
    element.height = TOWN_HEIGHT * ratio
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    if (!previous || reduced) {
      paintTown(context, match)
      return
    }
    let frame = 0
    const start = performance.now()
    const draw = (now: number) => {
      const progress = Math.min((now - start) / 950, 1)
      paintTown(context, match, previous, 1 - (1 - progress) ** 2)
      if (progress < 1) frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [match, previous, reduced])

  return <section className="city-card" aria-labelledby="city-title">
    <h2 id="city-title" className="sr-only">City overview</h2>
    <div className="city-scene">
      <div className="map-label">{building ? 'Construction update' : 'Site map'}</div>
      <div className="city-art" style={{ transform: `scale(${zoom})` }}>
        <canvas ref={canvas} width={TOWN_WIDTH} height={TOWN_HEIGHT} aria-hidden="true" />
        {targets.map(({ site, x, y }) => {
          if (!site) return null
          const [left, top] = projectPoint(x, y, elevation(site, match) + 0.22)
          return <button key={site.id} type="button"
            className={`site-pin seat-${site.seat} ${site.seat === activeSeat ? 'own-pin' : ''} ${site.status === 'complete' ? 'complete-pin' : ''}`}
            style={{ left: `${left / TOWN_WIDTH * 100}%`, top: `${top / TOWN_HEIGHT * 100}%` }}
            aria-label={match.companies[site.seat].name + ' ' + site.name}
            aria-expanded={selected === site.id} onClick={() => select(selected === site.id ? undefined : site.id)}>
            {site.status === 'complete' ? <Check size={12} /> : <span className="pin-dot" />}
            <span>{site.type === 'house' ? 'House' : site.type === 'commercial' ? 'Office' : 'Tower'}</span>
          </button>
        })}
      </div>
      <div className="compass" aria-hidden="true"><Navigation aria-hidden="true" size={14} /><span>N</span></div>
      <div className="zoom-tools">
        <button type="button" aria-label="Zoom in" onClick={() => setZoom(1.22)} disabled={zoom > 1}><Plus size={17} /></button>
        <button type="button" aria-label="Zoom out" onClick={() => setZoom(1)} disabled={zoom <= 1}><Minus size={17} /></button>
      </div>
      {displayed && <SiteDetail site={displayed} match={match} close={() => select(undefined)} />}
    </div>
  </section>
}
