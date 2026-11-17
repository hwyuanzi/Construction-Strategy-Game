import { currentStage } from '../game/engine'
import { MODES } from '../game/rules'
import type { MatchState, Project } from '../game/types'

export const TOWN_WIDTH = 920
export const TOWN_HEIGHT = 560

type Point = [number, number, number]
type Lot = [number, number]

const xRows = [-5.7, -1.8, 2.1, 6]
const lots: Lot[][] = [
  [[-4.6, -4.8], [0.4, -4.8], [5.1, -4.8], ...xRows.map(x => [x, -7.7] as Lot), ...xRows.map(x => [x, -1.75] as Lot)],
  [[-4.6, 3.9], [0.4, 3.9], [5.1, 3.9], ...xRows.map(x => [x, 7.25] as Lot), ...xRows.map(x => [x, 1.8] as Lot)],
]

const seatColors = [
  { roof: '#b65d43', wall: '#d48764', shade: '#965544', steel: '#9a513c' },
  { roof: '#437b7a', wall: '#7aaba2', shade: '#3d6c69', steel: '#356966' },
]

export function projectPoint(x: number, y: number, z = 0) {
  return [460 + (x - y) * 25.6, 282 + (x + y) * 14 - z * 34] as const
}

export function plots(state: MatchState) {
  return lots.flatMap((entries, seat) => {
    const sites = state.projects.filter(site => site.seat === seat)
    return entries.map(([x, y], index) => ({ x, y, seat, index, site: sites[index] }))
  })
}

export function elevation(site: Project, state: MatchState) {
  if (site.status === 'complete') return site.type === 'skyscraper' ? 5.25 : site.type === 'commercial' ? 2.05 : 1.75
  if (site.status !== 'active') return 0.2
  const stage = currentStage(state.mode, site)
  const progress = site.stage + site.work / stage.work
  if (site.type === 'skyscraper') return 0.2 + progress * 1.23
  if (site.type === 'commercial') return 0.18 + progress * 0.53
  return 0.25 + progress * 0.45
}

export function paintTown(ctx: CanvasRenderingContext2D, state: MatchState, previous?: MatchState, time = 1) {
  const region = (points: Point[], color: string, outline?: string) => {
    ctx.beginPath()
    for (const [[x, y], i] of points.map(point => projectPoint(...point)).map((point, index) => [point, index] as const)) {
      if (i) ctx.lineTo(x, y)
      else ctx.moveTo(x, y)
    }
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
    if (outline) {
      ctx.strokeStyle = outline
      ctx.lineWidth = 0.65
      ctx.stroke()
    }
  }
  const line = (a: Point, b: Point, color: string, width = 1) => {
    const start = projectPoint(...a)
    const end = projectPoint(...b)
    ctx.beginPath()
    ctx.moveTo(...start)
    ctx.lineTo(...end)
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.stroke()
  }
  const plane = (x: number, y: number, w: number, d: number, z: number, fill: string, edge?: string) =>
    region([[x, y, z], [x + w, y, z], [x + w, y + d, z], [x, y + d, z]], fill, edge)
  const solid = (x: number, y: number, w: number, d: number, base: number, h: number, colors: [string, string, string]) => {
    const top = base + h
    region([[x, y + d, base], [x + w, y + d, base], [x + w, y + d, top], [x, y + d, top]], colors[1])
    region([[x + w, y, base], [x + w, y + d, base], [x + w, y + d, top], [x + w, y, top]], colors[2])
    plane(x, y, w, d, top, colors[0])
  }

  ctx.clearRect(0, 0, TOWN_WIDTH, TOWN_HEIGHT)
  const water = ctx.createLinearGradient(0, 0, 0, TOWN_HEIGHT)
  water.addColorStop(0, '#d9dfd2')
  water.addColorStop(1, '#9bb9b3')
  ctx.fillStyle = water
  ctx.fillRect(0, 0, TOWN_WIDTH, TOWN_HEIGHT)
  for (let inset = 0.75; inset <= 2.8; inset += 0.5) {
    plane(-8.4 - inset, -8.6 - inset, 16.8 + inset * 2, 17.2 + inset * 2, -0.64, '#ffffff00', '#f3f4da95')
  }
  for (let ripple = 0; ripple < 170; ripple++) {
    const x = ((ripple * 127 + 13) % TOWN_WIDTH)
    const y = ((ripple * 151 + 71) % TOWN_HEIGHT)
    ctx.fillStyle = ripple % 3 === 0 ? '#f3f6df8e' : '#365e5925'
    ctx.fillRect(x, y, 3 + (ripple % 8) * 1.9, 0.7)
  }
  plane(-8.51, -8.42, 17.16, 17.59, -0.5, '#35584f40')
  solid(-8.4, -8.6, 16.8, 17.2, -0.58, 0.58, ['#eee0ba', '#ad9c7d', '#8d8872'])
  plane(-8.05, -8.24, 16.1, 16.48, 0.015, '#c7cda7', '#8c9b81')
  for (const y of [-8.38, 8.24]) {
    for (let x = -7.9; x < 8; x += 0.7) line([x, y, 0.03], [x, y + 0.15, 0.03], '#a99b7e91', .6)
  }
  plane(-8.4, -1.04, 16.8, 2.08, 0.045, '#a9ada0')
  plane(-8.4, -0.79, 16.8, 1.58, 0.05, '#58645e')
  for (let x = -8.12; x < 8; x += 0.78) line([x, 0, 0.055], [x + 0.39, 0, 0.055], '#ddd5ac', 1.05)
  for (const x of [-7, 6.7]) {
    for (let offset = -0.6; offset <= 0.6; offset += 0.22) plane(x, offset, 0.42, 0.105, 0.055, '#dbe0cd')
  }
  for (const x of [-7.9, 7.6]) {
    plane(x, -8.3, 0.3, 7.2, 0.025, '#d4d5c2')
    plane(x, 1.05, 0.3, 7.25, 0.025, '#d4d5c2')
  }

  const units = plots(state).map(plot => ({ ...plot, plot: true as const }))
  const surroundings = [
    [-7.35, -6.5], [-7.25, -5.8], [-7.3, -2.3], [-7.4, 1.58], [-7.0, 1.8],
    [-6.95, 5.6], [-7.2, 6.0], [-4.4, 6.8], [-2.2, 5.6], [-2.5, -4.2],
    [3.7, -6.3], [7.4, -7.8], [7.52, -5.45], [7.45, 1.55], [7.46, 2.05],
    [7.47, 5.7], [3.35, 7.82], [-4.35, -7.95], [4.2, 1.38],
  ].map(([x, y], index) => ({ x, y, index, plot: false as const }))
  const trees = (x: number, y: number, index: number) => {
    const z = 0.35 + (index % 3) * 0.09
    plane(x - 0.08, y - 0.08, 0.58, 0.55, 0.04, '#596c5633')
    solid(x - 0.055, y - 0.055, 0.11, 0.11, 0, z, ['#8b7451', '#7b684d', '#66593f'])
    solid(x - 0.29, y - 0.27, 0.56, 0.55, z - 0.15, 0.44, ['#799469', '#5d7d59', '#46674d'])
    solid(x - 0.18, y - 0.17, 0.38, 0.36, z + 0.23, 0.26, ['#a1ad76', '#839b68', '#658858'])
  }
  const crane = (x: number, y: number, height: number, index: number) => {
    const z = Math.max(2.15, height + 0.75)
    const color = index ? '#9a7f38' : '#b37d2c'
    const arm = 1.57
    solid(x - 0.18, y - 0.18, 0.36, 0.36, 0.09, 0.11, ['#bbb7a6', '#8d8f85', '#7a8278'])
    line([x, y, 0.16], [x, y, z], '#a76f24', 2.3)
    line([x + 0.13, y, 0.15], [x + 0.13, y, z], '#dfad54', 1.4)
    for (let rung = 0.15; rung < z - 0.24; rung += 0.27) line([x, y, rung], [x + 0.13, y, rung + 0.23], color, 1)
    line([x - 0.53, y, z], [x + arm, y, z], '#a5742e', 2.4)
    line([x - 0.53, y, z], [x, y, z + 0.31], '#e0b264', 1.15)
    line([x, y, z + 0.31], [x + arm, y, z], '#e0b264', 1.1)
    const hook = x + 1.2 + (time < 1 ? Math.sin(time * Math.PI * 2) * 0.22 : 0)
    line([hook, y, z], [hook, y, z - 0.63], '#544f47', 0.85)
    line([hook, y, z - 0.63], [hook + 0.12, y, z - 0.63], '#544f47', 1.1)
  }

  for (const tile of units) {
    const { x, y, site } = tile
    if (!site && tile.index > 3) continue
    plane(x - 1.42, y - 1.18, 2.84, 2.36, 0.055, site ? '#e3d3af' : '#d0d3ae', site ? '#aa9d80' : '#a4ad8d')
    if (site && site.status === 'active') {
      for (let stripe = 0; stripe < 9; stripe++) {
        const start = x - 1.31 + stripe * 0.29
        line([start, y + 1.12, 0.06], [start + 0.19, y + 1.12, 0.06], seatColors[tile.seat].steel, 1.75)
      }
    }
  }
  const decor = [
    { x: -3.02, y: -0.31, color: ['#e4d1a5', '#c3ad80', '#998660'] as [string, string, string] },
    { x: 3.5, y: 0.42, color: ['#a2b9bb', '#7a9299', '#617a82'] as [string, string, string] },
  ]
  for (const vehicle of decor) {
    solid(vehicle.x, vehicle.y, 0.67, 0.29, 0.07, 0.1, vehicle.color)
    solid(vehicle.x + 0.25, vehicle.y, 0.28, 0.29, 0.16, 0.10, vehicle.color)
  }
  for (const [x, y] of [[2.2, 11.1], [2.3, -10.6]]) {
    region([[x - 0.72, y, -0.57], [x - 0.36, y - 0.17, -0.57], [x + 0.65, y - 0.17, -0.57], [x + 0.65, y + 0.17, -0.57], [x - 0.36, y + 0.17, -0.57]], '#f6efda', '#557b71')
    region([[x, y, 0.13], [x - 0.48, y, -0.49], [x + 0.04, y, -0.49]], '#fff9e7', '#557b71')
    line([x + 0.7, y, -0.58], [x + 1.54, y, -0.58], '#f4f5e49e', 1.1)
  }

  for (const tile of [...units, ...surroundings].sort((a, b) => a.x + a.y - b.x - b.y)) {
    const { x, y, index } = tile
    if (!tile.plot) {
      trees(x, y, index)
      continue
    }
    const site = tile.site
    if (!site) {
      if (index <= 3) {
        line([x - 0.14, y, 0.07], [x + 0.14, y, 0.07], '#a2ad94', 0.8)
        line([x, y - 0.15, 0.07], [x, y + 0.15, 0.07], '#a2ad94', 0.8)
      }
      continue
    }
    const style = seatColors[tile.seat]
    const gone = site.status === 'abandoned' || site.status === 'expired'
    if (gone) {
      plane(x - 0.95, y - 0.73, 1.9, 1.46, 0.06, '#c8c5ae')
      continue
    }
    const old = previous?.projects.find(item => item.id === site.id)
    const from = old && previous ? elevation(old, previous) : 0.1
    const h = previous ? from + (elevation(site, state) - from) * time : elevation(site, state)
    const finished = site.status === 'complete' && (!old || old.status === 'complete' || time > 0.82)
    const stages = MODES[state.mode].contracts[site.type].stages
    const progress = Math.min(site.stage, stages.length) + (site.status === 'active' ? site.work / stages[site.stage].work : 0)
    const baseX = x - 1.0, baseY = y - 0.74
    const width = 2, depth = 1.48
    plane(baseX + 0.23, baseY + 0.29, width + 0.2, depth + 0.18, 0.065, '#71807435')
    solid(baseX - 0.10, baseY - 0.10, width + 0.20, depth + 0.20, 0.06, 0.12, ['#c0c2af', '#959d89', '#818b7b'])

    if (site.type === 'house' && (progress >= 2 || finished)) {
      const walls = Math.max(0.52, Math.min(h - 0.22, 1.19))
      solid(baseX, baseY, width, depth, 0.18, walls, [style.wall, '#e6dec1', '#bcbaa3'])
      const eave = 0.18 + walls
      const ridge = eave + (finished ? 0.47 : Math.max(0.19, h - eave))
      region([[baseX - 0.08, y, ridge], [baseX + width + 0.08, y, ridge], [baseX + width + 0.08, baseY + depth + 0.08, eave], [baseX - 0.08, baseY + depth + 0.08, eave]], style.roof)
      region([[baseX - 0.08, baseY - 0.08, eave], [baseX + width + 0.08, baseY - 0.08, eave], [baseX + width + 0.08, y, ridge], [baseX - 0.08, y, ridge]], style.wall)
      region([[baseX + width, baseY, eave], [baseX + width, y, ridge], [baseX + width, baseY + depth, eave]], style.shade)
      for (let trim = 0; trim < 4; trim++) {
        const roofX = baseX + 0.27 + trim * 0.47
        line([roofX, y, ridge], [roofX, baseY + depth + 0.08, eave], '#635d4c3b', 0.8)
      }
      for (const windowX of [baseX + 0.27, baseX + 1.45]) {
        region([[windowX, baseY + depth + 0.007, 0.52], [windowX + 0.27, baseY + depth + 0.007, 0.52], [windowX + 0.27, baseY + depth + 0.007, 0.89], [windowX, baseY + depth + 0.007, 0.89]], '#6d858b')
      }
      region([[x - 0.12, baseY + depth + 0.01, 0.18], [x + 0.14, baseY + depth + 0.01, 0.18], [x + 0.14, baseY + depth + 0.01, 0.75], [x - 0.12, baseY + depth + 0.01, 0.75]], '#9a805b')
      if (finished) trees(x + 1.04, y + 0.94, index)
    } else if (finished || (site.type !== 'house' && progress >= 2)) {
      const top = Math.max(h, 0.50)
      solid(baseX, baseY, width, depth, 0.18, top - 0.18, [style.wall, '#bcc5b8', '#889e98'])
      for (let floor = 0.45; floor < top - 0.2; floor += 0.44) {
        for (let wx = 0.18; wx < width - 0.18; wx += 0.38) {
          region([[baseX + wx, baseY + depth + 0.006, floor], [baseX + wx + 0.24, baseY + depth + 0.006, floor], [baseX + wx + 0.24, baseY + depth + 0.006, floor + 0.20], [baseX + wx, baseY + depth + 0.006, floor + 0.20]], '#648087')
        }
        line([baseX + width + 0.01, baseY + 0.15, floor + 0.10], [baseX + width + 0.01, baseY + depth - 0.15, floor + 0.10], '#5b7980', 3.25)
      }
      solid(baseX - 0.06, baseY - 0.06, width + 0.12, depth + 0.12, top, 0.085, [style.roof, style.shade, style.steel])
      if (finished) solid(x - 0.35, y - 0.26, 0.7, 0.52, top + 0.08, 0.33, ['#d7dace', '#aeb7ac', '#8c9a8d'])
    } else if (progress > 0.02) {
      const level = Math.max(0.23, h)
      const edges: [number, number][] = [[baseX, baseY], [x, baseY], [baseX + width, baseY], [baseX, baseY + depth], [x, baseY + depth], [baseX + width, baseY + depth]]
      for (const [px, py] of edges) line([px, py, 0.18], [px, py, level], style.steel, 2)
      for (const z of [level, (level + 0.18) / 2]) {
        line([baseX, baseY, z], [baseX + width, baseY, z], style.roof, 1.9)
        line([baseX, baseY + depth, z], [baseX + width, baseY + depth, z], style.wall, 2.2)
        for (const px of [baseX, x, baseX + width]) line([px, baseY, z], [px, baseY + depth, z], style.steel, 1.5)
      }
      line([x, baseY + depth, 0.20], [baseX + width, baseY + depth, level], style.steel, 1.35)
    }

    if (!finished) {
      solid(x - 1.05, y + 0.89, 0.36, 0.17, 0.06, 0.13, ['#e2ad5d', '#bb8a44', '#936835'])
      solid(x - 0.61, y + 0.88, 0.28, 0.16, 0.06, 0.08, ['#f4d6a0', '#d2aa69', '#b88b50'])
      if (site.type !== 'house') crane(x - 1.23, y - 0.85, h, tile.seat)
    }
  }
}
