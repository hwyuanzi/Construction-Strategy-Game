import type { Colors, Painter } from './townPainter'

export function tree(paint: Painter, x: number, y: number, scale: number, variant: number) {
  const { line, oval, solid, gradient } = paint
  const colors = [
    ['#c2ce83', '#77965c', '#466d55'],
    ['#dee099', '#a4b16e', '#5d8357'],
    ['#afc998', '#6a9771', '#3e6e5c'],
  ][variant % 3]
  solid(x - .048, y - .049, .096, .098, .018, .57 * scale, ['#a79664', '#947750', '#6b6248'])
  line([x, y + .055, .09], [x, y + .055, .55 * scale], '#b29b64', .7)
  for (const [dx, dy, z, width, height] of [
    [.14, -.06, .70, 10, 10], [-.17, .03, .71, 11, 10], [.06, .09, .69, 12, 11], [-.025, -.025, .93, 12, 12],
  ]) {
    const fill = gradient([x + dx * scale - .18, y + dy * scale, (z + .32) * scale],
      [x + dx * scale + .22, y + dy * scale, (z - .30) * scale], colors[0], colors[2])
    oval([x + dx * scale, y + dy * scale, z * scale], width * scale, height * scale, fill, -.24)
  }
  oval([x - .09 * scale, y, .99 * scale], 6.4 * scale, 3.8 * scale, colors[1] + '30', -.21)
  oval([x - .18 * scale, y + .05 * scale, 1.13 * scale], 4 * scale, 1.6 * scale, '#f4edac41', -.34)
}

export function flowerBed(paint: Painter, x: number, y: number, variant: number) {
  const { oval, plane, solid } = paint
  solid(x - .31, y - .18, .62, .36, .026, .075, ['#dedac0', '#bdb899', '#969e83'])
  plane(x - .27, y - .13, .54, .26, .103, '#7c8b5a')
  for (let flower = 0; flower < 7; flower++) {
    const u = x - .24 + flower % 4 * .15
    const v = y - .075 + Math.floor(flower / 4) * .155
    oval([u, v, .16], 2.5, 1.65, flower % 3 ? '#9aa568' : '#526f50', -.25)
    if ((flower + variant) % 3 !== 0) {
      oval([u - .015, v + .015, .206], 1.55, 1.25, variant % 2 ? '#eab898' : '#f5dc8d')
    }
  }
}

export function lamp(paint: Painter, x: number, y: number, side: number) {
  const { line, oval, solid } = paint
  oval([x, y, .03], 4, 2, '#50635657')
  line([x, y, .04], [x, y, .68], '#465b51', 1.2)
  line([x - .017, y, .11], [x - .017, y, .67], '#92a293', .5)
  line([x, y, .66], [x, y + side * .21, .74], '#465b51', 1.1)
  solid(x - .055, y + side * .21 - .044, .11, .09, .694, .05, ['#7f9281', '#f6e1a6', '#bca681'])
}

export function bench(paint: Painter, x: number, y: number) {
  const { line, solid } = paint
  for (const end of [-.23, .23]) solid(x + end, y - .067, .045, .14, .04, .14, ['#798776', '#636f60', '#53675b'])
  solid(x - .29, y - .08, .61, .20, .18, .044, ['#d1a679', '#916b53', '#796347'])
  solid(x - .29, y - .09, .61, .043, .24, .12, ['#d8ac7d', '#a48362', '#89715b'])
  line([x - .29, y - .043, .299], [x + .32, y - .043, .299], '#684e3d5f', .65)
}

export function fountain(paint: Painter, x: number, y: number) {
  const { shade, oval, solid, line } = paint
  shade([x + .11, y + .08, .025], 23, 11, '#41695743', .15)
  oval([x, y, .047], 21, 11, '#84917a')
  oval([x, y, .142], 21, 11, '#c4bb9d')
  oval([x, y, .16], 19, 9.6, '#f1e1b8')
  oval([x, y, .16], 15.8, 7.4, '#79a99d')
  oval([x - .055, y, .166], 12.5, 5.9, '#acd1bc')
  solid(x - .092, y - .092, .184, .184, .16, .24, ['#fff1cc', '#d5c4a6', '#a9ad99'])
  oval([x, y, .432], 6.5, 3.7, '#e7d9b8')
  oval([x, y, .433], 4.6, 2.15, '#9fc6b6')
  line([x, y, .47], [x, y, .61], '#f4fafa', 1)
  oval([x, y, .57], 2.5, 1, '#e5f4df')
}

export function car(paint: Painter, x: number, y: number, facing: number, body: Colors) {
  const { oval, solid, line } = paint
  paint.shade([x + .08, y + .048, .050], 15, 5.5, '#1d3a345f', .38)
  for (const dx of [-.24, .23]) oval([x + dx, y + .146, .09], 2.5, 3.8, '#343b3b', -.15)
  solid(x - .37, y - .134, .74, .268, .098, .113, body)
  solid(x - .16 - facing * .058, y - .115, .32, .228, .21, .115, ['#f5eed3', '#8aa6a7', '#596f73'])
  line([x - .15 - facing * .058, y + .114, .267], [x + .16 - facing * .058, y + .114, .267], '#f6efd795', .7)
  for (const dy of [-.084, .081]) oval([x + facing * .375, y + dy, .166], 1.45, 1.08, '#fff3cb')
  oval([x - facing * .375, y + .094, .162], 1.45, 1.08, '#a44e3f')
}

export function sailboat(paint: Painter, x: number, y: number, small = false) {
  const { gradient, line, oval, region } = paint
  const s = small ? .72 : 1
  const water = -.51
  oval([x + .22, y + .05, water], 21 * s, 5.5 * s, '#2e77736b', .44)
  line([x - s * .61, y + .16, water], [x - s * 1.65, y + .46, water], '#eff5da90', .9)
  line([x - s * .67, y - .16, water], [x - s * 1.68, y - .39, water], '#f3f7e381', .75)
  region([[x - .61 * s, y - .13 * s, water], [x + .36 * s, y - .16 * s, water], [x + .65 * s, y, water],
    [x + .37 * s, y + .17 * s, water], [x - .61 * s, y + .13 * s, water]], '#9c826a', '#487976')
  region([[x - .60 * s, y - .12 * s, water + .066], [x + .37 * s, y - .135 * s, water + .066], [x + .65 * s, y, water + .061],
    [x + .38 * s, y + .14 * s, water + .066], [x - .60 * s, y + .12 * s, water + .066]], '#fff0cd')
  const mast = water + .96 * s
  region([[x - .045, y, mast], [x - .49 * s, y, water + .136], [x - .054, y, water + .16]],
    gradient([x, y, mast], [x, y, water], '#fffbea', '#e3d3ac'), '#899f88')
  region([[x + .012, y, mast - .085], [x + .44 * s, y, water + .15], [x + .011, y, water + .19]],
    gradient([x, y, mast], [x, y, water], '#fff1d0', '#cedcc6'), '#839c88')
  line([x - .059, y, water + .13], [x - .059, y, mast + .03], '#9e8466', .7)
}
