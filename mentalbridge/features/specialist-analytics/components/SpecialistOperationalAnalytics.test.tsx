import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { FeedbackProvider } from '@/components/ui/FeedbackProvider'
import { ApiError } from '@/lib/api/api-error'
import type { SpecialistOperationalAnalytics as Analytics } from '@/lib/consultation/consultation-validation'
import {
  blockedAnalytics,
  emptyAnalytics,
  readyAnalytics,
} from '@/tests/fixtures/specialist-analytics'
import SpecialistOperationalAnalytics from './SpecialistOperationalAnalytics'

const api = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('../api/browser-client', () => ({
  specialistAnalyticsBrowserClient: api,
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}
function renderPage() {
  return render(
    <FeedbackProvider>
      <SpecialistOperationalAnalytics />
    </FeedbackProvider>,
  )
}
async function ready() {
  await screen.findByText('75%')
}
const unavailable = () =>
  new ApiError({
    code: 'NETWORK_ERROR',
    message: 'synthetic unavailable',
    status: 503,
  })

describe('SpecialistOperationalAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    api.get.mockResolvedValue(readyAnalytics)
  })

  it('renders factual capacity, all-time ratings, lifecycle and bounded financials', async () => {
    renderPage()
    await ready()
    expect(
      screen.getByRole('heading', { name: 'Phân tích vận hành chuyên gia' }),
    ).toBeInTheDocument()
    expect(screen.getByText('4,5')).toBeInTheDocument()
    expect(screen.getByText('Toàn bộ thời gian')).toBeInTheDocument()
    expect(
      screen.getByText('Điểm tổng hợp không thay đổi theo bộ lọc thời gian.'),
    ).toBeInTheDocument()
    expect(screen.getByText(/420\.000/)).toBeInTheDocument()
    expect(screen.getByText(/210\.000/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '30 ngày' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(
      screen.getAllByRole('button', { name: /lượt\. Xem chi tiết/ }),
    ).toHaveLength(10)
    expect(
      screen.queryByText(/HIPAA|MB-516|75% để đạt|05 và ngày 20/),
    ).not.toBeInTheDocument()
  })

  it('keeps the layout and selected controls while initially loading', () => {
    api.get.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(
      screen.getByRole('heading', { name: 'Hiệu suất khai thác lịch tư vấn' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Đang tổng hợp')
    expect(
      screen.getByRole('button', { name: 'Làm mới số liệu' }),
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: '7 ngày' })).toBeEnabled()
    expect(
      screen
        .getAllByRole('button', { name: /lượt\. Xem chi tiết/ })
        .every((button) => button.hasAttribute('disabled')),
    ).toBe(true)
  })

  it('renders period and generation time in the authoritative timezone', async () => {
    api.get.mockResolvedValue({
      ...readyAnalytics,
      period: { ...readyAnalytics.period, timezone: 'America/New_York' },
    })
    renderPage()
    await ready()
    expect(
      screen.getByText('Cập nhật lúc 21:00 05/10/2026'),
    ).toBeInTheDocument()
    expect(screen.getByText('05/09/2026 – 05/10/2026')).toBeInTheDocument()
  })

  it('does not repeat a refresh toast when changing the period afterward', async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()
    await user.click(screen.getByRole('button', { name: 'Làm mới số liệu' }))
    await screen.findByText('Đã cập nhật số liệu vận hành.')
    await user.click(screen.getByRole('button', { name: 'Đóng thông báo' }))
    await user.click(screen.getByRole('button', { name: '7 ngày' }))
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Làm mới số liệu' }),
      ).toBeEnabled(),
    )
    expect(
      screen.queryByText('Đã cập nhật số liệu vận hành.'),
    ).not.toBeInTheDocument()
  })

  it('switches presets without presenting old facts as the new period', async () => {
    const user = userEvent.setup()
    const response = deferred<Analytics>()
    renderPage()
    await ready()
    api.get.mockReturnValueOnce(response.promise)
    await user.click(screen.getByRole('button', { name: '7 ngày' }))
    expect(api.get).toHaveBeenLastCalledWith(7)
    expect(screen.queryByText('75%')).not.toBeInTheDocument()
    expect(screen.getByText('7 ngày gần nhất')).toBeInTheDocument()
    await act(async () =>
      response.resolve({
        ...readyAnalytics,
        period: { ...readyAnalytics.period, from: '2026-09-29T01:00:00Z' },
      }),
    )
    expect(screen.getByText('29/09/2026 – 06/10/2026')).toBeInTheDocument()
  })

  it('ignores a slower obsolete period response', async () => {
    const user = userEvent.setup()
    const slow = deferred<Analytics>()
    const latest = deferred<Analytics>()
    renderPage()
    await ready()
    api.get
      .mockReturnValueOnce(slow.promise)
      .mockReturnValueOnce(latest.promise)
    await user.click(screen.getByRole('button', { name: '7 ngày' }))
    await user.click(screen.getByRole('button', { name: '90 ngày' }))
    await act(async () =>
      latest.resolve({
        ...readyAnalytics,
        availability: {
          ...readyAnalytics.availability,
          utilizedSlotCount: 10,
          unusedSlotCount: 10,
          utilizationRate: 50,
        },
      }),
    )
    expect(screen.getByText('50%')).toBeInTheDocument()
    await act(async () => slow.resolve(emptyAnalytics))
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '90 ngày' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('retains safe same-period facts on refresh failure and recovers with real feedback', async () => {
    const user = userEvent.setup()
    const response = deferred<Analytics>()
    renderPage()
    await ready()
    api.get.mockReturnValueOnce(response.promise)
    await user.click(screen.getByRole('button', { name: 'Làm mới số liệu' }))
    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Đang làm mới')
    await act(async () => response.reject(unavailable()))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'lần tải thành công gần nhất',
    )
    expect(screen.getByText('75%')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Thử tải lại' }))
    await waitFor(() =>
      expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
    )
    expect(
      await screen.findByText('Đã cập nhật số liệu vận hành.'),
    ).toBeInTheDocument()
  })

  it.each([401, 403])(
    'removes cached facts when access fails with %s',
    async (status) => {
      const user = userEvent.setup()
      renderPage()
      await ready()
      api.get.mockRejectedValueOnce(
        new ApiError({
          status,
          code: `HTTP_${status}`,
          message: 'synthetic access failure',
        }),
      )
      await user.click(screen.getByRole('button', { name: 'Làm mới số liệu' }))
      await screen.findByRole('alert')
      expect(screen.queryByText('75%')).not.toBeInTheDocument()
      expect(screen.queryByText(/420\.000/)).not.toBeInTheDocument()
      expect(
        screen.getByRole('link', {
          name: status === 401 ? 'Đăng nhập lại' : 'Về tổng quan',
        }),
      ).toHaveAttribute(
        'href',
        status === 401 ? '/login' : '/specialist/dashboard',
      )
    },
  )

  it('distinguishes initial failure from an empty result and offers retry and help', async () => {
    const user = userEvent.setup()
    api.get.mockRejectedValueOnce(unavailable())
    renderPage()
    await screen.findByRole('alert')
    expect(
      screen.queryByRole('link', { name: 'Quản lý lịch khả dụng' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Yêu cầu mới: — lượt. Xem chi tiết' }),
    ).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Cách khắc phục' }))
    expect(
      screen.getByRole('dialog', { name: 'Khi số liệu chưa tải được' }),
    ).toBeInTheDocument()
  })

  it('uses an undefined gauge denominator, zero lifecycle counts and real next steps for empty data', async () => {
    const user = userEvent.setup()
    api.get.mockResolvedValue(emptyAnalytics)
    renderPage()
    await screen.findByRole('heading', {
      name: 'Chưa có lịch mở trong khoảng thời gian này',
    })
    expect(
      screen.getByRole('link', { name: 'Quản lý lịch khả dụng' }),
    ).toHaveAttribute('href', '/specialist/availability')
    expect(screen.getByText('Chưa có đánh giá')).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: 'Yêu cầu mới: 00 lượt. Xem chi tiết',
      }),
    ).toBeEnabled()
    expect(
      screen.getByRole('button', { name: 'Xem cách tính tỷ lệ sử dụng lịch' }),
    ).not.toHaveTextContent('0%Tỷ lệ sử dụng lịch')
    await user.click(
      screen.getByRole('button', {
        name: 'Yêu cầu mới: 00 lượt. Xem chi tiết',
      }),
    )
    expect(screen.getByRole('dialog')).toHaveTextContent(
      'Không có sự kiện ở mốc này',
    )
  })

  it.each([
    ['PROFILE_REQUIRED', 'Hoàn thiện hồ sơ'],
    ['PENDING_APPROVAL', 'Xem hồ sơ'],
    ['PROFILE_REJECTED', 'Cập nhật hồ sơ'],
  ] as const)(
    'locks metrics and links to the profile for %s',
    async (status, action) => {
      api.get.mockResolvedValue(blockedAnalytics(status))
      renderPage()
      expect(await screen.findByRole('link', { name: action })).toHaveAttribute(
        'href',
        '/specialist/profile',
      )
      expect(screen.getByRole('button', { name: '30 ngày' })).toBeDisabled()
      expect(
        screen.getByRole('button', {
          name: 'Đã hoàn thành: — lượt. Xem chi tiết',
        }),
      ).toBeDisabled()
      expect(screen.queryByText('75%')).not.toBeInTheDocument()
    },
  )

  it('keeps historical facts for suspension without inviting new activity', async () => {
    api.get.mockResolvedValue({
      ...emptyAnalytics,
      operationalStatus: 'SUSPENDED',
    })
    renderPage()
    expect(await screen.findByText('Hồ sơ đang tạm ngưng')).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: 'Yêu cầu mới: 00 lượt. Xem chi tiết',
      }),
    ).toBeEnabled()
    expect(
      screen.queryByRole('link', { name: 'Quản lý lịch khả dụng' }),
    ).not.toBeInTheDocument()
  })

  it('keeps stale facts visible with a recovery explanation', async () => {
    api.get.mockResolvedValue({
      ...readyAnalytics,
      availability: { ...readyAnalytics.availability, state: 'STALE' },
    })
    renderPage()
    expect(await screen.findByText('Số liệu có thể đã cũ')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('does not replace unavailable financial metrics with zero', async () => {
    api.get.mockResolvedValue({
      ...readyAnalytics,
      financials: {
        ...readyAnalytics.financials,
        state: 'UNAVAILABLE',
        currency: null,
        earnedAmountMinor: null,
        paidAmountMinor: null,
      },
    })
    renderPage()
    await ready()
    expect(
      screen.getByText(/Dữ liệu tài chính chưa thể kết nối/),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Thu nhập ghi nhận —' }),
    ).toBeDisabled()
    expect(screen.queryByText(/0\s*₫/)).not.toBeInTheDocument()
  })

  it('opens meaningful lifecycle details without fabricated logs or identities', async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()
    await user.click(
      screen.getByRole('button', {
        name: 'Yêu cầu mới: 18 lượt. Xem chi tiết',
      }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Yêu cầu mới' })
    expect(within(dialog).getByText('18')).toBeInTheDocument()
    expect(dialog).toHaveTextContent('không phải số yêu cầu hiện đang chờ')
    expect(
      within(dialog).getByRole('link', { name: 'Xem lịch hẹn' }),
    ).toHaveAttribute('href', '/specialist/appointments')
    expect(dialog).not.toHaveTextContent('#MB-|Session 1-on-1')
  })

  it('explains historical utilization and financial definitions through interactive cards', async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()
    await user.click(
      screen.getByRole('button', { name: 'Xem cách tính tỷ lệ sử dụng lịch' }),
    )
    expect(screen.getByRole('dialog')).toHaveTextContent(
      'không phải số khung giờ trống còn có thể đặt ngay',
    )
    await user.click(screen.getByRole('button', { name: 'Đã hiểu' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    await user.click(
      screen.getByRole('button', { name: /Thu nhập ghi nhận.*420\.000/ }),
    )
    expect(screen.getByRole('dialog')).toHaveTextContent(
      'không bao gồm khoản đã được đảo ngược',
    )
    expect(screen.getByRole('dialog')).toHaveTextContent(
      'Không lấy chênh lệch này làm số dư',
    )
  })

  it('opens the privacy scope as an accessible dialog', async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()
    await user.click(screen.getByRole('button', { name: 'Phạm vi dữ liệu' }))
    expect(
      screen.getByRole('dialog', {
        name: 'Phạm vi dữ liệu trên trang phân tích',
      }),
    ).toHaveTextContent('Không đọc điểm sàng lọc')
  })
})
