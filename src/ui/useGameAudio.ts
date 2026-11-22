import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { delivery } from '../game/engine'
import type { Match } from '../game/engine'
import { createGameAudio } from './gameAudio'
import { completionTime } from './town'

export function useGameAudio(match: Match, vsComputer: boolean) {
  const [enabled, setEnabled] = useState(false)
  const audio = useRef<ReturnType<typeof createGameAudio>>(undefined)
  const previousMatch = useRef(match)
  const reduced = useReducedMotion()

  useEffect(() => () => {
    audio.current?.close()
    audio.current = undefined
  }, [])

  useEffect(() => {
    if (previousMatch.current === match) return
    previousMatch.current = match
    const move = match.moves.at(-1)
    if (move) audio.current?.turn({
      stars: move.stars,
      placed: move.site !== null,
      computer: vsComputer && move.player === 1,
      finished: !delivery(match),
      scoreDelay: move.stars && !reduced ? completionTime(move.bricks) / 1000 : 0,
    })
  }, [match, reduced, vsComputer])

  async function toggle() {
    if (audio.current) {
      audio.current.close()
      audio.current = undefined
      setEnabled(false)
      return
    }

    let next: ReturnType<typeof createGameAudio> | undefined
    try {
      const context = new AudioContext()
      next = createGameAudio(context)
      audio.current = next
      setEnabled(true)
      await context.resume()
      if (audio.current === next) {
        next.click(true)
        next.start()
      }
    } catch {
      if (audio.current !== next) return
      next?.close()
      audio.current = undefined
      setEnabled(false)
    }
  }

  return {
    enabled,
    toggle,
    click: (wood: boolean) => audio.current?.click(wood),
  }
}
