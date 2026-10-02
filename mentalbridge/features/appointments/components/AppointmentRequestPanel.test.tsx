import { render, screen, waitFor } from '@testing-library/react'
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

function formatSlotInSnapshotTimezone(start: string, end: string) {
  const date = new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeZone: timezone,
  }).format(new Date(start))
  const time = new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  })
  return `${date} · ${time.format(new Date(start))} – ${time.format(new Date(end))}`
}

describe('AppointmentRequestPanel', () => {
  beforeAll(() => {
    process.env.TZ = 'America/New_York'
  })

  beforeEach(() => vi.clearAllMocks())

  afterAll(() => {
    if (originalTimezone === undefined) delete process.env.TZ
    else process.env.TZ = originalTimezone
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

    const snapshotStart = formatInSnapshotTimezone(appointmentStart)
    const deviceStart = new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(appointmentStart))
    expect(snapshotStart).not.toBe(deviceStart)
    expect((await screen.findAllByText(snapshotStart)).length).toBeGreaterThan(
      0,
    )
    expect(screen.getAllByText('Đang diễn ra')).toHaveLength(2)
    expect(
      screen.getByRole('link', {
        name: /Mở tin nhắn với Appointment specialist/,
      }),
    ).toHaveAttribute('href', `/messages?appointmentId=${appointment.id}`)
    expect(
      screen.queryByText(formatInSnapshotTimezone(decisionDeadline)),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(formatSlotInSnapshotTimezone(slotStart, slotEnd)),
    ).toBeInTheDocument()
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

    const historyFilter = await screen.findByRole('button', {
      name: 'Lịch sử',
    })
    await user.click(historyFilter)

    expect(historyFilter).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Hiển thị 1 lịch hẹn')).toBeInTheDocument()
    expect(screen.getByText('Historical specialist')).toBeInTheDocument()
    expect(screen.getByText('Cuộc hẹn tiếp theo')).toBeInTheDocument()
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
    expect(screen.getByText('Chưa thể tải khung giờ')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument()
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

    expect(await screen.findByText('Slot specialist')).toBeInTheDocument()
    expect(screen.getByText('Chưa thể tải lịch hẹn')).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: /Yêu cầu lịch hẹn với Slot specialist/,
      }),
    ).toBeInTheDocument()
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
    render(<AppointmentRequestPanel />)

    await user.click(
      await screen.findByRole('button', { name: /Hủy lịch hẹn với/ }),
    )

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
    render(<AppointmentRequestPanel />)

    await user.click(
      await screen.findByRole('button', { name: /Đổi lịch hẹn với/ }),
    )
    expect(screen.getByText(/chỉ được hủy khi yêu cầu mới/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Đổi lịch sang/ }))

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
    render(<AppointmentRequestPanel />)

    await user.click(
      await screen.findByRole('button', { name: /Đổi lịch hẹn với/ }),
    )

    expect(
      screen.getByText(/lượt tư vấn cũ sẽ không được hoàn lại/),
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
        <AppointmentRequestPanel />
      </FeedbackProvider>,
    )

    await user.click(
      await screen.findByRole('button', { name: /Đổi lịch hẹn với/ }),
    )
    expect(
      screen.queryByText(/lượt tư vấn cũ sẽ không được hoàn lại/),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Đổi lịch sang/ }))

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
