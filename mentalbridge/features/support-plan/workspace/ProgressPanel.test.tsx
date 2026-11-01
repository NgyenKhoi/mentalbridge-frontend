import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  ActionOccurrence,
  SupportPlanV3,
} from '../api/support-plan-contract'
import {
  emotionCompletionFixture,
  emotionOccurrenceFixture,
  nativeSupportPlanFixture,
} from '../testing/native-support-plan-fixture'
import ProgressPanel from './ProgressPanel'
import { occurrenceWindow, summarizeProgress } from './workspace-model'

const today = '2026-10-13'

// A cycle stretched by paused days: it starts before the loaded window.
function plan(): SupportPlanV3 {
  return {
    ...nativeSupportPlanFixture(),
    cycle: {
      policyVersion: 'support-plan-cycle-v1',
      lengthDays: 14,
      timezone: 'Asia/Ho_Chi_Minh',
      cycleNumber: 2,
      startedOn: '2026-09-18',
      reviewDueOn: '2026-10-22',
      currentDay: 26,
      pausedDays: 7,
      state: 'IN_PROGRESS',
    },
  }
}

const occurrence = (changes: Partial<ActionOccurrence>): ActionOccurrence =>
  ({ ...emotionOccurrenceFixture(), ...changes }) as ActionOccurrence

const occurrences = [
  occurrence({
    occurrenceId: 'done-today',
    localDate: today,
    scheduledAt: '2026-10-13T00:30:00Z',
    state: 'COMPLETED',
    displayState: 'COMPLETED',
    outcomeRecordedAt: '2026-10-13T00:42:00Z',
    completionEvidence: emotionCompletionFixture(),
  }),
  occurrence({
    occurrenceId: 'later-today',
    localDate: today,
    scheduledAt: '2026-10-13T14:00:00Z',
  }),
  occurrence({
    occurrenceId: 'skipped-yesterday',
    localDate: '2026-10-12',
    scheduledAt: '2026-10-12T01:00:00Z',
    state: 'SKIPPED',
    displayState: 'SKIPPED',
    barrierCode: 'NOT_ENOUGH_TIME',
  }),
  occurrence({
    occurrenceId: 'open-before',
    localDate: '2026-10-11',
    scheduledAt: '2026-10-11T01:00:00Z',
  }),
]

function panel(
  overrides: Partial<Parameters<typeof ProgressPanel>[0]> = {},
  rows = occurrences,
) {
  const current = plan()
  return (
    <ProgressPanel
      plan={current}
      occurrences={rows}
      today={today}
      timezone="Asia/Ho_Chi_Minh"
      summary={summarizeProgress(
        current,
        rows,
        occurrenceWindow(current, today),
        today,
      )}
      loadError={false}
      onRetry={vi.fn()}
      {...overrides}
    />
  )
}

describe('ProgressPanel', () => {
  beforeEach(() => {
    // Only the clock: 13/10 at 10:00 in the plan timezone.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-13T03:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('selects today and lists its rows with plain states', async () => {
    render(panel())
    const today = screen.getByRole('button', { pressed: true })
    expect(today).toHaveAttribute(
      'aria-label',
      expect.stringContaining('hôm nay'),
    )
    expect(today).toHaveAccessibleName(/1 xong, 1 chưa tới giờ/)
    expect(
      await screen.findByRole('heading', { name: /Hôm nay · / }),
    ).toBeVisible()
    expect(screen.getByText('Xong lúc 07:42')).toBeVisible()
    expect(screen.getByText('Chưa tới giờ')).toBeVisible()
  })

  it('shows another day on selection: put aside with its reason, and open as not done', async () => {
    const user = userEvent.setup()
    render(panel())
    await user.click(
      screen.getByRole('button', { name: /Thứ Hai, 12\/10: 1 để hôm khác/ }),
    )
    expect(
      await screen.findByText('Để hôm khác · Không đủ thời gian'),
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: /Chủ Nhật, 11\/10: 1 chưa làm/ }),
    )
    expect(
      await screen.findByText('Chưa làm', { selector: '.mbw-hist-state' }),
    ).toBeInTheDocument()
  })

  it('says "Chưa có dữ liệu" for days outside the loaded window, never "Chưa làm"', async () => {
    const user = userEvent.setup()
    render(panel())
    const first = screen.getByRole('button', {
      name: /18\/9: Chưa có dữ liệu/,
    })
    await user.click(first)
    expect(
      await screen.findByText('Chưa có dữ liệu cho ngày này.'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Chưa làm', { selector: '.mbw-hist-state' }),
    ).toBeNull()
  })

  it('says a covered past day without work had none', async () => {
    const user = userEvent.setup()
    render(panel())
    await user.click(
      screen.getByRole('button', { name: /Thứ Bảy, 10\/10: Không có việc/ }),
    )
    expect(
      await screen.findByText('Không có việc nào trong ngày này.'),
    ).toBeInTheDocument()
  })

  it('states the period with honest counts and the quiet comparison link', () => {
    render(panel())
    const counts = screen
      .getByRole('heading', { name: 'Những gì bạn đã làm' })
      .closest('section')!
    expect(within(counts).getByText('20/9 – hôm nay')).toBeVisible()
    const value = (label: string) =>
      within(
        within(counts).getByText(label).closest<HTMLElement>('.mbw-count')!,
      ).getByText(/\d/)
    expect(value('Đã làm')).toHaveTextContent('1 việc')
    expect(value('Để hôm khác')).toHaveTextContent('1 việc')
    expect(value('Chưa làm')).toHaveTextContent('1 việc')
    expect(value('Ngày ghi cảm xúc')).toHaveTextContent('1 ngày')
    expect(
      within(counts).getByRole('link', { name: 'So sánh các lần kiểm tra' }),
    ).toHaveAttribute('href', '/assessments')
  })

  it('keeps older counts visible with a retry when a refresh fails', async () => {
    const onRetry = vi.fn()
    render(panel({ loadError: true, onRetry }))
    expect(screen.getByRole('alert')).toHaveTextContent('Chưa cập nhật được')
    expect(screen.getByText('Ngày ghi cảm xúc')).toBeVisible()
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('shows only a failed region before anything was read, and loading without a verdict', () => {
    const { rerender } = render(panel({ summary: undefined, loadError: true }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Chưa tải được phần này.',
    )
    expect(screen.queryByText('Đã làm')).toBeNull()
    rerender(panel({ summary: undefined }))
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải…')
    expect(screen.queryByText('Đã làm')).toBeNull()
  })

  it('shows the last week as history without a running cycle, plus the counts', () => {
    const current = { ...plan(), cycle: null }
    render(
      panel({
        plan: current,
        summary: summarizeProgress(
          current,
          occurrences,
          occurrenceWindow(current, today),
          today,
        ),
      }),
    )
    expect(
      screen.getByRole('heading', { name: '7 ngày gần đây' }),
    ).toBeVisible()
    expect(
      within(screen.getByRole('group', { name: /Chọn một ngày/ })).getAllByRole(
        'button',
      ).length,
    ).toBeLessThanOrEqual(7)
    expect(screen.getByText('Ngày ghi cảm xúc')).toBeVisible()
  })
})
