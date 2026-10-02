import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FeedbackProvider } from '@/components/ui/FeedbackProvider'
import { ApiError } from '@/lib/api/api-error'
import SpecialistDiscovery from './SpecialistDiscovery'

const discoveryClient = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn() }))
const appointmentClient = vi.hoisted(() => ({ request: vi.fn() }))

vi.mock('../api/browser-client', () => ({
  specialistDiscoveryBrowserClient: discoveryClient,
}))
vi.mock('@/features/appointments/api/browser-client', () => ({
  appointmentBrowserClient: appointmentClient,
}))

const item = {
  specialistAccountId: '9e3a8903-3d31-48d0-bf1a-4d81bbcef4b8',
  displayName: 'Chuyên gia An',
  bio: 'Đồng hành trực tuyến bằng phương pháp hỗ trợ phi lâm sàng.',
  supportAreas: ['ANXIETY_SYMPTOMS'],
  languages: ['vi'],
  yearsOfExperience: 6,
  timezone: 'Asia/Ho_Chi_Minh',
  explanation: {
    compatibility: 'MATCHED',
    languageMatched: true,
    hasSelectableSlot: true,
    earliestSelectableStartAt: '2099-01-02T02:00:00Z',
    timezoneMatch: 'EXACT',
    timezoneOffsetDistanceMinutes: 0,
    ratingTieBreakerApplied: false,
    codes: ['SCREENED_SUPPORT_AREA_MATCH', 'SELECTABLE_SLOT_AVAILABLE'],
  },
  selectableSlots: [
    {
      id: '43b7dbb4-021e-4c75-ae48-bfa7126c7256',
      specialistAccountId: '9e3a8903-3d31-48d0-bf1a-4d81bbcef4b8',
      startAt: '2099-01-02T02:00:00Z',
      endAt: '2099-01-02T03:00:00Z',
      timezone: 'Asia/Ho_Chi_Minh',
      modality: 'IN_APP_CHAT',
      version: 2,
    },
  ],
} as const

function page(packageCode: 'FREE' | 'PLUS' | 'PREMIUM') {
  return {
    items: [item],
    count: 1,
    nextCursor: null,
    rankingPolicyVersion: 'specialist-discovery-v1' as const,
    generatedAt: '2099-01-01T00:00:00Z',
    contextState: 'APPLIED' as const,
    packageCode,
    bookingHandoff:
      packageCode === 'FREE'
        ? ('BROWSE_ONLY' as const)
        : ('BOOKING_POLICY_CHECK_REQUIRED' as const),
    videoEnabled: false,
  }
}

function renderDiscovery() {
  return render(
    <FeedbackProvider>
      <SpecialistDiscovery />
    </FeedbackProvider>,
  )
}

describe('SpecialistDiscovery', () => {
  beforeEach(() => {
    discoveryClient.list.mockReset()
    discoveryClient.detail.mockReset()
    appointmentClient.request.mockReset()
    discoveryClient.detail.mockResolvedValue(item)
  })

  it('allows Free users to browse real details and slots without booking', async () => {
    const user = userEvent.setup()
    discoveryClient.list.mockResolvedValue(page('FREE'))

    renderDiscovery()
    expect(await screen.findByText('Chuyên gia An')).toBeInTheDocument()
    expect(screen.getByText(/Bạn đang dùng gói Free/)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Video · sắp có' }),
    ).toBeDisabled()
    expect(
      screen.getByText(/Video trong ứng dụng hiện chưa khả dụng/),
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Xem hồ sơ và khung giờ' }),
    )

    expect(
      await screen.findByText('Vì sao hồ sơ này xuất hiện?'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Múi giờ')).not.toBeInTheDocument()
    expect(screen.queryByText('Asia/Ho_Chi_Minh')).not.toBeInTheDocument()
    expect(screen.getByText('Chat trong ứng dụng')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Xem quyền lợi các gói' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Gửi yêu cầu đặt lịch' }),
    ).not.toBeInTheDocument()
    expect(appointmentClient.request).not.toHaveBeenCalled()
    expect(document.body).not.toHaveTextContent('Phí tư vấn')
    expect(document.body).not.toHaveTextContent('Điện thoại')
    expect(document.body).not.toHaveTextContent('Địa điểm')
    expect(document.body).not.toHaveTextContent('Chứng chỉ')
  })

  it('hands the exact selected slot and modality to MB-378 for paid plans', async () => {
    const user = userEvent.setup()
    discoveryClient.list.mockResolvedValue(page('PLUS'))
    appointmentClient.request.mockResolvedValue({ id: 'appointment-id' })

    renderDiscovery()
    await user.click(
      await screen.findByRole('button', { name: 'Xem hồ sơ và khung giờ' }),
    )
    await user.click(await screen.findByRole('radio'))
    await user.click(
      screen.getByRole('button', { name: 'Gửi yêu cầu đặt lịch' }),
    )

    await waitFor(() =>
      expect(appointmentClient.request).toHaveBeenCalledWith(
        item.selectableSlots[0].id,
        'IN_APP_CHAT',
        expect.stringMatching(/^appointment-/),
      ),
    )
  })

  it('renders empty discovery without inventing specialists', async () => {
    discoveryClient.list.mockResolvedValue({
      ...page('PREMIUM'),
      items: [],
      count: 0,
    })

    renderDiscovery()
    expect(
      await screen.findByText('Chưa có chuyên gia phù hợp'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Chuyên gia An')).not.toBeInTheDocument()
  })

  it('keeps a stale slot selected for an explicit retry instead of substituting it', async () => {
    const user = userEvent.setup()
    discoveryClient.list.mockResolvedValue(page('PREMIUM'))
    appointmentClient.request.mockRejectedValue(
      new ApiError({
        message: 'Slot changed.',
        code: 'APPOINTMENT_SLOT_STALE',
        status: 409,
      }),
    )

    renderDiscovery()
    await user.click(
      await screen.findByRole('button', { name: 'Xem hồ sơ và khung giờ' }),
    )
    const slot = await screen.findByRole('radio')
    await user.click(slot)
    await user.click(
      screen.getByRole('button', { name: 'Gửi yêu cầu đặt lịch' }),
    )

    expect(
      await screen.findByText(
        'Khung giờ này đã thay đổi. Hãy tải lại và chọn giờ khác.',
      ),
    ).toBeInTheDocument()
    expect(slot).toBeChecked()
    expect(appointmentClient.request).toHaveBeenCalledTimes(1)
  })

  it('shows a retry state when discovery is unavailable', async () => {
    discoveryClient.list.mockRejectedValue(new Error('dependency unavailable'))

    renderDiscovery()

    expect(
      await screen.findByRole('heading', { name: 'Chưa thể tải danh sách' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument()
    expect(screen.queryByText('Chuyên gia An')).not.toBeInTheDocument()
  })
})
