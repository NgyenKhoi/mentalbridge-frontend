import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  localToday,
  previousLocalDate,
  shiftLocalDate,
} from '@/features/mam/companion-copy'
import { resetCompanionStateForTests } from '@/features/mam/companion-state'
import { MamDockSlot } from '@/features/mam/MamDockSlot'
import { mockServer } from '@/tests/mocks/server'
import HomeNextStepCard from './HomeNextStepCard'
import {
  homeFirstUseFixture,
  homeNextStepFixture as home,
  homePlanFixture as plan,
} from './testing/home-next-step-fixture'

// Height animations in jsdom call window.scrollTo.
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

const ACCOUNT = '00000000-0000-4000-8000-0000000000bb'
const ID = '30000000-0000-4000-8000-000000000001'

const commitment = (patch: object = {}) => ({
  id: ID,
  kind: 'REST',
  minutes: 10,
  dueOn: previousLocalDate(localToday()),
  source: 'CHAT',
  status: 'OPEN',
  createdAt: '2026-11-26T08:00:00.000Z',
  resolvedAt: null,
  ...patch,
})

const serve = (state: { focus?: unknown; commitments?: unknown[] }) =>
  mockServer.use(
    http.get('/api/companion-state', () =>
      HttpResponse.json({
        focus: null,
        chapters: [],
        commitments: [],
        ui: { guide: null, seen: [] },
        revision: 1,
        ...state,
      }),
    ),
  )

const card = (value = home({ plan: plan('DO_TODAY') })) =>
  render(
    <>
      <MamDockSlot accountId={ACCOUNT} />
      <HomeNextStepCard home={value} onRetry={vi.fn()} />
    </>,
  )

describe('Home card: lời hẹn ask', () => {
  beforeEach(() => resetCompanionStateForTests())

  it('asks about yesterday lời hẹn with three quiet answers and no extra primary', async () => {
    serve({ commitments: [commitment()] })
    card()

    expect(
      await screen.findByText(
        'Hôm qua bạn hẹn Mầm: nghỉ ngơi hoặc ngủ sớm hơn (10 phút). Xong chưa?',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xong rồi' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Chưa' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Đổi việc nhẹ hơn' }),
    ).toBeInTheDocument()
    // The card keeps its one primary action.
    expect(screen.getAllByRole('link', { name: /Bắt đầu ngay/ })).toHaveLength(
      1,
    )
  })

  it('says "Hôm nay" for a lời hẹn due today and stays out when nothing is due', async () => {
    serve({ commitments: [commitment({ dueOn: localToday(), minutes: null })] })
    const { unmount } = card()
    expect(
      await screen.findByText(
        'Hôm nay bạn hẹn Mầm: nghỉ ngơi hoặc ngủ sớm hơn. Xong chưa?',
      ),
    ).toBeInTheDocument()
    unmount()

    resetCompanionStateForTests()
    serve({
      commitments: [commitment({ dueOn: shiftLocalDate(localToday(), 1) })],
    })
    card()
    await waitFor(() =>
      expect(screen.getByText('Hôm nay cùng Mầm')).toBeInTheDocument(),
    )
    expect(screen.queryByRole('button', { name: 'Xong rồi' })).toBeNull()
  })

  it('done: saves DONE, tells Mầm line, sends the mam event and moves focus to the line', async () => {
    const user = userEvent.setup()
    let body: unknown = null
    mockServer.use(
      http.patch(
        `/api/companion-state/commitments/${ID}`,
        async ({ request }) => {
          body = await request.json()
          return HttpResponse.json(
            commitment({
              status: 'DONE',
              resolvedAt: '2026-11-27T09:00:00.000Z',
            }),
          )
        },
      ),
    )
    serve({ commitments: [commitment()] })
    const heard = vi.fn()
    window.addEventListener('mam:commitment-done', heard)
    card()

    await user.click(await screen.findByRole('button', { name: 'Xong rồi' }))

    const line = await screen.findByRole('status')
    expect(line).toHaveTextContent('Giỏi lắm nè, Mầm ghi lại rồi.')
    expect(line).toHaveFocus()
    expect(body).toEqual({ status: 'DONE' })
    expect(heard).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: 'Chưa' })).toBeNull()
    window.removeEventListener('mam:commitment-done', heard)
  })

  it('follows the answer the server holds when another device answered first: no cheer unless DONE', async () => {
    const user = userEvent.setup()
    const answered = commitment({
      status: 'NOT_YET',
      resolvedAt: '2026-11-27T09:00:00.000Z',
    })
    let conflict = false
    mockServer.use(
      http.get('/api/companion-state', () =>
        HttpResponse.json({
          focus: null,
          chapters: [],
          commitments: [conflict ? answered : commitment()],
          ui: { guide: null, seen: [] },
          revision: 1,
        }),
      ),
      http.patch(`/api/companion-state/commitments/${ID}`, () => {
        conflict = true
        return HttpResponse.json(
          {
            type: '/problems/commitment_resolved',
            title: 'x',
            status: 409,
            code: 'COMMITMENT_RESOLVED',
            correlationId: 'c',
          },
          { status: 409 },
        )
      }),
    )
    const heard = vi.fn()
    window.addEventListener('mam:commitment-done', heard)
    card()

    await user.click(await screen.findByRole('button', { name: 'Xong rồi' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Không sao hết. Mai 5 phút thôi cũng được.',
    )
    expect(screen.queryByText(/Giỏi lắm/)).toBeNull()
    expect(heard).not.toHaveBeenCalled()
    window.removeEventListener('mam:commitment-done', heard)
  })

  it('not yet: saves NOT_YET, then offers to book the same thing tomorrow for 5 minutes', async () => {
    const user = userEvent.setup()
    let rebooked: unknown = null
    mockServer.use(
      http.patch(`/api/companion-state/commitments/${ID}`, () =>
        HttpResponse.json(
          commitment({
            status: 'NOT_YET',
            resolvedAt: '2026-11-27T09:00:00.000Z',
          }),
        ),
      ),
      http.post('/api/companion-state/commitments', async ({ request }) => {
        rebooked = await request.json()
        return HttpResponse.json(
          commitment({
            id: '30000000-0000-4000-8000-000000000002',
            minutes: 5,
            dueOn: shiftLocalDate(localToday(), 1),
            source: 'HOME',
          }),
          { status: 201 },
        )
      }),
    )
    serve({ commitments: [commitment()] })
    card()

    await user.click(await screen.findByRole('button', { name: 'Chưa' }))
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Không sao hết. Mai 5 phút thôi cũng được.',
    )
    await user.click(screen.getByRole('button', { name: 'Hẹn lại mai 5 phút' }))

    expect(
      await screen.findByText(
        'Đã hẹn: nghỉ ngơi hoặc ngủ sớm hơn, ngày mai. Mầm sẽ hỏi lại.',
      ),
    ).toBeInTheDocument()
    expect(rebooked).toEqual({
      kind: 'REST',
      minutes: 5,
      dueOn: shiftLocalDate(localToday(), 1),
      source: 'HOME',
    })
  })

  it('swap: saves SWAPPED, then opens the picker with 5 minutes preset', async () => {
    const user = userEvent.setup()
    let swapped: unknown = null
    let created: unknown = null
    mockServer.use(
      http.patch(
        `/api/companion-state/commitments/${ID}`,
        async ({ request }) => {
          swapped = await request.json()
          return HttpResponse.json(
            commitment({
              status: 'SWAPPED',
              resolvedAt: '2026-11-27T09:00:00.000Z',
            }),
          )
        },
      ),
      http.post('/api/companion-state/commitments', async ({ request }) => {
        created = await request.json()
        return HttpResponse.json(
          commitment({
            id: '30000000-0000-4000-8000-000000000003',
            kind: 'RELAX',
            minutes: 5,
            dueOn: localToday(),
            source: 'HOME',
          }),
          { status: 201 },
        )
      }),
    )
    serve({ commitments: [commitment()] })
    card()

    await user.click(
      await screen.findByRole('button', { name: 'Đổi việc nhẹ hơn' }),
    )
    expect(swapped).toEqual({ status: 'SWAPPED' })
    expect(await screen.findByRole('radio', { name: '5 phút' })).toBeChecked()

    await user.click(screen.getByRole('radio', { name: 'Thư giãn' }))
    await user.click(screen.getByRole('button', { name: 'Hẹn Mầm' }))

    expect(
      await screen.findByText(
        'Đã hẹn: thư giãn, hít thở, hôm nay. Mầm sẽ hỏi lại.',
      ),
    ).toBeInTheDocument()
    expect(created).toEqual({
      kind: 'RELAX',
      minutes: 5,
      dueOn: localToday(),
      source: 'HOME',
    })
  })

  it('keeps the ask and says so when the answer cannot be saved', async () => {
    const user = userEvent.setup()
    mockServer.use(
      http.patch(`/api/companion-state/commitments/${ID}`, () =>
        HttpResponse.error(),
      ),
    )
    serve({ commitments: [commitment()] })
    card()

    await user.click(await screen.findByRole('button', { name: 'Xong rồi' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chưa lưu được lời hẹn. Bạn thử lại nhé.',
    )
    expect(screen.getByRole('button', { name: 'Xong rồi' })).toBeEnabled()
  })

  it('never shows the ask on the safety card', async () => {
    serve({ commitments: [commitment()] })
    card(
      home({
        journey: {
          ...home().journey,
          nextAction: 'REVIEW_SAFETY_SUPPORT',
        },
      }),
    )
    expect(await screen.findByText('Hỗ trợ ngay')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Xong rồi' })).toBeNull()
  })
})

describe('Home card: focus goal', () => {
  beforeEach(() => resetCompanionStateForTests())

  it('shows the goal as a chip with "Đổi", and opens the picker inline with the goal chosen', async () => {
    const user = userEvent.setup()
    serve({ focus: { goal: 'SLEEP', chosenOn: localToday() } })
    card()

    expect(
      await screen.findByText('Mục tiêu 14 ngày: Giấc ngủ'),
    ).toBeInTheDocument()
    const change = screen.getByRole('button', { name: 'Đổi mục tiêu 14 ngày' })
    expect(change).toHaveAttribute('aria-expanded', 'false')
    await user.click(change)

    expect(change).toHaveAttribute('aria-expanded', 'true')
    expect(await screen.findByRole('radio', { name: 'Giấc ngủ' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Giấc ngủ' })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Để sau' }))
    await waitFor(() => expect(screen.queryByRole('radiogroup')).toBeNull())
    expect(change).toHaveFocus()
  })

  it('offers a quiet link to choose when a screening exists and no goal is set', async () => {
    const user = userEvent.setup()
    let body: unknown = null
    mockServer.use(
      http.patch('/api/companion-state', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({
          focus: { goal: 'LONELINESS', chosenOn: localToday() },
          chapters: [],
          commitments: [],
          ui: { guide: null, seen: [] },
          revision: 2,
        })
      }),
    )
    serve({})
    card()

    await user.click(
      await screen.findByRole('button', { name: 'Chọn điều bạn muốn nhẹ đi' }),
    )
    await user.click(
      await screen.findByRole('radio', { name: 'Cảm giác cô đơn' }),
    )
    await user.click(screen.getByRole('button', { name: 'Chọn điều này' }))

    expect(
      await screen.findByText('Ok, 14 ngày tới mình để ý cảm giác cô đơn nhé.'),
    ).toBeInTheDocument()
    expect(body).toEqual({
      focus: { goal: 'LONELINESS', chosenOn: localToday() },
    })
    expect(
      await screen.findByText('Mục tiêu 14 ngày: Cảm giác cô đơn'),
    ).toBeInTheDocument()
  })

  it('stays out before the first screening and on the safety card', async () => {
    serve({})
    const first = card(homeFirstUseFixture())
    await waitFor(() =>
      expect(screen.getByText('Hôm nay cùng Mầm')).toBeInTheDocument(),
    )
    expect(
      screen.queryByRole('button', { name: 'Chọn điều bạn muốn nhẹ đi' }),
    ).toBeNull()
    first.unmount()

    resetCompanionStateForTests()
    serve({ focus: { goal: 'SLEEP', chosenOn: localToday() } })
    card(
      home({
        journey: { ...home().journey, nextAction: 'REVIEW_SAFETY_SUPPORT' },
      }),
    )
    expect(await screen.findByText('Hỗ trợ ngay')).toBeInTheDocument()
    expect(screen.queryByText(/Mục tiêu 14 ngày/)).toBeNull()
  })
})
