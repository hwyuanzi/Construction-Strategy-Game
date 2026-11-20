export const BUILDINGS = {
  house: { name: 'House', bricks: 3, stars: 2, foundation: 1 },
  library: { name: 'Library', bricks: 4, stars: 3, foundation: 1 },
  commercial: { name: 'Workshop', bricks: 5, stars: 4, foundation: 1 },
  apartment: { name: 'Apartments', bricks: 6, stars: 5, foundation: 2 },
  skyscraper: { name: 'Tower', bricks: 7, stars: 7, foundation: 1 },
} as const

export type Building = keyof typeof BUILDINGS

export const BUILDING_TYPES = Object.keys(BUILDINGS) as Building[]
export const DEFAULT_SITES: readonly Building[] = ['house', 'commercial', 'skyscraper']
export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 6
export const MAX_SITES = 12
export const MAX_STARTING_BRICKS = 7
export const DEFAULT_STARTING_BRICKS = 2
export const TURN_LIMIT = 3
export const BRICK_BUDGET = 12
export const ROUNDS = 6
export const SKIP_LIMIT = 2

export const BONUS_CARDS = {
  doubleLoad: { name: 'Double Load', description: 'Double this turn’s limit' },
  brickCart: { name: 'Brick Cart', description: 'Place up to 2 free bricks' },
} as const

export type BonusCard = keyof typeof BONUS_CARDS
export const CARD_TYPES: readonly BonusCard[] = ['doubleLoad', 'brickCart']
const CART_BRICKS = 2

const LATER_LOADS = Array.from({ length: ROUNDS - 1 }, () => TURN_LIMIT)

export interface BuildAction {
  site: number
  bricks: number
  card?: BonusCard
}

interface PassAction {
  site: null
  bricks: 0
}

export const SKIP_TURN: PassAction = { site: null, bricks: 0 }
export type TurnAction = BuildAction | PassAction
export interface BuildMove extends BuildAction {
  player: number
  before: number
  stars: number
}
export type Move = BuildMove | (PassAction & { player: number; stars: 0; forced?: true })

interface MatchOptions {
  sites?: readonly Building[]
  startingBricks?: readonly number[]
  laterLoads?: readonly number[]
  firstPlayer?: number
}

export interface Match {
  sites: readonly Building[]
  firstPlayer: number
  startingBricks: readonly number[]
  laterLoads: readonly number[]
  progress: readonly number[]
  reopensAt: readonly number[]
  reserves: readonly number[]
  skips: readonly number[]
  cards: readonly (readonly BonusCard[])[]
  scores: readonly number[]
  moves: readonly Move[]
}

export function createMatch({
  sites = DEFAULT_SITES,
  startingBricks = [DEFAULT_STARTING_BRICKS, DEFAULT_STARTING_BRICKS],
  laterLoads = LATER_LOADS,
  firstPlayer = 0,
}: MatchOptions = {}): Match {
  const validLoad = (load: number) => Number.isInteger(load) && load >= 1 && load <= MAX_STARTING_BRICKS
  if (startingBricks.length < MIN_PLAYERS || startingBricks.length > MAX_PLAYERS || !startingBricks.every(validLoad) ||
    !Number.isInteger(firstPlayer) || firstPlayer < 0 || firstPlayer >= startingBricks.length) {
    throw new Error('Choose two to six players with valid opening limits.')
  }
  if (!sites.length || sites.length > MAX_SITES || !sites.every(site => Object.hasOwn(BUILDINGS, site))) {
    throw new Error('Choose one to twelve building sites.')
  }
  if (!laterLoads.every(validLoad)) throw new Error('Turn limits must be whole numbers of bricks.')
  return {
    sites: [...sites],
    firstPlayer,
    startingBricks: [...startingBricks],
    laterLoads: [...laterLoads],
    progress: sites.map(site => BUILDINGS[site].foundation),
    reopensAt: sites.map(() => 0),
    reserves: startingBricks.map(() => BRICK_BUDGET),
    skips: startingBricks.map(() => SKIP_LIMIT),
    cards: startingBricks.map(() => [...CARD_TYPES]),
    scores: startingBricks.map(() => 0),
    moves: [],
  }
}

export function deliveryAt(match: Match, turn: number, reserves = match.reserves) {
  const count = match.startingBricks.length
  const round = Math.floor(turn / count)
  if (round > match.laterLoads.length) return
  const player = (match.firstPlayer + turn) % count
  const limit = round === 0 ? match.startingBricks[player] : match.laterLoads[round - 1]
  return { player, round: round + 1, bricks: Math.min(limit, reserves[player]) }
}

export function delivery(match: Match, ahead = 0) {
  return deliveryAt(match, match.moves.length + ahead)
}

export function bricksLeft(match: Match, site: number) {
  return BUILDINGS[match.sites[site]].bricks - match.progress[site]
}

export function turnsUntilOpen(match: Match, site: number) {
  return Math.max(0, match.reopensAt[site] - match.moves.length)
}

export function reopeningTurn(match: Match, completionTurn: number) {
  return completionTurn + match.scores.length + 1
}

export function isCopyCoolingDown(match: Match, site: number) {
  const previousSite = match.moves.at(-1)?.site
  return previousSite != null && previousSite !== site && match.sites[previousSite] === match.sites[site]
}

export function isSiteOpen(match: Match, site: number, ahead = 0) {
  return turnsUntilOpen(match, site) <= ahead && (ahead > 0 || !isCopyCoolingDown(match, site))
}

export function buildLimit(match: Match, load: NonNullable<ReturnType<typeof delivery>>, card?: BonusCard) {
  if (!card) return load.bricks
  if (!match.cards[load.player].includes(card)) return 0
  return card === 'doubleLoad' ? Math.min(load.bricks * 2, match.reserves[load.player]) : load.bricks + CART_BRICKS
}

export function maxBuildLimit(match: Match, load: ReturnType<typeof delivery>) {
  if (!load) return 0
  return Math.max(buildLimit(match, load), ...match.cards[load.player].map(card => buildLimit(match, load, card)))
}

export function canPlaceBricks(match: Match, load = delivery(match)) {
  return maxBuildLimit(match, load) > 0 && match.sites.some((_, site) => isSiteOpen(match, site))
}

export function playMove(match: Match, action: TurnAction): Match {
  const load = delivery(match)
  if (!load) return match
  const { site, bricks: requested } = action
  if (site === null) {
    if (requested !== 0) return match
    const forced = !canPlaceBricks(match, load)
    if (!forced && match.skips[load.player] === 0) return match
    const skips = forced ? match.skips : match.skips.map((left, player) => player === load.player ? left - 1 : left)
    return {
      ...match, skips,
      moves: [...match.moves, { ...SKIP_TURN, player: load.player, stars: 0, ...(forced ? { forced: true as const } : {}) }],
    }
  }
  const { card } = action
  if (!Number.isInteger(site) || site < 0 || site >= match.sites.length ||
    !Number.isInteger(requested) || requested < 1 || requested > buildLimit(match, load, card) || !isSiteOpen(match, site)) return match

  const project = BUILDINGS[match.sites[site]]
  const before = match.progress[site]
  const remaining = project.bricks - before
  const bricks = Math.min(requested, remaining)
  const stars = bricks === remaining ? project.stars : 0
  const progress = [...match.progress]
  const reopensAt = [...match.reopensAt]
  const scores = [...match.scores]
  const reserves = [...match.reserves]
  progress[site] = stars ? 0 : before + bricks
  if (stars) reopensAt[site] = reopeningTurn(match, match.moves.length)
  scores[load.player] += stars
  reserves[load.player] -= card === 'brickCart' ? Math.max(0, bricks - CART_BRICKS) : bricks
  const cards = card ? match.cards.map((hand, player) => player === load.player ? hand.filter(item => item !== card) : hand) : match.cards
  return {
    ...match, progress, reopensAt, scores, reserves, cards,
    moves: [...match.moves, { player: load.player, site, before, bricks, stars, ...(card ? { card } : {}) }],
  }
}
