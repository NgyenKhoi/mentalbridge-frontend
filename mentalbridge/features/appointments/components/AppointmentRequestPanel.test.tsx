import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { FeedbackProvider } from '@/components/ui/FeedbackProvider'
import AppointmentRequestPanel from './AppointmentRequestPanel'

const appointmentClient = vi.hoisted(() => ({
  cancel: vi.fn(),
  list: vi.fn(),
  request: vi.fn(),
  slots: vi.fn(),
}))

vi.mock('../api/browser-client', () => ({
  appointmentBrowserClient: appointmentClient,
}))

vi.mock('./ConsultationBriefEditor', () => ({
  ConsultationBriefEditor: ({ appointmentId }: { appointmentId: string }) => (
    <div data-testid={`consultation-brief-${appointmentId}`} />
  ),
}))

vi.mock('./SessionSummaryPanel', () => ({
  SessionSummaryPanel: ({ appointmentId }: { appointmentId: string }) => (
    <div data-testid={`session-summary-${appointmentId}`} />
  ),
}))

const timezone = 'Asia/Ho_Chi_Minh'
const slotStart = '2099-01-02T02:00:00Z'
const slotEnd = '2099-01-02T03:00:00Z'
const appointmentStart = '2099-01-03T04:00:00Z'
const decisionDeadline = '2099-01-01T05:00:00Z'
const originalTimezone = process.env.TZ

const slot = {
  id: '123e4567-e89b-42d3-a456-426614174001',
  specialistAccountId: '123e4567-e89b-42d3-a456-426614174002',
  specialistDisplayName: 'Slot specialist',
  startAt: slotStart,
  endAt: slotEnd,
  timezone,
  modality: 'IN_APP_CHAT' as const,
}

const appointment = {
  id: '123e4567-e89b-42d3-a456-426614174003',
  slotId: '123e4567-e89b-42d3-a456-426614174004',
  specialistAccountId: '123e4567-e89b-42d3-a456-426614174005',
  specialistDisplayName: 'Appointment specialist',
  status: 'REQUESTED' as const,
  modality: 'IN_APP_CHAT' as const,
  scheduledStartAt: appointmentStart,
  scheduledEndAt: '2099-01-03T05:00:00Z',
  timezone,
  requestedAt: '2099-01-01T00:00:00Z',
  decisionDeadlineAt: decisionDeadline,
  heldCreditId: '123e4567-e89b-42d3-a456-426614174006',
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

function formatInSnapshotTimezone(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(value))
}

function formatSlotTimeInSnapshotTimezone(start: string, end: string) {
  const time = new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  })
  return `${time.format(new Date(start))} – ${time.format(new Date(end))}`
}

describe('AppointmentRequestPanel', () => {
  beforeAll(() => {
    process.env.TZ = 'America/New_York'
  })

  beforeEach(() => vi.clearAllMocks())

  it.each(['CONFIRMED', 'SESSION_ENDED'] as const)(
    'opens %s video in its dedicated room without inline media and with the visible action in its accessible name',
    async (status) => {
      appointmentClient.slots.mockResolvedValue({
        items: [],
        count: 0,
        generatedAt: '2099-01-01T00:00:00Z',
        videoEnabled: true,
      })
      appointmentClient.list.mockResolvedValue({
        items: [
          {
            ...appointment,
            modality: 'IN_APP_VIDEO',
            status,
            decidedAt: '2099-01-01T01:00:00Z',
            decisionReason: 'SPECIALIST_ACCEPTED',
            version: 1,
          },
        ],
        count: 1,
        generatedAt: '2099-01-01T00:00:00Z',
      })
      render(<AppointmentRequestPanel focusAppointmentId={appointment.id} />)
      expect(
        await screen.findByRole('link', {
          name:
            status === 'CONFIRMED'
              ? /Mở phòng tư vấn với Appointment specialist/
              : /Xem phiên tư vấn video với Appointment specialist/,
        }),
      ).toHaveAttribute('href', `/appointments/${appointment.id}/video`)
      expect(
        screen.queryByRole('region', { name: 'Cuộc gọi tư vấn' }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Tham gia phiên tư vấn' }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('link', { name: /Mở tin nhắn/ }),
      ).not.toBeInTheDocument()
    },
  )

  afterAll(() => {
    if (originalTimezone === undefined) delete process.env.TZ
    else process.env.TZ = originalTimezone
  })

  it('shows no invented appointments or slots when the account has none', async () => {
    appointmentClient.slots.mockResolvedValue({
      items: [],
      count: 0,
      generatedAt: '2026-10-16T00:00:00Z',
      videoEnabled: false,
    })
    appointmentClient.list.mockResolvedValue({
      items: [],
      count: 0,
      generatedAt: '2026-10-16T00:00:00Z',
    })
    render(<AppointmentRequestPanel />)

    expect(
      await screen.findByText(
        'Bạn chưa có lịch hẹn nào. Chọn một khung giờ trống để bắt đầu.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: 'Cuộc hẹn kế tiếp' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Tất cả (0)' })).toBeInTheDocument()
    expect(
      screen.getByText('Ngày này chưa có khung giờ trống.'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/ThS\. BS\. Minh Anh/)).not.toBeInTheDocument()
  })

  it('renders slots and appointments in their timezone snapshot', async () => {
    appointmentClient.slots.mockResolvedValue({
      items: [slot],
      count: 1,
      generatedAt: '2099-01-01T00:00:00Z',
      videoEnabled: false,
    })
    appointmentClient.list.mockResolvedValue({
      items: [
        {
          ...appointment,
          status: 'IN_PROGRESS',
          decidedAt: '2099-01-01T01:00:00Z',
          decisionReason: 'SPECIALIST_ACCEPTED',
          version: 1,
        },
      ],
      count: 1,
      generatedAt: '2099-01-01T00:00:00Z',
    })

    render(<AppointmentRequestPanel />)

    const snapshotStart = formatSlotTimeInSnapshotTimezone(
      appointmentStart,
      appointment.scheduledEndAt,
    )
    const deviceStart = new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(appointmentStart))
    expect(snapshotStart).not.toBe(deviceStart)
    expect((await screen.findAllByText(snapshotStart)).length).toBeGreaterThan(
      0,
    )
    expect(screen.getByText('Đang diễn ra')).toBeInTheDocument()
    expect(
      screen.getByRole('link', {
        name: 'Mở tin nhắn',
      }),
    ).toHaveAttribute('href', `/messages?appointmentId=${appointment.id}`)
    expect(
      screen.queryByText(formatInSnapshotTimezone(decisionDeadline)),
    ).not.toBeInTheDocument()
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Xác nhận đặt khung giờ này' }))
    expect(
      within(
        screen.getByRole('dialog', { name: 'Chọn khung giờ tư vấn' }),
      ).getByRole('button', { name: /Slot specialist/ }),
    ).toHaveTextContent(formatSlotTimeInSnapshotTimezone(slotStart, slotEnd))
  })

  it('filters the appointment list without hiding the next appointment context', async () => {
    const historicalAppointment = {
      ...appointment,
      id: '523e4567-e89b-42d3-a456-426614174003',
      specialistDisplayName: 'Historical specialist',
      status: 'COMPLETED' as const,
      creditState: 'CONSUMED' as const,
      version: 2,
    }
    appointmentClient.slots.mockResolvedValue({
      items: [],
      count: 0,
      generatedAt: '2099-01-01T00:00:00Z',
      videoEnabled: false,
    })
    appointmentClient.list.mockResolvedValue({
      items: [appointment, historicalAppointment],
      count: 2,
      generatedAt: '2099-01-01T00:00:00Z',
    })
    const user = userEvent.setup()

    render(<AppointmentRequestPanel />)

    const historyFilter = await screen.findByRole('tab', {
      name: /Đã hoàn tất/,
    })
    await user.click(historyFilter)

    expect(historyFilter).toHaveAttribute('aria-selected', 'true')
    expect(
      screen.getByText('Hiển thị 1 trên tổng số 2 cuộc hẹn'),
    ).toBeInTheDocument()
    expect(screen.getByText('Historical specialist')).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', {
        name: /Xem chi tiết lịch hẹn với Historical specialist/,
      }),
    )
    expect(
      screen.getByRole('dialog', { name: 'Chi tiết lịch hẹn' }),
    ).toHaveTextContent('Historical specialist')
    expect(screen.getByRole('tab', { name: 'Sắp tới (1)' })).toBeInTheDocument()
  })

  it('keeps the consultation brief route reachable for a confirmed chat appointment', async () => {
    const confirmed = { ...appointment, status: 'CONFIRMED' as const }
    appointmentClient.slots.mockResolvedValue({
      items: [],
      count: 0,
      generatedAt: '2099-01-01T00:00:00Z',
      videoEnabled: false,
    })
    appointmentClient.list.mockResolvedValue({
      items: [confirmed],
      count: 1,
      generatedAt: '2099-01-01T00:00:00Z',
    })
    const user = userEvent.setup()
    render(<AppointmentRequestPanel />)

    const [openDetails] = await screen.findAllByRole('button', {
      name: /Xem chi tiết lịch hẹn với Appointment specialist/,
    })
    await user.click(openDetails)

    expect(
      screen.getByRole('link', { name: 'Chuẩn bị cho buổi tư vấn' }),
    ).toHaveAttribute('href', `/appointments/${confirmed.id}`)
  })

  it('books an available slot from a popup without navigating away', async () => {
    appointmentClient.slots.mockResolvedValue({
      items: [slot],
      count: 1,
      generatedAt: '2099-01-01T00:00:00Z',
      videoEnabled: false,
    })
    appointmentClient.list.mockResolvedValue({
      items: [],
      count: 0,
      generatedAt: '2099-01-01T00:00:00Z',
    })
    appointmentClient.request.mockResolvedValue(appointment)
    const user = userEvent.setup()
    render(<AppointmentRequestPanel />)

    await user.click(
      await screen.findByRole('button', { name: 'Xác nhận đặt khung giờ này' }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Chọn khung giờ tư vấn' })
    expect(dialog).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Gửi yêu cầu đặt lịch' }),
    ).toBeDisabled()

    await user.click(
      within(dialog).getByRole('button', { name: /Slot specialist/ }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Gửi yêu cầu đặt lịch' }),
    )

    await waitFor(() =>
      expect(appointmentClient.request).toHaveBeenCalledWith(
        slot.id,
        slot.modality,
        expect.stringMatching(/^appointment-/),
        undefined,
        undefined,
      ),
    )
    await waitFor(() => expect(dialog).not.toHaveAttribute('open'))
  })

  it('opens booking from the page header action', async () => {
    appointmentClient.slots.mockResolvedValue({
      items: [slot],
      count: 1,
      generatedAt: '2099-01-01T00:00:00Z',
      videoEnabled: false,
    })
    appointmentClient.list.mockResolvedValue({
      items: [],
      count: 0,
      generatedAt: '2099-01-01T00:00:00Z',
    })
    render(<AppointmentRequestPanel />)

    act(() =>
      window.dispatchEvent(new Event('mentalbridge:open-appointment-booking')),
    )

    expect(
      await screen.findByRole('dialog', { name: 'Chọn khung giờ tư vấn' }),
    ).toBeInTheDocument()
    expect(appointmentClient.slots).toHaveBeenCalled()
  })

  it('opens appointment notes and completed records in dialogs', async () => {
    const ended = {
      ...appointment,
      id: '523e4567-e89b-42d3-a456-426614174003',
      status: 'SESSION_ENDED' as const,
    }
    const completed = {
      ...appointment,
      id: '623e4567-e89b-42d3-a456-426614174003',
      status: 'COMPLETED' as const,
      modality: 'IN_APP_VIDEO' as const,
      sessionSettledAt: '2099-01-03T06:00:00Z',
    }
    appointmentClient.slots.mockResolvedValue({
      items: [],
      count: 0,
      generatedAt: '2099-01-01T00:00:00Z',
      videoEnabled: false,
    })
    appointmentClient.list.mockResolvedValue({
      items: [ended, completed],
      count: 2,
      generatedAt: '2099-01-01T00:00:00Z',
    })
    const user = userEvent.setup()
    render(<AppointmentRequestPanel />)

    await user.click(
      await screen.findByRole('button', { name: 'Xem ghi chú sơ bộ' }),
    )
    expect(
      screen.getByRole('dialog', { name: 'Ghi chú phiên' }),
    ).toBeInTheDocument()
    expect(
      screen.getByTestId(`session-summary-${ended.id}`),
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Đóng chi tiết lịch hẹn' }),
    )

    await user.click(screen.getByRole('button', { name: 'Hồ sơ phiên' }))
    expect(
      screen.getByRole('dialog', { name: 'Hồ sơ phiên' }),
    ).toBeInTheDocument()
    expect(
      screen.getByTestId(`session-summary-${completed.id}`),
    ).toBeInTheDocument()
    // Settled sessions keep their path to the dispute panel on the detail route.
    expect(
      screen.getByRole('link', { name: 'Xem chi tiết và phản hồi kết quả' }),
    ).toHaveAttribute('href', `/appointments/${completed.id}`)
  })

  it('keeps appointments usable when available slots fail to load', async () => {
    appointmentClient.slots.mockRejectedValue(new Error('slots unavailable'))
    appointmentClient.list.mockResolvedValue({
      items: [appointment],
      count: 1,
      generatedAt: '2099-01-01T00:00:00Z',
    })

    render(<AppointmentRequestPanel />)

    expect(
      (await screen.findAllByText('Appointment specialist')).length,
    ).toBeGreaterThan(0)
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Xác nhận đặt khung giờ này' }))
    expect(
      within(
        screen.getByRole('dialog', { name: 'Chọn khung giờ tư vấn' }),
      ).getByRole('alert'),
    ).toHaveTextContent('Chưa thể tải khung giờ.')
    expect(
      within(
        screen.getByRole('dialog', { name: 'Chọn khung giờ tư vấn' }),
      ).getByRole('button', { name: 'Thử lại' }),
    ).toBeInTheDocument()
  })

  it('keeps booking slots usable when appointments fail to load', async () => {
    appointmentClient.slots.mockResolvedValue({
      items: [slot],
      count: 1,
      generatedAt: '2099-01-01T00:00:00Z',
      videoEnabled: false,
    })
    appointmentClient.list.mockRejectedValue(
      new Error('appointments unavailable'),
    )

    render(<AppointmentRequestPanel />)

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Xác nhận đặt khung giờ này' }))
    expect(
      await within(
        screen.getByRole('dialog', { name: 'Chọn khung giờ tư vấn' }),
      ).findByRole('button', { name: /Slot specialist/ }),
    ).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Chưa thể tải lịch hẹn.',
    )
    expect(
      screen.getByRole('button', {
        name: /Xác nhận đặt khung giờ này/,
      }),
    ).toBeInTheDocument()
  })

  it('opens a reminder deep link only for an appointment in the current account', async () => {
    appointmentClient.slots.mockResolvedValue({
      items: [],
      count: 0,
      generatedAt: '2099-01-01T00:00:00Z',
      videoEnabled: false,
    })
    appointmentClient.list.mockResolvedValue({
      items: [{ ...appointment, status: 'CONFIRMED' }],
      count: 1,
      generatedAt: '2099-01-01T00:00:00Z',
    })
    const { rerender } = render(
      <AppointmentRequestPanel focusAppointmentId={appointment.id} />,
    )
    expect(
      (await screen.findAllByText('Appointment specialist')).length,
    ).toBeGreaterThan(0)
    expect(document.getElementById('appointment-from-reminder')).toBeVisible()

    rerender(
      <AppointmentRequestPanel focusAppointmentId="another-appointment" />,
    )
    expect(await screen.findByText('Không tìm thấy lịch hẹn này')).toBeVisible()
  })

  it('shows a recoverable error when loading an appointment detail fails', async () => {
    appointmentClient.slots.mockResolvedValue({ items: [] })
    appointmentClient.list.mockRejectedValueOnce(new Error('unavailable'))
    appointmentClient.list.mockResolvedValue({
      items: [appointment],
      generatedAt: '2099-01-01T00:00:00Z',
    })
    const user = userEvent.setup()
    render(<AppointmentRequestPanel focusAppointmentId={appointment.id} />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chưa thể tải lịch hẹn',
    )
    expect(screen.queryByText('Không tìm thấy lịch hẹn này')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Thử lại' }))

    expect(await screen.findByText('Appointment specialist')).toBeVisible()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('cancels with the exact version and renders the persisted audit outcome after reload', async () => {
    const cancelled = {
      ...appointment,
      status: 'CANCELLED' as const,
      cancelledAt: '2099-01-01T01:00:00Z',
      cancellationReason: 'USER_CANCELLED' as const,
      cancellationActor: 'USER' as const,
      cancellationCreditOutcome: 'RELEASED' as const,
      creditState: 'AVAILABLE' as const,
      history: [
        {
          eventId: '223e4567-e89b-42d3-a456-426614174003',
          fromStatus: 'REQUESTED' as const,
          toStatus: 'CANCELLED' as const,
          actorType: 'USER' as const,
          actorId: '323e4567-e89b-42d3-a456-426614174003',
          reason: 'USER_CANCELLED' as const,
          creditOutcome: 'RELEASED' as const,
          occurredAt: '2099-01-01T01:00:00Z',
        },
      ],
      version: 1,
    }
    appointmentClient.slots.mockResolvedValue({
      items: [slot],
      count: 1,
      generatedAt: '2099-01-01T00:00:00Z',
      videoEnabled: false,
    })
    appointmentClient.list
      .mockResolvedValueOnce({
        items: [appointment],
        count: 1,
        generatedAt: '2099-01-01T00:00:00Z',
      })
      .mockResolvedValueOnce({
        items: [appointment],
        count: 1,
        generatedAt: '2099-01-01T00:59:59Z',
      })
      .mockResolvedValueOnce({
        items: [appointment],
        count: 1,
        generatedAt: '2099-01-01T00:59:59Z',
      })
      .mockResolvedValue({
        items: [cancelled],
        count: 1,
        generatedAt: '2099-01-01T01:00:01Z',
      })
    appointmentClient.cancel.mockResolvedValue(cancelled)
    const user = userEvent.setup()
    render(<AppointmentRequestPanel focusAppointmentId={appointment.id} />)

    await user.click(await screen.findByRole('button', { name: 'Hủy lịch' }))

    await waitFor(() =>
      expect(appointmentClient.cancel).toHaveBeenCalledWith(
        appointment.id,
        0,
        expect.stringMatching(/^appointment-cancel-/),
      ),
    )
    expect(await screen.findByText('Thông tin hủy lịch')).toBeInTheDocument()
    expect(screen.getByText('Đã được hoàn lại')).toBeInTheDocument()
    expect(screen.getByText('Lý do: bạn yêu cầu hủy')).toBeInTheDocument()
  })

  it('carries the old appointment id and version through a replacement request', async () => {
    appointmentClient.slots.mockResolvedValue({
      items: [slot],
      count: 1,
      generatedAt: '2099-01-01T00:00:00Z',
      videoEnabled: false,
    })
    appointmentClient.list.mockResolvedValue({
      items: [appointment],
      count: 1,
      generatedAt: '2099-01-01T00:00:00Z',
    })
    appointmentClient.request.mockResolvedValue({
      ...appointment,
      id: '423e4567-e89b-42d3-a456-426614174003',
      slotId: slot.id,
      replacesAppointmentId: appointment.id,
    })
    const user = userEvent.setup()
    render(<AppointmentRequestPanel focusAppointmentId={appointment.id} />)

    await user.click(await screen.findByRole('button', { name: 'Đổi lịch' }))
    expect(screen.getByText(/chỉ được hủy khi yêu cầu mới/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Slot specialist/ }))
    await user.click(
      screen.getByRole('button', { name: 'Gửi yêu cầu đổi lịch' }),
    )

    await waitFor(() =>
      expect(appointmentClient.request).toHaveBeenCalledWith(
        slot.id,
        slot.modality,
        expect.stringMatching(/^appointment-/),
        appointment.id,
        appointment.version,
      ),
    )
  })

  it('warns when rescheduling a confirmed appointment inside the 24-hour window', async () => {
    appointmentClient.slots.mockResolvedValue({
      items: [slot],
      count: 1,
      generatedAt: '2099-01-03T00:00:00Z',
      videoEnabled: false,
    })
    appointmentClient.list.mockResolvedValue({
      items: [
        {
          ...appointment,
          status: 'CONFIRMED',
          decidedAt: '2099-01-02T00:00:00Z',
          decisionReason: 'SPECIALIST_ACCEPTED',
          version: 1,
        },
      ],
      count: 1,
      generatedAt: '2099-01-03T00:00:00Z',
    })
    const user = userEvent.setup()
    render(<AppointmentRequestPanel focusAppointmentId={appointment.id} />)

    await user.click(await screen.findByRole('button', { name: 'Đổi lịch' }))

    expect(
      screen.getByText(/lượt tư vấn cũ sẽ không được hoàn lại/i),
    ).toBeInTheDocument()
  })

  it('reconciles timing after crossing T-24h before submitting a replacement', async () => {
    const confirmed = {
      ...appointment,
      status: 'CONFIRMED' as const,
      decidedAt: '2099-01-01T00:30:00Z',
      decisionReason: 'SPECIALIST_ACCEPTED' as const,
      version: 1,
    }
    const reconciled = { ...confirmed, version: 2 }
    const replacement = {
      ...appointment,
      id: '423e4567-e89b-42d3-a456-426614174003',
      slotId: slot.id,
      replacesAppointmentId: appointment.id,
    }
    const cancelled = {
      ...reconciled,
      status: 'CANCELLED' as const,
      replacedByAppointmentId: replacement.id,
      cancelledAt: '2099-01-02T04:00:02Z',
      cancellationReason: 'USER_RESCHEDULED' as const,
      cancellationActor: 'USER' as const,
      cancellationCreditOutcome: 'FORFEITED' as const,
      creditState: 'FORFEITED' as const,
      version: 3,
    }
    appointmentClient.slots.mockResolvedValue({
      items: [slot],
      count: 1,
      generatedAt: '2099-01-02T03:59:59Z',
      videoEnabled: false,
    })
    appointmentClient.list
      .mockResolvedValueOnce({
        items: [confirmed],
        count: 1,
        generatedAt: '2099-01-02T03:59:59Z',
      })
      .mockResolvedValueOnce({
        items: [reconciled],
        count: 1,
        generatedAt: '2099-01-02T04:00:01Z',
      })
      .mockResolvedValueOnce({
        items: [reconciled],
        count: 1,
        generatedAt: '2099-01-02T04:00:01Z',
      })
      .mockResolvedValue({
        items: [cancelled, replacement],
        count: 2,
        generatedAt: '2099-01-02T04:00:03Z',
      })
    appointmentClient.request.mockResolvedValue(replacement)
    const user = userEvent.setup()
    render(
      <FeedbackProvider>
        <AppointmentRequestPanel focusAppointmentId={appointment.id} />
      </FeedbackProvider>,
    )

    await user.click(await screen.findByRole('button', { name: 'Đổi lịch' }))
    expect(
      screen.queryByText(/lượt tư vấn cũ sẽ không được hoàn lại/),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Slot specialist/ }))
    await user.click(
      screen.getByRole('button', { name: 'Gửi yêu cầu đổi lịch' }),
    )

    expect(
      await screen.findByText(
        /Lượt tư vấn cũ sẽ không được hoàn lại, và lịch mới cần một lượt tư vấn đủ điều kiện khác/,
      ),
    ).toBeInTheDocument()
    expect(appointmentClient.request).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Tiếp tục đổi lịch' }))

    await waitFor(() =>
      expect(appointmentClient.request).toHaveBeenCalledWith(
        slot.id,
        slot.modality,
        expect.stringMatching(/^appointment-/),
        appointment.id,
        2,
      ),
    )
    expect(
      await screen.findByText(
        'Lượt tư vấn cũ không được hoàn lại theo mốc 24 giờ; lịch mới đã dùng một lượt tư vấn đủ điều kiện khác.',
      ),
    ).toBeInTheDocument()
  })
})
