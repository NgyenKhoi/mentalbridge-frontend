import { describe, expect, it } from 'vitest'

import {
  NO_POKE,
  POKE_COOLDOWN_MS,
  POKE_WINDOW_MS,
  pokeClick,
  type PokeState,
} from './mam-poke'

const click = (state: PokeState, at: number) => pokeClick(state, at)

describe('pokeClick', () => {
  it('the first click toggles the menu and giggles', () => {
    const first = click(NO_POKE, 1000)
    expect(first.toggleMenu).toBe(true)
    expect(first.play).toBe('giggle')
  })

  it('further clicks inside 1.5 s are pokes only: no menu toggle', () => {
    const first = click(NO_POKE, 1000)
    const second = click(first.state, 1000 + POKE_WINDOW_MS - 1)
    expect(second.toggleMenu).toBe(false)
    expect(second.play).toBe('giggle')
  })

  it('the third poke in the window plays tickled once and starts the cool-down', () => {
    let state = click(NO_POKE, 0).state
    state = click(state, 400).state
    const third = click(state, 800)
    expect(third.toggleMenu).toBe(false)
    expect(third.play).toBe('tickled')
    expect(third.state.coolUntil).toBe(800 + POKE_COOLDOWN_MS)
    // A fourth click in the same window plays nothing and still never toggles.
    const fourth = click(third.state, 1200)
    expect(fourth.toggleMenu).toBe(false)
    expect(fourth.play).toBeNull()
  })

  it('a click after the window starts a new window: it toggles the menu again', () => {
    const first = click(NO_POKE, 0)
    const later = click(first.state, POKE_WINDOW_MS)
    expect(later.toggleMenu).toBe(true)
    expect(later.play).toBe('giggle')
    expect(later.state.count).toBe(1)
  })

  it('reacts with nothing during the 10 s cool-down, but the menu still toggles per window', () => {
    let state = click(NO_POKE, 0).state
    state = click(state, 300).state
    state = click(state, 600).state // tickled, cool until 10 600
    const during = click(state, 3000)
    expect(during.toggleMenu).toBe(true)
    expect(during.play).toBeNull()
    expect(click(during.state, 3200).play).toBeNull()
    const after = click(during.state, 10_600 + POKE_WINDOW_MS)
    expect(after.toggleMenu).toBe(true)
    expect(after.play).toBe('giggle')
  })
})
