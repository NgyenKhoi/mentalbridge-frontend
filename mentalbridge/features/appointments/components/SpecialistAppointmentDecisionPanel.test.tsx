import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { NOTIFICATIONS_UPDATED_EVENT } from '@/components/NotificationBell'
import { FeedbackProvider } from '@/components/ui/FeedbackProvider'
import { ApiError } from '@/lib/api/api-error'
import SpecialistAppointmentDecisionPanel from './SpecialistAppointmentDecisionPanel'

const api = vi.hoisted(() => ({
  assigned: vi.fn(),
  decide: vi.fn(),
}))

const continuity = vi.hoisted(() => ({ specialistContinuity: vi.fn() }))

vi.mock('../api/browser-client', () => ({
  appointmentBrowserClient: api,
}))

vi.mock('../api/consultation-brief-browser-client', () => ({
  consultationBriefBrowserClient: continuity,
}))

vi.mock('./SpecialistConsultationBrief', () => ({
  SpecialistConsultationBrief: ({
    appointmentId,
  }: {
    appointmentId: string
  }) => <div data-testid={`specialist-brief-${appointmentId}`} />,
}))

const requested = {
  id: '10a7e5d8-7960-42fb-9706-e642f849b78f',
  slotId: '43b7dbb4-021e-4c75-ae48-bfa7126c7256',
  specialistAccountId: '9e3a8903-3d31-48d0-bf1a-4d81bbcef4b8',
  specialistDisplayName: 'Chuyên gia An',
  status: 'REQUESTED' as const,
  modality: 'IN_APP_CHAT' as const,
  scheduledStartAt: '2099-09-27T02:00:00Z',
  scheduledEndAt: '2099-09-27T03:00:00Z',
  timezone: 'Asia/Ho_Chi_Minh',
  requestedAt: '2099-09-25T02:00:00Z',
  decisionDeadlineAt: '2099-09-26T02:00:00Z',
  heldCreditId: '96de7b84-14ae-46cd-bfa1-8314d1366b02',
  replacesAppointmentId: null,
  replacedByAppointmentId: null,
  decidedAt: null,
  decisionReason: null,
  cancelledAt: null,
  cancellationReason: null,
  cancellationActor: null,
  cancellationCreditOutcome: null,
  creditState: 'HELD' as const,
  history: [],
  version: 0,
}

describe('SpecialistAppointmentDecisionPanel', () => {
  it.each(['CONFIRMED', 'SESSION_ENDED'] as const)(
    'routes assigned %s video to its dedicated room with the visible action in its accessible name, not chat or inline media',
    async (status) => {
      api.assigned.mockResolvedValueOnce({
        items: [
          {
            ...requested,
            modality: 'IN_APP_VIDEO',
            status,
            decidedAt: '2099-09-25T03:00:00Z',
            decisionReason: 'SPECIALIST_ACCEPTED',
            version: 1,
          },
        ],
        count: 1,
        generatedAt: '2099-09-25T03:00:01Z',
      })
      render(<SpecialistAppointmentDecisionPanel />)
      const links = await screen.findAllByRole('link', {
        name:
          status === 'CONFIRMED' ? /Mở phòng tư vấn/ : /Xem phiên tư vấn video/,
      })
      for (const link of links)
        expect(link).toHaveAttribute(
          'href',
          `/specialist/appointments/${requested.id}/video`,
        )
      expect(
        screen.queryByRole('region', { name: 'Cuộc gọi tư vấn' }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('link', { name: /Mở tin nhắn/ }),
      ).not.toBeInTheDocument()
    },
  )
  beforeEach(() => {
    vi.clearAllMocks()
    continuity.specialistContinuity.mockResolvedValue({ items: [] })
    api.assigned.mockResolvedValue({
      items: [requested],
      count: 1,
      generatedAt: '2099-09-25T02:00:01Z',
    })
  })

  it.each([
    [null, 'Đang xác nhận kết quả'],
    ['USER_NO_SHOW', 'Khách hàng vắng mặt'],
    ['SPECIALIST_NO_SHOW', 'Bạn vắng mặt'],
  ] as const)(
    'labels an ended session with outcome %s as "%s"',
    async (sessionOutcome, label) => {
      api.assigned.mockResolvedValueOnce({
        items: [{ ...requested, status: 'SESSION_ENDED', sessionOutcome }],
        count: 1,
        generatedAt: '2099-09-25T03:00:01Z',
      })
      render(<SpecialistAppointmentDecisionPanel />)

      expect((await screen.findAllByText(label)).length).toBeGreaterThan(0)
      expect(
        screen.queryByText('Đang tổng hợp kết quả'),
      ).not.toBeInTheDocument()
    },
  )

  it('shows the real pending request and its decision deadline', async () => {
    render(<SpecialistAppointmentDecisionPanel />)

    expect(await screen.findByText('Chờ phản hồi')).toBeInTheDocument()
    expect(screen.getByText(/Phản hồi trước/)).toBeInTheDocument()
    expect(
      screen.getByText('Buổi tư vấn đang được giữ cho lịch hẹn'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xác nhận' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Từ chối' })).toBeEnabled()
  })

  it('accepts with the current version and updates the persisted outcome', async () => {
    api.decide.mockResolvedValue({
      ...requested,
      status: 'CONFIRMED',
      decidedAt: '2099-09-25T03:00:00Z',
      decisionReason: 'SPECIALIST_ACCEPTED',
      version: 1,
    })
    const user = userEvent.setup()
    render(<SpecialistAppointmentDecisionPanel />)

    await user.click(await screen.findByRole('button', { name: 'Xác nhận' }))

    await waitFor(() => expect(api.decide).toHaveBeenCalledTimes(1))
    expect(api.decide).toHaveBeenCalledWith(
      requested.id,
      'accept',
      0,
      expect.stringMatching(/^[0-9a-f-]{36}$/),
    )
    expect((await screen.findAllByText('Đã xác nhận')).length).toBeGreaterThan(
      0,
    )
    expect(
      screen.queryByRole('button', { name: 'Từ chối' }),
    ).not.toBeInTheDocument()
  })

  it('routes a confirmed appointment to the specialist chat workspace', async () => {
    api.assigned.mockResolvedValue({
      items: [
        {
          ...requested,
          status: 'CONFIRMED',
          decidedAt: '2099-09-25T03:00:00Z',
          decisionReason: 'SPECIALIST_ACCEPTED',
          version: 1,
        },
      ],
      count: 1,
      generatedAt: '2099-09-25T03:00:01Z',
    })
    const { container } = render(<SpecialistAppointmentDecisionPanel />)

    await waitFor(() =>
      expect(
        container.querySelector(
          `a[href="/specialist/messages?appointmentId=${requested.id}"]`,
        ),
      ).toBeInTheDocument(),
    )
  })

  it('rejects only after confirmation and shows the released credit', async () => {
    api.decide.mockResolvedValue({
      ...requested,
      status: 'REJECTED',
      decidedAt: '2099-09-25T03:00:00Z',
      decisionReason: 'SPECIALIST_REJECTED',
      creditState: 'AVAILABLE',
      version: 1,
    })
    const user = userEvent.setup()
    render(
      <FeedbackProvider>
        <SpecialistAppointmentDecisionPanel />
      </FeedbackProvider>,
    )

    await user.click(await screen.findByRole('button', { name: 'Từ chối' }))
    expect(api.decide).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Từ chối yêu cầu' }))

    await waitFor(() => expect(api.decide).toHaveBeenCalledTimes(1))
    expect(api.decide).toHaveBeenCalledWith(
      requested.id,
      'reject',
      0,
      expect.stringMatching(/^[0-9a-f-]{36}$/),
    )
    expect(await screen.findByText('Đã từ chối')).toBeInTheDocument()
    expect(screen.getByText('Buổi tư vấn đã được hoàn lại')).toBeInTheDocument()
  })

  it('reloads a stale request before explaining that it changed', async () => {
    api.decide.mockRejectedValueOnce(
      new ApiError({
        message: 'stale',
        code: 'APPOINTMENT_VERSION_MISMATCH',
        status: 412,
      }),
    )
    api.assigned
      .mockResolvedValueOnce({
        items: [requested],
        count: 1,
        generatedAt: '2099-09-25T02:00:01Z',
      })
      .mockResolvedValueOnce({
        items: [
          {
            ...requested,
            status: 'EXPIRED',
            decidedAt: '2099-09-26T02:00:00Z',
            decisionReason: 'DECISION_DEADLINE_EXPIRED',
            creditState: 'AVAILABLE',
            version: 1,
          },
        ],
        count: 1,
        generatedAt: '2099-09-26T02:00:01Z',
      })
    const user = userEvent.setup()
    render(<SpecialistAppointmentDecisionPanel />)

    await user.click(await screen.findByRole('button', { name: 'Xác nhận' }))

    expect(await screen.findByText('Đã hết hạn')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Yêu cầu này vừa được cập nhật ở nơi khác. Danh sách mới nhất đã được tải lại.',
      ),
    ).toBeInTheDocument()
    expect(api.assigned).toHaveBeenCalledTimes(2)
  })

  it('retains loaded requests on refresh failure rather than rendering an empty state', async () => {
    api.assigned
      .mockResolvedValueOnce({
        items: [requested],
        count: 1,
        generatedAt: '2099-09-25T02:00:01Z',
      })
      .mockRejectedValueOnce(new Error('offline'))
    const user = userEvent.setup()
    render(<SpecialistAppointmentDecisionPanel />)
    await screen.findByRole('button', { name: 'Xác nhận' })
    await user.click(screen.getByRole('button', { name: 'Tải lại' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chưa thể cập nhật lịch hẹn',
    )
    expect(screen.getByRole('button', { name: 'Xác nhận' })).toBeEnabled()
    expect(
      screen.queryByText('Chưa có yêu cầu lịch hẹn'),
    ).not.toBeInTheDocument()
  })

  it('does not report an empty appointment list when the initial request fails', async () => {
    api.assigned.mockRejectedValueOnce(new Error('offline'))
    render(<SpecialistAppointmentDecisionPanel />)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chưa thể tải lịch hẹn',
    )
    expect(
      screen.queryByText('Chưa có yêu cầu lịch hẹn'),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeEnabled()
  })
  it('reloads the list quietly when a new notification arrives', async () => {
    api.assigned
      .mockResolvedValueOnce({
        items: [],
        count: 0,
        generatedAt: '2099-09-25T02:00:00Z',
      })
      .mockResolvedValueOnce({
        items: [requested],
        count: 1,
        generatedAt: '2099-09-25T02:00:30Z',
      })
    render(<SpecialistAppointmentDecisionPanel />)
    await screen.findByText('Chưa có yêu cầu lịch hẹn')
    act(() => {
      window.dispatchEvent(new CustomEvent(NOTIFICATIONS_UPDATED_EVENT))
    })
    expect(
      await screen.findByRole('button', { name: 'Xác nhận' }),
    ).toBeEnabled()
    expect(api.assigned).toHaveBeenCalledTimes(2)
  })

  describe('client name and session details', () => {
    const confirmed = {
      ...requested,
      id: '20a7e5d8-7960-42fb-9706-e642f849b78f',
      status: 'CONFIRMED' as const,
      decidedAt: '2099-09-25T03:00:00Z',
      decisionReason: 'SPECIALIST_ACCEPTED' as const,
      scheduledStartAt: '2099-09-26T02:00:00Z',
      scheduledEndAt: '2099-09-26T03:00:00Z',
      version: 1,
    }

    it('shows the real client name from continuity and falls back to a generic label', async () => {
      continuity.specialistContinuity.mockResolvedValue({
        items: [{ appointmentId: confirmed.id, userDisplayName: 'Lan Anh' }],
      })
      api.assigned.mockResolvedValue({
        items: [requested, confirmed],
        count: 2,
        generatedAt: '2099-09-25T02:00:01Z',
      })
      render(<SpecialistAppointmentDecisionPanel />)

      expect((await screen.findAllByText(/Lan Anh/)).length).toBeGreaterThan(0)
      expect(screen.queryByText(/Người đặt lịch/)).not.toBeInTheDocument()
      const waiting = (await screen.findAllByText('Khách hàng'))[0]
      expect(waiting).toBeInTheDocument()
    })

    it('opens a details drawer with name, time, status, decision and links', async () => {
      continuity.specialistContinuity.mockResolvedValue({
        items: [{ appointmentId: confirmed.id, userDisplayName: 'Lan Anh' }],
      })
      api.assigned.mockResolvedValue({
        items: [confirmed],
        count: 1,
        generatedAt: '2099-09-25T02:00:01Z',
      })
      const user = userEvent.setup()
      render(<SpecialistAppointmentDecisionPanel />)
      await screen.findAllByText(/Lan Anh/)

      await user.click(
        screen.getByRole('button', { name: /Xem chi tiết phiên/ }),
      )
      const drawer = await screen.findByRole('dialog', {
        name: 'Chi tiết phiên',
      })
      expect(drawer).toHaveTextContent('Lan Anh')
      expect(drawer).toHaveTextContent('Chat trong ứng dụng')
      expect(drawer).toHaveTextContent('Đã xác nhận')
      expect(drawer).toHaveTextContent('Bạn đã xác nhận lịch hẹn')
      expect(
        within(drawer).getByRole('link', { name: 'Mở hồ sơ chuẩn bị phiên' }),
      ).toHaveAttribute(
        'href',
        `/specialist/clients?appointmentId=${confirmed.id}`,
      )
      expect(
        within(drawer).getByRole('link', { name: 'Mở cuộc trò chuyện' }),
      ).toHaveAttribute(
        'href',
        `/specialist/messages?appointmentId=${confirmed.id}`,
      )
      expect(
        within(drawer).queryByRole('link', { name: 'Xem tổng kết phiên' }),
      ).not.toBeInTheDocument()
    })

    it('keeps the open drawer filled when a refresh drops its appointment', async () => {
      continuity.specialistContinuity.mockResolvedValue({
        items: [{ appointmentId: confirmed.id, userDisplayName: 'Lan Anh' }],
      })
      api.assigned
        .mockResolvedValueOnce({
          items: [confirmed],
          count: 1,
          generatedAt: '2099-09-25T02:00:01Z',
        })
        .mockResolvedValue({
          items: [],
          count: 0,
          generatedAt: '2099-09-25T02:00:31Z',
        })
      const user = userEvent.setup()
      render(<SpecialistAppointmentDecisionPanel />)
      await user.click(
        await screen.findByRole('button', {
          name: /Xem chi tiết phiên, Lan Anh/,
        }),
      )
      const drawer = await screen.findByRole('dialog', {
        name: 'Chi tiết phiên',
      })

      act(() => {
        window.dispatchEvent(new CustomEvent(NOTIFICATIONS_UPDATED_EVENT))
      })
      await screen.findByText('Chưa có yêu cầu lịch hẹn')
      expect(drawer).toHaveTextContent('Lan Anh')
      expect(drawer).toHaveTextContent('Bạn đã xác nhận lịch hẹn')
    })

    it('hides the drawer link list when the session has nowhere to go', async () => {
      api.assigned.mockResolvedValue({
        items: [{ ...requested, status: 'REJECTED' as const }],
        count: 1,
        generatedAt: '2099-09-25T02:00:01Z',
      })
      const user = userEvent.setup()
      render(<SpecialistAppointmentDecisionPanel />)
      await user.click(
        await screen.findByRole('button', { name: /Xem chi tiết phiên/ }),
      )
      const drawer = await screen.findByRole('dialog', {
        name: 'Chi tiết phiên',
      })
      expect(
        within(drawer).queryByRole('navigation', { name: 'Đi tới' }),
      ).not.toBeInTheDocument()
    })

    it('offers the summary link for a completed video session and shows who cancelled', async () => {
      api.assigned.mockResolvedValue({
        items: [
          {
            ...confirmed,
            status: 'COMPLETED' as const,
            modality: 'IN_APP_VIDEO' as const,
          },
          {
            ...requested,
            id: '30a7e5d8-7960-42fb-9706-e642f849b78f',
            status: 'CANCELLED' as const,
            cancelledAt: '2099-09-25T03:00:00Z',
            cancellationReason: 'USER_CANCELLED' as const,
            cancellationActor: 'USER' as const,
          },
        ],
        count: 2,
        generatedAt: '2099-09-25T02:00:01Z',
      })
      const user = userEvent.setup()
      render(<SpecialistAppointmentDecisionPanel />)
      const buttons = await screen.findAllByRole('button', {
        name: /Xem chi tiết phiên/,
      })

      await user.click(buttons[1])
      let drawer = await screen.findByRole('dialog', { name: 'Chi tiết phiên' })
      expect(
        within(drawer).getByRole('link', { name: 'Xem tổng kết phiên' }),
      ).toBeInTheDocument()
      expect(
        within(drawer).getByRole('link', { name: 'Xem phiên tư vấn video' }),
      ).toHaveAttribute(
        'href',
        `/specialist/appointments/${confirmed.id}/video`,
      )
      await user.click(
        within(drawer).getByRole('button', { name: 'Đóng chi tiết phiên' }),
      )

      await user.click(buttons[0])
      drawer = await screen.findByRole('dialog', { name: 'Chi tiết phiên' })
      expect(drawer).toHaveTextContent('Khách hàng đã hủy lịch hẹn')
    })
  })

  it('lists groups in specialist order: in progress, upcoming, requests, ended, history', async () => {
    const base = { ...requested, decidedAt: '2099-09-25T03:00:00Z' }
    api.assigned.mockResolvedValue({
      items: [
        { ...base, id: 'h', status: 'COMPLETED' },
        requested,
        { ...base, id: 'c', status: 'CONFIRMED' },
        { ...base, id: 'e', status: 'SESSION_ENDED' },
        { ...base, id: 'p', status: 'IN_PROGRESS' },
      ],
      count: 5,
      generatedAt: '2099-09-25T02:00:01Z',
    })
    render(<SpecialistAppointmentDecisionPanel />)
    await screen.findByText('CHỜ BẠN PHẢN HỒI')

    expect(
      screen
        .getAllByRole('heading', { level: 3 })
        .filter((heading) => heading.id.startsWith('group-'))
        .map((heading) => heading.textContent),
    ).toEqual([
      'ĐANG DIỄN RA',
      'ĐÃ XÁC NHẬN, SẮP TỚI',
      'CHỜ BẠN PHẢN HỒI',
      'ĐÃ KẾT THÚC, CHỜ KẾT QUẢ',
      'LỊCH SỬ & ĐÃ HỦY',
    ])
  })
})
