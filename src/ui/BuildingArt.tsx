import { useEffect, useRef } from 'react'
import type { Building } from '../game/engine'
import { paintThumbnail } from './town'

export function BuildingArt({ type }: { type: Building }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    ctx.setTransform(2, 0, 0, 2, 0, 0)
    paintThumbnail(ctx, type)
  }, [type])
  return <canvas className="building-art" ref={canvas} width={168} height={136} aria-hidden="true" />
}
