import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FeedbackProvider } from '@/components/ui/FeedbackProvider'
import { ApiError } from '@/lib/api/api-error'
import SpecialistDiscovery from './SpecialistDiscovery'

const discoveryClient = vi.hoisted(() => ({
  list: vi.fn(),
  detail: vi.fn(),
  badges: vi.fn(),
}))
const appointmentClient = vi.hoisted(() => ({ request: vi.fn() }))
const creditsClient = vi.hoisted(() => ({ get: vi.fn() }))

vi.mock('../api/browser-client', () => ({
  specialistDiscoveryBrowserClient: discoveryClient,
}))
vi.mock('@/features/appointments/api/browser-client', () => ({
  appointmentBrowserClient: appointmentClient,
}))
vi.mock('@/features/service-credits/api/browser-client', () => ({
  browserServiceCredits: creditsClient,
}))

const item = {
  specialistAccountId: '9e3a8903-3d31-48d0-bf1a-4d81bbcef4b8',
  displayName: 'Chuyên gia An',
  bio: 'Đồng hành trực tuyến bằng phương pháp hỗ trợ phi lâm sàng.',
  supportAreas: ['ANXIETY_SYMPTOMS'],
  languages: ['vi'],
  yearsOfExperience: 6,
  timezone: 'Asia/Ho_Chi_Minh',
  ratingAggregate: null,
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
    rankingPolicyVersion: 'specialist-discovery-v2' as const,
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
    window.history.replaceState({}, '', '/specialists')
    discoveryClient.list.mockReset()
    discoveryClient.detail.mockReset().mockResolvedValue(item)
    discoveryClient.badges.mockReset().mockResolvedValue([])
    appointmentClient.request.mockReset()
    creditsClient.get
      .mockReset()
      .mockResolvedValue({ balance: { available: 2 } })
  })

  it('applies the selected support-area and language filters to discovery', async () => {
    const user = userEvent.setup()
    discoveryClient.list.mockResolvedValue(page('FREE'))
    renderDiscovery()
    await screen.findByRole('heading', { name: 'Chuyên gia An' })

    await user.click(
      screen.getByRole('button', { name: /Lo âu & Căng thẳng/i }),
    )
    await waitFor(() =>
      expect(discoveryClient.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ supportArea: 'ANXIETY_SYMPTOMS' }),
      ),
    )

    await user.selectOptions(
      screen.getByRole('combobox', { name: /Ngôn ngữ/i }),
      'vi',
    )
    await waitFor(() =>
      expect(discoveryClient.list).toHaveBeenLastCalledWith(
        expect.objectContaining({
          supportArea: 'ANXIETY_SYMPTOMS',
          language: 'vi',
        }),
      ),
    )
  })

  it('allows Free users to browse real details and slots without booking', async () => {
    const user = userEvent.setup()
    discoveryClient.list.mockResolvedValue(page('FREE'))
    renderDiscovery()
    expect(
      await screen.findByRole('heading', { name: 'Chuyên gia An' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Video · sắp có' }),
    ).toBeDisabled()
    expect(screen.queryByText(item.bio)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Hồ sơ' }))
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText(item.bio)).toBeInTheDocument()
    expect(
      within(dialog).getByRole('link', { name: 'Xem quyền lợi các gói' }),
    ).toBeInTheDocument()
    await user.click(within(dialog).getByRole('tab', { name: 'Lịch trống' }))
    expect(within(dialog).getByRole('radio')).toBeInTheDocument()
    expect(appointmentClient.request).not.toHaveBeenCalled()
  })

  it('opens directly to slots and requests the exact selected time after confirmation', async () => {
    const user = userEvent.setup()
    discoveryClient.list.mockResolvedValue(page('PLUS'))
    appointmentClient.request.mockResolvedValue({ id: 'appointment-id' })
    renderDiscovery()
    await user.click(await screen.findByRole('button', { name: 'Lịch trống' }))
    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByRole('tab', { name: 'Lịch trống' }),
    ).toHaveAttribute('aria-selected', 'true')
    await user.click(await within(dialog).findByRole('radio'))
    await user.click(within(dialog).getByRole('button', { name: 'Tiếp tục' }))
    expect(appointmentClient.request).not.toHaveBeenCalled()
    await user.click(
      within(dialog).getByRole('button', { name: 'Xác nhận đặt lịch' }),
    )
    await waitFor(() =>
      expect(appointmentClient.request).toHaveBeenCalledWith(
        item.selectableSlots[0].id,
        'IN_APP_CHAT',
        expect.stringMatching(/^appointment-/),
      ),
    )
    expect(
      await within(dialog).findByText('Đã gửi yêu cầu đặt lịch'),
    ).toBeInTheDocument()
    expect(screen.getByText('Lịch hẹn sắp tới')).toBeInTheDocument()
  })

  it('retains a stale time for explicit retry after a booking conflict', async () => {
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
    await user.click(await screen.findByRole('button', { name: 'Lịch trống' }))
    const dialog = await screen.findByRole('dialog')
    const slot = await within(dialog).findByRole('radio')
    await user.click(slot)
    await user.click(within(dialog).getByRole('button', { name: 'Tiếp tục' }))
    await user.click(
      within(dialog).getByRole('button', { name: 'Xác nhận đặt lịch' }),
    )
    expect(
      await within(dialog).findByText(
        'Khung giờ này đã thay đổi. Hãy tải lại và chọn giờ khác.',
      ),
    ).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Quay lại' }))
    expect(slot).toBeChecked()
  })

  it('refreshes authoritative slots when the user returns from the specialist tab', async () => {
    discoveryClient.list
      .mockResolvedValueOnce({ ...page('PLUS'), items: [], count: 0 })
      .mockResolvedValue(page('PLUS'))

    renderDiscovery()
    await screen.findByText('Chưa có chuyên gia phù hợp')
    fireEvent(window, new Event('focus'))

    expect(
      await screen.findByRole('heading', { name: 'Chuyên gia An' }),
    ).toBeInTheDocument()
  })

  it.each([
    [
      'MATCHED',
      'Có lĩnh vực hỗ trợ trùng với gợi ý sau bài sàng lọc bạn đã chọn dùng.',
    ],
    [
      'NOT_MATCHED',
      'Chưa có lĩnh vực hỗ trợ trùng với gợi ý sau bài sàng lọc.',
    ],
    [
      'UNAVAILABLE',
      'Hiện chưa thể dùng gợi ý sau bài sàng lọc; các tiêu chí còn lại vẫn được áp dụng.',
    ],
    ['NEUTRAL', 'Thứ tự chung không sử dụng nội dung bài sàng lọc.'],
  ] as const)(
    'explains why a %s profile appears without inventing clinical claims',
    async (compatibility, message) => {
      const user = userEvent.setup()
      const explained = {
        ...item,
        explanation: {
          ...item.explanation,
          compatibility,
          languageMatched: false,
          ratingTieBreakerApplied: true,
        },
      }
      discoveryClient.list.mockResolvedValue(page('PLUS'))
      discoveryClient.detail.mockResolvedValue(explained)
      renderDiscovery()
      await user.click(await screen.findByRole('button', { name: 'Hồ sơ' }))
      const why = await within(await screen.findByRole('dialog')).findByRole(
        'region',
        { name: 'Vì sao hồ sơ này xuất hiện?' },
      )
      expect(
        within(why)
          .getAllByRole('listitem')
          .map((entry) => entry.textContent),
      ).toEqual([
        message,
        'Chưa có ngôn ngữ bạn ưu tiên.',
        'Có khung giờ 60 phút đang chọn được.',
        'Điểm đánh giá chỉ được dùng để phân định khi các yếu tố chính bằng nhau.',
      ])
    },
  )

  it('re-reads a stale zero balance on return so booking is no longer blocked', async () => {
    const user = userEvent.setup()
    discoveryClient.list.mockResolvedValue(page('PLUS'))
    creditsClient.get.mockResolvedValue({ balance: { available: 0 } })
    renderDiscovery()
    await user.click(await screen.findByRole('button', { name: 'Hồ sơ' }))
    const dialog = await screen.findByRole('dialog')
    await waitFor(() =>
      expect(
        within(dialog).getByRole('button', { name: 'Đặt lịch gần nhất' }),
      ).toBeDisabled(),
    )

    creditsClient.get.mockResolvedValue({ balance: { available: 1 } })
    fireEvent(window, new Event('focus'))

    await waitFor(() =>
      expect(
        within(dialog).getByRole('button', { name: 'Đặt lịch gần nhất' }),
      ).toBeEnabled(),
    )
    expect(within(dialog).getByText(/1 lượt khả dụng/)).toBeInTheDocument()
  })

  it('keeps the newest balance when an older zero read finishes last', async () => {
    const user = userEvent.setup()
    discoveryClient.list.mockResolvedValue(page('PLUS'))
    let finishOlder: (value: unknown) => void = () => {}
    creditsClient.get
      .mockResolvedValueOnce({ balance: { available: 0 } })
      .mockImplementationOnce(
        () => new Promise((resolve) => (finishOlder = resolve)),
      )
      .mockResolvedValue({ balance: { available: 1 } })
    renderDiscovery()
    // Opening the profile starts a read that is still pending (the older one).
    await user.click(await screen.findByRole('button', { name: 'Hồ sơ' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent(window, new Event('focus'))
    await waitFor(() =>
      expect(
        within(dialog).getByRole('button', { name: 'Đặt lịch gần nhất' }),
      ).toBeEnabled(),
    )

    await act(async () => finishOlder({ balance: { available: 0 } }))

    expect(
      within(dialog).getByRole('button', { name: 'Đặt lịch gần nhất' }),
    ).toBeEnabled()
    expect(within(dialog).getByText(/1 lượt khả dụng/)).toBeInTheDocument()
  })

  it('uses the enabled backend video capability for discovery filtering', async () => {
    const user = userEvent.setup()
    discoveryClient.list.mockResolvedValue({
      ...page('PLUS'),
      videoEnabled: true,
    })

    renderDiscovery()
    const video = await screen.findByRole('button', { name: /^Video$/ })
    expect(video).toBeEnabled()
    await user.click(video)

    await waitFor(() =>
      expect(discoveryClient.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ modality: 'IN_APP_VIDEO' }),
      ),
    )
  })

  it('retains the originating PlanAction only after the user explicitly books', async () => {
    const user = userEvent.setup()
    const actionId = '20000000-0000-4000-8000-000000000643'
    window.history.replaceState({}, '', `/specialists?planActionId=${actionId}`)
    discoveryClient.list.mockResolvedValue(page('PLUS'))
    appointmentClient.request.mockResolvedValue({ id: 'appointment-id' })

    renderDiscovery()
    await user.click(await screen.findByRole('button', { name: 'Lịch trống' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(await within(dialog).findByRole('radio'))
    await user.click(within(dialog).getByRole('button', { name: 'Tiếp tục' }))
    expect(appointmentClient.request).not.toHaveBeenCalled()
    await user.click(
      within(dialog).getByRole('button', { name: 'Xác nhận đặt lịch' }),
    )

    await waitFor(() =>
      expect(appointmentClient.request).toHaveBeenCalledWith(
        item.selectableSlots[0].id,
        'IN_APP_CHAT',
        expect.stringMatching(/^appointment-/),
        undefined,
        undefined,
        actionId,
      ),
    )
  })

  it('links back to the originating support guide', async () => {
    const guideId = '30000000-0000-4000-8000-000000000668'
    discoveryClient.list.mockResolvedValue(page('PLUS'))
    render(
      <FeedbackProvider>
        <SpecialistDiscovery returnSupportGuideId={guideId} />
      </FeedbackProvider>,
    )

    expect(
      await screen.findByRole('link', { name: 'Quay lại gợi ý hỗ trợ' }),
    ).toHaveAttribute('href', `/support-guides/${guideId}`)
  })

  it('renders empty discovery without inventing specialists or slots', async () => {
    discoveryClient.list.mockResolvedValue({
      ...page('PLUS'),
      items: [],
      count: 0,
    })
    renderDiscovery()

    expect(
      await screen.findByText('Chưa có chuyên gia phù hợp'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    expect(screen.getByText('0 chuyên gia')).toBeInTheDocument()
  })

  it('shows a retry state when discovery is unavailable', async () => {
    const user = userEvent.setup()
    discoveryClient.list
      .mockRejectedValueOnce(
        new ApiError({ message: 'Down', code: 'UNAVAILABLE', status: 503 }),
      )
      .mockResolvedValue(page('PLUS'))
    renderDiscovery()

    const alert = await screen.findByRole('alert')
    await user.click(within(alert).getByRole('button', { name: 'Thử lại' }))
    expect(
      await screen.findByRole('heading', { name: 'Chuyên gia An' }),
    ).toBeInTheDocument()
  })

  it('filters the loaded list from the topbar search event', async () => {
    discoveryClient.list.mockResolvedValue(page('PLUS'))
    renderDiscovery()
    expect(
      await screen.findByRole('heading', { name: 'Chuyên gia An' }),
    ).toBeInTheDocument()
    act(() =>
      window.dispatchEvent(
        new CustomEvent('mentalbridge:specialist-search', {
          detail: 'không tồn tại',
        }),
      ),
    )
    expect(
      await screen.findByText('Chưa có chuyên gia phù hợp'),
    ).toBeInTheDocument()
  })
})
