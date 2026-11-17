import type { Building, Mode } from './rules'

export type Status = 'active' | 'complete' | 'expired' | 'abandoned'

export interface Project {
  id: string
  seat: number
  type: Building
  name: string
  stage: number
  work: number
  due: number
  payout: number
  started: number
  status: Status
}

export interface Company {
  seat: number
  name: string
  cash: number
  overtime: number
  signedTower: boolean
}

export interface Offer {
  type: Building
  name: string
  duration: number
  payout: number
  minimum: number
  rush: boolean
}

export interface WeekPlan {
  permit?: Building
  work: Record<string, number>
  bid?: { site: string; amount: number }
  fallback?: { site: string; shifts: number }
  overtime?: boolean
  subcontract?: boolean
  abandon?: string[]
}

export type GameEvent =
  | { kind: 'auction'; seat: number; site: string; amount: number; won: boolean }
  | { kind: 'work'; seat: number; site: string; shifts: number; cost: number }
  | { kind: 'stage'; seat: number; site: string; stage: string }
  | { kind: 'income'; seat: number; amount: number; source: 'milestone' | 'completion' | 'subcontract' | 'prize'; site?: string }
  | { kind: 'overtime'; seat: number; amount: number }
  | { kind: 'project'; seat: number; site: string; action: 'completed' | 'expired' | 'abandoned' }
  | { kind: 'permit'; seat: number; type: Building; result: 'awarded' | 'claimed' | 'full'; site?: string }

export interface WeekReport {
  week: number
  events: GameEvent[]
  cash: number[]
}

export interface MatchState {
  mode: Mode
  seed: number
  week: number
  finished: boolean
  firstPriority: number
  prizeWeek?: number
  companies: Company[]
  projects: Project[]
  history: WeekReport[]
}

export interface PlayerView {
  mode: Mode
  week: number
  finished: boolean
  seat: number
  companies: Company[]
  projects: Project[]
  priority: number[]
  cranes: number
  offers: Offer[]
  prizeWeek?: number
  history: WeekReport[]
}

export interface Branch {
  work: Record<string, number>
  shifts: number
  spend: number
  overtime: boolean
  slot: boolean
}

export interface PlanCheck {
  errors: string[]
  win: Branch
  lose: Branch
  reserve: number
}
