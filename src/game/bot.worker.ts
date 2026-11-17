import { searchMove } from './planner'
import type { Match } from './engine'

self.addEventListener('message', (event: MessageEvent<Match>) => {
  self.postMessage(searchMove(event.data, 'hard')?.action)
})
