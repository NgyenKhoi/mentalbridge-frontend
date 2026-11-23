import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ getLookBack: vi.fn() }))
vi.mock('./browser-look-back', () => api)

import {
  asOf,
  harder,
  makeProgress,
  improving,
  makeDashboard,
  sparse,
} from '@/tests/fixtures/look-back'
import { isMamFeatureSuppressed } from '@/features/mam/mam-suppression'
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
        name: 'Hành trình 14 ngày của bạn',
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
    expect(screen.getAllByRole('button', { name: /^Ngày \d+,/ })).toHaveLength(
      7,
    )
    fireEvent.click(screen.getByRole('button', { name: /Ngày 1,/ }))
    expect(screen.getByLabelText('Chi tiết ngày 1')).toHaveTextContent(
      'Mức cảm xúc:',
    )
    expect(screen.getByLabelText('Chi tiết ngày 1')).toHaveTextContent(
      'Hoạt động đã làm:',
    )
    expect(screen.getByLabelText('Chi tiết ngày 1')).toHaveTextContent(
      'Nhật ký:',
    )
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
})
