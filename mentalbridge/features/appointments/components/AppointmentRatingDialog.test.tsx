import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { FeedbackProvider } from '@/components/ui/FeedbackProvider'
import { ApiError } from '@/lib/api/api-error'
import type { Appointment } from '@/lib/consultation/consultation-validation'
import { AppointmentRatingDialog } from './AppointmentRatingDialog'

const client = vi.hoisted(() => ({ rating: vi.fn(), saveRating: vi.fn() }))

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

function renderDialog() {
  return render(
    <FeedbackProvider>
      <AppointmentRatingDialog appointment={appointment} />
    </FeedbackProvider>,
  )
}

describe('AppointmentRatingDialog', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a bounded rating for an unrated completed appointment', async () => {
    const user = userEvent.setup()
    client.rating.mockRejectedValue(
      new ApiError({
        message: 'not found',
        code: 'APPOINTMENT_RATING_NOT_FOUND',
        status: 404,
      }),
    )
    client.saveRating.mockResolvedValue({
      appointmentId: appointment.id,
      specialistAccountId: appointment.specialistAccountId,
      rating: 5,
      createdAt: '2099-09-27T04:00:00Z',
      updatedAt: '2099-09-27T04:00:00Z',
      version: 0,
      specialistAggregate: { averageRating: 4.75, ratingCount: 12 },
    })

    renderDialog()
    await user.click(
      screen.getByRole('button', { name: 'Đánh giá chuyên gia' }),
    )
    await screen.findByText('Chưa chọn điểm')
    await user.click(screen.getByRole('button', { name: '5 sao' }))
    await user.click(screen.getByRole('button', { name: 'Gửi đánh giá' }))

    await waitFor(() =>
      expect(client.saveRating).toHaveBeenCalledWith(
        appointment.id,
        5,
        undefined,
      ),
    )
    expect(await screen.findByText('Đã đánh giá · 5/5')).toBeInTheDocument()
  })

  it('prefills and safely edits the current rating version', async () => {
    const user = userEvent.setup()
    client.rating.mockResolvedValue({
      appointmentId: appointment.id,
      specialistAccountId: appointment.specialistAccountId,
      rating: 3,
      createdAt: '2099-09-27T04:00:00Z',
      updatedAt: '2099-09-27T04:00:00Z',
      version: 2,
      specialistAggregate: { averageRating: 4.2, ratingCount: 10 },
    })
    client.saveRating.mockResolvedValue({
      appointmentId: appointment.id,
      specialistAccountId: appointment.specialistAccountId,
      rating: 4,
      createdAt: '2099-09-27T04:00:00Z',
      updatedAt: '2099-09-27T05:00:00Z',
      version: 3,
      specialistAggregate: { averageRating: 4.3, ratingCount: 10 },
    })

    renderDialog()
    await user.click(
      screen.getByRole('button', { name: 'Đánh giá chuyên gia' }),
    )
    expect(await screen.findByText('3/5 · Trải nghiệm ổn')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '4 sao' }))
    await user.click(screen.getByRole('button', { name: 'Cập nhật đánh giá' }))

    await waitFor(() =>
      expect(client.saveRating).toHaveBeenCalledWith(appointment.id, 4, 2),
    )
  })

  it('keeps saving disabled until a failed rating load is retried successfully', async () => {
    const user = userEvent.setup()
    client.rating
      .mockRejectedValueOnce(
        new ApiError({ message: 'offline', code: 'UPSTREAM', status: 503 }),
      )
      .mockResolvedValueOnce({
        appointmentId: appointment.id,
        specialistAccountId: appointment.specialistAccountId,
        rating: 2,
        createdAt: '2099-09-27T04:00:00Z',
        updatedAt: '2099-09-27T04:00:00Z',
        version: 1,
        specialistAggregate: { averageRating: 3.5, ratingCount: 2 },
      })

    renderDialog()
    await user.click(
      screen.getByRole('button', { name: 'Đánh giá chuyên gia' }),
    )
    const retry = await screen.findByRole('button', { name: 'Thử lại' })
    expect(screen.getByRole('button', { name: 'Gửi đánh giá' })).toBeDisabled()

    await user.click(retry)

    expect(await screen.findByText('2/5 · Cần cải thiện')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Cập nhật đánh giá' }),
    ).toBeEnabled()
  })
})
