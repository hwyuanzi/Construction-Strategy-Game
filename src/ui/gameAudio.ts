const AMBIENT_PHRASES = [
  [[48, 0], [67, .48], [64, 1.22], [62, 2.34], [67, 3.42], [72, 4.06]],
  [[45, 0], [64, .48], [67, 1.22], [69, 2.70], [64, 3.73]],
  [[41, 0], [65, .48], [69, 1.22], [72, 2.34], [69, 3.42], [67, 4.06]],
  [[43, 0], [62, .48], [67, 1.22], [64, 2.70], [62, 3.73], [60, 4.49]],
]
const PHRASE_LENGTH = 6.4
const FINALE_MELODY = [55, 60, 64, 67]

function frequency(note: number) {
  return 440 * 2 ** ((note - 69) / 12)
}

export function createGameAudio(context: AudioContext) {
  const master = context.createGain()
  master.gain.value = 1.08
  master.connect(context.destination)

  let phrase = 0
  let nextPhrase = 0
  let ambientTimer: number | undefined
  let lastClick = -Infinity

  function tone(at: number, pitch: number, endPitch: number, level: number, duration: number, attack = .006, shape: OscillatorType = 'sine') {
    const oscillator = context.createOscillator()
    const envelope = context.createGain()
    oscillator.type = shape
    oscillator.frequency.setValueAtTime(pitch, at)
    oscillator.frequency.exponentialRampToValueAtTime(endPitch, at + duration)
    envelope.gain.setValueAtTime(0, at)
    envelope.gain.linearRampToValueAtTime(level, at + attack)
    envelope.gain.exponentialRampToValueAtTime(.0001, at + duration)
    oscillator.connect(envelope).connect(master)
    oscillator.onended = () => {
      oscillator.disconnect()
      envelope.disconnect()
    }
    oscillator.start(at)
    oscillator.stop(at + duration)
  }

  function mallet(at: number, note: number, level: number, duration: number) {
    const pitch = frequency(note)
    tone(at, pitch, pitch, level, duration, .012)
    tone(at, pitch * 2.76, pitch * 2.75, level * .22, duration * .36, .004)
  }

  function knock(at: number, level: number, pitch: number) {
    tone(at, pitch, pitch * .77, level, .11, .003, 'triangle')
    tone(at, pitch * 3.36, pitch * 3.10, level * .5, .050, .002)
  }

  function scheduleAmbient() {
    if (context.state === 'running' && !document.hidden) {
      // Keep only the next phrase queued and recover from a throttled timer.
      const now = context.currentTime
      if (nextPhrase < now + .15) {
        const at = Math.max(nextPhrase, now + .025)
        for (const [note, offset] of AMBIENT_PHRASES[phrase]) {
          const bass = note < 60
          mallet(at + offset, note, bass ? .026 : .018, bass ? 1.7 : .85)
        }
        if (phrase === 1 || phrase === 3) {
          tone(at + 5.1, 1550, 2390, .009, .14, .055)
          tone(at + 5.29, 2210, 1680, .007, .18, .027)
        }
        phrase = (phrase + 1) % AMBIENT_PHRASES.length
        nextPhrase = at + PHRASE_LENGTH
      }
    }
    ambientTimer = window.setTimeout(scheduleAmbient, 120)
  }

  return {
    start() {
      nextPhrase = context.currentTime + .65
      scheduleAmbient()
    },
    click(wood = false) {
      if (context.state !== 'running') return
      const at = context.currentTime + .008
      if (at - lastClick < .045) return
      lastClick = at
      knock(at, wood ? .115 : .085, wood ? 365 : 630)
      if (wood) knock(at + .064, .060, 475)
    },
    turn({ stars, placed, computer, finished, scoreDelay }: {
      stars: number
      placed: boolean
      computer: boolean
      finished: boolean
      scoreDelay: number
    }) {
      if (context.state !== 'running') return
      const at = context.currentTime + .014
      const level = computer ? .64 : 1
      const scoreAt = at + scoreDelay
      if (stars > 0) {
        if (scoreDelay) knock(at, .085 * level, 330)
        knock(scoreAt, .18 * level, 210)
        const flourish = stars >= 4 ? [60, 67, 72, 79] : [64, 67, 72]
        flourish.forEach((note, index) => mallet(scoreAt + .045 + index * .082, note, .13 * level, .43 + index * .075))
        mallet(scoreAt + .35, 84, .042 * level, .56)
      } else if (placed || !computer) {
        knock(at, .13 * level, placed ? 260 : 430)
        if (placed) knock(at + .052, .063 * level, 380)
      }
      if (finished) {
        const finale = stars > 0 ? scoreAt + .80 : at + .28
        FINALE_MELODY.forEach((note, index) => mallet(finale + index * .13, note, .085, .64))
        for (const note of [48, 60, 64, 67, 72]) {
          mallet(finale + .57, note, note === 72 ? .113 : .062, 1.22)
        }
      }
    },
    close() {
      window.clearTimeout(ambientTimer)
      master.disconnect()
      void context.close().catch(() => {})
    },
  }
}
