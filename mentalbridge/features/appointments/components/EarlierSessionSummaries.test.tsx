import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Appointment } from '@/lib/consultation/consultation-validation'
import type { SessionSummary } from '@/lib/consultation/session-summary-validation'
import { EarlierSessionSummaries } from './EarlierSessionSummaries'

const api = vi.hoisted(() => ({ list: vi.fn(), updateConsent: vi.fn() }))
vi.mock('../api/session-summary-browser-client', () => ({
  sessionSummaryBrowserClient: api,
}))

const appointment = {
  id: '10000000-0000-4000-8000-000000000001',
  specialistDisplayName: 'ThS. Trần Minh Khuê',
  scheduledStartAt: '2026-11-12T02:00:00Z',
  scheduledEndAt: '2026-11-12T03:00:00Z',
  timezone: 'Asia/Ho_Chi_Minh',
  status: 'COMPLETED',
} as Appointment

const summary = {
  id: '20000000-0000-4000-8000-000000000001',
  appointmentId: appointment.id,
  version: 1,
  specialistNoteForUser: 'Bạn đã làm rất tốt khi ghi lại cảm xúc mỗi tối.',
  progressSummary: null,
  reuseConsent: null,
  agreedNextSteps: [
    {
      id: '30000000-0000-4000-8000-000000000001',
      title: 'Hít thở 4-7-8 trước khi ngủ',
      state: 'COMPLETED',
      hidden: false,
    },
    {
      id: '30000000-0000-4000-8000-000000000002',
      title: 'Bước đã ẩn',
      state: 'PENDING',
      hidden: true,
    },
  ],
} as unknown as SessionSummary

describe('EarlierSessionSummaries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.list.mockResolvedValue({ items: [summary], count: 1 })
  })

  it('renders nothing when there is no earlier session', () => {
    const { container } = render(
      <EarlierSessionSummaries
        appointments={[]}
        disabled={false}
        onUse={vi.fn()}
      />,
    )
    expect(container).toBeEmptyDOMElement()
    expect(api.list).not.toHaveBeenCalled()
  })

  it('shows the published note and visible steps, and hands them to the brief', async () => {
    const onUse = vi.fn()
    render(
      <EarlierSessionSummaries
        appointments={[appointment]}
        disabled={false}
        onUse={onUse}
      />,
    )

    expect(
      await screen.findByText('Hít thở 4-7-8 trước khi ngủ'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Bước đã ẩn')).not.toBeInTheDocument()
    expect(api.list).toHaveBeenCalledWith(appointment.id, 'USER')

    await userEvent.click(
      screen.getByRole('button', { name: 'Đưa vào tóm tắt' }),
    )
    expect(onUse).toHaveBeenCalledWith(
      'Từ buổi 12/11/2026 với ThS. Trần Minh Khuê:\nBạn đã làm rất tốt khi ghi lại cảm xúc mỗi tối.\n- Hít thở 4-7-8 trước khi ngủ (đã hoàn thành)',
    )
  })

  it('saves reuse consent for that summary', async () => {
    api.updateConsent.mockResolvedValue({
      ...summary,
      reuseConsent: { approved: true, version: 1 },
    })
    render(
      <EarlierSessionSummaries
        appointments={[appointment]}
        disabled={false}
        onUse={vi.fn()}
      />,
    )

    await userEvent.click(
      await screen.findByRole('checkbox', {
        name: 'Cho chuyên gia buổi sau xem lại',
      }),
    )
    expect(api.updateConsent).toHaveBeenCalledWith(summary.id, true, 0)
    await waitFor(() =>
      expect(
        screen.getByRole('checkbox', {
          name: 'Cho chuyên gia buổi sau xem lại',
        }),
      ).toBeChecked(),
    )
  })
})
