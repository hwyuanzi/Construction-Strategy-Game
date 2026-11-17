import { greedyPlan } from './planner'
import type { PlayerView } from './types'

self.addEventListener('message', (event: MessageEvent<PlayerView>) => {
  self.postMessage(greedyPlan(event.data))
})
