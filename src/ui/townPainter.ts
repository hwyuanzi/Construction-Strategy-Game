export type Point = [number, number, number]
export type Project = (x: number, y: number, z: number) => readonly [number, number]
type Fill = string | CanvasGradient
export type Colors = readonly [Fill, Fill, Fill]

export function painter(ctx: CanvasRenderingContext2D, project: Project) {
  function region(points: Point[], color: Fill, outline?: string) {
    ctx.beginPath()
    points.forEach((point, index) => {
      const [x, y] = project(...point)
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

  function plane(x: number, y: number, w: number, d: number, z: number, fill: Fill, edge?: string) {
    region([[x, y, z], [x + w, y, z], [x + w, y + d, z], [x, y + d, z]], fill, edge)
  }

  function solid(x: number, y: number, w: number, d: number, base: number, height: number, colors: Colors) {
    const top = base + height
    region([[x, y + d, base], [x + w, y + d, base], [x + w, y + d, top], [x, y + d, top]], colors[1])
    region([[x + w, y, base], [x + w, y + d, base], [x + w, y + d, top], [x + w, y, top]], colors[2])
    plane(x, y, w, d, top, colors[0])
  }

  function gradient(a: Point, b: Point, from: string, to: string) {
    const fill = ctx.createLinearGradient(...project(...a), ...project(...b))
    fill.addColorStop(0, from)
    fill.addColorStop(1, to)
    return fill
  }

  function oval(point: Point, rx: number, ry: number, fill: Fill, rotation = 0) {
    ctx.beginPath()
    ctx.ellipse(...project(...point), rx, ry, rotation, 0, Math.PI * 2)
    ctx.fillStyle = fill
    ctx.fill()
  }

  function shade(point: Point, rx: number, ry: number, color: string, rotation = 0) {
    ctx.save()
    ctx.translate(...project(...point))
    ctx.rotate(rotation)
    ctx.scale(rx, ry)
    const shade = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
    shade.addColorStop(0, color)
    shade.addColorStop(.5, color)
    shade.addColorStop(1, '#243e3200')
    ctx.fillStyle = shade
    ctx.fillRect(-1, -1, 2, 2)
    ctx.restore()
  }

  return { project, region, line, plane, solid, gradient, oval, shade }
}

export type Painter = ReturnType<typeof painter>
