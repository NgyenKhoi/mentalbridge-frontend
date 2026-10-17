import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/api-error'
import type { Appointment } from '@/lib/consultation/consultation-validation'
import { AppointmentDisputePanel } from './AppointmentDisputePanel'

const client = vi.hoisted(() => ({ dispute: vi.fn(), openDispute: vi.fn() }))
vi.mock('../api/browser-client', () => ({ appointmentBrowserClient: client }))

const appointment: Appointment = {
  id: '10a7e5d8-7960-42fb-9706-e642f849b78f',
  slotId: '13b7dbb4-021e-4c75-ae48-bfa7126c7256',
  specialistAccountId: '9e3a8903-3d31-48d0-bf1a-4d81bbcef4b8',
  specialistDisplayName: 'Chuyên gia An',
  status: 'COMPLETED',
  modality: 'IN_APP_CHAT',
  scheduledStartAt: '2099-09-27T02:00:00Z',
  scheduledEndAt: '2099-09-27T03:00:00Z',
  timezone: 'Asia/Ho_Chi_Minh',
  requestedAt: '2099-09-25T02:00:00Z',
  decisionDeadlineAt: '2099-09-26T02:00:00Z',
  heldCreditId: '96de7b84-14ae-46cd-bfa1-8314d1366b02',
  replacesAppointmentId: null,
  replacedByAppointmentId: null,
  decidedAt: '2099-09-26T01:00:00Z',
  decisionReason: 'SPECIALIST_ACCEPTED',
  cancelledAt: null,
  cancellationReason: null,
  cancellationActor: null,
  cancellationCreditOutcome: null,
  sessionOutcome: 'COMPLETED',
  sessionOutcomeReason: 'EVIDENCE_REQUIREMENTS_MET',
  sessionPolicyVersion: 'chat-session-completion-v1',
  sessionEndedAt: '2099-09-27T03:00:00Z',
  sessionSettledAt: '2099-09-27T03:05:00Z',
  completionFactId: '20a7e5d8-7960-42fb-9706-e642f849b78f',
  creditState: 'CONSUMED',
  history: [],
  version: 4,
}

const openDispute = {
  id: '40a7e5d8-7960-42fb-9706-e642f849b78f',
  appointmentId: appointment.id,
  appointmentVersion: 4,
  status: 'OPEN' as const,
  openedByRole: 'USER' as const,
  reasonCode: 'OUTCOME_INCORRECT' as const,
  evidenceType: null,
  evidenceOccurredAt: null,
  openedAt: '2099-09-27T04:00:00Z',
  eligibleUntil: '2099-09-28T03:05:00Z',
  settlementGated: true,
  resolutionOutcome: null,
  resolutionReason: null,
  resolvedAt: null,
  priorAppointmentStatus: null,
  priorSessionOutcome: null,
  resultingAppointmentStatus: null,
  resultingSessionOutcome: null,
  creditAction: null,
  version: 0,
}

describe('AppointmentDisputePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    client.dispute.mockRejectedValue(
      new ApiError({
        message: 'not found',
        code: 'APPOINTMENT_DISPUTE_NOT_FOUND',
        status: 404,
      }),
    )
  })

  it('reuses one command key after an ambiguous committed response failure', async () => {
    const user = userEvent.setup()
    client.openDispute
      .mockRejectedValueOnce(
        new ApiError({
          message: 'timeout',
          code: 'REQUEST_TIMEOUT',
          status: 504,
        }),
      )
      .mockResolvedValueOnce(openDispute)

    render(
      <AppointmentDisputePanel
        appointment={appointment}
        role="USER"
        generatedAt="2099-09-27T04:00:00Z"
      />,
    )
    await user.click(await screen.findByText('Yêu cầu xem xét kết quả phiên'))
    const submit = screen.getByRole('button', { name: 'Gửi yêu cầu xem xét' })
    await user.click(submit)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Nội dung vẫn được giữ',
    )
    await user.click(submit)

    await screen.findByText('Yêu cầu đang được xem xét')
    const firstKey = client.openDispute.mock.calls[0][3]
    expect(client.openDispute.mock.calls[1][3]).toBe(firstKey)
    expect(client.openDispute).toHaveBeenCalledTimes(2)
  })

  it('shows a resolved credit release without exposing raw evidence', async () => {
    client.dispute.mockResolvedValue({
      ...openDispute,
      status: 'RESOLVED',
      resolutionOutcome: 'RELEASE_USER_CREDIT',
      resolutionReason: 'TECHNICAL_FAILURE_CONFIRMED',
      resolvedAt: '2099-09-27T05:00:00Z',
      priorAppointmentStatus: 'COMPLETED',
      priorSessionOutcome: 'COMPLETED',
      resultingAppointmentStatus: 'COMPLETED',
      resultingSessionOutcome: 'COMPLETED',
      creditAction: 'ADJUSTED_RELEASED',
      version: 1,
    })
    render(
      <AppointmentDisputePanel
        appointment={appointment}
        role="USER"
        generatedAt="2099-09-29T04:00:00Z"
      />,
    )
    expect(
      await screen.findByText('Đã trả lại lượt tư vấn'),
    ).toBeInTheDocument()
    await waitFor(() => expect(client.openDispute).not.toHaveBeenCalled())
    expect(
      screen.queryByText(/ACCESS_LOG|CONNECTION_INCIDENT/),
    ).not.toBeInTheDocument()
  })
})
