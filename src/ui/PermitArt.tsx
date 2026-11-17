import { useEffect, useRef } from 'react'
import type { Building } from '../game/rules'

export function PermitArt({ type }: { type: Building }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    ctx.setTransform(2, 0, 0, 2, 0, 0)
    ctx.clearRect(0, 0, 112, 74)

    const face = (color: string, ...points: [number, number][]) => {
      ctx.beginPath()
      points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y))
      ctx.closePath()
      ctx.fillStyle = color
      ctx.fill()
      ctx.strokeStyle = '#2e392b62'
      ctx.lineWidth = .65
      ctx.stroke()
    }
    face('#3e4a361b', [20, 55], [56, 38], [94, 57], [59, 73])

    if (type === 'house') {
      face('#faeee0', [27, 38], [61, 54], [61, 66], [27, 50])
      face('#c5ae90', [61, 54], [84, 42], [84, 55], [61, 66])
      face('#b76d51', [22, 39], [59, 57], [65, 39], [28, 22])
      face('#d58a6a', [28, 22], [65, 39], [88, 44], [51, 26])
      face('#b88d74', [61, 55], [65, 39], [84, 43])
      face('#59736d', [34, 44], [43, 48], [43, 53], [34, 49])
      face('#59736d', [49, 51], [57, 55], [57, 59], [49, 56])
      face('#684a39', [68, 56], [75, 52], [75, 59], [68, 62])
      return
    }

    const tower = type === 'skyscraper'
    const left = tower ? 38 : 25
    const right = tower ? 75 : 85
    const seam = tower ? 57 : 60
    const top = tower ? 15 : 35
    const rise = tower ? 7 : 13
    face(tower ? '#9997ae' : '#9ab9ab', [left, top], [seam, top + rise], [seam, 65], [left, 65 - rise])
    face(tower ? '#726d88' : '#537e75', [seam, top + rise], [right, top], [right, 65 - rise], [seam, 65])
    face(tower ? '#c9c3d0' : '#d7dccc', [left, top], [56, top - rise], [right, top], [seam, top + rise])
    for (let floor = top + rise + 8; floor < 64; floor += 8) {
      face('#e9e9d7', [left + 3, floor - rise], [seam - 3, floor - 2], [seam - 3, floor + 1], [left + 3, floor - rise + 3])
      face('#dce0d4', [seam + 3, floor - 2], [right - 3, floor - rise], [right - 3, floor - rise + 3], [seam + 3, floor + 1])
    }
    if (tower) {
      ctx.beginPath()
      ctx.moveTo(57, 4)
      ctx.lineTo(57, 17)
      ctx.strokeStyle = '#605c69'
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }, [type])
  return <canvas className="permit-art" ref={canvas} width={224} height={148} aria-hidden="true" />
}
