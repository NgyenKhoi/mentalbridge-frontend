import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { MamCardButton } from './MamCardButton'
import { MAM_SUMMON_EVENT } from './mam-summon-request'
import { useMamSuppress } from './mam-suppression'

function Card({
  initiallyHidden = false,
}: Readonly<{ initiallyHidden?: boolean }>) {
  const [safety, setSafety] = useState(initiallyHidden)
  useMamSuppress(safety, 'hide')
  return (
    <section data-mam="">
      <h3>Thở chậm 3 phút</h3>
      <button type="button">Để hôm khác</button>
      <MamCardButton label="Mầm giải thích: Thở chậm 3 phút" />
      <button type="button" onClick={() => setSafety(true)}>
        Bật vùng an toàn
      </button>
    </section>
  )
}

describe('MamCardButton focus when Mầm goes away', () => {
  it('moves focus to the card heading when a safety zone removes the focused button', async () => {
    render(<Card />)
    const button = screen.getByRole('button', {
      name: 'Mầm giải thích: Thở chậm 3 phút',
    })
    act(() => button.focus())
    expect(button).toHaveFocus()

    // Safety arrives asynchronously, with no key press on the page.
    act(() => screen.getByRole('button', { name: 'Bật vùng an toàn' }).click())

    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: /^Mầm giải thích/ }),
      ).toBeNull(),
    )
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Thở chậm 3 phút' }),
      ).toHaveFocus(),
    )
  })

  it('leaves focus alone when it was on another control', async () => {
    render(<Card />)
    const other = screen.getByRole('button', { name: 'Để hôm khác' })
    act(() => other.focus())
    act(() => screen.getByRole('button', { name: 'Bật vùng an toàn' }).click())
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: /^Mầm giải thích/ }),
      ).toBeNull(),
    )
    expect(screen.getByRole('heading')).not.toHaveFocus()
  })

  it('does not take focus from an open modal', async () => {
    const page = (modal: boolean) => (
      <>
        <Card />
        {modal && (
          <dialog open>
            <button type="button">Trong hộp thoại</button>
          </dialog>
        )}
      </>
    )
    const { rerender } = render(page(false))
    const button = screen.getByRole('button', {
      name: 'Mầm giải thích: Thở chậm 3 phút',
    })
    act(() => button.focus())
    // A modal opens while the button holds focus: Mầm goes away, the page body keeps no focus claim.
    rerender(page(true))
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: /^Mầm giải thích/ }),
      ).toBeNull(),
    )
    expect(screen.getByRole('heading', { hidden: true })).not.toHaveFocus()
  })
})

// MB-814: the card icon is hidden until focus, but stays a real button.
describe('MamCardButton hiddenUntilFocus', () => {
  it('keeps the same name and summon action, with the visually-hidden class', () => {
    const asked = vi.fn()
    window.addEventListener(MAM_SUMMON_EVENT, asked)
    render(
      <section data-mam="">
        <h3>Thở chậm 3 phút</h3>
        <MamCardButton
          hiddenUntilFocus
          label="Mầm giải thích: Thở chậm 3 phút"
        />
        <MamCardButton label="Mầm giải thích: Hít thở" />
      </section>,
    )
    const quiet = screen.getByRole('button', {
      name: 'Mầm giải thích: Thở chậm 3 phút',
    })
    const plain = screen.getByRole('button', {
      name: 'Mầm giải thích: Hít thở',
    })
    // The hidden-until-focus rule lives in the variant class only.
    expect(quiet.className).toMatch(/hiddenUntilFocus/)
    expect(plain.className).not.toMatch(/hiddenUntilFocus/)
    expect(quiet).toHaveAttribute('data-mam-trigger')

    fireEvent.click(quiet)
    expect(asked).toHaveBeenCalledTimes(1)
    expect(
      (asked.mock.calls[0]![0] as CustomEvent<{ source: HTMLElement }>).detail
        .source,
    ).toBe(quiet)
    window.removeEventListener(MAM_SUMMON_EVENT, asked)
  })

  it('is reachable with Tab, and focus stays where the keyboard put it', async () => {
    const user = userEvent.setup()
    render(
      <section data-mam="">
        <button type="button">Để hôm khác</button>
        <MamCardButton hiddenUntilFocus label="Mầm giải thích: Thở chậm" />
      </section>,
    )
    await user.tab()
    expect(screen.getByRole('button', { name: 'Để hôm khác' })).toHaveFocus()
    await user.tab()
    expect(
      screen.getByRole('button', { name: 'Mầm giải thích: Thở chậm' }),
    ).toHaveFocus()
  })
})
