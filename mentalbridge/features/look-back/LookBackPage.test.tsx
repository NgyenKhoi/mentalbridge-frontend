import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ getLookBack: vi.fn() }))
vi.mock('./browser-look-back', () => api)
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
import { isMamFeatureSuppressed } from '@/features/mam/mam-suppression'
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

const nextLink = () =>
  within(screen.getByRole('region', { name: 'Bước tiếp theo' })).getByRole(
    'link',
  )

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

    it('refetches by the chặng dates, shows loading while it waits and keeps the selector', async () => {
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
      expect(screen.getByText('Đang tải phần nhìn lại…')).toBeInTheDocument()
      expect(selected()).toEqual(['Chặng 125/10 – 31/10'])
      expect(
        screen.queryByRole('heading', { name: /Bản đồ hành trình cảm xúc/ }),
      ).toBeNull()

      finish(chapterView(base, 's1'))
      expect(
        await screen.findByRole('heading', { name: 'Chặng 1' }),
      ).toBeVisible()
      expect(screen.getByText(/đã khép lại$/)).toBeVisible()
      expect(screen.queryByText('Đang tải phần nhìn lại…')).toBeNull()
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
        name: /Chọn nhịp tiếp theo/,
      })
      expect(choose).toHaveLength(1)
      expect(choose[0]).toHaveAttribute('href', '/support-plan?review=open')
      expect(nextLink()).toBe(choose[0])
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
})
