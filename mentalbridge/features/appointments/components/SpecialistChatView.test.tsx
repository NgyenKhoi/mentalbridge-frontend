import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Appointment } from '@/lib/consultation/consultation-validation'
import SpecialistChatView from './SpecialistChatView'

const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  pathname: '/messages',
}))

const appointmentApi = vi.hoisted(() => ({
  list: vi.fn(),
  assigned: vi.fn(),
}))

const sessionSummaryApi = vi.hoisted(() => ({
  list: vi.fn(),
}))

const briefApi = vi.hoisted(() => ({
  get: vi.fn(),
}))

const chatApi = vi.hoisted(() => ({
  chatEligibility: vi.fn(),
  chatHistory: vi.fn(),
}))

const assessmentApi = vi.hoisted(() => ({
  getAssessmentHistory: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace, push: navigation.push }),
}))

vi.mock('../api/browser-client', () => ({
  appointmentBrowserClient: appointmentApi,
}))

vi.mock('../api/session-summary-browser-client', () => ({
  sessionSummaryBrowserClient: sessionSummaryApi,
}))

vi.mock('../api/consultation-brief-browser-client', () => ({
  consultationBriefBrowserClient: briefApi,
}))

vi.mock('../api/chat-browser-client', () => ({
  chatEligibility: (...args: unknown[]) => chatApi.chatEligibility(...args),
  chatHistory: (...args: unknown[]) => chatApi.chatHistory(...args),
}))

vi.mock('@/features/assessment/api/browser-care', () => ({
  getAssessmentHistory: (...args: unknown[]) =>
    assessmentApi.getAssessmentHistory(...args),
}))

vi.mock('./AppointmentChatPanel', () => ({
  default: ({ appointmentId }: { appointmentId: string }) => (
    <div data-testid="realtime-chat-panel">{appointmentId}</div>
  ),
}))

const testAppointment: Appointment = {
  id: '40b3dce0-1d5d-44a2-81dd-b8e0dd9fb377',
  slotId: '22222222-2222-4222-8222-222222222222',
  specialistAccountId: 'fff240fb-44b2-4d95-aa23-31ef3b903e5c',
  specialistDisplayName: 'ThS. BS. Minh Anh',
  status: 'COMPLETED',
  modality: 'IN_APP_CHAT',
  scheduledStartAt: '2026-10-01T15:55:00Z',
  scheduledEndAt: '2026-10-01T16:55:00Z',
  timezone: 'Asia/Ho_Chi_Minh',
  requestedAt: '2026-09-30T10:00:00Z',
  decisionDeadlineAt: '2026-10-01T10:00:00Z',
  heldCreditId: 'credit-123',
  replacesAppointmentId: null,
  replacedByAppointmentId: null,
  decidedAt: '2026-09-30T12:00:00Z',
  decisionReason: 'SPECIALIST_ACCEPTED',
  cancelledAt: null,
  cancellationReason: null,
  cancellationActor: null,
  cancellationCreditOutcome: null,
  sessionOutcome: 'COMPLETED',
  sessionOutcomeReason: null,
  sessionPolicyVersion: 'chat-session-completion-v1',
  sessionEndedAt: '2026-10-01T16:55:00Z',
  sessionSettledAt: '2026-10-01T17:00:00Z',
  completionFactId: 'fact-1',
  creditState: 'CONSUMED',
  history: [
    {
      eventId: 'event-confirmed',
      fromStatus: 'REQUESTED',
      toStatus: 'CONFIRMED',
      actorType: 'SPECIALIST',
      actorId: null,
      reason: 'SPECIALIST_ACCEPTED',
      creditOutcome: null,
      occurredAt: '2026-09-30T12:00:00Z',
    },
  ],
  version: 2,
}

describe('SpecialistChatView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    navigation.pathname = '/messages'
    appointmentApi.list.mockResolvedValue({
      items: [testAppointment],
      count: 1,
      generatedAt: '2026-10-01T17:00:00Z',
    })
    sessionSummaryApi.list.mockResolvedValue({
      items: [
        {
          id: 'summary-1',
          appointmentId: testAppointment.id,
          specialistAccountId: testAppointment.specialistAccountId,
          summaryMarkdown: 'Tóm tắt phiên tham vấn lâm sàng',
          clinicalNoteMarkdown: 'Bệnh nhân đáp ứng tốt với bài tập thở',
          keyObservations: ['Lo âu giảm sau can thiệp'],
          homeworkRecommendations: ['Tập thở 4-7-8', 'Xả não trước khi ngủ'],
          createdAt: '2026-10-01T17:00:00Z',
          updatedAt: '2026-10-01T17:00:00Z',
          publishedToUserAt: '2026-10-01T17:00:00Z',
          specialistNoteForUser: 'Duy trì bài tập thở mỗi tối',
          agreedNextSteps: [
            {
              stepId: 'step-1',
              title: 'Thực hành tập thở 4-7-8',
              state: 'COMPLETED',
            },
          ],
        },
      ],
      count: 1,
    })
    briefApi.get.mockResolvedValue({
      consultationBriefId: 'brief-1',
      appointmentId: testAppointment.id,
      userAccountId: '037b2133-09a0-4fb1-8ebd-39e0f91c057e',
      situation: 'Căng thẳng do công việc dạo gần đây và khó ngủ',
      goals: ['Cải thiện chất lượng giấc ngủ', 'Hạ bớt căng thẳng'],
      createdAt: '2026-10-01T10:00:00Z',
    })
    chatApi.chatEligibility.mockResolvedValue({
      historyAllowed: true,
      sendAllowed: false,
      conversationId: 'conv-123',
    })
    chatApi.chatHistory.mockResolvedValue({
      items: [
        {
          messageId: 'msg-1',
          conversationId: 'conv-123',
          senderId: testAppointment.specialistAccountId,
          recipientId: 'user-1',
          content: 'Chào bạn, tôi là BS. Minh Anh',
          sentAt: '2026-10-01T16:00:00Z',
          deliveryState: 'SENT',
        },
      ],
    })
    assessmentApi.getAssessmentHistory.mockResolvedValue([])
  })

  it('renders the 3-column layout with appointments and specialist info', async () => {
    render(
      <SpecialistChatView
        initialAppointmentId={testAppointment.id}
        viewerRole="USER"
      />,
    )

    // Col 1: Appointments List
    expect(
      await screen.findByRole('heading', { name: /Cuộc trò chuyện/i }),
    ).toBeVisible()
    expect(await screen.findAllByText('Đã hoàn thành')).not.toHaveLength(0)
    expect(screen.queryByText('Đã xong')).not.toBeInTheDocument()
    expect(
      screen.getAllByText('ThS. BS. Minh Anh').length,
    ).toBeGreaterThanOrEqual(1)

    // Col 2: Chat Main Area (no fake presence, no mock specialist tabs)
    expect(screen.queryByText('Đang trực tuyến')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Bác sĩ' })).toBeNull()
    expect(
      screen.getByRole('heading', { level: 1, name: 'ThS. BS. Minh Anh' }),
    ).toBeVisible()
    // No invented affiliation or specialty line.
    expect(screen.queryByText(/Khoa |BV ĐHYD/)).not.toBeInTheDocument()
    expect(screen.getByText(/Thời lượng:/i)).toBeVisible()
    expect(
      screen.getByText('Phiên đã kết thúc. Khung chat chỉ đọc.'),
    ).toBeVisible()

    // Col 3: the appointment info drawer is initially open
    expect(screen.getByText('Thông tin buổi hẹn')).toBeVisible()
    await waitFor(() =>
      expect(
        within(document.getElementById('appointment-info-drawer')!).getByText(
          'Chat trực tuyến',
        ),
      ).toBeVisible(),
    )
    // The summary loads after the appointment: wait for it instead of racing it.
    expect(
      await within(
        document.getElementById('appointment-info-drawer')!,
      ).findByText('Duy trì bài tập thở mỗi tối'),
    ).toBeVisible()
    expect(screen.getByText('Bước tiếp theo')).toBeVisible()
    expect(screen.getAllByText('Đã dùng 1 buổi tư vấn')[0]).toBeVisible()
  })

  it('shows no EMR, clinical, invoice, PDF or AI-pill content', async () => {
    render(
      <SpecialistChatView
        initialAppointmentId={testAppointment.id}
        viewerRole="USER"
      />,
    )

    expect(
      (await screen.findAllByText('Đã dùng 1 buổi tư vấn'))[0],
    ).toBeVisible()
    const text = document.body.textContent ?? ''
    for (const banned of [
      /EMR/,
      /lâm sàng/i,
      /bệnh án/i,
      /INV-MB/,
      /#MB-/,
      /Credit/,
      /Xuất PDF/,
      /Hóa đơn/i,
      /Tâm sự 24\/7/,
    ]) {
      expect(text).not.toMatch(banned)
    }
    expect(screen.queryByRole('link', { name: /Tâm sự/ })).toBeNull()
  })

  it('never prints a raw modality enum', async () => {
    appointmentApi.list.mockResolvedValue({
      items: [testAppointment],
      count: 1,
      generatedAt: '2026-10-01T17:00:00Z',
    })
    render(
      <SpecialistChatView
        initialAppointmentId={testAppointment.id}
        viewerRole="USER"
      />,
    )

    expect(
      await within(
        document.getElementById('appointment-info-drawer')!,
      ).findByText('Chat trực tuyến'),
    ).toBeVisible()
    expect(document.body.textContent).not.toMatch(/IN_APP_/)
  })

  it.each([
    ['CONFIRMED', 'Đã xác nhận'],
    ['CANCELLED', 'Đã hủy'],
  ] as const)(
    'labels a %s booking whose end time has passed like /appointments, never "Sắp tới"',
    async (status, label) => {
      appointmentApi.list.mockResolvedValue({
        items: [
          {
            ...testAppointment,
            status,
            scheduledStartAt: '2020-01-01T08:00:00Z',
            scheduledEndAt: '2020-01-01T09:00:00Z',
          },
        ],
        count: 1,
        generatedAt: '2026-10-01T17:00:00Z',
      })
      render(
        <SpecialistChatView
          initialAppointmentId={testAppointment.id}
          viewerRole="USER"
        />,
      )

      expect((await screen.findAllByText(label)).length).toBeGreaterThanOrEqual(
        1,
      )
      expect(screen.queryByText('Sắp tới')).not.toBeInTheDocument()
    },
  )

  it('lists only conversations that can open and selects the first one', async () => {
    const requested: Appointment = {
      ...testAppointment,
      id: '60b3dce0-1d5d-44a2-81dd-b8e0dd9fb379',
      specialistDisplayName: 'ThS. Đang chờ',
      status: 'REQUESTED',
      history: [],
    }
    const video: Appointment = {
      ...testAppointment,
      id: '70b3dce0-1d5d-44a2-81dd-b8e0dd9fb380',
      specialistDisplayName: 'ThS. Gọi video',
      modality: 'IN_APP_VIDEO',
    }
    appointmentApi.list.mockResolvedValue({
      items: [requested, video, testAppointment],
      count: 3,
      generatedAt: '2026-10-01T17:00:00Z',
    })
    render(<SpecialistChatView viewerRole="USER" />)

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'ThS. BS. Minh Anh',
      }),
    ).toBeVisible()
    expect(screen.queryByText('ThS. Đang chờ')).not.toBeInTheDocument()
    expect(screen.queryByText('ThS. Gọi video')).not.toBeInTheDocument()
  })

  it('offers the next session with the same specialist', async () => {
    render(
      <SpecialistChatView
        initialAppointmentId={testAppointment.id}
        viewerRole="USER"
      />,
    )

    const links = await screen.findAllByRole('link', {
      name: /Đặt buổi tiếp theo/,
    })
    for (const link of links) {
      expect(link).toHaveAttribute(
        'href',
        `/specialists?specialist=${testAppointment.specialistAccountId}`,
      )
    }
    expect(screen.queryByText(/tái khám/i)).not.toBeInTheDocument()
  })

  it('allows toggling the info drawer open and closed', async () => {
    render(
      <SpecialistChatView
        initialAppointmentId={testAppointment.id}
        viewerRole="USER"
      />,
    )

    expect(await screen.findByText('Thông tin buổi hẹn')).toBeVisible()
    const drawer = document.getElementById('appointment-info-drawer')
    // Ended session: the drawer opens once the appointment has loaded.
    await waitFor(() =>
      expect(drawer?.className).not.toContain('emrDrawerHidden'),
    )

    // Click close button in drawer header
    const closeBtn = screen.getByRole('button', { name: 'Đóng ngăn kéo' })
    fireEvent.click(closeBtn)

    // Info drawer should have hidden class
    expect(drawer?.className).toContain('emrDrawerHidden')

    // Click split button in chat header to reopen
    const openBtn = screen.getByRole('button', {
      name: 'Thông tin buổi hẹn',
    })
    fireEvent.click(openBtn)

    // Info drawer is reopened
    expect(drawer?.className).not.toContain('emrDrawerHidden')
  })

  it('keeps the info drawer closed by default on a narrow screen', async () => {
    const original = window.matchMedia
    window.matchMedia = vi.fn((query: string) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia
    try {
      render(
        <SpecialistChatView
          initialAppointmentId={testAppointment.id}
          viewerRole="USER"
        />,
      )

      await screen.findByRole('heading', {
        level: 1,
        name: 'ThS. BS. Minh Anh',
      })
      expect(
        document.getElementById('appointment-info-drawer')?.className,
      ).toContain('emrDrawerHidden')
    } finally {
      window.matchMedia = original
    }
  })

  it('does not offer rating inside the messages drawer', async () => {
    render(
      <SpecialistChatView
        initialAppointmentId={testAppointment.id}
        viewerRole="USER"
      />,
    )

    expect(
      (await screen.findAllByText('Đã dùng 1 buổi tư vấn'))[0],
    ).toBeVisible()
    expect(screen.queryByText(/Đánh giá phiên/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Gửi đánh giá/)).not.toBeInTheDocument()
  })

  it('renders truthful empty state when chat history has no messages', async () => {
    chatApi.chatHistory.mockResolvedValueOnce({ items: [] })

    render(
      <SpecialistChatView
        initialAppointmentId={testAppointment.id}
        viewerRole="USER"
      />,
    )

    expect(
      await screen.findByText('Chưa có tin nhắn trong phiên này'),
    ).toBeVisible()
  })

  it('shows when the room opens before the window and a neutral line otherwise', async () => {
    appointmentApi.list.mockResolvedValue({
      items: [{ ...testAppointment, status: 'CANCELLED' }],
      count: 1,
      generatedAt: '2026-10-01T10:00:00Z',
    })
    chatApi.chatEligibility.mockResolvedValueOnce({
      historyAllowed: false,
      sendAllowed: false,
      phase: 'TOO_EARLY',
      scheduledStartAt: testAppointment.scheduledStartAt,
    })

    const { unmount } = render(
      <SpecialistChatView
        initialAppointmentId={testAppointment.id}
        viewerRole="USER"
      />,
    )

    // Room opens 10 minutes before 22:55 (Asia/Ho_Chi_Minh).
    expect(
      await screen.findByText('Phòng chat mở lúc 22:45, 01/10'),
    ).toBeVisible()
    unmount()

    chatApi.chatEligibility.mockResolvedValueOnce({
      historyAllowed: false,
      sendAllowed: false,
      phase: 'NOT_AVAILABLE',
    })
    render(
      <SpecialistChatView
        initialAppointmentId={testAppointment.id}
        viewerRole="USER"
      />,
    )
    expect(
      await screen.findByText('Chưa có nội dung trò chuyện để xem.'),
    ).toBeVisible()
  })

  it.each([
    [null, 'Đang xác nhận kết quả'],
    ['USER_NO_SHOW', 'Bạn vắng mặt'],
    ['SPECIALIST_NO_SHOW', 'Chuyên gia vắng mặt'],
    ['BOTH_NO_SHOW', 'Cả hai vắng mặt'],
    ['INSUFFICIENT_EVIDENCE', 'Chưa đủ dữ liệu xác nhận'],
    ['EVIDENCE_REVIEW', 'Đang xem xét'],
  ] as const)(
    'labels an ended session by outcome %s, never as done',
    async (sessionOutcome, label) => {
      appointmentApi.list.mockResolvedValue({
        items: [
          { ...testAppointment, status: 'SESSION_ENDED', sessionOutcome },
        ],
        count: 1,
        generatedAt: '2026-10-01T17:00:00Z',
      })

      render(
        <SpecialistChatView
          initialAppointmentId={testAppointment.id}
          viewerRole="USER"
        />,
      )

      expect((await screen.findAllByText(label)).length).toBeGreaterThanOrEqual(
        1,
      )
      expect(screen.queryByText('Đã xong')).not.toBeInTheDocument()
      expect(screen.queryByText('Đã hoàn thành')).not.toBeInTheDocument()
    },
  )

  it('shows the specialist wording of a no-show', async () => {
    appointmentApi.assigned.mockResolvedValue({
      items: [
        {
          ...testAppointment,
          status: 'SESSION_ENDED',
          sessionOutcome: 'USER_NO_SHOW',
        },
      ],
      count: 1,
      generatedAt: '2026-10-01T17:00:00Z',
    })

    render(
      <SpecialistChatView
        initialAppointmentId={testAppointment.id}
        viewerRole="SPECIALIST"
      />,
    )

    expect((await screen.findAllByText('Khách hàng vắng mặt')).length).toBe(2)
  })

  it('renders error state when chat history request fails', async () => {
    chatApi.chatEligibility.mockRejectedValueOnce(
      new Error('Network connection failed'),
    )

    render(
      <SpecialistChatView
        initialAppointmentId={testAppointment.id}
        viewerRole="USER"
      />,
    )

    expect(
      await screen.findByText('Không thể tải lịch sử trò chuyện'),
    ).toBeVisible()
  })

  it('disables composer input and send button for ended session', async () => {
    render(
      <SpecialistChatView
        initialAppointmentId={testAppointment.id}
        viewerRole="USER"
      />,
    )

    await screen.findByRole('heading', { level: 1, name: 'ThS. BS. Minh Anh' })

    const input = screen.getByPlaceholderText(
      'Phiên tư vấn đã kết thúc • Khung chat chỉ đọc',
    )
    expect(input).toBeDisabled()

    const sendBtn = screen.getByRole('button', { name: 'Gửi tin nhắn' })
    expect(sendBtn).toBeDisabled()
  })

  it('handles session with no summary gracefully without crashing', async () => {
    sessionSummaryApi.list.mockResolvedValueOnce({ items: [], count: 0 })

    render(
      <SpecialistChatView
        initialAppointmentId={testAppointment.id}
        viewerRole="USER"
      />,
    )

    expect(
      await screen.findByText(
        'Chưa có kế hoạch chăm sóc tiếp theo được ghi nhận cho phiên này.',
      ),
    ).toBeVisible()
  })
  it('hands an active session to the realtime chat panel instead of a dead composer', async () => {
    appointmentApi.list.mockResolvedValue({
      items: [{ ...testAppointment, status: 'IN_PROGRESS' }],
      count: 1,
      generatedAt: '2026-10-01T16:00:00Z',
    })
    chatApi.chatEligibility.mockResolvedValue({
      historyAllowed: true,
      sendAllowed: true,
      conversationId: 'conv-123',
    })

    render(
      <SpecialistChatView
        initialAppointmentId={testAppointment.id}
        viewerRole="USER"
      />,
    )

    expect(await screen.findByTestId('realtime-chat-panel')).toHaveTextContent(
      testAppointment.id,
    )
    expect(
      screen.queryByRole('button', { name: 'Gửi tin nhắn' }),
    ).not.toBeInTheDocument()
    // The live panel already shows the appointment info, so the drawer starts closed.
    expect(
      document.getElementById('appointment-info-drawer')?.className,
    ).toContain('emrDrawerHidden')
  })

  it('never shows the previous appointment summary under a newly selected appointment', async () => {
    const other: Appointment = {
      ...testAppointment,
      id: '50b3dce0-1d5d-44a2-81dd-b8e0dd9fb378',
      specialistDisplayName: 'ThS. Hòa Bình',
    }
    appointmentApi.list.mockResolvedValue({
      items: [testAppointment, other],
      count: 2,
      generatedAt: '2026-10-01T17:00:00Z',
    })
    const first = await sessionSummaryApi.list()
    sessionSummaryApi.list.mockImplementation((id: string) =>
      id === other.id ? new Promise(() => {}) : Promise.resolve(first),
    )

    render(
      <SpecialistChatView
        initialAppointmentId={testAppointment.id}
        viewerRole="USER"
      />,
    )

    expect(
      (await screen.findAllByText('Thực hành tập thở 4-7-8')).length,
    ).toBeGreaterThanOrEqual(1)

    fireEvent.click(screen.getAllByText('ThS. Hòa Bình')[0])

    expect(
      screen.queryByText('Thực hành tập thở 4-7-8'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('Chào bạn, tôi là BS. Minh Anh'),
    ).not.toBeInTheDocument()
  })
})
