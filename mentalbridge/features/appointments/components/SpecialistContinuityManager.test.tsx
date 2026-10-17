import { render, screen, waitFor } from '@testing-library/react'
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

  it('selects the requested session and keeps the selected immutable version when reloading', async () => {
    const second = {
      ...completedAppointment,
      id: '40000000-0000-4000-8000-000000000001',
      scheduledStartAt: '2099-10-01T02:00:00Z',
      scheduledEndAt: '2099-10-01T03:00:00Z',
    }
    const amended = {
      ...summary,
      id: '50000000-0000-4000-8000-000000000001',
      appointmentId: second.id,
      version: 2,
      amendsSummaryId: summary.id,
      progressSummary: 'Nội dung bản đính chính',
    }
    appointmentApi.assigned.mockResolvedValue({
      items: [completedAppointment, second],
      count: 2,
    })
    summaryApi.list.mockResolvedValue({
      items: [{ ...summary, appointmentId: second.id }, amended],
      count: 2,
    })
    const user = userEvent.setup()
    render(<SpecialistContinuityManager initialAppointmentId={second.id} />)
    expect(
      await screen.findByText('Nội dung bản đính chính'),
    ).toBeInTheDocument()
    expect(summaryApi.list).toHaveBeenCalledWith(second.id, 'SPECIALIST')
    expect(
      screen.getByRole('link', { name: 'Quản lý trong lịch hẹn' }),
    ).toHaveAttribute(
      'href',
      `/specialist/appointments?appointmentId=${second.id}`,
    )
    const latest = screen.getByRole('tab', { name: 'Mới nhất · Bản 2' })
    latest.focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Bản 1' })).toHaveFocus()
    expect(
      screen.getByText('Đã cùng nhìn lại nhịp ngủ trong tuần.'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Tải lại' }))
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Bản 1' })).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    )
    expect(
      screen.getByText('Đã cùng nhìn lại nhịp ngủ trong tuần.'),
    ).toBeInTheDocument()
  })

  it('reopening the selected session does not clear the snapshot or leave loading stuck', async () => {
    const user = userEvent.setup()
    render(<SpecialistContinuityManager />)
    expect(
      await screen.findByText(summary.progressSummary!),
    ).toBeInTheDocument()
    const row = screen.getByRole('button', { name: /02\/10\/2099/ })
    await user.click(row)
    expect(screen.getByText(summary.progressSummary!)).toBeInTheDocument()
    expect(
      screen.queryByText('Đang tải nội dung sau phiên…'),
    ).not.toBeInTheDocument()
    expect(summaryApi.list).toHaveBeenCalledTimes(1)
  })

  it('does not substitute an unrelated session for a missing deep-link', async () => {
    const user = userEvent.setup()
    render(
      <SpecialistContinuityManager initialAppointmentId="missing-session" />,
    )
    expect(
      await screen.findByText('Chọn một phiên đã hoàn thành'),
    ).toBeInTheDocument()
    expect(summaryApi.list).not.toHaveBeenCalled()
    expect(screen.queryByText(summary.progressSummary!)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Tải lại' }))
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Tải lại' }),
      ).not.toBeDisabled(),
    )
    expect(screen.getByText('Chọn một phiên đã hoàn thành')).toBeInTheDocument()
    expect(summaryApi.list).not.toHaveBeenCalled()
  })

  it('clears protected snapshots after assignment permission is revoked', async () => {
    const user = userEvent.setup()
    render(<SpecialistContinuityManager />)
    expect(
      await screen.findByText(summary.progressSummary!),
    ).toBeInTheDocument()
    appointmentApi.assigned.mockRejectedValue(
      new ApiError({ message: 'forbidden', code: 'FORBIDDEN', status: 403 }),
    )
    await user.click(screen.getByRole('button', { name: 'Tải lại' }))
    expect(
      await screen.findByText(
        'Tài khoản hiện tại không có quyền xem lịch hẹn chuyên gia.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText(summary.progressSummary!)).not.toBeInTheDocument()
    expect(summaryApi.list).toHaveBeenCalledTimes(1)
  })

  it('opens the linked platform resource instead of a simulated success toast', async () => {
    const resourceSummary = {
      ...summary,
      agreedNextSteps: [
        {
          ...summary.agreedNextSteps[0],
          type: 'PLATFORM_RESOURCE' as const,
          resourceId: 'sleep-resource',
          resourceVersion: '7',
        },
      ],
    }
    summaryApi.list.mockResolvedValue({ items: [resourceSummary], count: 1 })
    render(<SpecialistContinuityManager />)
    expect(
      await screen.findByRole('link', { name: 'Xem tài nguyên đính kèm' }),
    ).toHaveAttribute('href', '/resources/sleep-resource?contentVersion=7')
  })
})
