import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AppointmentChatPanel from './AppointmentChatPanel'

const api = vi.hoisted(() => ({
  chatEligibility: vi.fn(),
  chatHistory: vi.fn(),
  socketCredential: vi.fn(),
}))

const realtime = vi.hoisted(() => ({
  connect: vi.fn(),
  stop: vi.fn(),
  resume: vi.fn(),
  subscribe: vi.fn().mockResolvedValue('sent'),
  sendMessage: vi.fn().mockResolvedValue('sent'),
  checkIn: vi.fn().mockResolvedValue('sent'),
  heartbeat: vi.fn().mockReturnValue('sent'),
}))
const transport = vi.hoisted(() => ({
  options: undefined as
    | {
        onState?: (state: {
          phase: string
          reconnectAttempt: number
          recovery: string
          issue?: { code: string; message: string; retryable: boolean }
        }) => void
      }
    | undefined,
}))

vi.mock('../api/chat-browser-client', () => api)
vi.mock('@/lib/realtime', () => ({
  createCheckInCommand: vi.fn(() => ({ commandType: 'conversation.check-in' })),
  createHeartbeatCommand: vi.fn(() => ({ commandType: 'presence.heartbeat' })),
  createMessageCommand: vi.fn(() => ({ commandType: 'message.send' })),
  createSocketIoFactory: vi.fn(() => vi.fn()),
  createSubscribeCommand: vi.fn(() => ({
    commandType: 'conversation.subscribe',
  })),
  RealtimeTransport: vi.fn((options) => {
    transport.options = options
    return realtime
  }),
}))

const appointmentId = '10a7e5d8-7960-42fb-9706-e642f849b78f'
const baseDecision = {
  conversationId: appointmentId,
  appointmentId,
  userAccountId: '9e3a8903-3d31-48d0-bf1a-4d81bbcef4b8',
  specialistAccountId: '43b7dbb4-021e-4c75-ae48-bfa7126c7256',
  phase: 'WAITING' as const,
  reasonCode: 'APPOINTMENT_WAITING',
  subscribeAllowed: true,
  sendAllowed: false,
  historyAllowed: true,
  checkInAllowed: true,
  participantCheckedIn: false,
  sessionOutcome: null,
  creditState: 'HELD' as const,
  scheduledStartAt: '2099-09-27T02:00:00Z',
  scheduledEndAt: '2099-09-27T03:00:00Z',
  serverTime: '2099-09-27T01:55:00Z',
}

describe('AppointmentChatPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    transport.options = undefined
    api.chatHistory.mockResolvedValue({
      items: [],
      nextCursor: null,
      hasMore: false,
    })
    api.socketCredential.mockResolvedValue({
      accessToken: 'a'.repeat(43),
      expiresAt: '2099-09-27T01:56:00Z',
      endpoint: 'http://localhost:3004/',
    })
  })

  it('enters the waiting room but keeps sending disabled before the start', async () => {
    api.chatEligibility.mockResolvedValue(baseDecision)
    render(<AppointmentChatPanel appointmentId={appointmentId} />)

    expect((await screen.findAllByText(/phòng chờ/i)).length).toBeGreaterThan(0)
    expect(screen.getByRole('textbox', { name: 'Tin nhắn' })).toBeDisabled()
    await waitFor(() => expect(realtime.connect).toHaveBeenCalledOnce())
    expect(realtime.subscribe).toHaveBeenCalledOnce()
  })

  it('enables the composer only while the server reports ACTIVE', async () => {
    api.chatEligibility.mockResolvedValue({
      ...baseDecision,
      phase: 'ACTIVE',
      reasonCode: 'APPOINTMENT_ACTIVE',
      sendAllowed: true,
      serverTime: '2099-09-27T02:05:00Z',
    })
    render(<AppointmentChatPanel appointmentId={appointmentId} />)

    expect(
      (await screen.findAllByText(/đang diễn ra/i)).length,
    ).toBeGreaterThan(0)
    expect(screen.getByRole('textbox', { name: 'Tin nhắn' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Gửi lời chào' }))
    expect(screen.getByRole('textbox', { name: 'Tin nhắn' })).toHaveValue(
      'Chào chuyên gia, mình đã sẵn sàng bắt đầu.',
    )
  })

  it('shows ended history as read-only without opening a socket', async () => {
    api.chatEligibility.mockResolvedValue({
      ...baseDecision,
      phase: 'ENDED_PROCESSING',
      reasonCode: 'SESSION_OUTCOME_PROCESSING',
      subscribeAllowed: false,
      checkInAllowed: false,
      serverTime: '2099-09-27T03:01:00Z',
    })
    render(<AppointmentChatPanel appointmentId={appointmentId} />)

    expect(await screen.findByText(/đang tổng hợp/i)).toBeInTheDocument()
    expect(screen.getByText(/Credit đang được giữ/i)).toBeInTheDocument()
    expect(api.chatHistory).toHaveBeenCalledWith(appointmentId)
    expect(realtime.connect).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox', { name: 'Tin nhắn' })).toBeDisabled()
  })

  it('requires an explicit check-in and then shows the recorded state', async () => {
    api.chatEligibility
      .mockResolvedValueOnce(baseDecision)
      .mockResolvedValue({ ...baseDecision, participantCheckedIn: true })
    render(<AppointmentChatPanel appointmentId={appointmentId} />)

    const button = await screen.findByRole('button', {
      name: 'Xác nhận tham gia',
    })
    fireEvent.click(button)

    await waitFor(() => expect(realtime.checkIn).toHaveBeenCalledOnce())
    expect(await screen.findByText('Đã ghi nhận điểm danh')).toBeInTheDocument()
  })

  it('keeps socket presence alive while waiting for explicit check-in', async () => {
    api.chatEligibility.mockResolvedValue(baseDecision)
    render(<AppointmentChatPanel appointmentId={appointmentId} />)
    await waitFor(() =>
      expect(transport.options?.onState).toBeTypeOf('function'),
    )

    vi.useFakeTimers()
    try {
      act(() =>
        transport.options?.onState?.({
          phase: 'ready',
          reconnectAttempt: 0,
          recovery: 'not-needed',
        }),
      )
      await act(async () => vi.advanceTimersByTimeAsync(15_000))

      expect(realtime.heartbeat).toHaveBeenCalledOnce()
    } finally {
      vi.useRealTimers()
    }
  })

  it('visually distinguishes the current participant messages', async () => {
    api.chatEligibility.mockResolvedValue({
      ...baseDecision,
      phase: 'ACTIVE',
      reasonCode: 'APPOINTMENT_ACTIVE',
      sendAllowed: true,
    })
    api.chatHistory.mockResolvedValue({
      items: [
        {
          messageId: '11111111-1111-4111-8111-111111111111',
          conversationId: appointmentId,
          senderId: baseDecision.specialistAccountId,
          clientMessageId: '22222222-2222-4222-8222-222222222222',
          type: 'TEXT',
          content: 'Tin nhắn từ chuyên gia',
          sentAt: '2099-09-27T02:01:00Z',
          schemaVersion: 1,
        },
        {
          messageId: '33333333-3333-4333-8333-333333333333',
          conversationId: appointmentId,
          senderId: baseDecision.userAccountId,
          clientMessageId: '44444444-4444-4444-8444-444444444444',
          type: 'TEXT',
          content: 'Tin nhắn từ người dùng',
          sentAt: '2099-09-27T02:02:00Z',
          schemaVersion: 1,
        },
      ],
      nextCursor: null,
      hasMore: false,
    })

    render(
      <AppointmentChatPanel
        appointmentId={appointmentId}
        viewerRole="SPECIALIST"
      />,
    )

    expect(await screen.findByLabelText('Tin nhắn của bạn')).toHaveTextContent(
      'Tin nhắn từ chuyên gia',
    )
    expect(screen.getByLabelText('Tin nhắn từ Người dùng')).toHaveTextContent(
      'Tin nhắn từ người dùng',
    )
  })

  it.each([
    ['CANCELLED', 'Lịch hẹn đã bị hủy'],
    ['RESCHEDULED', 'Lịch hẹn đã được đổi'],
  ] as const)('shows %s history as read-only', async (phase, message) => {
    api.chatEligibility.mockResolvedValue({
      ...baseDecision,
      phase,
      reasonCode:
        phase === 'CANCELLED'
          ? 'APPOINTMENT_CANCELLED'
          : 'APPOINTMENT_RESCHEDULED',
      subscribeAllowed: false,
    })
    render(<AppointmentChatPanel appointmentId={appointmentId} />)

    expect(
      await screen.findByText(new RegExp(message, 'i')),
    ).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Tin nhắn' })).toBeDisabled()
    expect(realtime.connect).not.toHaveBeenCalled()
  })

  it('shows reconnecting and a stable exhausted-connection failure', async () => {
    api.chatEligibility.mockResolvedValue(baseDecision)
    render(<AppointmentChatPanel appointmentId={appointmentId} />)
    await waitFor(() =>
      expect(transport.options?.onState).toBeTypeOf('function'),
    )

    act(() =>
      transport.options?.onState?.({
        phase: 'reconnecting',
        reconnectAttempt: 1,
        recovery: 'pending',
      }),
    )
    expect(screen.getByText(/Đang kết nối lại/i)).toBeInTheDocument()

    act(() =>
      transport.options?.onState?.({
        phase: 'disconnected',
        reconnectAttempt: 5,
        recovery: 'failed',
        issue: {
          code: 'RECONNECT_EXHAUSTED',
          message: 'Reconnect attempt limit reached.',
          retryable: true,
        },
      }),
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      /Không thể duy trì kết nối chat/i,
    )
  })
})
