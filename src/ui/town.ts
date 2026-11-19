import { BUILDINGS } from '../game/engine'
import type { Building, BuildMove, Match } from '../game/engine'

export const TOWN_WIDTH = 960
export const TOWN_HEIGHT = 550
export const BUILD_DURATION = 930

type Point = [number, number, number]
type Lot = [number, number]
type Colors = [string, string, string]
type Project = (x: number, y: number, z: number) => readonly [number, number]

export const BUILDING_COLORS: Record<Building, string> = {
  house: '#a84f37',
  library: '#9a6925',
  commercial: '#377366',
  apartment: '#a55543',
  skyscraper: '#645784',
}

const heights: Record<Building, number> = {
  house: 1.47, library: 1.62, commercial: 1.32, apartment: 2.61, skyscraper: 3.82,
}

export function projectPoint(x: number, y: number, z = 0) {
  return [480 + (x - y) * 25.8, 270 + (x + y) * 13.6 - z * 32] as const
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

function painter(ctx: CanvasRenderingContext2D, project: Project) {
  function region(points: Point[], color: string, outline?: string) {
    ctx.beginPath()
    points.forEach((p, index) => {
      const [x, y] = project(...p)
      if (index) ctx.lineTo(x, y)
      else ctx.moveTo(x, y)
    })
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
    if (outline) {
      ctx.strokeStyle = outline
      ctx.lineWidth = .65
      ctx.stroke()
    }
  }

  function line(a: Point, b: Point, color: string, width = 1) {
    ctx.beginPath()
    ctx.moveTo(...project(...a))
    ctx.lineTo(...project(...b))
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.stroke()
  }

  function plane(x: number, y: number, w: number, d: number, z: number, fill: string, edge?: string) {
    region([[x, y, z], [x + w, y, z], [x + w, y + d, z], [x, y + d, z]], fill, edge)
  }

  function solid(x: number, y: number, w: number, d: number, base: number, height: number, colors: Colors) {
    const top = base + height
    region([[x, y + d, base], [x + w, y + d, base], [x + w, y + d, top], [x, y + d, top]], colors[1])
    region([[x + w, y, base], [x + w, y + d, base], [x + w, y + d, top], [x + w, y, top]], colors[2])
    plane(x, y, w, d, top, colors[0])
  }

  return { region, line, plane, solid }
}

type Painter = ReturnType<typeof painter>

function tree(paint: Painter, x: number, y: number, scale = 1) {
  paint.plane(x - .08, y - .08, .59 * scale, .49 * scale, .045, '#485d4038')
  paint.solid(x - .05, y - .05, .10, .10, 0, .53 * scale, ['#9b805d', '#7e674c', '#675741'])
  paint.solid(x - .26 * scale, y - .25 * scale, .54 * scale, .51 * scale, .31 * scale, .42 * scale, ['#93a46d', '#6c8b5b', '#4c704f'])
  paint.solid(x - .17 * scale, y - .16 * scale, .35 * scale, .34 * scale, .73 * scale, .24 * scale, ['#aeb779', '#87a16a', '#628454'])
}

function modelScale(kind: Building, progress: number) {
  return .54 + .46 * Math.min(progress / BUILDINGS[kind].bricks, 1)
}

function building(paint: Painter, kind: Building, x: number, y: number, progress: number) {
  const { line, plane, region, solid } = paint
  const scale = modelScale(kind, progress)
  const h = heights[kind] * scale
  const west = x - .93
  const south = y - .71
  const front = y + .71
  const east = x + .93
  const w = 1.86
  const d = 1.42
  const base = .16
  const roof = base + h
  const colors: Record<Building, Colors> = {
    house: ['#ead9b6', '#f1ddbf', '#cbb99f'],
    library: ['#d6c28d', '#f4dfb2', '#bfaa82'],
    commercial: ['#a8c8b5', '#99bcb2', '#618f86'],
    apartment: ['#d59c76', '#e8b58c', '#b78465'],
    skyscraper: ['#9b94b9', '#9999bc', '#696d96'],
  }
  solid(west - .12, south - .12, w + .24, d + .24, .055, .105, ['#ded8bf', '#aeab94', '#969b85'])
  solid(west, south, w, d, base, h, colors[kind])

  function window(x1: number, z: number, width: number, height: number, color: string) {
    region([[x1, front, z], [x1 + width, front, z], [x1 + width, front, z + height], [x1, front, z + height]], color)
  }

  function sideWindow(y1: number, z: number, width: number, height: number, color: string) {
    region([[east, y1, z], [east, y1 + width, z], [east, y1 + width, z + height], [east, y1, z + height]], color)
  }

  if (kind === 'house') {
    const ridge = roof + .39
    region([[west - .08, y, ridge], [east + .08, y, ridge], [east + .08, front + .09, roof], [west - .08, front + .09, roof]], '#ba674c')
    region([[west - .08, south - .09, roof], [east + .08, south - .09, roof], [east + .08, y, ridge], [west - .08, y, ridge]], '#de8a6c')
    region([[east, south, roof], [east, y, ridge], [east, front, roof]], '#945545')
    for (let i = 1; i <= 7; i++) line([west + i * .24, y, ridge], [west + i * .24, front + .09, roof], '#78392238', .7)
    window(x - .13, base, .27, .55 * scale, '#805e48')
    for (const wx of [west + .22, east - .50]) {
      window(wx, base + .33 * scale, .29, .34 * scale, '#577c7d')
      line([wx + .145, front, base + .33 * scale], [wx + .145, front, base + .67 * scale], '#f4e8ca', .75)
    }
    sideWindow(y - .18, base + .35 * scale, .32, .32 * scale, '#638083')
    solid(x + .36, y - .25, .16, .17, roof + .18, .27, ['#e3a687', '#b66e57', '#965444'])
  } else if (kind === 'library') {
    solid(west - .06, south - .07, w + .12, d + .14, roof, .095, ['#f3d99f', '#c4a668', '#ad9058'])
    solid(x - .58, front - .08, 1.16, .34, .1, .11, ['#ded3af', '#aea181', '#938867'])
    for (const wx of [x - .49, x - .20, x + .12, x + .40]) {
      solid(wx, front + .09, .09, .12, base + .05, h - .13, ['#fff0be', '#ecd6a1', '#c2ae83'])
    }
    window(x - .13, base, .26, .66 * scale, '#735f57')
    solid(x - .61, front - .12, 1.22, .35, roof - .04, .13, ['#f2d89c', '#c2a975', '#b49b67'])
    for (const wy of [south + .22, y, front - .30]) sideWindow(wy, base + h * .36, .21, h * .32, '#6d857d')
    solid(x - .25, y - .32, .5, .42, roof + .09, .13, ['#8fa8a0', '#7f9990', '#688278'])
  } else if (kind === 'commercial') {
    for (const offset of [0, .66]) {
      region([[west, south + offset, roof], [east, south + offset, roof], [east, south + offset + .58, roof + .28], [west, south + offset + .58, roof + .28]], '#c0d1b9')
      region([[east, south + offset, roof], [east, south + offset + .58, roof + .28], [east, south + offset + .58, roof]], '#60887b')
      region([[west, south + offset + .58, roof], [east, south + offset + .58, roof], [east, south + offset + .58, roof + .28], [west, south + offset + .58, roof + .28]], '#668f8a')
    }
    window(x - .54, base, .66, h * .64, '#486e69')
    window(x + .31, base + h * .31, .37, h * .26, '#dcece1')
    for (let i = 1; i < 5; i++) {
      const z = base + h * i * .11
      line([x - .54, front, z], [x + .12, front, z], '#a4c3b5', .8)
    }
    sideWindow(y - .42, base + h * .35, .85, h * .22, '#4a786e')
  } else {
    const tall = kind === 'skyscraper'
    const floors = Math.max(2, Math.round((tall ? 7 : 5) * scale))
    for (let floor = 0; floor < floors; floor++) {
      const z = base + h * (floor + .25) / floors
      const pane = h / floors * .43
      for (const wx of [west + .18, west + .58, west + .99, west + 1.39]) {
        window(wx, z, .25, pane, tall ? '#dce6ec' : '#526f74')
      }
      for (const wy of [south + .17, south + .56, south + .95]) {
        sideWindow(wy, z, .25, pane, tall ? '#bfcadd' : '#738f87')
      }
      if (!tall && floor > 0) solid(x - .48, front - .04, .94, .23, z - .09, .07, ['#e7c29c', '#c8936e', '#a87358'])
    }
    const trim: Colors = tall ? ['#c5bfd5', '#8881a5', '#746c92'] : ['#e6c499', '#b87e60', '#98694f']
    solid(west - .045, south - .045, w + .09, d + .09, roof, .09, trim)
    if (tall) {
      solid(x - .49, y - .31, .98, .62, roof + .09, .24, trim)
      line([x, y, roof + .33], [x, y, roof + .78], '#535476', 1.2)
    } else {
      solid(x - .55, y - .30, .73, .48, roof + .09, .08, ['#94a97b', '#74896c', '#596f56'])
      solid(x + .29, y + .06, .28, .27, roof + .09, .18, trim)
    }
  }
}

export function paintThumbnail(ctx: CanvasRenderingContext2D, kind: Building) {
  const scale = kind === 'skyscraper' ? 9 : 12
  const project: Project = (x, y, z) => [42 + (x - y) * scale, 45 + (x + y) * scale * .52 - z * scale]
  const paint = painter(ctx, project)
  ctx.clearRect(0, 0, 84, 68)
  paint.plane(-1.17, -.98, 2.54, 2.07, .01, '#82775132')
  building(paint, kind, 0, 0, BUILDINGS[kind].bricks)
}

export function animationLevel(move: BuildMove, time: number) {
  const rise = Math.min(1, time / .58)
  const settle = move.stars ? Math.max(0, (time - .78) / .22) : 0
  return (move.before + move.bricks * (1 - (1 - rise) ** 3)) * (1 - settle ** 2)
}

export function paintTown(ctx: CanvasRenderingContext2D, match: Match, time = 1, focused?: number) {
  const { region, line, plane, solid } = painter(ctx, projectPoint)
  const paint = { region, line, plane, solid }
  const lots = plots(match.sites.length)
  const recent = time < 1 ? match.moves.at(-1) : undefined

  const water = ctx.createLinearGradient(0, 0, 0, TOWN_HEIGHT)
  water.addColorStop(0, '#d9e6d7')
  water.addColorStop(1, '#90b8b4')
  ctx.fillStyle = water
  ctx.fillRect(0, 0, TOWN_WIDTH, TOWN_HEIGHT)
  for (let inset = .6; inset <= 2.6; inset += .55) {
    plane(-8.2 - inset, -8.1 - inset, 16.4 + inset * 2, 16.2 + inset * 2, -.52, '#0000', '#f0f5dd9c')
  }
  for (let ripple = 0; ripple < 145; ripple++) {
    const x = (ripple * 131 + 17) % TOWN_WIDTH
    const y = (ripple * 157 + 47) % TOWN_HEIGHT
    ctx.fillStyle = ripple % 3 ? '#f2f7e288' : '#2f625628'
    ctx.fillRect(x, y, 3 + ripple % 8 * 1.7, .75)
  }
  plane(-8.22, -7.94, 16.77, 16.45, -.52, '#31594f40')
  solid(-8.2, -8.1, 16.4, 16.2, -.59, .59, ['#e8dbb4', '#a79b7f', '#868774'])
  plane(-7.86, -7.78, 15.72, 15.56, .014, '#bfcba5', '#9ea183')
  for (let step = -7.64; step <= 7.75; step += .48) {
    line([step, 7.78, .028], [step, 8.05, .028], '#9d916fa1', .7)
    line([7.86, step, .028], [8.16, step, .028], '#9d916fa1', .7)
  }
  plane(-8.18, -.99, 16.36, 1.98, .035, '#ded8b9')
  plane(-8.18, -.71, 16.36, 1.42, .045, '#657068')
  for (let x = -7.96; x < 7.8; x += .73) line([x, 0, .052], [x + .36, 0, .052], '#f0e2b2', 1.1)
  for (const x of [-7.09, 6.79]) {
    for (let offset = -.54; offset < .63; offset += .20) plane(x, offset, .45, .09, .054, '#ebebd6')
  }
  for (const side of [-1, 1]) {
    const y = side * 6.92
    plane(-7.14, y, 14.28, .31, .031, '#d9d7b2')
    for (const x of [-7.15, 6.85]) {
      plane(x, -7.0, .29, 6.0, .027, '#d9d7b2')
      plane(x, 1, .29, 6.0, .027, '#d9d7b2')
    }
  }

  for (const [index, [x, y]] of lots.entries()) {
    const selected = focused === index
    const kind = match.sites[index]
    plane(x - 1.42, y - 1.12, 2.84, 2.24, .055, selected ? '#f2e1a9' : '#dfd2ae', selected ? BUILDING_COLORS[kind] : '#aaa588')
    plane(x - .82, y - .46, 2.28, 1.64, .064, '#60786139')
    for (let dash = 0; dash < 7; dash++) {
      const sx = x - 1.21 + dash * .34
      line([sx, y + 1.07, .064], [sx + .19, y + 1.07, .064], BUILDING_COLORS[kind], 1.8)
    }
  }

  for (const [x, y, color] of [
    [-3.2 + (time < 1 ? time * 1.25 : 0), -.34, '#c48846'],
    [3.6 - (time < 1 ? time * .9 : 0), .34, '#69928f'],
  ] as const) {
    solid(x, y, .70, .27, .07, .12, ['#eed7a2', color, '#6e7865'])
    solid(x + .38, y, .24, .27, .19, .12, ['#efe5c1', color, '#64766b'])
  }
  for (const [x, y] of [[2.75, 10.85], [-3.6, -10.35]]) {
    region([[x - .71, y, -.43], [x - .38, y - .16, -.43], [x + .61, y - .16, -.43], [x + .61, y + .17, -.43], [x - .38, y + .17, -.43]], '#f5ead3', '#648a80')
    region([[x, y, .34], [x - .49, y, -.40], [x + .08, y, -.40]], '#fff8e6', '#73968b')
    line([x + .72, y, -.44], [x + 1.51, y, -.44], '#f5f5ddaf', 1.2)
  }

  const greenery: Lot[] = [
    [-7.45,-6.55], [-7.37,-3.63], [-7.3,1.51], [-7.3,2.08], [-5.57,7.27], [-4.9,7.37],
    [-2.73,6.32], [1.5,7.27], [4.6,7.35], [6.85,7.12], [7.44,3.52], [7.42,1.34],
    [7.45,-1.37], [7.29,-7.47], [5.99,-7.36], [1.25,-7.43], [-2.87,-7.32], [-5.25,-7.45],
    [-3.67,2.43], [.95,2.24], [3.82,2.13], [-5.38,-3.61], [.03,-3.62], [4.9,-2.74],
  ]
  const scenery = greenery.filter(([x, y]) => lots.every(([lx, ly]) => Math.abs(lx - x) > 1.47 || Math.abs(ly - y) > 1.22))
  const units = [
    ...scenery.map(([x, y], i) => ({ x, y, scale: .81 + i % 4 * .125, site: -1 })),
    ...lots.map(([x, y], site) => ({ x, y, scale: 1, site })),
  ].sort((a, b) => a.x + a.y - b.x - b.y)
  for (const { x, y, scale, site } of units) {
    if (site < 0) {
      tree(paint, x, y, scale)
      continue
    }
    const kind = match.sites[site]
    const level = recent?.site === site ? animationLevel(recent, time) : match.progress[site]
    building(paint, kind, x, y, level)
    if (kind === 'house') tree(paint, x + 1.09, y + .82, .59)
    else solid(x - 1.11, y + .82, .26, .12, .055, .13, ['#e1b667', '#bf8b44', '#9b733e'])
    if (recent?.site === site && time < .69) {
      const step = time / .69 * recent.bricks
      const fall = step % 1
      const z = .5 + heights[kind] * modelScale(kind, level) + (1 - fall ** 2) * .75
      const offset = (Math.floor(step) - (recent.bricks - 1) / 2) * .19
      solid(x + offset, y - .12, .21, .18, z, .14, ['#f5bc6f', '#d98649', '#a95c35'])
    }
  }

  if (recent && recent.site !== null && recent.stars && time > .42) {
    const [x, y] = lots[recent.site]
    const [px, py] = projectPoint(x, y, heights[match.sites[recent.site]] + .52)
    const burst = (time - .42) / .58
    ctx.globalAlpha = 1 - burst
    for (let i = 0; i < 12; i++) {
      const theta = i * Math.PI / 6
      const distance = 8 + 42 * burst
      const sx = px + Math.cos(theta) * distance
      const sy = py + Math.sin(theta) * distance - 14 * burst
      ctx.fillStyle = i % 2 ? '#fff5cb' : '#e5ad44'
      ctx.fillRect(sx, sy, 3 + i % 3, 3 + i % 3)
    }
    ctx.globalAlpha = 1
  }
}
