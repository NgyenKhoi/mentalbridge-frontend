import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  rating: vi.fn(),
  saveRating: vi.fn(),
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
  getAssessmentHistory: (...args: unknown[]) => assessmentApi.getAssessmentHistory(...args),
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
  history: [],
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
    appointmentApi.rating.mockResolvedValue({
      score: 5,
      specialistAccountId: 'fff240fb-44b2-4d95-aa23-31ef3b903e5c',
      ratedAt: '2026-10-01T17:30:00Z',
      canRate: true,
      reason: null,
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
      allowed: false,
      reason: 'SESSION_COMPLETED',
    })
    chatApi.chatHistory.mockResolvedValue({
      messages: [],
    })
    assessmentApi.getAssessmentHistory.mockResolvedValue([])
  })

  it('renders the 3-column layout with appointments and specialist info', async () => {
    render(<SpecialistChatView initialAppointmentId={testAppointment.id} viewerRole="USER" />)

    // Col 1: Appointments List
    expect(await screen.findByRole('heading', { name: /Lịch hẹn chat/i })).toBeVisible()
    expect(await screen.findByText('Đã xong')).toBeVisible()
    expect(screen.getAllByText('ThS. BS. Minh Anh').length).toBeGreaterThanOrEqual(1)

    // Col 2: Chat Main Area
    expect(await screen.findByText('Đã hoàn thành')).toBeVisible()
    expect(screen.getAllByText(/Khoa Sức khỏe Tâm thần/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Thời lượng:/i)).toBeVisible()
    expect(screen.getByText(/Phiên đã kết thúc và được lưu trữ an toàn trong hồ sơ bệnh án EMR/i)).toBeVisible()

    // Col 3: EMR Drawer is initially open
    expect(screen.getByText('Thông tin buổi hẹn & EMR')).toBeVisible()
    expect(screen.getByText('Chỉ số cảm xúc phiên này')).toBeVisible()
    expect(screen.getByText('Toa dặn dò & Lộ trình tuần')).toBeVisible()
  })

  it('allows toggling the EMR drawer open and closed', async () => {
    render(<SpecialistChatView initialAppointmentId={testAppointment.id} viewerRole="USER" />)

    expect(await screen.findByText('Thông tin buổi hẹn & EMR')).toBeVisible()
    const drawer = document.getElementById('emr-drawer')
    expect(drawer?.className).not.toContain('emrDrawerHidden')

    // Click close button in drawer header
    const closeBtn = screen.getByRole('button', { name: 'Đóng ngăn kéo' })
    fireEvent.click(closeBtn)

    // EMR drawer should have hidden class
    expect(drawer?.className).toContain('emrDrawerHidden')

    // Click split button in chat header to reopen
    const openBtn = screen.getByRole('button', { name: 'Đóng / Mở Ngăn kéo EMR' })
    fireEvent.click(openBtn)

    // EMR drawer is reopened
    expect(drawer?.className).not.toContain('emrDrawerHidden')
  })

  it('opens the full EMR modal when clicking Xem biên bản EMR & Hóa đơn', async () => {
    render(<SpecialistChatView initialAppointmentId={testAppointment.id} viewerRole="USER" />)

    expect(await screen.findByText('Xem biên bản EMR & Hóa đơn')).toBeVisible()
    const invoiceBtn = screen.getByText('Xem biên bản EMR & Hóa đơn')
    fireEvent.click(invoiceBtn)

    // Full modal should open
    expect(await screen.findByText('Biên bản EMR & Hóa đơn lâm sàng')).toBeVisible()
    expect(screen.getByText(/HỒ SƠ BỆNH ÁN ĐIỆN TỬ/i)).toBeVisible()

    // Close modal via footer button "Đóng"
    const closeBtn = screen.getByRole('button', { name: /^Đóng$/i })
    fireEvent.click(closeBtn)

    await waitFor(() => {
      expect(screen.queryByText('Biên bản EMR & Hóa đơn lâm sàng')).not.toBeInTheDocument()
    })
  })

  it('opens and submits rating modal', async () => {
    render(<SpecialistChatView initialAppointmentId={testAppointment.id} viewerRole="USER" />)

    const rateBtn = await screen.findByRole('button', { name: /Đã đánh giá|Đánh giá phiên/i })
    expect(rateBtn).toBeVisible()
    fireEvent.click(rateBtn)

    // Rating dialog is visible
    expect(await screen.findByText('Đánh giá phiên tham vấn')).toBeVisible()
    const submitBtn = screen.getByRole('button', { name: /Gửi đánh giá/i })
    fireEvent.click(submitBtn)

    expect(appointmentApi.saveRating).toHaveBeenCalledWith(testAppointment.id, 5)
  })
})
