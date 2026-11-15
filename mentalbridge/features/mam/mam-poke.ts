// MB-818 goal 5: poke windows. Pure, so the host only feeds it clicks.
export const POKE_WINDOW_MS = 1500
export const POKE_COOLDOWN_MS = 10_000

export type PokeState = Readonly<{
  /** When the current window's first click landed. */
  start: number
  count: number
  /** No giggle or tickle before this time. */
  coolUntil: number
}>

export const NO_POKE: PokeState = {
  start: Number.NEGATIVE_INFINITY,
  count: 0,
  coolUntil: 0,
}

/**
 * Only the first click of a window toggles the menu. The first two play
 * `giggle`, the third `tickled` once and starts the cool-down; clicks after
 * that, or during a cool-down, play nothing.
 */
export function pokeClick(
  state: PokeState,
  now: number,
): {
  state: PokeState
  toggleMenu: boolean
  play: 'giggle' | 'tickled' | null
} {
  const inWindow = now - state.start < POKE_WINDOW_MS
  const count = inWindow ? state.count + 1 : 1
  const start = inWindow ? state.start : now
  const cooling = now < state.coolUntil
  const play = cooling || count > 3 ? null : count === 3 ? 'tickled' : 'giggle'
  return {
    state: {
      start,
      count,
      coolUntil: play === 'tickled' ? now + POKE_COOLDOWN_MS : state.coolUntil,
    },
    toggleMenu: count === 1,
    play,
  }
}
