import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { FeedbackProvider } from '@/components/ui/FeedbackProvider'
import { ApiError } from '@/lib/api/api-error'
import SpecialistAppointmentDecisionPanel from './SpecialistAppointmentDecisionPanel'

const api = vi.hoisted(() => ({
  assigned: vi.fn(),
  decide: vi.fn(),
}))

vi.mock('../api/browser-client', () => ({
  appointmentBrowserClient: api,
}))

const requested = {
  id: '10a7e5d8-7960-42fb-9706-e642f849b78f',
  slotId: '43b7dbb4-021e-4c75-ae48-bfa7126c7256',
  specialistAccountId: '9e3a8903-3d31-48d0-bf1a-4d81bbcef4b8',
  specialistDisplayName: 'Chuyên gia An',
  status: 'REQUESTED' as const,
  modality: 'IN_APP_CHAT' as const,
  scheduledStartAt: '2099-09-27T02:00:00Z',
  scheduledEndAt: '2099-09-27T03:00:00Z',
  timezone: 'Asia/Ho_Chi_Minh',
  requestedAt: '2099-09-25T02:00:00Z',
  decisionDeadlineAt: '2099-09-26T02:00:00Z',
  heldCreditId: '96de7b84-14ae-46cd-bfa1-8314d1366b02',
  replacesAppointmentId: null,
  decidedAt: null,
  decisionReason: null,
  creditState: 'HELD' as const,
  version: 0,
}

describe('SpecialistAppointmentDecisionPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.assigned.mockResolvedValue({
      items: [requested],
      count: 1,
      generatedAt: '2099-09-25T02:00:01Z',
    })
  })

  it('shows the real pending request and its decision deadline', async () => {
    render(<SpecialistAppointmentDecisionPanel />)

    expect(await screen.findByText('Chờ phản hồi')).toBeInTheDocument()
    expect(screen.getByText(/Phản hồi trước/)).toBeInTheDocument()
    expect(
      screen.getByText('Lượt tư vấn vẫn được giữ cho lịch hẹn'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xác nhận' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Từ chối' })).toBeEnabled()
  })

  it('accepts with the current version and updates the persisted outcome', async () => {
    api.decide.mockResolvedValue({
      ...requested,
      status: 'CONFIRMED',
      decidedAt: '2099-09-25T03:00:00Z',
      decisionReason: 'SPECIALIST_ACCEPTED',
      version: 1,
    })
    const user = userEvent.setup()
    render(<SpecialistAppointmentDecisionPanel />)

    await user.click(await screen.findByRole('button', { name: 'Xác nhận' }))

    await waitFor(() => expect(api.decide).toHaveBeenCalledTimes(1))
    expect(api.decide).toHaveBeenCalledWith(
      requested.id,
      'accept',
      0,
      expect.stringMatching(/^[0-9a-f-]{36}$/),
    )
    expect(await screen.findByText('Đã xác nhận')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Từ chối' }),
    ).not.toBeInTheDocument()
  })

  it('rejects only after confirmation and shows the released credit', async () => {
    api.decide.mockResolvedValue({
      ...requested,
      status: 'REJECTED',
      decidedAt: '2099-09-25T03:00:00Z',
      decisionReason: 'SPECIALIST_REJECTED',
      creditState: 'AVAILABLE',
      version: 1,
    })
    const user = userEvent.setup()
    render(
      <FeedbackProvider>
        <SpecialistAppointmentDecisionPanel />
      </FeedbackProvider>,
    )

    await user.click(await screen.findByRole('button', { name: 'Từ chối' }))
    expect(api.decide).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Từ chối yêu cầu' }))

    await waitFor(() => expect(api.decide).toHaveBeenCalledTimes(1))
    expect(api.decide).toHaveBeenCalledWith(
      requested.id,
      'reject',
      0,
      expect.stringMatching(/^[0-9a-f-]{36}$/),
    )
    expect(await screen.findByText('Đã từ chối')).toBeInTheDocument()
    expect(screen.getByText('Lượt tư vấn đã được hoàn lại')).toBeInTheDocument()
  })

  it('reloads a stale request before explaining that it changed', async () => {
    api.decide.mockRejectedValueOnce(
      new ApiError({
        message: 'stale',
        code: 'APPOINTMENT_VERSION_MISMATCH',
        status: 412,
      }),
    )
    api.assigned
      .mockResolvedValueOnce({
        items: [requested],
        count: 1,
        generatedAt: '2099-09-25T02:00:01Z',
      })
      .mockResolvedValueOnce({
        items: [
          {
            ...requested,
            status: 'EXPIRED',
            decidedAt: '2099-09-26T02:00:00Z',
            decisionReason: 'DECISION_DEADLINE_EXPIRED',
            creditState: 'AVAILABLE',
            version: 1,
          },
        ],
        count: 1,
        generatedAt: '2099-09-26T02:00:01Z',
      })
    const user = userEvent.setup()
    render(<SpecialistAppointmentDecisionPanel />)

    await user.click(await screen.findByRole('button', { name: 'Xác nhận' }))

    expect(await screen.findByText('Đã hết hạn')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Yêu cầu này vừa được cập nhật ở nơi khác. Danh sách mới nhất đã được tải lại.',
      ),
    ).toBeInTheDocument()
    expect(api.assigned).toHaveBeenCalledTimes(2)
  })
})
