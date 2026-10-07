import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SpecialistOperationalAnalytics as Analytics } from '@/lib/consultation/consultation-validation'
import SpecialistOperationalAnalytics from './SpecialistOperationalAnalytics'

const api = vi.hoisted(() => ({ get: vi.fn() }))

vi.mock('../api/browser-client', () => ({
  specialistAnalyticsBrowserClient: api,
}))

const generatedAt = '2026-10-06T01:00:00Z'
const readyAnalytics = {
  source: 'CONSULTATION',
  generatedAt,
  operationalStatus: 'READY',
  period: {
    from: '2026-09-06T01:00:00Z',
    to: generatedAt,
    timezone: 'Asia/Ho_Chi_Minh',
  },
  availability: {
    source: 'CONSULTATION',
    asOf: generatedAt,
    state: 'AVAILABLE',
    publishedSlotCount: 20,
    utilizedSlotCount: 15,
    unusedSlotCount: 5,
    utilizationRate: 75,
  },
  appointments: {
    source: 'CONSULTATION',
    asOf: generatedAt,
    state: 'AVAILABLE',
    requestedCount: 18,
    acceptedCount: 15,
    rejectedCount: 1,
    expiredCount: 2,
    cancelledCount: 1,
    rescheduledCount: 2,
    completedCount: 12,
    userNoShowCount: 1,
    specialistNoShowCount: 0,
    bothNoShowCount: 0,
  },
  rating: {
    source: 'CONSULTATION',
    asOf: generatedAt,
    state: 'AVAILABLE',
    averageRating: 4.5,
    ratingCount: 10,
  },
  financials: {
    source: 'CONSULTATION',
    asOf: generatedAt,
    state: 'AVAILABLE',
    currency: 'VND',
    earnedAmountMinor: 420000,
    paidAmountMinor: 210000,
  },
} satisfies Analytics

describe('SpecialistOperationalAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(generatedAt))
    api.get.mockResolvedValue(readyAnalytics)
  })

  it('renders factual operational and MB-516 financial metrics', async () => {
    render(<SpecialistOperationalAnalytics />)

    expect(
      await screen.findByRole('heading', { name: 'Hoạt động tư vấn của bạn' }),
    ).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.getByText('Tài chính trong kỳ')).toBeInTheDocument()
    expect(screen.getByText(/420\.000/)).toBeInTheDocument()
    expect(screen.getByText(/210\.000/)).toBeInTheDocument()
    expect(
      screen.getByText(/không sử dụng dữ liệu sức khỏe tinh thần/i),
    ).toBeInTheDocument()
  })

  it('reloads with the selected bounded period', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<SpecialistOperationalAnalytics />)
    await screen.findByRole('heading', { name: 'Hoạt động tư vấn của bạn' })

    await user.selectOptions(screen.getByLabelText('Khoảng thời gian'), '7')

    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith(7))
  })

  it('keeps historical metrics visible while stating suspension truthfully', async () => {
    api.get.mockResolvedValue({
      ...readyAnalytics,
      operationalStatus: 'SUSPENDED',
    })
    render(<SpecialistOperationalAnalytics />)

    expect(await screen.findByText(/Hồ sơ đang tạm ngưng/)).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('shows a stale-data recovery message without hiding the last facts', async () => {
    api.get.mockResolvedValue({
      ...readyAnalytics,
      availability: { ...readyAnalytics.availability, state: 'STALE' },
    })
    render(<SpecialistOperationalAnalytics />)

    expect(await screen.findByText(/Số liệu có thể đã cũ/)).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
  })
})
