import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { mockServer } from '@/tests/mocks/server'
import { localToday } from './companion-copy'
import { resetCompanionStateForTests } from './companion-state'
import { MamFocusPicker } from './MamFocusPicker'

const state = (goal: string | null) => ({
  focus: goal ? { goal, chosenOn: localToday() } : null,
  chapters: [],
  commitments: [],
  ui: { guide: null, seen: [] },
  revision: 1,
})

describe('MamFocusPicker', () => {
  beforeEach(() => resetCompanionStateForTests())

  it('asks as a radio group with the primary disabled until a chip is chosen', async () => {
    render(<MamFocusPicker accountId="acc-f1" onSkip={vi.fn()} />)

    expect(
      screen.getByRole('heading', {
        level: 3,
        name: '14 ngày tới, bạn muốn điều gì nhẹ đi?',
      }),
    ).toBeInTheDocument()
    const group = screen.getByRole('radiogroup', {
      name: '14 ngày tới, bạn muốn điều gì nhẹ đi?',
    })
    expect(group).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(7)
    expect(screen.getByRole('button', { name: 'Chọn điều này' })).toBeDisabled()
    // One tab stop: the first chip while nothing is chosen.
    expect(screen.getAllByRole('radio')[0]).toHaveAttribute('tabindex', '0')
    expect(screen.getAllByRole('radio')[1]).toHaveAttribute('tabindex', '-1')
  })

  it('moves and chooses with the arrow keys, wrapping around', async () => {
    const user = userEvent.setup()
    render(<MamFocusPicker accountId="acc-f2" onSkip={vi.fn()} />)

    screen.getByRole('radio', { name: 'Giấc ngủ' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(
      screen.getByRole('radio', { name: 'Áp lực học hoặc làm' }),
    ).toBeChecked()
    expect(
      screen.getByRole('radio', { name: 'Áp lực học hoặc làm' }),
    ).toHaveFocus()
    await user.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(screen.getByRole('radio', { name: 'Mình chưa rõ' })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Chọn điều này' })).toBeEnabled()
  })

  it('saves the focus with the local date, says Mầm line and moves focus to it', async () => {
    const user = userEvent.setup()
    let body: unknown = null
    mockServer.use(
      http.patch('/api/companion-state', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(state('SLEEP'))
      }),
    )
    const onSaved = vi.fn()
    render(
      <MamFocusPicker accountId="acc-f3" onSaved={onSaved} onSkip={vi.fn()} />,
    )

    await user.click(screen.getByRole('radio', { name: 'Giấc ngủ' }))
    await user.click(screen.getByRole('button', { name: 'Chọn điều này' }))

    const line = await screen.findByRole('status')
    expect(line).toHaveTextContent('Ok, 14 ngày tới mình để ý giấc ngủ nhé.')
    expect(line).toHaveFocus()
    expect(body).toEqual({ focus: { goal: 'SLEEP', chosenOn: localToday() } })
    expect(onSaved).toHaveBeenCalledWith('SLEEP')
  })

  it('says the NOT_SURE line without a phrase', async () => {
    const user = userEvent.setup()
    mockServer.use(
      http.patch('/api/companion-state', () =>
        HttpResponse.json(state('NOT_SURE')),
      ),
    )
    render(<MamFocusPicker accountId="acc-f4" onSkip={vi.fn()} />)

    await user.click(screen.getByRole('radio', { name: 'Mình chưa rõ' }))
    await user.click(screen.getByRole('button', { name: 'Chọn điều này' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Ok, mình cứ đi rồi tìm ra dần nhé.',
    )
  })

  it('keeps the choice and says so when saving fails, and "Để sau" saves nothing', async () => {
    const user = userEvent.setup()
    const patch = vi.fn()
    mockServer.use(
      http.patch('/api/companion-state', () => {
        patch()
        return HttpResponse.error()
      }),
    )
    const onSkip = vi.fn()
    render(<MamFocusPicker accountId="acc-f5" onSkip={onSkip} />)

    await user.click(screen.getByRole('radio', { name: 'Chuyện gia đình' }))
    await user.click(screen.getByRole('button', { name: 'Chọn điều này' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chưa lưu được lựa chọn. Bạn thử lại nhé.',
    )
    expect(screen.getByRole('radio', { name: 'Chuyện gia đình' })).toBeChecked()

    await user.click(screen.getByRole('button', { name: 'Để sau' }))
    expect(onSkip).toHaveBeenCalledOnce()
    await waitFor(() => expect(patch).toHaveBeenCalledOnce())
  })
})
