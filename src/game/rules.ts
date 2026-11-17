export type Mode = 'quick' | 'standard'
export type Building = 'house' | 'commercial' | 'skyscraper'

export interface Stage {
  name: string
  work: number
  crane?: boolean
  draw?: number
}

interface Contract {
  stages: Stage[]
  payout: number
  due: number
  rushDue?: number
  rushBonus?: number
}

export const BUILDINGS = {
  house: { label: 'House', permit: 4, unit: 2, late: 5 },
  commercial: { label: 'Commercial', permit: 6, unit: 3, late: 9 },
  skyscraper: { label: 'Skyscraper', permit: 9, unit: 4, late: 14 },
} as const

const house = (frame: number, finish: number, payout: number, rushBonus: number): Contract => ({
  stages: [{ name: 'Foundation', work: 2 }, { name: 'Frame', work: frame }, { name: 'Finish', work: finish }],
  payout, due: 4, rushDue: 3, rushBonus,
})

const commercial = (slab: number, finish: number, payout: number, due: number, rushBonus: number): Contract => ({
  stages: [{ name: 'Slab', work: slab }, { name: 'Steel frame', work: 4, crane: true }, { name: 'Fit-out', work: finish }],
  payout, due, rushDue: 3, rushBonus,
})

export const MODES: Record<Mode, {
  label: string
  weeks: number
  charges: number
  contracts: Record<Building, Contract>
  starters: { house: number; commercial: number }
}> = {
  quick: {
    label: 'Quick Match', weeks: 8, charges: 1, starters: { house: 13, commercial: 26 },
    contracts: {
      house: house(2, 1, 22, 3),
      commercial: commercial(2, 2, 45, 4, 6),
      skyscraper: {
        stages: [
          { name: 'Foundation', work: 3, draw: 12 }, { name: 'Core', work: 4, crane: true, draw: 18 },
          { name: 'Façade', work: 3, crane: true }, { name: 'Fit-out', work: 2 },
        ],
        payout: 82, due: 5,
      },
    },
  },
  standard: {
    label: 'Standard Match', weeks: 12, charges: 2, starters: { house: 16, commercial: 31 },
    contracts: {
      house: house(3, 2, 29, 4),
      commercial: commercial(3, 3, 57, 5, 8),
      skyscraper: {
        stages: [
          { name: 'Foundation', work: 4, draw: 15 }, { name: 'Core', work: 6, crane: true, draw: 27 },
          { name: 'Façade', work: 4, crane: true }, { name: 'Fit-out', work: 3 },
        ],
        payout: 113, due: 8,
      },
    },
  },
}

export const REGULAR_SHIFTS = 3
export const OVERTIME_COST = 3
export const SUBCONTRACT_LIMIT = 8
export const SUBCONTRACT_PAY = 4
export const SKYLINE_PRIZE = 12
export const GRACE_WEEKS = 2

export function subcontractPayout(openingCash: number) {
  return Math.max(0, Math.min(SUBCONTRACT_PAY, SUBCONTRACT_LIMIT - openingCash))
}

export function minimumWeeks(stages: Stage[], charges: number) {
  const regular = stages.reduce((weeks, stage) => weeks + Math.ceil(stage.work / REGULAR_SHIFTS), 0)
  const compressible = stages.filter(stage => stage.work % REGULAR_SHIFTS === 1 && stage.work > REGULAR_SHIFTS).length
  return regular - Math.min(charges, compressible)
}
