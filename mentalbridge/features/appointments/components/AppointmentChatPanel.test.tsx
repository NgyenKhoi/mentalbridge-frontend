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
        onAcknowledgement?: (ack: { commandId: string }) => void
      }
    | undefined,
}))

vi.mock('../api/chat-browser-client', () => api)
vi.mock('@/lib/realtime', () => ({
  createCheckInCommand: vi.fn(() => ({ commandType: 'conversation.check-in' })),
  createHeartbeatCommand: vi.fn(() => ({ commandType: 'presence.heartbeat' })),
  createMessageCommand: vi.fn((_id: string, content: string) => ({
    commandType: 'message.send',
    commandId: '20000000-0000-4000-8000-000000000050',
    payload: {
      clientMessageId: '20000000-0000-4000-8000-000000000051',
      content,
    },
  })),
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
    realtime.sendMessage.mockReset().mockResolvedValue('sent')
    realtime.checkIn.mockReset().mockResolvedValue('sent')
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
    await waitFor(() => expect(realtime.connect).toHaveBeenCalledOnce())
    expect(realtime.checkIn).not.toHaveBeenCalled()
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

  it('specialist readonly uses a clear state instead of a disabled fake composer', async () => {
    api.chatEligibility.mockResolvedValue({
      ...baseDecision,
      phase: 'COMPLETED',
      subscribeAllowed: false,
      checkInAllowed: false,
      creditState: 'CONSUMED',
    })
    render(
      <AppointmentChatPanel
        appointmentId={appointmentId}
        viewerRole="SPECIALIST"
      />,
    )
    expect(
      await screen.findByText('Cuộc trò chuyện hiện ở chế độ chỉ đọc.'),
    ).toBeVisible()
    expect(
      screen.queryByRole('textbox', { name: 'Tin nhắn' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Mở Sau tư vấn' })).toHaveAttribute(
      'href',
      `/specialist/follow-up?appointmentId=${appointmentId}`,
    )
    expect(realtime.connect).not.toHaveBeenCalled()
  })

  it('protects Vietnamese composition and retains the draft on send failure', async () => {
    api.chatEligibility.mockResolvedValue({
      ...baseDecision,
      phase: 'ACTIVE',
      sendAllowed: true,
    })
    realtime.sendMessage.mockResolvedValue('blocked')
    render(
      <AppointmentChatPanel
        appointmentId={appointmentId}
        viewerRole="SPECIALIST"
      />,
    )
    const input = await screen.findByRole('textbox', { name: 'Tin nhắn' })
    await waitFor(() => expect(realtime.connect).toHaveBeenCalled())
    fireEvent.change(input, { target: { value: 'Tôi đang gõ tiếng Việt' } })
    fireEvent.compositionStart(input)
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 })
    expect(realtime.sendMessage).not.toHaveBeenCalled()
    fireEvent.compositionEnd(input)
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    expect(realtime.sendMessage).not.toHaveBeenCalled()
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Bản nháp vẫn được giữ',
    )
    expect(input).toHaveValue('Tôi đang gõ tiếng Việt')
  })

  it('serializes pending sends and clears only after acknowledgment', async () => {
    api.chatEligibility.mockResolvedValue({
      ...baseDecision,
      phase: 'ACTIVE',
      sendAllowed: true,
    })
    let resolveSend!: (result: string) => void
    realtime.sendMessage.mockReturnValue(
      new Promise((resolve) => {
        resolveSend = resolve
      }),
    )
    render(
      <AppointmentChatPanel
        appointmentId={appointmentId}
        viewerRole="SPECIALIST"
      />,
    )
    const input = await screen.findByRole('textbox', { name: 'Tin nhắn' })
    await waitFor(() => expect(realtime.connect).toHaveBeenCalled())
    fireEvent.change(input, { target: { value: 'Bản nháp chưa gửi' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(realtime.sendMessage).toHaveBeenCalledTimes(1)
    expect(input).toHaveValue('Bản nháp chưa gửi')
    expect(input).toBeDisabled()
    await act(async () => resolveSend('sent'))
    expect(input).toHaveValue('Bản nháp chưa gửi')
    act(() =>
      transport.options?.onAcknowledgement?.({
        commandId: '20000000-0000-4000-8000-000000000050',
      }),
    )
    expect(input).toHaveValue('')
  })

  it('clears protected history when the latest eligibility no longer permits it', async () => {
    api.chatEligibility.mockResolvedValue({
      ...baseDecision,
      phase: 'ENDED_PROCESSING',
      subscribeAllowed: false,
      checkInAllowed: false,
    })
    api.chatHistory.mockResolvedValue({
      items: [
        {
          messageId: 'm1',
          conversationId: appointmentId,
          senderId: baseDecision.userAccountId,
          content: 'Lịch sử riêng tư',
          sentAt: baseDecision.scheduledStartAt,
        },
      ],
      hasMore: false,
      nextCursor: null,
    })
    render(
      <AppointmentChatPanel
        appointmentId={appointmentId}
        viewerRole="SPECIALIST"
      />,
    )
    expect(await screen.findByText('Lịch sử riêng tư')).toBeVisible()
    api.chatEligibility.mockResolvedValue({
      ...baseDecision,
      historyAllowed: false,
      subscribeAllowed: false,
      sendAllowed: false,
      checkInAllowed: false,
    })
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại phòng chat' }))
    await waitFor(() =>
      expect(screen.queryByText('Lịch sử riêng tư')).not.toBeInTheDocument(),
    )
    expect(realtime.connect).not.toHaveBeenCalled()
  })
})
