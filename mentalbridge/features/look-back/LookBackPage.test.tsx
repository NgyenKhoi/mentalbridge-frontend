import { fireEvent, render, screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ getLookBack: vi.fn() }))
vi.mock('./browser-look-back', () => api)
// The signed-in account comes from the dashboard layout's slot; only the question tests sign in.
const slot = vi.hoisted(() => ({ accountId: null as string | null }))
vi.mock('@/features/mam/MamDockSlot', () => ({
  useMamAccountId: () => slot.accountId,
  slottedMamAccountId: () => slot.accountId,
}))
vi.mock('@/features/resources/api/browser-resources', () => ({
  getResourceCatalogue: vi
    .fn()
    .mockResolvedValue({ items: [], hasMore: false }),
}))

import type { ReassessmentSummary } from '@/features/assessment/api/care-contract'
import { makeSummary } from '@/tests/fixtures/reassessment-review'
import {
  asOf,
  harder,
  makeProgress,
  improving,
  makeDashboard,
  sparse,
} from '@/tests/fixtures/look-back'
import { resetCompanionStateForTests } from '@/features/mam/companion-state'
import { isMamFeatureSuppressed } from '@/features/mam/mam-suppression'
import {
  localDate,
  shiftDate,
} from '@/features/resources/model/resource-experience'
import type { CompanionState } from '@/lib/companion-state/contract'
import { mockServer } from '@/tests/mocks/server'
import { buildJourney } from './look-back-chapters'
import { composeLookBack, type LookBack } from './look-back-model'
import { narrativeCopy } from './look-back-copy'
import { LookBackPage } from './LookBackPage'

const steady = (patch: Partial<LookBack> = {}): LookBack => ({
  ...composeLookBack({
    dashboard: makeDashboard(Array(14).fill(3)),
    conversations: null,
    progress: [],
    degraded: false,
  }),
  ...patch,
})

const summary = (id: string, start: string, end: string) =>
  makeSummary({
    summaryId: id,
    composedAt: `${end}T09:00:00+07:00`,
    currentPeriod: {
      startAt: `${start}T00:00:00+07:00`,
      endAt: `${end}T00:00:00+07:00`,
    },
    previousPeriod: {
      startAt: '2026-01-01T00:00:00+07:00',
      endAt: `${start}T00:00:00+07:00`,
    },
  }) as unknown as ReassessmentSummary
const cycle = (patch: Record<string, unknown> = {}) =>
  ({
    policyVersion: 'support-plan-cycle-v1',
    lengthDays: 14,
    timezone: 'Asia/Ho_Chi_Minh',
    cycleNumber: 3,
    startedOn: '2026-11-17',
    reviewDueOn: '2026-11-30',
    currentDay: 6,
    pausedDays: 0,
    state: 'IN_PROGRESS',
    ...patch,
  }) as never
const withJourney = (
  summaries: ReassessmentSummary[],
  plan: ReturnType<typeof cycle> | null = null,
) =>
  steady({
    journey: buildJourney({
      summaries,
      dashboard: makeDashboard(Array(14).fill(4)),
      cycle: plan,
      timeZone: 'Asia/Ho_Chi_Minh',
    }),
  })
const twoChapters = () => [
  summary('s1', '2026-10-10', '2026-10-24'),
  summary('s2', '2026-10-25', '2026-11-08'),
]

// The primary action is the first link; a quiet second one may follow.
const nextLink = () =>
  within(screen.getByRole('region', { name: 'Bước tiếp theo' })).getAllByRole(
    'link',
  )[0]

// Five check-ins at "tốt" on plan days, nine at "không tốt" on the others.
const helped = () =>
  steady({
    ...composeLookBack({
      dashboard: makeDashboard([4, 4, 4, 4, 4, 2, 2, 2, 2, 2, 2, 2, 2, 2], {
        0: { supportCompleted: 1 },
        1: { supportCompleted: 1 },
        2: { supportCompleted: 1 },
        3: { supportCompleted: 1 },
        4: { supportCompleted: 1 },
      }),
      conversations: null,
      progress: [],
      degraded: false,
    }),
  })

describe('LookBackPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows the title and a live status while loading', () => {
    api.getLookBack.mockReturnValue(new Promise(() => undefined))
    render(<LookBackPage />)
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Nhìn lại hành trình',
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải')
  })

  it('asks for the browser timezone', async () => {
    api.getLookBack.mockResolvedValue(improving())
    render(<LookBackPage />)
    await screen.findByText(narrativeCopy.IMPROVING)
    expect(api.getLookBack).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(AbortSignal),
    )
  })

  it('IMPROVING: reads in order and offers the plan as the one next step', async () => {
    api.getLookBack.mockResolvedValue(improving())
    render(<LookBackPage />)
    expect(await screen.findByText(narrativeCopy.IMPROVING)).toBeVisible()

    expect(
      screen.getByRole('heading', { name: /Bản đồ hành trình cảm xúc/ }),
    ).toBeVisible()
    expect(
      screen.getByLabelText('Mức cảm xúc trung bình hai tuần'),
    ).toHaveTextContent('/5')
    expect(
      screen.getByRole('heading', { name: 'Bạn đã trò chuyện với Mầm về' }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Kết quả tự đánh giá' }),
    ).toBeVisible()
    expect(screen.getByText('Ngủ ngon hơn')).toBeVisible()
    expect(screen.getByText('Mức trung bình → Mức nhẹ')).toBeVisible()
    expect(nextLink()).toHaveTextContent('Tiếp tục kế hoạch hôm nay')
    expect(nextLink()).toHaveAttribute('href', '/support-plan')
    expect(screen.queryByText(/Tìm chuyên gia/)).toBeNull()
    expect(screen.queryByText(/chưa tải được/)).toBeNull()
  })

  it('keeps raw scores behind details and says once it is not a diagnosis', async () => {
    api.getLookBack.mockResolvedValue(improving())
    render(<LookBackPage />)
    await screen.findByText(narrativeCopy.IMPROVING)
    const details = screen.getByText('Xem chi tiết điểm').closest('details')
    expect(details).not.toHaveAttribute('open')
    expect(details).toHaveTextContent('Trầm cảm (PHQ-9): 12 → 7 điểm')
    expect(screen.getAllByText(/không phải chẩn đoán/)).toHaveLength(1)
  })

  it('HARDER with a moderate band: gentle copy, professional pointer, support as next step, still result', async () => {
    api.getLookBack.mockResolvedValue(harder())
    render(<LookBackPage />)
    expect(await screen.findByText(narrativeCopy.HARDER)).toBeVisible()
    expect(screen.getByText('Mức nhẹ → Mức trung bình')).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Tìm chuyên gia' }),
    ).toHaveAttribute('href', '/specialists')
    expect(nextLink()).toHaveTextContent('Xem hướng hỗ trợ')
    expect(nextLink()).toHaveAttribute('href', '/support-guides')
    expect(
      screen
        .getByRole('heading', { name: 'Kết quả tự đánh giá' })
        .closest('section'),
    ).toHaveAttribute('data-page-motion', 'off')
    expect(screen.queryByText(/chúc mừng|tuyệt vời|thành tích/i)).toBeNull()
  })

  it('shows what seems to help, as an association, in its own section before the stats', async () => {
    api.getLookBack.mockResolvedValue(helped())
    render(<LookBackPage />)
    const section = (
      await screen.findByRole('heading', { name: 'Chặng này của bạn' })
    ).closest('section')!
    expect(
      within(section).getByRole('heading', { name: 'Điều có vẻ giúp bạn' }),
    ).toBeVisible()
    expect(section).toHaveTextContent(
      '5 ngày bạn làm ít nhất một việc trong kế hoạch, cảm xúc bạn ghi thường ở mức tốt. 9 ngày không làm: không tốt.',
    )
    expect(
      screen.getByText(
        'Số liệu do bạn tự ghi lại; xu hướng và điều cùng xuất hiện không phải chẩn đoán hay nguyên nhân.',
      ),
    ).toBeVisible()
    expect(screen.queryByText(/nhờ|vì|do việc/i)).toBeNull()
  })

  it('hides the whole section when there is nothing to say yet', async () => {
    api.getLookBack.mockResolvedValue(improving())
    render(<LookBackPage />)
    await screen.findByText(narrativeCopy.IMPROVING)
    expect(
      screen.queryByRole('heading', { name: 'Chặng này của bạn' }),
    ).toBeNull()
    expect(screen.queryByText('Điều có vẻ giúp bạn')).toBeNull()
  })

  it('SPARSE: no chart, no sections, just the copy and the check-in step', async () => {
    api.getLookBack.mockResolvedValue(sparse())
    render(<LookBackPage />)
    expect(await screen.findByText(narrativeCopy.SPARSE)).toBeVisible()
    expect(
      screen.queryByRole('heading', { name: /Bản đồ hành trình cảm xúc/ }),
    ).toBeNull()
    expect(screen.queryByRole('img')).toBeNull()
    expect(nextLink()).toHaveTextContent('Ghi cảm xúc hôm nay')
    expect(nextLink()).toHaveAttribute('href', '/dashboard')
  })

  it('hides the conversation section when the list is unavailable, without an error', async () => {
    api.getLookBack.mockResolvedValue(steady())
    render(<LookBackPage />)
    await screen.findByText(narrativeCopy.STEADY)
    expect(screen.queryByText('Bạn đã trò chuyện với Mầm về')).toBeNull()
    expect(
      screen.getByRole('heading', { name: /Bản đồ hành trình cảm xúc/ }),
    ).toBeVisible()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows one partial note and a dash instead of invented zeros', async () => {
    const base = steady()
    api.getLookBack.mockResolvedValue(
      steady({
        partial: true,
        weeks: [
          { ...base.weeks[0], journalDays: null },
          { ...base.weeks[1], journalDays: null },
        ],
      }),
    )
    render(<LookBackPage />)
    expect(
      await screen.findAllByText('Một phần dữ liệu chưa tải được.'),
    ).toHaveLength(1)
    const row = screen.getByText('Ngày viết nhật ký').closest('div')
    expect(row).toHaveTextContent('–')
    expect(row).not.toHaveTextContent('0')
  })

  it('folds conversations beyond two behind "Xem thêm"', async () => {
    const items = Array.from({ length: 8 }, (_, index) => ({
      id: `c${index}`,
      title: index === 7 ? null : `Chủ đề ${index}`,
      localDate: asOf,
    }))
    api.getLookBack.mockResolvedValue(steady({ conversations: items }))
    render(<LookBackPage />)
    const summary = await screen.findByText('Xem thêm 6 cuộc trò chuyện')
    expect(summary.closest('details')).not.toHaveAttribute('open')
    expect(screen.getByText('Một cuộc trò chuyện')).toBeInTheDocument()
  })

  it('filters the map and shows only factual daily details', async () => {
    api.getLookBack.mockResolvedValue(improving())
    render(<LookBackPage />)
    await screen.findByText(narrativeCopy.IMPROVING)
    const firstWeek = screen.getByRole('button', { name: /Tuần 1 \(/ })
    fireEvent.click(firstWeek)
    expect(firstWeek).toHaveAttribute('aria-pressed', 'true')
    // Week 2 stays on the road, dimmed but still reachable by keyboard and screen reader.
    expect(screen.getAllByRole('button', { name: /^Ngày \d+,/ })).toHaveLength(
      14,
    )
    expect(document.querySelectorAll('button[data-dim]')).toHaveLength(7)
    expect(screen.getByText(/^Tập trung Tuần 1/)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: /Ngày 1,/ }))
    const card = screen.getByLabelText('Chi tiết ngày 1')
    expect(card).toHaveTextContent(/Ngày 1 •/)
    expect(card).toHaveTextContent(/\(\d\/5\)|Chưa ghi cảm xúc/)
    expect(card).toHaveTextContent('hoạt động đã làm')
    expect(card).toHaveTextContent(/nhật ký/i)
    expect(card).toHaveTextContent(/lần ghi|chưa ghi cảm xúc/i)
    // Escape closes the card without a pointer.
    fireEvent.keyDown(card, { key: 'Escape' })
    expect(screen.queryByLabelText('Chi tiết ngày 1')).toBeNull()
  })

  it('shows a completed specialist session only when supplied by the consultation source', async () => {
    api.getLookBack.mockResolvedValue(
      steady({ completedSessions: 2, appointments: 7 }),
    )
    render(<LookBackPage />)
    await screen.findByText(narrativeCopy.STEADY)
    const specialist = screen.getByText('Hỗ trợ chuyên gia').closest('div')
    expect(specialist).toHaveTextContent('2')
    expect(specialist).toHaveTextContent('buổi tư vấn đã diễn ra')
    expect(specialist).not.toHaveTextContent('7')
  })

  it('SPARSE with a moderate band still shows the result and the professional pointer', async () => {
    api.getLookBack.mockResolvedValue(
      composeLookBack({
        dashboard: makeDashboard([3, null, null, 3]),
        conversations: null,
        progress: [
          makeProgress(
            'PHQ9',
            ['2026-11-10T09:00:00+07:00', 'MILD', 7],
            ['2026-11-21T09:00:00+07:00', 'MODERATE', 11],
          ),
        ],
        degraded: false,
      }),
    )
    render(<LookBackPage />)
    expect(await screen.findByText(narrativeCopy.SPARSE)).toBeVisible()
    expect(screen.getByText('Mức nhẹ → Mức trung bình')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Tìm chuyên gia' })).toBeVisible()
    expect(screen.queryByRole('img')).toBeNull()
    expect(nextLink()).toHaveTextContent('Xem hướng hỗ trợ')
  })

  it('unreadable mood: no Mầm sentence about too few records, one neutral note, other sections stay', async () => {
    const dashboard = makeDashboard(Array(14).fill(3))
    api.getLookBack.mockResolvedValue(
      composeLookBack({
        dashboard: {
          ...dashboard,
          sources: { ...dashboard.sources, emotions: 'unavailable' },
        },
        conversations: null,
        progress: [],
        degraded: false,
      }),
    )
    render(<LookBackPage />)
    expect(
      await screen.findByText('Một phần dữ liệu chưa tải được.'),
    ).toBeVisible()
    expect(screen.queryByText(/chưa có đủ ghi nhận/)).toBeNull()
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByText('Ngày viết nhật ký')).toBeVisible()
    expect(nextLink()).toHaveTextContent('Tiếp tục kế hoạch hôm nay')
  })

  it('keeps Mầm quiet (no celebration, queued award or welcome) while loading and beside hard news, not otherwise', async () => {
    api.getLookBack.mockResolvedValue(harder())
    const hard = render(<LookBackPage />)
    expect(isMamFeatureSuppressed()).toBe(true)
    await screen.findByText(narrativeCopy.HARDER)
    expect(isMamFeatureSuppressed()).toBe(true)
    hard.unmount()
    expect(isMamFeatureSuppressed()).toBe(false)

    api.getLookBack.mockResolvedValue(improving())
    render(<LookBackPage />)
    expect(isMamFeatureSuppressed()).toBe(true)
    await screen.findByText(narrativeCopy.IMPROVING)
    expect(isMamFeatureSuppressed()).toBe(false)
  })

  it('moves focus to the title after retrying, and marks the page busy while loading', async () => {
    api.getLookBack.mockRejectedValueOnce(new Error('down'))
    api.getLookBack.mockReturnValueOnce(new Promise(() => undefined))
    const { container } = render(<LookBackPage />)
    expect(container.firstElementChild).toHaveAttribute('aria-busy', 'true')
    fireEvent.click(await screen.findByRole('button', { name: 'Thử lại' }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus()
    expect(container.firstElementChild).toHaveAttribute('aria-busy', 'true')
  })

  it('error: says what happened and retries', async () => {
    api.getLookBack.mockRejectedValueOnce(new Error('down'))
    api.getLookBack.mockResolvedValueOnce(improving())
    render(<LookBackPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('thử lại')
    expect(screen.queryByText(/ApiError|CARE_|500/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByText(narrativeCopy.IMPROVING)).toBeVisible()
    expect(api.getLookBack).toHaveBeenCalledTimes(2)
  })

  describe('chapters', () => {
    // Both end inside the test dashboard (24/10 to 22/11), so each can be looked at on its own.
    const pickable = () => [
      summary('s1', '2026-10-25', '2026-11-01'),
      summary('s2', '2026-11-01', '2026-11-15'),
    ]
    // What the BFF returns for one chặng: its own days and its own summary screening.
    const chapterView = (base: LookBack, id: string) => {
      const chapter = base.journey!.chapters.find(
        (item) => item.summaryId === id,
      )!
      return composeLookBack({
        dashboard: makeDashboard(Array(14).fill(3)),
        conversations: null,
        progress: [],
        degraded: false,
        journey: base.journey,
        fromLocalDate: chapter.startLocalDate,
        toLocalDate: chapter.endLocalDate,
        chapterScreening: chapter.screening,
      })
    }
    const serve = (base: LookBack) =>
      api.getLookBack.mockImplementation(
        (_tz: string, _signal: AbortSignal, window?: { from: string }) =>
          Promise.resolve(
            window
              ? chapterView(
                  base,
                  base.journey!.chapters.find(
                    (item) => item.startLocalDate === window.from,
                  )!.summaryId,
                )
              : base,
          ),
      )
    const tabs = () => within(screen.getByRole('tablist')).getAllByRole('tab')
    const selected = () =>
      tabs()
        .filter((tab) => tab.getAttribute('aria-selected') === 'true')
        .map((tab) => tab.textContent)

    it('offers one tab per chặng, oldest first, with the running one selected and last', async () => {
      api.getLookBack.mockResolvedValue(withJourney(pickable(), cycle()))
      render(<LookBackPage />)
      await screen.findByRole('heading', { name: /Bản đồ hành trình cảm xúc/ })
      expect(tabs().map((tab) => tab.textContent)).toEqual([
        'Chặng 125/10 – 31/10',
        'Chặng 201/11 – 14/11',
        'Chặng 3đang diễn ra',
      ])
      expect(selected()).toEqual(['Chặng 3đang diễn ra'])
      expect(screen.getByRole('tablist')).toHaveAccessibleName('Chọn chặng')
      expect(screen.getByRole('tabpanel')).toHaveAttribute(
        'aria-labelledby',
        tabs()[2].id,
      )
      expect(
        screen.getByRole('heading', { name: 'Chặng 3 · ngày 6/14' }),
      ).toBeVisible()
    })

    it('with no running chặng selects the newest closed one and shows its road', async () => {
      api.getLookBack.mockResolvedValue(withJourney(pickable()))
      render(<LookBackPage />)
      await screen.findByRole('heading', { name: /Bản đồ hành trình cảm xúc/ })
      expect(tabs()).toHaveLength(2)
      expect(selected()).toEqual(['Chặng 201/11 – 14/11'])
      expect(screen.getByRole('heading', { name: 'Chặng 2' })).toBeVisible()
    })

    it('has no selector without chặng and keeps the rolling 14 days', async () => {
      api.getLookBack.mockResolvedValue(withJourney([]))
      render(<LookBackPage />)
      expect(
        await screen.findByRole('heading', { name: '14 ngày gần đây' }),
      ).toBeVisible()
      expect(screen.queryByRole('tablist')).toBeNull()
      expect(screen.queryByRole('tabpanel')).toBeNull()
      expect(
        screen.queryByRole('heading', { name: 'Hành trình của bạn' }),
      ).toBeNull()
      expect(
        screen.getByRole('heading', { name: /Bản đồ hành trình cảm xúc/ }),
      ).toBeVisible()
    })

    it('gives a chặng older than the 90 days no tab but keeps it in the journey strip', async () => {
      api.getLookBack.mockResolvedValue(
        withJourney([summary('old', '2026-07-01', '2026-07-15')]),
      )
      render(<LookBackPage />)
      expect(
        await screen.findByRole('heading', { name: 'Hành trình của bạn' }),
      ).toBeVisible()
      expect(screen.queryByRole('tablist')).toBeNull()
      expect(
        screen.getByRole('heading', { name: '14 ngày gần đây' }),
      ).toBeVisible()
    })

    it('refetches by the chặng dates, keeps the previous chặng dimmed while it waits and keeps the selector', async () => {
      const base = withJourney(pickable(), cycle())
      let finish: (view: LookBack) => void = () => undefined
      api.getLookBack.mockImplementation(
        (_tz: string, _signal: AbortSignal, window?: unknown) =>
          window
            ? new Promise<LookBack>((resolve) => (finish = resolve))
            : Promise.resolve(base),
      )
      const { container } = render(<LookBackPage />)
      await screen.findByRole('heading', { name: /Bản đồ hành trình cảm xúc/ })
      expect(api.getLookBack).toHaveBeenCalledTimes(1)

      fireEvent.click(tabs()[0])
      expect(api.getLookBack).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.any(AbortSignal),
        { from: '2026-10-25', to: '2026-10-31' },
      )
      expect(container.firstElementChild).toHaveAttribute('aria-busy', 'true')
      expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-busy', 'true')
      // No collapse to a skeleton: the running chặng stays on screen, dimmed, until the pick arrives.
      expect(screen.queryByText('Đang tải phần nhìn lại…')).toBeNull()
      expect(
        screen.getByRole('heading', { name: 'Chặng 3 · ngày 6/14' }),
      ).toBeVisible()
      expect(screen.getByRole('tabpanel').className).toMatch(/panelStale/)
      expect(screen.getByText('Đang tải chặng 1…')).toBeInTheDocument()
      expect(selected()).toEqual(['Chặng 125/10 – 31/10'])

      finish(chapterView(base, 's1'))
      expect(
        await screen.findByRole('heading', { name: 'Chặng 1' }),
      ).toBeVisible()
      expect(screen.getByText(/đã khép lại$/)).toBeVisible()
      expect(await screen.findByText('Đã mở chặng 1')).toBeInTheDocument()
      expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-busy', 'false')
      expect(screen.getByRole('tabpanel').className).not.toMatch(/panelStale/)
      expect(container.firstElementChild).toHaveAttribute('aria-busy', 'false')
      // The journey strip is the first load's: it never refetches per tab.
      expect(
        screen.getByRole('heading', { name: 'Hành trình của bạn' }),
      ).toBeVisible()

      // The default chặng is already loaded.
      fireEvent.click(tabs()[2])
      expect(
        await screen.findByRole('heading', { name: 'Chặng 3 · ngày 6/14' }),
      ).toBeVisible()
      expect(api.getLookBack).toHaveBeenCalledTimes(2)
    })

    it('ignores a response whose request was aborted by a newer pick', async () => {
      const base = withJourney(pickable(), cycle())
      const finish: Record<string, (view: LookBack) => void> = {}
      api.getLookBack.mockImplementation(
        (_tz: string, _signal: AbortSignal, window?: { from: string }) =>
          window
            ? new Promise<LookBack>(
                (resolve) => (finish[window.from] = resolve),
              )
            : Promise.resolve(base),
      )
      render(<LookBackPage />)
      await screen.findByRole('heading', { name: /Bản đồ hành trình cảm xúc/ })
      fireEvent.click(tabs()[0])
      fireEvent.click(tabs()[1])
      finish['2026-10-25'](chapterView(base, 's1'))
      await Promise.resolve()
      // The first request was aborted: its answer must not replace the content of the chặng picked since.
      expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-busy', 'true')
      expect(screen.queryByRole('heading', { name: 'Chặng 1' })).toBeNull()
      finish['2026-11-01'](chapterView(base, 's2'))
      expect(
        await screen.findByRole('heading', { name: 'Chặng 2' }),
      ).toBeVisible()
    })

    it('hides the selector when only one chặng can be picked, the strip still lists it', async () => {
      api.getLookBack.mockResolvedValue(
        withJourney([summary('s1', '2026-10-25', '2026-11-01')]),
      )
      render(<LookBackPage />)
      expect(
        await screen.findByRole('heading', { name: 'Chặng 1' }),
      ).toBeVisible()
      expect(screen.queryByRole('tablist')).toBeNull()
      expect(screen.queryByRole('tabpanel')).toBeNull()
      expect(
        screen.getByRole('heading', { name: 'Hành trình của bạn' }),
      ).toBeVisible()
    })

    it('offers the explanation link only where the review choice shows', async () => {
      api.getLookBack.mockResolvedValue(improving())
      const { unmount } = render(<LookBackPage />)
      await screen.findByText(narrativeCopy.IMPROVING)
      expect(screen.queryByText('Nhờ Mầm giải thích các lựa chọn')).toBeNull()
      unmount()
      api.getLookBack.mockResolvedValue(
        withJourney(pickable(), cycle({ state: 'REVIEW_DUE', currentDay: 14 })),
      )
      render(<LookBackPage />)
      await screen.findByRole('heading', { name: /Chặng 3/ })
      expect(nextLink()).toHaveAttribute(
        'href',
        '/initial-check?purpose=reassessment',
      )
      expect(screen.queryByText('Nhờ Mầm giải thích các lựa chọn')).toBeNull()
    })

    it('puts the pending next step only on the chặng it concerns', async () => {
      // A closed cycle waits for the choice: only the newest closed chặng shows it.
      const closedBase = withJourney(
        pickable(),
        cycle({ startedOn: '2026-11-01', state: 'REVIEW_DUE', currentDay: 14 }),
      )
      serve(closedBase)
      const { unmount } = render(<LookBackPage />)
      await screen.findByRole('heading', { name: 'Chặng 2 đã khép lại' })
      expect(nextLink()).toHaveAttribute('href', '/support-plan?review=open')
      fireEvent.click(tabs()[0])
      await screen.findByRole('heading', { name: 'Chặng 1' })
      expect(nextLink()).not.toHaveAttribute(
        'href',
        '/support-plan?review=open',
      )
      unmount()

      // A running chặng that is due: only the running tab shows the reassessment.
      const dueBase = withJourney(
        pickable(),
        cycle({ state: 'REVIEW_DUE', currentDay: 14 }),
      )
      serve(dueBase)
      render(<LookBackPage />)
      await screen.findByRole('heading', { name: 'Chặng 3 · ngày 14/14' })
      expect(nextLink()).toHaveAttribute(
        'href',
        '/initial-check?purpose=reassessment',
      )
      fireEvent.click(tabs()[0])
      await screen.findByRole('heading', { name: 'Chặng 1' })
      expect(nextLink()).not.toHaveAttribute(
        'href',
        '/initial-check?purpose=reassessment',
      )
      expect(
        screen.queryByRole('link', { name: /Làm bài đánh giá lại để khép/ }),
      ).toBeNull()
    })

    it("shows a closed chặng's own screening, previous to current", async () => {
      const base = withJourney(pickable(), cycle())
      serve(base)
      render(<LookBackPage />)
      await screen.findByRole('heading', { name: /Bản đồ hành trình cảm xúc/ })
      fireEvent.click(tabs()[0])
      const card = (
        await screen.findByRole('heading', { name: 'Kết quả tự đánh giá' })
      ).closest('section')!
      expect(card).toHaveTextContent('Mức trung bình → Mức nhẹ')
      expect(card).toHaveTextContent('14 → 8 điểm')
    })

    it('moves focus with the arrow keys without fetching, and picks on Enter', async () => {
      const base = withJourney(pickable(), cycle())
      serve(base)
      render(<LookBackPage />)
      await screen.findByRole('heading', { name: /Bản đồ hành trình cảm xúc/ })
      const [first, second, third] = tabs()
      expect(third).toHaveAttribute('tabindex', '0')
      expect(first).toHaveAttribute('tabindex', '-1')
      third.focus()
      fireEvent.keyDown(third, { key: 'ArrowLeft' })
      expect(second).toHaveFocus()
      fireEvent.keyDown(second, { key: 'Home' })
      expect(first).toHaveFocus()
      fireEvent.keyDown(first, { key: 'End' })
      expect(third).toHaveFocus()
      fireEvent.keyDown(third, { key: 'ArrowRight' })
      expect(first).toHaveFocus()
      expect(api.getLookBack).toHaveBeenCalledTimes(1)
    })

    it('says the chặng could not load and retries just that chặng', async () => {
      const base = withJourney(pickable(), cycle())
      api.getLookBack.mockImplementation(
        (_tz: string, _signal: AbortSignal, window?: unknown) =>
          window ? Promise.reject(new Error('down')) : Promise.resolve(base),
      )
      render(<LookBackPage />)
      await screen.findByRole('heading', { name: /Bản đồ hành trình cảm xúc/ })
      fireEvent.click(tabs()[0])
      expect(await screen.findByRole('alert')).toHaveTextContent('thử lại')
      expect(screen.getAllByRole('tab')).toHaveLength(3)
      api.getLookBack.mockResolvedValue(chapterView(base, 's1'))
      fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
      expect(
        await screen.findByRole('heading', { name: 'Chặng 1' }),
      ).toBeVisible()
    })

    it('strip starts at the beginning, ends with the running chapter and gives it no band', async () => {
      api.getLookBack.mockResolvedValue(withJourney(twoChapters(), cycle()))
      render(<LookBackPage />)
      const strip = (
        await screen.findByRole('heading', { name: 'Hành trình của bạn' })
      ).closest('section')!
      const columns = within(strip).getAllByRole('listitem')
      expect(columns.map((c) => c.firstElementChild?.textContent)).toEqual([
        'Lúc bắt đầu',
        'Chặng 1',
        'Chặng 2',
        'Chặng 3',
      ])
      expect(columns[3]).toHaveTextContent('Đang diễn ra')
      expect(columns[3]).toHaveTextContent('Chưa đánh giá lại')
      expect(columns[3]).not.toHaveTextContent(/Tâm trạng|Lo lắng/)
      expect(columns[1]).toHaveTextContent('Tâm trạng')
    })

    it('titles the running chapter by its day and offers the reassessment as header and next step when it is due', async () => {
      api.getLookBack.mockResolvedValue(
        withJourney(
          twoChapters(),
          cycle({ state: 'REVIEW_DUE', currentDay: 14 }),
        ),
      )
      render(<LookBackPage />)
      expect(
        await screen.findByRole('heading', { name: 'Chặng 3 · ngày 14/14' }),
      ).toBeVisible()
      expect(
        screen.getByRole('link', {
          name: /Làm bài đánh giá lại để khép chặng này/,
        }),
      ).toHaveAttribute('href', '/initial-check?purpose=reassessment')
      expect(nextLink()).toHaveTextContent('Làm bài đánh giá lại')
      expect(nextLink()).toHaveAttribute(
        'href',
        '/initial-check?purpose=reassessment',
      )
      expect(nextLink()).not.toHaveTextContent('Tiếp tục kế hoạch hôm nay')
    })

    it('a cycle closed by a reassessment keeps the road, adds a small banner and makes the choice the one next step', async () => {
      api.getLookBack.mockResolvedValue(
        withJourney(
          pickable(),
          cycle({
            startedOn: '2026-11-01',
            state: 'REVIEW_DUE',
            currentDay: 14,
          }),
        ),
      )
      render(<LookBackPage />)
      expect(
        await screen.findByRole('heading', { name: 'Chặng 2 đã khép lại' }),
      ).toBeVisible()
      // The MB-898 view stays: header, road and week tabs, next step.
      expect(screen.getByRole('heading', { name: 'Chặng 2' })).toBeVisible()
      expect(
        screen.getByRole('heading', { name: /Bản đồ hành trình cảm xúc/ }),
      ).toBeVisible()
      expect(
        screen.getByLabelText('Mức cảm xúc trung bình hai tuần'),
      ).toBeVisible()
      expect(selected()).toEqual(['Chặng 201/11 – 14/11'])
      // One call to action, in the next-step card.
      const choose = screen.getAllByRole('link', {
        name: /Chọn kế hoạch tiếp theo/,
      })
      expect(choose).toHaveLength(1)
      expect(choose[0]).toHaveAttribute('href', '/support-plan?review=open')
      expect(nextLink()).toBe(choose[0])
      // No second route: a reading of the options cannot exist before a plan draft does.
      expect(screen.queryByText(/Nhờ Mầm giải thích/)).toBeNull()
      expect(screen.queryByText('Tiếp tục kế hoạch hôm nay')).toBeNull()
      expect(screen.queryByText('Đang diễn ra')).toBeNull()
      expect(
        screen.queryByRole('heading', { name: '14 ngày gần đây' }),
      ).toBeNull()
    })

    it('draws only the days a running chapter has so far', async () => {
      api.getLookBack.mockResolvedValue(
        composeLookBack({
          dashboard: makeDashboard([...Array(7).fill(2), ...Array(7).fill(4)]),
          conversations: null,
          progress: [],
          degraded: false,
          fromLocalDate: '2026-11-13',
        }),
      )
      render(<LookBackPage />)
      await screen.findByRole('heading', { name: /Bản đồ hành trình cảm xúc/ })
      expect(
        screen.getAllByRole('button', { name: /^Ngày \d+,/ }),
      ).toHaveLength(10)
      expect(screen.getByRole('button', { name: /^Tuần 2 \(/ })).toBeVisible()
      expect(screen.getByText('Đang hiển thị toàn cảnh 10 ngày')).toBeVisible()
    })

    it('says the note about self-reported data once, however many chapters', async () => {
      api.getLookBack.mockResolvedValue(withJourney(twoChapters()))
      render(<LookBackPage />)
      await screen.findByRole('heading', { name: 'Hành trình của bạn' })
      expect(screen.getAllByText(/không phải chẩn đoán/)).toHaveLength(1)
    })

    it('keeps Mầm quiet when the chặng shown ends at a moderate band', async () => {
      const moderate = summary('s1', '2026-10-25', '2026-11-08')
      moderate.screening.trends[0].current.screeningLevel = 'MODERATE'
      const base = withJourney([moderate])
      // The first load is the newest closed chặng, composed with its own summary screening.
      api.getLookBack.mockResolvedValue({
        ...chapterView(base, 's1'),
        journey: base.journey,
      })
      render(<LookBackPage />)
      await screen.findByRole('heading', { name: 'Hành trình của bạn' })
      expect(isMamFeatureSuppressed()).toBe(true)
      expect(
        screen.getByRole('link', { name: 'Tìm chuyên gia' }),
      ).toHaveAttribute('href', '/specialists')
    })
  })

  describe('chapter questions', () => {
    const stamp = '2026-11-27T02:00:00.000Z'
    const commitmentId = '30000000-0000-4000-8000-000000000001'
    let server: CompanionState
    let patches: unknown[]
    let posts: unknown[]
    let limit: boolean
    let failPatch: boolean

    const setServer = (patch: Partial<CompanionState> = {}) => {
      server = {
        focus: null,
        chapters: [],
        commitments: [],
        ui: { guide: null, seen: [] },
        revision: 1,
        ...patch,
      }
    }
    const sleep = { goal: 'SLEEP', chosenOn: '2026-11-01' } as const

    beforeEach(() => {
      slot.accountId = 'acc-1'
      resetCompanionStateForTests()
      setServer()
      patches = []
      posts = []
      limit = false
      failPatch = false
      mockServer.use(
        http.get('/api/companion-state', () => HttpResponse.json(server)),
        http.patch('/api/companion-state', async ({ request }) => {
          if (failPatch)
            return HttpResponse.json({ code: 'X' }, { status: 500 })
          const body = (await request.json()) as {
            chapter: CompanionState['chapters'][number]
          }
          patches.push(body)
          const others = server.chapters.filter(
            (item) => item.startedOn !== body.chapter.startedOn,
          )
          const merged = {
            ...server.chapters.find(
              (item) => item.startedOn === body.chapter.startedOn,
            ),
            ...body.chapter,
            updatedAt: stamp,
          }
          server = {
            ...server,
            chapters: [...others, merged],
            revision: server.revision + 1,
          }
          return HttpResponse.json(server)
        }),
        http.post('/api/companion-state/commitments', async ({ request }) => {
          if (limit)
            return HttpResponse.json(
              {
                type: '/problems/commitment_limit',
                title: 'x',
                status: 409,
                code: 'COMMITMENT_LIMIT',
                correlationId: 'c',
              },
              { status: 409 },
            )
          const body = (await request.json()) as Record<string, unknown>
          posts.push(body)
          return HttpResponse.json(
            {
              id: commitmentId,
              ...body,
              status: 'OPEN',
              createdAt: stamp,
              resolvedAt: null,
            },
            { status: 201 },
          )
        }),
      )
    })
    afterEach(() => {
      slot.accountId = null
    })

    // Two weeks of mood 3; `extra` shapes the plan activity per day (index 0-13, week 1 first).
    const view = (
      extra: Parameters<typeof makeDashboard>[1] = {},
      plan: ReturnType<typeof cycle> | null = null,
      patch: Partial<LookBack> = {},
    ): LookBack => ({
      ...composeLookBack({
        dashboard: makeDashboard(Array(14).fill(3), extra),
        conversations: null,
        progress: [],
        degraded: false,
      }),
      journey: buildJourney({
        summaries: plan ? [] : twoChapters(),
        dashboard: makeDashboard(Array(14).fill(4)),
        cycle: plan,
        timeZone: 'Asia/Ho_Chi_Minh',
      }),
      ...patch,
    })
    const closed = (
      extra: Parameters<typeof makeDashboard>[1] = {},
      patch: Partial<LookBack> = {},
    ) => view(extra, null, patch)
    const startOf = (data: LookBack) =>
      data.journey!.chapters.at(-1)!.startLocalDate
    const slipping = { 0: { supportCompleted: 2 }, 9: { supportCompleted: 1 } }
    const radios = (name: string | RegExp) =>
      within(screen.getByRole('radiogroup', { name })).getAllByRole('radio')
    const heard = () => {
      const events: unknown[] = []
      const on = (event: Event) => {
        const { kind, value, moderatePlus } = (event as CustomEvent).detail
        events.push({ kind, value, moderatePlus })
      }
      window.addEventListener('mam:lookback-answer', on)
      return {
        events,
        stop: () => window.removeEventListener('mam:lookback-answer', on),
      }
    }

    it('with no focus asks only the connection question at the end of a closed chặng', async () => {
      api.getLookBack.mockResolvedValue(closed())
      render(<LookBackPage />)
      expect(
        await screen.findByRole('heading', { name: 'Kết nối' }),
      ).toBeVisible()
      expect(
        screen.getByRole('heading', { name: 'Chặng này của bạn' }),
      ).toBeVisible()
      expect(screen.queryByText('Mục tiêu chặng này')).toBeNull()
      expect(screen.queryByText(/nhẹ đi chưa/)).toBeNull()
      expect(screen.queryByText('Điều gì cản bạn?')).toBeNull()
    })

    it('shows the goal while the chặng runs, and the rating and connection only from day 12', async () => {
      setServer({ focus: sleep })
      api.getLookBack.mockResolvedValue(view({}, cycle({ currentDay: 11 })))
      const { unmount } = render(<LookBackPage />)
      expect(
        await screen.findByRole('heading', { name: 'Mục tiêu chặng này' }),
      ).toBeVisible()
      expect(screen.getByText('Giấc ngủ')).toBeVisible()
      expect(screen.queryByText(/nhẹ đi chưa/)).toBeNull()
      expect(screen.queryByRole('heading', { name: 'Kết nối' })).toBeNull()
      unmount()

      api.getLookBack.mockResolvedValue(view({}, cycle({ currentDay: 12 })))
      render(<LookBackPage />)
      expect(await screen.findByText(/nhẹ đi chưa/)).toBeVisible()
      expect(screen.getByRole('heading', { name: 'Kết nối' })).toBeVisible()
    })

    it('stays out of the rolling 14 days and without a signed-in account', async () => {
      setServer({ focus: sleep })
      api.getLookBack.mockResolvedValue(
        steady({
          journey: buildJourney({
            summaries: [],
            dashboard: makeDashboard(Array(14).fill(4)),
            cycle: null,
            timeZone: 'Asia/Ho_Chi_Minh',
          }),
        }),
      )
      const { unmount } = render(<LookBackPage />)
      await screen.findByRole('heading', { name: '14 ngày gần đây' })
      expect(
        screen.queryByRole('heading', { name: 'Chặng này của bạn' }),
      ).toBeNull()
      unmount()

      slot.accountId = null
      api.getLookBack.mockResolvedValue(closed())
      render(<LookBackPage />)
      await screen.findByRole('heading', { name: 'Chặng 2' })
      expect(screen.queryByRole('heading', { name: 'Kết nối' })).toBeNull()
    })

    it('saves the rating with the goal, answers in place, and lets the user change it', async () => {
      setServer({ focus: sleep })
      const base = closed()
      api.getLookBack.mockResolvedValue(base)
      const { stop, events } = heard()
      render(<LookBackPage />)
      await screen.findByText(/nhẹ đi chưa/)
      expect(radios(/nhẹ đi chưa/).map((item) => item.textContent)).toEqual([
        'Nhẹ hơn',
        'Như cũ',
        'Nặng hơn',
        'Chưa rõ',
      ])
      for (const radio of radios(/nhẹ đi chưa/))
        expect(radio).toHaveAttribute('aria-checked', 'false')

      fireEvent.click(screen.getByRole('radio', { name: 'Nhẹ hơn' }))
      expect(
        await screen.findByText(
          'Vui cùng bạn nè. Mình giữ những việc đã giúp nhé.',
        ),
      ).toBeVisible()
      expect(patches).toEqual([
        {
          chapter: {
            startedOn: startOf(base),
            goal: 'SLEEP',
            rating: 'LIGHTER',
          },
        },
      ])
      expect(events).toEqual([
        { kind: 'rating', value: 'LIGHTER', moderatePlus: false },
      ])
      // Answered: the answer and "Đổi" replace the chips, and focus stays on a control.
      expect(
        screen.queryByRole('radiogroup', { name: /nhẹ đi chưa/ }),
      ).toBeNull()
      const change = screen.getAllByRole('button', { name: 'Đổi' })[0]
      expect(change).toHaveFocus()
      expect(change).toHaveAccessibleDescription('Nhẹ hơn')
      expect(screen.queryByRole('link', { name: 'Tìm chuyên gia' })).toBeNull()

      fireEvent.click(change)
      expect(screen.getByRole('radio', { name: 'Nhẹ hơn' })).toHaveAttribute(
        'aria-checked',
        'true',
      )
      expect(screen.getByRole('radio', { name: 'Nhẹ hơn' })).toHaveFocus()
      fireEvent.click(screen.getByRole('radio', { name: 'Nặng hơn' }))
      expect(await screen.findByText(/Cảm ơn bạn đã nói thật/)).toBeVisible()
      expect(
        screen.getByRole('link', { name: 'Tìm chuyên gia' }),
      ).toHaveAttribute('href', '/specialists')
      expect(events.at(-1)).toEqual({
        kind: 'rating',
        value: 'HEAVIER',
        moderatePlus: false,
      })
      stop()
    })

    it.each([
      ['Như cũ', /Có khi cần thêm thời gian/],
      ['Chưa rõ', /Chưa rõ cũng là một câu trả lời/],
    ])('replies to %s in place', async (label, reply) => {
      setServer({ focus: sleep })
      api.getLookBack.mockResolvedValue(closed())
      render(<LookBackPage />)
      await screen.findByText(/nhẹ đi chưa/)
      fireEvent.click(screen.getByRole('radio', { name: label }))
      expect(await screen.findByText(reply)).toBeVisible()
    })

    it('shows a saved answer straight away and tells Mầm when the band is moderate or worse', async () => {
      const base = closed({}, { professionalPointer: true })
      setServer({
        focus: sleep,
        chapters: [
          { startedOn: startOf(base), rating: 'SAME', updatedAt: stamp },
        ],
      })
      api.getLookBack.mockResolvedValue(base)
      const { stop, events } = heard()
      render(<LookBackPage />)
      expect(await screen.findByText(/Có khi cần thêm thời gian/)).toBeVisible()
      fireEvent.click(screen.getAllByRole('button', { name: 'Đổi' })[0])
      fireEvent.click(screen.getByRole('radio', { name: 'Chưa rõ' }))
      await screen.findByText(/Chưa rõ cũng là/)
      expect(events).toEqual([
        { kind: 'rating', value: 'UNSURE', moderatePlus: true },
      ])
      stop()
    })

    it('arrow keys move between chips without answering', async () => {
      setServer({ focus: sleep })
      api.getLookBack.mockResolvedValue(closed())
      render(<LookBackPage />)
      await screen.findByText(/nhẹ đi chưa/)
      const [first, second, , last] = radios(/nhẹ đi chưa/)
      expect(first).toHaveAttribute('tabindex', '0')
      expect(second).toHaveAttribute('tabindex', '-1')
      first.focus()
      fireEvent.keyDown(first, { key: 'ArrowRight' })
      expect(second).toHaveFocus()
      fireEvent.keyDown(second, { key: 'ArrowLeft' })
      fireEvent.keyDown(first, { key: 'ArrowUp' })
      expect(last).toHaveFocus()
      fireEvent.keyDown(last, { key: 'Home' })
      expect(first).toHaveFocus()
      fireEvent.keyDown(first, { key: 'End' })
      expect(last).toHaveFocus()
      expect(patches).toEqual([])
    })

    it('keeps the chips and says so when the answer could not be saved', async () => {
      setServer({ focus: sleep })
      failPatch = true
      api.getLookBack.mockResolvedValue(closed())
      const { stop, events } = heard()
      render(<LookBackPage />)
      await screen.findByText(/nhẹ đi chưa/)
      fireEvent.click(screen.getByRole('radio', { name: 'Như cũ' }))
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Chưa lưu được',
      )
      expect(screen.getByRole('radio', { name: 'Như cũ' })).toHaveAttribute(
        'aria-checked',
        'false',
      )
      expect(events).toEqual([])
      stop()
    })

    it('asks what got in the way only when week 2 slipped, and links the matching review option', async () => {
      api.getLookBack.mockResolvedValue(closed())
      const first = render(<LookBackPage />)
      await screen.findByRole('heading', { name: 'Kết nối' })
      expect(
        screen.queryByRole('heading', { name: 'Điều gì cản bạn?' }),
      ).toBeNull()
      first.unmount()

      // Week 2 did less than week 1.
      const base = closed(slipping)
      api.getLookBack.mockResolvedValue(base)
      const { stop, events } = heard()
      render(<LookBackPage />)
      expect(
        await screen.findByRole('heading', { name: 'Điều gì cản bạn?' }),
      ).toBeVisible()
      expect(
        radios('Điều gì cản bạn?').map((item) => item.textContent),
      ).toEqual([
        'Bận quá',
        'Hay quên',
        'Không còn sức',
        'Việc không hợp',
        'Lý do khác',
      ])
      fireEvent.click(screen.getByRole('radio', { name: 'Không còn sức' }))
      expect(
        await screen.findByText(
          'Hiểu rồi nè. Mình chọn kế hoạch nhẹ hơn cho chặng sau nhé.',
        ),
      ).toBeVisible()
      expect(patches).toEqual([
        { chapter: { startedOn: startOf(base), obstacle: 'LOW_ENERGY' } },
      ])
      expect(
        screen.getByRole('link', { name: 'Xem lựa chọn phù hợp' }),
      ).toHaveAttribute(
        'href',
        '/support-plan?review=open&prefer=LOWER_WORKLOAD',
      )
      expect(events).toEqual([
        { kind: 'obstacle', value: 'LOW_ENERGY', moderatePlus: false },
      ])
      stop()
    })

    it('also asks when week 2 skipped an activity, but not on a part-lived week 2 that merely did less', async () => {
      api.getLookBack.mockResolvedValue(closed({ 10: { supportSkipped: 1 } }))
      const first = render(<LookBackPage />)
      expect(
        await screen.findByRole('heading', { name: 'Điều gì cản bạn?' }),
      ).toBeVisible()
      first.unmount()

      // Day 9 of a running chặng: week 2 has two days, so "less than week 1" says nothing yet.
      const early = view(slipping, cycle({ currentDay: 9 }))
      api.getLookBack.mockResolvedValue({
        ...early,
        days: early.days.slice(0, 9),
      })
      render(<LookBackPage />)
      await screen.findByRole('heading', { name: /ngày 9[/]14/ })
      expect(
        screen.queryByRole('heading', { name: 'Điều gì cản bạn?' }),
      ).toBeNull()
    })

    it.each([
      ['Bận quá', 'DIFFERENT_TIME'],
      ['Hay quên', 'DIFFERENT_TIME'],
      ['Việc không hợp', 'ALTERNATIVE_ACTION'],
      ['Lý do khác', null],
    ])('maps the obstacle %s to prefer=%s', async (label, prefer) => {
      api.getLookBack.mockResolvedValue(closed(slipping))
      render(<LookBackPage />)
      await screen.findByRole('heading', { name: 'Điều gì cản bạn?' })
      fireEvent.click(screen.getByRole('radio', { name: label }))
      expect(
        await screen.findByRole('link', { name: 'Xem lựa chọn phù hợp' }),
      ).toHaveAttribute(
        'href',
        prefer
          ? `/support-plan?review=open&prefer=${prefer}`
          : '/support-plan?review=open',
      )
    })

    it('"Rồi" ends there; "Chưa" offers a draft with Mầm and a lời hẹn for tomorrow', async () => {
      const base = closed()
      api.getLookBack.mockResolvedValue(base)
      const { stop, events } = heard()
      render(<LookBackPage />)
      await screen.findByRole('heading', { name: 'Kết nối' })
      expect(
        radios(/nói chuyện thật lòng/).map((item) => item.textContent),
      ).toEqual(['Rồi', 'Chưa', 'Không muốn nói'])
      fireEvent.click(screen.getByRole('radio', { name: 'Rồi' }))
      await screen.findByRole('button', { name: 'Đổi' })
      expect(
        screen.queryByRole('link', { name: 'Soạn tin cùng Mầm' }),
      ).toBeNull()

      fireEvent.click(screen.getByRole('button', { name: 'Đổi' }))
      fireEvent.click(screen.getByRole('radio', { name: 'Chưa' }))
      expect(
        await screen.findByText(
          'Thử nhắn cho một người bạn tin nhé, ngắn thôi cũng được.',
        ),
      ).toBeVisible()
      expect(patches.at(-1)).toEqual({
        chapter: { startedOn: startOf(base), connected: 'NOT_YET' },
      })
      expect(
        screen.getByRole('link', { name: 'Soạn tin cùng Mầm' }),
      ).toHaveAttribute('href', '/ai-companion?draft=connect')

      fireEvent.click(screen.getByRole('button', { name: 'Hẹn Mầm mai nhắc' }))
      const booked = await screen.findByRole('button', {
        name: 'Đã hẹn, mai Mầm hỏi bạn',
      })
      expect(booked).toHaveAttribute('aria-disabled', 'true')
      expect(posts).toEqual([
        {
          kind: 'CONNECT_PERSON',
          minutes: null,
          dueOn: shiftDate(localDate(), 1),
          source: 'LOOK_BACK',
        },
      ])
      // Pressing it again books nothing more.
      fireEvent.click(booked)
      expect(posts).toHaveLength(1)
      expect(events).toEqual([
        { kind: 'connected', value: 'YES', moderatePlus: false },
        { kind: 'connected', value: 'NOT_YET', moderatePlus: false },
      ])
      stop()
    })

    it('says three lời hẹn are already open instead of booking a fourth', async () => {
      const base = closed()
      setServer({
        chapters: [
          { startedOn: startOf(base), connected: 'NOT_YET', updatedAt: stamp },
        ],
      })
      limit = true
      api.getLookBack.mockResolvedValue(base)
      render(<LookBackPage />)
      fireEvent.click(
        await screen.findByRole('button', { name: 'Hẹn Mầm mai nhắc' }),
      )
      expect(
        await screen.findByText(
          'Bạn đang có 3 lời hẹn rồi, làm xong một cái rồi hẹn thêm nhé.',
        ),
      ).toBeVisible()
      expect(
        screen.getByRole('button', { name: 'Hẹn Mầm mai nhắc' }),
      ).not.toHaveAttribute('aria-disabled')
    })

    it('shows a lời hẹn already made as booked after a reload', async () => {
      const base = closed()
      setServer({
        chapters: [
          { startedOn: startOf(base), connected: 'NOT_YET', updatedAt: stamp },
        ],
        commitments: [
          {
            id: commitmentId,
            kind: 'CONNECT_PERSON',
            minutes: null,
            dueOn: shiftDate(localDate(), 1),
            source: 'LOOK_BACK',
            status: 'OPEN',
            createdAt: stamp,
            resolvedAt: null,
          },
        ],
      })
      api.getLookBack.mockResolvedValue(base)
      render(<LookBackPage />)
      expect(
        await screen.findByRole('button', { name: 'Đã hẹn, mai Mầm hỏi bạn' }),
      ).toBeVisible()
    })
  })
})
