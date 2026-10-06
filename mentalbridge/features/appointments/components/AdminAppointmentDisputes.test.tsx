import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminAppointmentDisputes from './AdminAppointmentDisputes'

const client = vi.hoisted(() => ({
  disputes: vi.fn(),
  resolveDispute: vi.fn(),
}))
vi.mock('../api/browser-client', () => ({ appointmentBrowserClient: client }))

const open = {
  id: '40a7e5d8-7960-42fb-9706-e642f849b78f',
  appointmentId: '10a7e5d8-7960-42fb-9706-e642f849b78f',
  appointmentVersion: 4,
  status: 'OPEN' as const,
  openedByRole: 'USER' as const,
  reasonCode: 'TECHNICAL_FAILURE' as const,
  evidenceType: 'PROVIDER_INCIDENT' as const,
  evidenceOccurredAt: '2099-09-27T03:00:00Z',
  openedAt: '2099-09-27T04:00:00Z',
  eligibleUntil: '2099-09-28T04:00:00Z',
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

describe('AdminAppointmentDisputes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    client.disputes.mockResolvedValue({
      items: [open],
      count: 1,
      generatedAt: '2099-09-27T04:10:00Z',
    })
  })

  it('offers only bounded outcomes and resolves with a stable command', async () => {
    const user = userEvent.setup()
    client.resolveDispute.mockResolvedValue({
      ...open,
      status: 'RESOLVED',
      version: 1,
    })
    render(<AdminAppointmentDisputes />)

    const outcome = await screen.findByLabelText('Kết quả xử lý')
    expect(outcome).toHaveTextContent('Giữ nguyên kết quả đã ghi nhận')
    expect(outcome).toHaveTextContent('Trả lại lượt tư vấn')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    await user.selectOptions(outcome, 'RELEASE_USER_CREDIT')
    await user.selectOptions(
      screen.getByLabelText('Lý do'),
      'TECHNICAL_FAILURE_CONFIRMED',
    )
    await user.click(
      screen.getByRole('button', { name: 'Ghi nhận quyết định' }),
    )

    await waitFor(() => expect(client.resolveDispute).toHaveBeenCalledTimes(1))
    expect(client.resolveDispute).toHaveBeenCalledWith(
      open.id,
      {
        outcome: 'RELEASE_USER_CREDIT',
        reasonCode: 'TECHNICAL_FAILURE_CONFIRMED',
      },
      0,
      expect.any(String),
    )
    expect(
      await screen.findByText(/Quyết định đã được ghi nhận/),
    ).toBeInTheDocument()
  })
})
