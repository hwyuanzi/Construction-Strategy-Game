import { BUILDINGS } from '../game/engine'
import type { Building } from '../game/engine'
import { painter } from './townPainter'
import type { Colors, Painter, Point, Project } from './townPainter'

const heights: Record<Building, number> = {
  house: 1.48, library: 1.66, commercial: 1.34, apartment: 2.64, skyscraper: 3.84,
}

const walls: Record<Building, [string, string, string, string, string]> = {
  house: ['#f4dfbc', '#fff1d6', '#dcb78e', '#e6c9a1', '#ae896b'],
  library: ['#e5ca93', '#fff0c7', '#dbc094', '#e1c89d', '#ac916a'],
  commercial: ['#b8d0bf', '#c7e0d0', '#84ad9d', '#8cb4a9', '#537c76'],
  apartment: ['#e4b294', '#f5d1ad', '#cc987e', '#cf967f', '#aa705d'],
  skyscraper: ['#b0b5d1', '#b5bbd8', '#747eaa', '#828db6', '#525e88'],
}

function scaleFor(kind: Building, progress: number) {
  return .55 + .45 * Math.min(progress / BUILDINGS[kind].bricks, 1)
}

export function roofHeight(kind: Building, progress: number) {
  const crown = { house: .49, library: .24, commercial: .30, apartment: .27, skyscraper: .46 }[kind]
  return .16 + heights[kind] * scaleFor(kind, progress) + crown
}

export function buildingShadow(paint: Painter, kind: Building, x: number, y: number, progress: number) {
  const h = roofHeight(kind, progress)
  paint.shade([x + .25 + h * .21, y + .17 + h * .07, .04], 39 + h * 4, 20, '#34463760', .30)
}

export function building(paint: Painter, kind: Building, x: number, y: number, progress: number) {
  const { line, plane, region, solid, gradient, oval } = paint
  const scale = scaleFor(kind, progress)
  const h = heights[kind] * scale
  const west = x - .93
  const south = y - .71
  const front = y + .71
  const east = x + .93
  const w = 1.86
  const d = 1.42
  const base = .16
  const roof = base + h
  const [top, light, foot, side, sideFoot] = walls[kind]

  solid(west - .11, south - .11, w + .22, d + .22, .06, .06, ['#e6dbbd', '#b4ae94', '#919983'])
  solid(west - .065, south - .065, w + .13, d + .13, .12, .04, ['#fff1ce', '#dac8a6', '#aaa88f'])
  solid(west, south, w, d, base, h, [top,
    gradient([west, front, roof], [west, front, base], light, foot),
    gradient([east, south, roof], [east, south, base], side, sideFoot),
  ])
  line([west, front, roof], [west, front, base + .04], '#fff7dd77', .8)
  line([west, front, base + .07], [east, front, base + .07], '#59463833', 1)

  function pane(at: number, z: number, width: number, height: number, color: string, beside = false, crossbar = false) {
    const point = (u: number, v: number): Point => beside ? [east, u, v] : [u, front, v]
    const span = (u: number, v: number, a: number, b: number, fill: string | CanvasGradient) =>
      region([point(u, v), point(u + a, v), point(u + a, v + b), point(u, v + b)], fill)
    span(at - .026, z - .025, width + .052, height + .05, beside ? '#36474040' : '#fdf3d296')
    span(at, z, width, height, gradient(point(at, z + height), point(at + width, z), color, '#3e5562'))
    region([point(at, z + height), point(at + width * .74, z + height), point(at, z + height * .29)], '#eff9e230')
    line(point(at - .026, z - .025), point(at + width + .026, z - .025), '#ffedccad', .8)
    if (crossbar) {
      line(point(at + width * .5, z), point(at + width * .5, z + height), '#fff1c9d1', .85)
      line(point(at, z + height * .57), point(at + width, z + height * .57), '#fff1c9a3', .6)
    }
  }

  if (kind === 'house') {
    const ridge = roof + .43
    const left = west - .10
    const right = east + .10
    const eave = front + .10
    const back = south - .10
    region([[west, south, roof], [east, south, roof], [east, y, ridge], [west, y, ridge]], '#ead4ab')
    region([[east, south, roof], [east, y, ridge], [east, front, roof]], '#dbb48f')
    region([[left, back, roof], [right, back, roof], [right, y, ridge], [left, y, ridge]], '#d48f69')
    region([[left, y, ridge], [right, y, ridge], [right, eave, roof], [left, eave, roof]],
      gradient([x, y, ridge], [x, eave, roof], '#d88662', '#a8513d'))
    for (let row = 1; row <= 5; row++) {
      const t = row / 6
      const edge = y + (eave - y) * t
      const z = ridge - .43 * t
      line([left, edge, z], [right, edge, z], '#733f3454', .8)
      for (let tile = left + .13 + row % 2 * .10; tile < right; tile += .21) {
        line([tile, edge, z], [tile, edge + .125, z - .067], '#592f243a', .65)
      }
    }
    line([left, eave, roof], [right, eave, roof], '#7a4635', 1.9)
    line([left, y, ridge + .016], [right, y, ridge + .016], '#f5af81', 1.6)
    line([right, y, ridge], [right, back, roof], '#a25a45', 1.05)
    solid(x + .36, y + .22, .16, .19, roof + .26, .23, ['#c58269', '#b07057', '#875543'])
    solid(x + .33, y + .20, .22, .23, roof + .49, .055, ['#ecd0a8', '#ca956e', '#a66b52'])
    pane(x - .15, base + .012, .31, .57 * scale, '#875f47')
    for (const wx of [west + .23, east - .53]) {
      pane(wx, base + .34 * scale, .30, .35 * scale, '#759b9d', false, true)
      solid(wx - .04, front - .008, .38, .08, base + .30 * scale, .027, ['#fff6dc', '#d7aa81', '#ad886d'])
    }
    pane(y - .19, base + .33 * scale, .34, .35 * scale, '#779899', true, true)
    solid(x - .20, front, .43, .23, .067, .066, ['#e9d5b4', '#bd9d7f', '#9c8c75'])
    oval([x + .08, front, base + .22 * scale], 1, 1, '#fbd089')
  } else if (kind === 'library') {
    const trim = ['#ffedc0', '#d4b580', '#b1956c'] as const
    for (const offset of [.24, h * .65]) {
      line([west, front, base + offset], [east, front, base + offset], '#fff6d388', .8)
      line([east, south, base + offset], [east, front, base + offset], '#7b67483d', .8)
    }
    pane(x - .16, base + .035, .32, h * .66, '#6f8583', false, true)
    for (const wx of [west + .15, east - .40]) pane(wx, base + h * .35, .25, h * .29, '#7d9290', false, true)
    for (const wy of [south + .19, y - .04, front - .31]) pane(wy, base + h * .36, .21, h * .29, '#84938c', true)
    solid(west - .08, south - .08, w + .16, d + .16, roof - .035, .12, trim)
    plane(west + .13, south + .12, w - .26, d - .24, roof + .09, '#dcc38f', '#b69a6c')
    solid(x - .60, front - .08, 1.20, .41, .06, .045, trim)
    solid(x - .52, front - .04, 1.04, .29, .105, .055, trim)
    for (const wx of [x - .48, x - .22, x + .15, x + .41]) {
      solid(wx - .021, front + .068, .13, .14, base, .057, trim)
      solid(wx, front + .091, .086, .093, base + .057, h - .14, ['#fff8d8', '#f3e4bb', '#c7af83'])
      solid(wx - .017, front + .074, .12, .13, roof - .092, .06, trim)
    }
    solid(x - .61, front - .06, 1.22, .36, roof - .028, .084, trim)
    const pediment = roof + .29
    region([[x - .60, front + .30, roof + .056], [x + .60, front + .30, roof + .056], [x, front + .30, pediment]], '#e9cea0')
    line([x - .60, front + .30, roof + .056], [x, front + .30, pediment], '#fff1c4', 1.25)
    line([x, front + .30, pediment], [x + .60, front + .30, roof + .056], '#fff1c4', 1.25)
    oval([x, front + .306, roof + .132], 1.7, 1.7, '#a78b60')
  } else if (kind === 'commercial') {
    for (const offset of [0, .69]) {
      const low = south + offset - .03
      const high = low + .67
      region([[west - .05, low, roof], [east + .05, low, roof], [east + .05, high, roof + .30], [west - .05, high, roof + .30]],
        gradient([x, high, roof + .30], [x, low, roof], '#dbe2c6', '#9fbdb0'))
      region([[east + .05, low, roof], [east + .05, high, roof + .30], [east + .05, high, roof]], '#557f77')
      region([[west - .05, high, roof], [east + .05, high, roof], [east + .05, high, roof + .30], [west - .05, high, roof + .30]], '#5e8880')
      for (let seam = west + .14; seam < east; seam += .18) {
        line([seam, low, roof], [seam, high, roof + .30], '#456f6742', .65)
      }
      line([west - .05, high, roof + .30], [east + .05, high, roof + .30], '#ebf2d6', 1.1)
      line([west - .05, high, roof + .22], [east + .05, high, roof + .22], '#c0d9cd99', 1.8)
    }
    pane(west + .19, base + .035, .72, h * .67, '#587e75')
    for (let slat = 1; slat <= 6; slat++) {
      const z = base + .05 + h * slat * .09
      line([west + .21, front, z], [west + .88, front, z], '#b8d4c19e', .9)
    }
    pane(x + .33, base + h * .40, .37, h * .28, '#a4c8c4', false, true)
    pane(y - .46, base + h * .42, .88, h * .24, '#8eb4ae', true, true)
    solid(west + .13, front - .02, .84, .19, base + h * .76, .048, ['#e1d3a8', '#c6a97b', '#9c8b69'])
    line([west, front, base + h * .24], [east, front, base + h * .24], '#38685b42', 1)
    solid(east - .04, front - .30, .13, .17, base + .07, .14, ['#e2cfa7', '#bca784', '#8a937c'])
  } else {
    const tall = kind === 'skyscraper'
    const floors = Math.max(2, Math.round((tall ? 7 : 5) * scale))
    const trim: Colors = tall ? ['#d2d6e5', '#9b9ebf', '#737eaa'] : ['#f3d5b2', '#d2a185', '#a87865']
    for (let floor = 0; floor < floors; floor++) {
      const z = base + h * (floor + .24) / floors
      const height = h / floors * .46
      for (let bay = 0; bay < 4; bay++) {
        const color = tall ? (floor + bay * 2) % 7 === 3 ? '#f1d49a' : '#bdcedd' : '#9dbab7'
        pane(west + .17 + bay * .406, z, .248, height, color)
      }
      for (let bay = 0; bay < 3; bay++) {
        pane(south + .15 + bay * .397, z, .235, height, tall ? '#a1b5ca' : '#87a7a2', true)
      }
      const seam = floor ? z - height * .37 : base + .03
      line([west, front, seam], [east, front, seam], tall ? '#e4e6f06b' : '#ffe3bf94', .95)
      line([east, south, seam], [east, front, seam], '#25374833', .9)
      if (!tall && floor > 0) {
        solid(x - .49, front - .04, .98, .25, z - .08, .06, trim)
        line([x - .48, front + .20, z + .10], [x + .48, front + .20, z + .10], '#846f63', .85)
        for (const u of [-.46, -.23, 0, .23, .46]) line([x + u, front + .20, z + .01], [x + u, front + .20, z + .10], '#755c57a0', .65)
        solid(x + .29, front + .10, .14, .085, z + .005, .085, ['#91a56c', '#73865f', '#566f55'])
      }
    }
    solid(west - .055, south - .055, w + .11, d + .11, roof - .01, .085, trim)
    plane(west + .10, south + .10, w - .20, d - .20, roof + .077, tall ? '#a6afc8' : '#e0bc99', '#636e8055')
    if (tall) {
      solid(x - .58, y - .35, 1.14, .70, roof + .08, .24, trim)
      solid(x - .46, y - .25, .92, .50, roof + .32, .085, ['#e2e1eb', '#afb4cc', '#7983a8'])
      solid(x - .12, y - .10, .24, .20, roof + .405, .058, trim)
      line([x, y, roof + .465], [x, y, roof + .80], '#565c79', 1.25)
      oval([x, y, roof + .805], 1.6, 1.6, '#ffd393')
      for (const u of [west + .15, east - .24]) solid(u, front - .27, .16, .14, roof + .08, .11, trim)
    } else {
      solid(x - .58, y - .30, .82, .53, roof + .08, .06, ['#9baa7d', '#7b8d69', '#5f765e'])
      for (const u of [-.45, -.21, .02]) oval([x + u, y - .05, roof + .17], 2, 1.7, '#718958')
      solid(x + .33, y + .05, .23, .24, roof + .08, .16, trim)
    }
  }
}

export function paintThumbnail(ctx: CanvasRenderingContext2D, kind: Building) {
  const scale = kind === 'skyscraper' ? 8.5 : 11.5
  const project: Project = (x, y, z) => [42 + (x - y) * scale, 46 + (x + y) * scale * .52 - z * scale]
  const paint = painter(ctx, project)
  ctx.clearRect(0, 0, 84, 68)
  paint.shade([.32, .17, 0], 22, 9, '#4645303c', .22)
  building(paint, kind, 0, 0, BUILDINGS[kind].bricks)
}
