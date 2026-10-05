import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const appointmentClient = vi.hoisted(() => ({ search: vi.fn() }))
vi.mock('../api/browser-admin-appointments', () => ({
  browserAdminAppointments: appointmentClient,
}))

import AdminAppointmentMonitor from './AdminAppointmentMonitor'

const item = {
  appointmentId: '11111111-1111-4111-8111-111111111111',
  availabilitySlotId: '22222222-2222-4222-8222-222222222222',
  userAccountId: '33333333-3333-4333-8333-333333333333',
  specialistAccountId: '44444444-4444-4444-8444-444444444444',
  status: 'CONFIRMED' as const,
  modality: 'IN_APP_CHAT' as const,
  scheduledStartAt: '2026-10-06T10:00:00Z',
  scheduledEndAt: '2026-10-06T11:00:00Z',
  timezone: 'Asia/Ho_Chi_Minh',
  requestedAt: '2026-10-01T10:00:00Z',
  decisionDeadlineAt: '2026-10-02T10:00:00Z',
  decidedAt: '2026-10-01T11:00:00Z',
  decisionReasonCode: 'SPECIALIST_ACCEPTED',
  cancelledAt: null,
  cancellationReasonCode: null,
  cancellationCreditOutcome: null,
  sessionEndedAt: null,
  sessionSettledAt: null,
  sessionOutcome: null,
  sessionOutcomeReasonCode: null,
  settlementState: 'HELD' as const,
  updatedAt: '2026-10-01T11:00:00Z',
  version: 1,
}

beforeEach(() => {
  appointmentClient.search.mockReset()
  appointmentClient.search.mockResolvedValue({
    source: 'CONSULTATION',
    dataState: 'CURRENT',
    generatedAt: '2026-10-05T10:00:00Z',
    queryFrom: '2026-09-05T00:00:00Z',
    queryTo: '2026-11-05T00:00:00Z',
    items: [item],
    count: 1,
    nextCursor: 'next-page',
  })
})

describe('AdminAppointmentMonitor', () => {
  it('renders authoritative operational facts without private content', async () => {
    const { container } = render(<AdminAppointmentMonitor />)
    expect(await screen.findByText('#11111111')).toBeVisible()
    expect(screen.getAllByText('CONFIRMED')).toHaveLength(2)
    expect(screen.getByText('HELD')).toBeVisible()
    expect(screen.getByText(/Nguồn: Consultation/)).toBeVisible()
    expect(screen.getByText(/CURRENT/)).toBeVisible()
    expect(container).not.toHaveTextContent('ConsultationBrief')
    expect(container).not.toHaveTextContent('chat body')
    expect(container).not.toHaveTextContent('assessmentAnswers')
  })

  it('applies bounded filters and follows the server cursor', async () => {
    const user = userEvent.setup()
    render(<AdminAppointmentMonitor />)
    await screen.findByText('#11111111')
    await user.selectOptions(screen.getByLabelText('Trạng thái'), 'CONFIRMED')
    await user.selectOptions(screen.getByLabelText('Hình thức'), 'IN_APP_CHAT')
    await user.click(screen.getByRole('button', { name: 'Áp dụng bộ lọc' }))
    await waitFor(() =>
      expect(appointmentClient.search).toHaveBeenCalledTimes(2),
    )
    expect(appointmentClient.search.mock.calls[1][0]).toMatchObject({
      status: 'CONFIRMED',
      modality: 'IN_APP_CHAT',
      limit: 20,
    })
    await user.click(screen.getByRole('button', { name: 'Trang sau' }))
    await waitFor(() =>
      expect(appointmentClient.search).toHaveBeenCalledTimes(3),
    )
    expect(appointmentClient.search.mock.calls[2][0]).toMatchObject({
      cursor: 'next-page',
    })
  })

  it('shows owner unavailability explicitly and does not retain stale rows', async () => {
    appointmentClient.search.mockRejectedValue(new Error('offline'))
    render(<AdminAppointmentMonitor />)
    expect(await screen.findByRole('alert')).toHaveTextContent('không khả dụng')
    expect(screen.queryByText('#11111111')).not.toBeInTheDocument()
  })
})
