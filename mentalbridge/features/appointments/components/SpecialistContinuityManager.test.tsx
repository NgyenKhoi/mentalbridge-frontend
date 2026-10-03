import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api/api-error'
import type { Appointment } from '@/lib/consultation/consultation-validation'
import type { SessionSummary } from '@/lib/consultation/session-summary-validation'
import SpecialistContinuityManager from './SpecialistContinuityManager'

const appointmentApi = vi.hoisted(() => ({ assigned: vi.fn() }))
const summaryApi = vi.hoisted(() => ({ list: vi.fn() }))

vi.mock('../api/browser-client', () => ({
  appointmentBrowserClient: appointmentApi,
}))
vi.mock('../api/session-summary-browser-client', () => ({
  sessionSummaryBrowserClient: summaryApi,
}))
vi.mock('./PlanChangeRequestCard', () => ({
  PlanChangeRequestCard: () => <div>Trạng thái đề xuất tài nguyên</div>,
}))

const completedAppointment: Appointment = {
  id: '10000000-0000-4000-8000-000000000001',
  slotId: '10000000-0000-4000-8000-000000000002',
  specialistAccountId: '10000000-0000-4000-8000-000000000003',
  specialistDisplayName: 'Chuyên gia An',
  status: 'COMPLETED',
  modality: 'IN_APP_CHAT',
  scheduledStartAt: '2099-10-02T02:00:00Z',
  scheduledEndAt: '2099-10-02T03:00:00Z',
  timezone: 'Asia/Ho_Chi_Minh',
  requestedAt: '2099-09-30T02:00:00Z',
  decisionDeadlineAt: '2099-10-01T02:00:00Z',
  heldCreditId: '10000000-0000-4000-8000-000000000004',
  replacesAppointmentId: null,
  replacedByAppointmentId: null,
  decidedAt: '2099-10-01T01:00:00Z',
  decisionReason: 'SPECIALIST_ACCEPTED',
  cancelledAt: null,
  cancellationReason: null,
  cancellationActor: null,
  cancellationCreditOutcome: null,
  sessionOutcome: 'COMPLETED',
  sessionOutcomeReason: 'EVIDENCE_REQUIREMENTS_MET',
  sessionPolicyVersion: 'chat-session-completion-v1',
  sessionEndedAt: '2099-10-02T03:00:00Z',
  sessionSettledAt: '2099-10-02T03:01:00Z',
  completionFactId: '10000000-0000-4000-8000-000000000005',
  creditState: 'CONSUMED',
  history: [],
  version: 3,
}

const summary: SessionSummary = {
  id: '20000000-0000-4000-8000-000000000001',
  appointmentId: completedAppointment.id,
  userAccountId: '20000000-0000-4000-8000-000000000002',
  specialistAccountId: completedAppointment.specialistAccountId,
  version: 1,
  schemaVersion: 'session-summary-v1',
  topicsDiscussed: ['Giấc ngủ'],
  progressSummary: 'Đã cùng nhìn lại nhịp ngủ trong tuần.',
  specialistNoteForUser: 'Duy trì giờ ngủ đã thống nhất.',
  followUpSuggested: true,
  amendsSummaryId: null,
  publishedAt: '2099-10-02T03:10:00Z',
  reuseConsent: null,
  agreedNextSteps: [
    {
      id: '20000000-0000-4000-8000-000000000003',
      type: 'JOURNAL',
      title: 'Ghi lại giờ ngủ trong ba ngày',
      details: 'Ghi ngắn gọn sau khi thức dậy.',
      resourceId: null,
      resourceVersion: null,
      resourceProposalReasonCode: null,
      state: null,
      hidden: false,
      stateVersion: null,
      stateUpdatedAt: null,
    },
  ],
}

describe('SpecialistContinuityManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    appointmentApi.assigned.mockResolvedValue({
      items: [
        completedAppointment,
        {
          ...completedAppointment,
          id: '30000000-0000-4000-8000-000000000001',
          status: 'CONFIRMED',
          scheduledStartAt: '2099-10-05T02:00:00Z',
          scheduledEndAt: '2099-10-05T03:00:00Z',
        },
      ],
      count: 2,
      generatedAt: '2099-10-03T02:00:00Z',
    })
    summaryApi.list.mockResolvedValue({
      items: [summary],
      count: 1,
      generatedAt: '2099-10-03T02:00:00Z',
    })
  })

  it('shows immutable continuity only for a completed assigned appointment', async () => {
    render(<SpecialistContinuityManager />)

    expect(
      await screen.findByText('Đã cùng nhìn lại nhịp ngủ trong tuần.'),
    ).toBeInTheDocument()
    expect(summaryApi.list).toHaveBeenCalledWith(
      completedAppointment.id,
      'SPECIALIST',
    )
    expect(
      screen.getByText('Ghi lại giờ ngủ trong ba ngày'),
    ).toBeInTheDocument()
    expect(screen.getByText('Đã thống nhất')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Xem lại hội thoại' }),
    ).toHaveAttribute(
      'href',
      `/specialist/messages?appointmentId=${completedAppointment.id}`,
    )
    expect(screen.queryByText(/05\/10\/2099/)).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('clears the previous snapshot when the newly selected session is unavailable', async () => {
    const second = {
      ...completedAppointment,
      id: '40000000-0000-4000-8000-000000000001',
      scheduledStartAt: '2099-10-01T02:00:00Z',
      scheduledEndAt: '2099-10-01T03:00:00Z',
    }
    appointmentApi.assigned.mockResolvedValue({
      items: [completedAppointment, second],
      count: 2,
      generatedAt: '2099-10-04T02:00:00Z',
    })
    summaryApi.list
      .mockResolvedValueOnce({
        items: [summary],
        count: 1,
        generatedAt: '2099-10-04T02:00:00Z',
      })
      .mockRejectedValueOnce(
        new ApiError({ message: 'forbidden', code: 'FORBIDDEN', status: 403 }),
      )
    const user = userEvent.setup()
    render(<SpecialistContinuityManager />)

    expect(
      await screen.findByText('Đã cùng nhìn lại nhịp ngủ trong tuần.'),
    ).toBeInTheDocument()
    const secondDate = screen.getByText(/01\/10\/2099/)
    await user.click(secondDate.closest('button') as HTMLButtonElement)

    expect(
      await screen.findByText('Không thể mở nội dung sau phiên'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Bản tóm tắt này không còn khả dụng với tài khoản của bạn.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Đã cùng nhìn lại nhịp ngủ trong tuần.'),
    ).not.toBeInTheDocument()
  })

  it('offers recovery without inventing rows when appointment loading fails', async () => {
    appointmentApi.assigned.mockRejectedValue(
      new ApiError({
        message: 'unavailable',
        code: 'CONSULTATION_UNAVAILABLE',
        status: 503,
      }),
    )
    render(<SpecialistContinuityManager />)

    expect(
      await screen.findByText(
        'Chưa thể tải các phiên tư vấn đã hoàn thành. Vui lòng thử lại.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument()
    expect(summaryApi.list).not.toHaveBeenCalled()
  })
})
