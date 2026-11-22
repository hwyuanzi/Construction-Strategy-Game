import { BUILDINGS } from '../game/engine'
import type { Building, BuildMove, Match } from '../game/engine'
import { building, buildingShadow, roofHeight } from './townBuildings'
import { painter } from './townPainter'
import type { Painter, Project } from './townPainter'
import { bench, car, flowerBed, fountain, lamp, sailboat, tree } from './townScenery'

export const TOWN_WIDTH = 960
export const TOWN_HEIGHT = 610
export const BUILD_DURATION = 1080

type Lot = [number, number]
export type BuildAnimation = { move: BuildMove; start: number }

export const BUILDING_COLORS: Record<Building, string> = {
  house: '#9b4937',
  library: '#80591e',
  commercial: '#2c6c5d',
  apartment: '#934c39',
  skyscraper: '#545582',
}

function projectPoint(x: number, y: number, z = 0) {
  return [480 + (x - y) * 25.8, 285 + (x + y) * 13.6 - z * 32] as const
}

export function plots(count: number): Lot[] {
  if (count <= 4) {
    const small: Lot[][] = [
      [[0, -2.5]],
      [[-3.6, 2.8], [3.6, -2.7]],
      [[-4.7, 2.7], [0, -2.35], [5.2, -3.7]],
      [[-5.8, 3.4], [-2.05, -1.9], [2.05, 2.6], [5.45, -3.2]],
    ]
    return small[count - 1]
  }

  const xs = [-5.85, -2.05, 1.9, 5.7]
  const outer = xs.flatMap(x => [[x, -5.4], [x, 4.4]] as Lot[])
  const near = xs.map(x => [x, -2] as Lot)
  return [...outer, ...near].slice(0, count)
}

export function townProjection(sites: readonly Building[], lots: Lot[]) {
  const ceiling = Math.min(...lots.map(([x, y], site) => {
    const kind = sites[site]
    return projectPoint(x, y, roofHeight(kind, BUILDINGS[kind].bricks) + .82)[1]
  }))
  if (ceiling >= 21) return projectPoint

  const bottom = TOWN_HEIGHT - 76
  const scale = Math.min(1, (bottom - 24) / (bottom - ceiling))
  return (x: number, y: number, z = 0) => {
    const [left, top] = projectPoint(x, y, z)
    return [480 + (left - 480) * scale, 21 + (top - ceiling) * scale] as const
  }
}

function noise(seed: number) {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return value - Math.floor(value)
}

function layerLike(ctx: CanvasRenderingContext2D) {
  const canvas = document.createElement('canvas')
  canvas.width = ctx.canvas.width
  canvas.height = ctx.canvas.height
  const buffer = canvas.getContext('2d')!
  buffer.setTransform(ctx.getTransform())
  return buffer
}

const treeLocations: Lot[] = [
  [-7.45,-6.55], [-7.37,-3.63], [-7.26,1.71], [-6.80,2.19], [-5.63,7.34], [-5.01,7.42],
  [-2.73,6.32], [-2.29,6.75], [1.5,7.26], [4.6,7.36], [6.80,7.22], [7.45,3.52],
  [7.42,1.52], [7.38,-1.59], [7.22,-7.34], [5.99,-7.31], [1.25,-7.40], [.68,-7.09],
  [-2.87,-7.35], [-5.20,-7.39], [-3.12,2.84], [.95,2.48], [3.82,2.2], [-5.38,-3.61],
  [.06,-3.69], [4.85,-2.78], [3.18,-5.82], [-2.71,-4.28], [-1.44,4.72], [5.88,5.78],
]

function plotPad(paint: Painter, x: number, y: number, kind: Building, focused: boolean) {
  const { plane, solid, line, gradient } = paint
  const edge = BUILDING_COLORS[kind]
  const fill = focused
    ? gradient([x - 1.42, y + 1.12, .06], [x + 1.42, y + 1.12, .06], '#fdf3c6', '#ead39a')
    : gradient([x - 1.42, y + 1.12, .06], [x + 1.42, y + 1.12, .06], '#f1e6c4', '#dfd0a7')
  solid(x - 1.42, y - 1.12, 2.84, 2.24, .024, .028, [fill, '#a9a489', '#929e7b'])
  if (focused) plane(x - 1.42, y - 1.12, 2.84, 2.24, .053, '#0000', edge)
  for (let dash = 0; dash < 7; dash++) {
    const sx = x - 1.19 + dash * .34
    line([sx, y + 1.04, .062], [sx + .18, y + 1.04, .062], edge, focused ? 2.45 : 1.75)
  }
}

function paintGround(ctx: CanvasRenderingContext2D, sites: readonly Building[], lots: Lot[], project: Project) {
  const paint = painter(ctx, project)
  const { plane, solid, line, gradient, oval, shade } = paint
  ctx.clearRect(0, 0, TOWN_WIDTH, TOWN_HEIGHT)
  plane(-8.29, -8.13, 16.79, 16.62, -.65, '#396c5b59')
  solid(-8.2, -8.1, 16.4, 16.2, -.59, .46, ['#b3b29a',
    gradient([0, 8.1, -.13], [0, 8.1, -.59], '#b1a38a', '#788a76'),
    gradient([8.2, 0, -.13], [8.2, 0, -.59], '#938c75', '#697e72'),
  ])
  solid(-8.24, -8.14, 16.48, 16.28, -.13, .13, ['#f0dfb6', '#d1bb92', '#b7aa87'])
  plane(-7.88, -7.79, 15.76, 15.58, .012,
    gradient([-7.9, -7.8, 0], [7.9, 7.8, 0], '#d6dbad', '#a9bf8e'), '#a1ad84')

  for (let block = 0; block < 33; block++) {
    const step = -8.18 + block * .50
    line([step, 7.80, .024], [step, 8.14, .024], '#b49b755e', .65)
    line([7.88, step, .024], [8.24, step, .024], '#a192706b', .65)
    if (block % 2 === 0) {
      line([step + .15, 8.101, -.13], [step + .15, 8.101, -.56], '#756f5c55', .7)
      line([8.201, step + .13, -.13], [8.201, step + .13, -.56], '#6b726069', .7)
    }
  }
  line([-8.24, 8.14, 0], [8.24, 8.14, 0], '#fff0c9', 1.05)
  line([8.24, -8.14, 0], [8.24, 8.14, 0], '#decaa1', .85)

  for (let i = 0; i < 640; i++) {
    const x = -7.79 + noise(i * 3) * 15.58
    const y = -7.68 + noise(i * 3 + 1) * 15.36
    const size = noise(i * 3 + 2)
    oval([x, y, .018], .55 + size * 1.5, .28 + size * .5, i % 3 ? '#68895332' : '#fbf2c970', -.24)
  }

  for (const y of [-6.99, 6.68]) plane(-7.24, y, 14.48, .32, .027, '#d8d6ac', '#c4c79d')
  for (const x of [-7.25, 6.93]) plane(x, -6.98, .32, 13.98, .028, '#d8d6ac', '#c4c79d')
  for (const [x, y] of lots) {
    if (Math.abs(y) < 4.5) {
      const near = Math.min(y, Math.sign(y))
      plane(x - .15, near, .3, Math.abs(y - Math.sign(y)), .031, '#dbd8b2')
    }
  }

  plane(-8.24, -1.015, 16.48, 2.03, .036, '#e4d7b3', '#a5a389')
  plane(-8.24, -.75, 16.48, 1.50, .044,
    gradient([0, -.75, .04], [0, .75, .04], '#677570', '#566861'))
  for (const y of [-.75, .75]) line([-8.24, y, .048], [8.24, y, .048], '#a8ab91', 1.1)
  for (const y of [-.65, .65]) line([-8.23, y, .049], [8.23, y, .049], '#cdd1ae57', .65)
  for (let x = -8.07; x < 8.1; x += .40) {
    line([x, .755, .041], [x, 1.013, .041], '#837d674e', .65)
    line([x, -.755, .041], [x, -1.013, .041], '#837d674e', .65)
  }
  for (let x = -6.31; x < 6.4; x += .73) line([x, 0, .052], [x + .37, 0, .052], '#ebdb9dcc', 1.08)
  for (const x of [-7.17, 6.87]) {
    for (let offset = -.553; offset < .62; offset += .155) plane(x, offset, .39, .079, .054, '#e6e4cc')
    line([x - .12, -.61, .053], [x - .12, -.03, .053], '#daddc4ad', .85)
    line([x + .51, .05, .053], [x + .51, .61, .053], '#daddc4ad', .85)
  }
  for (const [index, [x, y]] of lots.entries()) plotPad(paint, x, y, sites[index], false)
  for (const [x, y] of treeLocations) {
    if (lots.some(([lx, ly]) => Math.abs(x - lx) <= 1.64 && Math.abs(y - ly) <= 1.37)) continue
    shade([x + .32, y + .11, .028], 20, 8, '#3b604450', .23)
  }
}

function paintSea(ctx: CanvasRenderingContext2D, project: Project) {
  const water = ctx.createLinearGradient(90, 10, 796, TOWN_HEIGHT)
  water.addColorStop(0, '#e0ead0')
  water.addColorStop(.36, '#bad9c4')
  water.addColorStop(.72, '#82b9af')
  water.addColorStop(1, '#69a59f')
  ctx.fillStyle = water
  ctx.fillRect(0, 0, TOWN_WIDTH, TOWN_HEIGHT)
  const haze = ctx.createRadialGradient(330, 170, 60, 440, 230, 570)
  haze.addColorStop(0, '#fff1c464')
  haze.addColorStop(1, '#fff1c400')
  ctx.fillStyle = haze
  ctx.fillRect(0, 0, TOWN_WIDTH, TOWN_HEIGHT)
  const { plane, line } = painter(ctx, project)
  for (let inset = 0; inset < 7; inset++) {
    const size = .38 + inset * .19
    plane(-8.2 - size, -8.1 - size, 16.4 + size * 2, 16.2 + size * 2, -.59,
      inset % 2 === 0 ? '#edf7d20f' : '#0000', inset < 4 ? '#e9f9de51' : '#eff8dd28')
  }
  for (let i = 0; i < 112; i++) {
    const x = noise(1800 + i * 3) * 30 - 15
    const y = noise(1801 + i * 3) * 30 - 15
    const w = .14 + noise(1802 + i * 3) * .31
    line([x, y, -.60], [x + w, y + .045, -.60], i % 4 ? '#eff8df61' : '#3e7d7426', .75)
  }
}

function paintRipples(ctx: CanvasRenderingContext2D, paint: Painter, seconds: number) {
  for (let i = 0; i < 38; i++) {
    const x = noise(2500 + i * 2) * TOWN_WIDTH
    const y = noise(2501 + i * 2) * TOWN_HEIGHT
    const phase = i * 1.19 + seconds * (.62 + i % 3 * .14)
    const length = 4 + i % 8 * 1.75
    ctx.globalAlpha = .32 + Math.sin(phase) * .21
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.quadraticCurveTo(x + length * .44, y - 1.9, x + length, y - .25)
    ctx.strokeStyle = '#f3f6dd'
    ctx.lineWidth = .9
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  sailboat(paint, 2.82 + .63 * Math.sin(seconds * .23), 10.55 + .14 * Math.sin(seconds * .44))
  sailboat(paint, -3.48 + .72 * Math.sin(-.8 + seconds * .25), -10.37 + .13 * Math.sin(seconds * .41), true)
}

function paintTraffic(ctx: CanvasRenderingContext2D, paint: Painter, seconds: number) {
  const amber = (4.9 + seconds * .88) % 15.4 - 7.7
  const mint = 7.7 - (4.2 + seconds * .73) % 15.4
  ctx.save()
  ctx.globalAlpha = clamp((7.73 - Math.abs(amber)) / .68)
  car(paint, amber, -.31, 1, ['#e9b67b', '#c68952', '#9d6949'])
  ctx.globalAlpha = clamp((7.73 - Math.abs(mint)) / .68)
  car(paint, mint, .31, -1, ['#c2cbbc', '#80a299', '#5f8b83'])
  ctx.restore()
}

const clamp = (value: number) => Math.max(0, Math.min(1, value))
const ease = (value: number) => value * value * (3 - 2 * value)
const BRICK_FALL = .19

function brickStart(brick: number, count: number) {
  return .035 + brick * .46 / count
}

export function completionTime(count: number) {
  return (brickStart(count - 1, count) + BRICK_FALL) * BUILD_DURATION
}

function placementTime(brick: number, count: number, time: number) {
  return (time - brickStart(brick, count)) / BRICK_FALL
}

function animationLevel(move: BuildMove, time: number) {
  let level = move.before
  for (let brick = 0; brick < move.bricks; brick++) {
    level += ease(clamp((placementTime(brick, move.bricks, time) - .68) / .32))
  }
  return move.stars ? level * (1 - ease(clamp((time - .79) / .21))) : level
}

function paintBricks(paint: Painter, kind: Building, x: number, y: number, move: BuildMove, time: number, level: number) {
  for (let i = 0; i < move.bricks; i++) {
    const progress = placementTime(i, move.bricks, time)
    const u = x + (i % 3 - 1) * .31
    const v = y + (i % 2 ? .16 : -.15)
    const z = roofHeight(kind, level) + .065
    if (progress >= 0 && progress < 1) {
      const rest = 1 - progress ** 2
      const dx = rest * (i % 2 ? .54 : -.57)
      paint.solid(u + dx - .115, v - .10, .29, .23, z + rest * 1.14, .15, ['#ffdfa0', '#dd9560', '#a75f43'])
      paint.line([u + dx - .11, v + .13, z + rest * 1.14 + .14],
        [u + dx + .17, v + .13, z + rest * 1.14 + .14], '#fff0b5', .8)
    }
    const puff = (progress - .90) / .85
    if (puff >= 0 && puff < 1) {
      const colors = ['#fff1ccb0', '#f8d9a881', '#ffebc264']
      for (let speck = 0; speck < 5; speck++) {
        const radius = .12 + puff * .41
        const angle = speck * 1.245 + i * .81
        paint.oval([u + Math.cos(angle) * radius, v + Math.sin(angle) * radius, z + puff * .15],
          (2.25 - puff * 1.9) * (1 + speck % 2 * .25), 1.32 - puff * 1.02, colors[speck % 3])
      }
    }
  }
}

function paintCelebration(ctx: CanvasRenderingContext2D, px: number, py: number, burst: number) {
  if (burst <= 0 || burst >= 1) return
  ctx.save()
  ctx.globalAlpha = (1 - burst ** 2) * Math.min(1, burst * 8)
  for (let i = 0; i < 13; i++) {
    const theta = i * 2.39996
    const reach = 13 + (29 + i % 4 * 8) * ease(burst)
    const sx = px + Math.cos(theta) * reach
    const sy = py + Math.sin(theta) * reach * .63 - 18 * burst
    const radius = (2 + i % 4 * .8) * (1 - burst * .55)
    ctx.beginPath()
    ctx.moveTo(sx, sy - radius)
    ctx.quadraticCurveTo(sx + radius * .16, sy - radius * .18, sx + radius * .78, sy)
    ctx.quadraticCurveTo(sx + radius * .16, sy + radius * .18, sx, sy + radius)
    ctx.quadraticCurveTo(sx - radius * .16, sy + radius * .18, sx - radius * .78, sy)
    ctx.quadraticCurveTo(sx - radius * .16, sy - radius * .18, sx, sy - radius)
    ctx.fillStyle = i % 3 === 0 ? '#fff9d5' : i % 3 === 1 ? '#f6cf77' : '#f3ae58'
    ctx.fill()
  }
  ctx.restore()
}

export function createTownRenderer(ctx: CanvasRenderingContext2D, background: CanvasRenderingContext2D) {
  const ground = layerLike(background)
  const water = layerLike(background)
  let paint = painter(ctx, projectPoint)
  let environment = painter(background, projectPoint)
  let sites: readonly Building[] | undefined
  let lots: Lot[] = []
  let ambientTime = 0
  let pieces: { x: number; y: number; draw: (levels: number[]) => void }[] = []

  function setLayout(next: readonly Building[]) {
    sites = next
    lots = plots(next.length)
    const project = townProjection(next, lots)
    paint = painter(ctx, project)
    environment = painter(background, project)
    pieces = []
    const clear = (x: number, y: number, w = 1.64, d = 1.37) =>
      lots.every(([lx, ly]) => Math.abs(x - lx) > w || Math.abs(y - ly) > d)
    function prop(x: number, y: number, draw: () => void) {
      if (clear(x, y)) pieces.push({ x, y, draw })
    }
    for (const [i, [x, y]] of treeLocations.entries()) {
      prop(x, y, () => tree(paint, x, y, .73 + noise(i * 7) * .43, i))
    }
    for (const [i, [x, y]] of [[-5.27, 5.78], [2.30, 5.96], [6.35, 1.54], [-7.34, -5.12], [4.23, -6.63], [-.71, -6.23], [1.02, 1.55]].entries()) {
      prop(x, y, () => flowerBed(paint, x, y, i))
    }
    for (const x of [-6.18, -1.17, 2.95, 5.9]) {
      for (const side of [-1, 1]) prop(x, side * 1.09, () => lamp(paint, x, side * 1.09, -side))
    }
    for (const [x, y] of [[-4.0, 6.42], [3.18, 6.22], [-2.46, -6.55], [5.20, -6.75]]) {
      prop(x, y, () => bench(paint, x, y))
    }
    if (clear(-.06, 4.81, 2.25, 1.82)) prop(-.06, 4.81, () => fountain(paint, -.06, 4.81))
    for (const [site, [x, y]] of lots.entries()) {
      const kind = next[site]
      pieces.push({ x, y, draw: levels => building(paint, kind, x, y, levels[site]) })
      const u = x + (kind === 'house' ? 1.00 : -1.08)
      const v = y + .82
      pieces.push({ x: u, y: v, draw: () => {
        if (kind === 'house') tree(paint, u, v, .54, site)
        else if (kind === 'commercial') {
          paint.solid(u - .16, v - .09, .30, .18, .055, .13, ['#edbe85', '#cd9363', '#95664c'])
          paint.solid(u - .10, v - .08, .15, .17, .185, .10, ['#f3cf90', '#d5a16e', '#a1754b'])
        } else flowerBed(paint, u, v, site)
      } })
    }
    pieces.sort((a, b) => a.x + a.y - b.x - b.y)
    paintSea(water, project)
    paintGround(ground, next, lots, project)
  }

  function drawEnvironment(seconds = ambientTime) {
    if (!sites) return
    ambientTime = seconds
    background.drawImage(water.canvas, 0, 0, TOWN_WIDTH, TOWN_HEIGHT)
    paintRipples(background, environment, seconds)
    background.drawImage(ground.canvas, 0, 0, TOWN_WIDTH, TOWN_HEIGHT)
    paintTraffic(background, environment, seconds)
  }

  function drawTown(match: Match, now: number, animations: ReadonlyMap<number, BuildAnimation>, focused?: number) {
    if (sites !== match.sites) {
      setLayout(match.sites)
      drawEnvironment()
    }
    ctx.clearRect(0, 0, TOWN_WIDTH, TOWN_HEIGHT)
    if (focused !== undefined && lots[focused]) {
      const [x, y] = lots[focused]
      plotPad(paint, x, y, match.sites[focused], true)
    }
    const levels = [...match.progress]
    for (const [site, { move, start }] of animations) {
      levels[site] = animationLevel(move, clamp((now - start) / BUILD_DURATION))
    }
    for (const [site, [x, y]] of lots.entries()) buildingShadow(paint, match.sites[site], x, y, levels[site])
    for (const piece of pieces) piece.draw(levels)
    for (const [site, { move, start }] of animations) {
      const [x, y] = lots[site]
      const kind = match.sites[site]
      const time = clamp((now - start) / BUILD_DURATION)
      paintBricks(paint, kind, x, y, move, time, levels[site])
      if (move.stars) {
        const landing = completionTime(move.bricks) / BUILD_DURATION
        const [px, py] = paint.project(x, y, roofHeight(kind, move.before + move.bricks) + .15)
        paintCelebration(ctx, px, py, (time - landing) / (1 - landing))
      }
    }
  }

  return { drawTown, drawEnvironment }
}
