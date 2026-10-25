import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { appointmentBrowserClient } from '@/features/appointments/api/browser-client'
import { HomeUpcomingAppointment } from './HomeUpcomingAppointment'
import { homeAppointmentFixture } from './testing/home-secondary-fixtures'

vi.mock('@/features/appointments/api/browser-client', () => ({
  appointmentBrowserClient: { list: vi.fn() },
}))

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(appointmentBrowserClient.list).mockResolvedValue({
    items: [],
    count: 0,
    generatedAt: '2026-10-22T12:00:00Z',
  })
})

describe('HomeUpcomingAppointment', () => {
  it('holds the appointment skeleton until its own request completes', () => {
    vi.mocked(appointmentBrowserClient.list).mockReturnValue(
      new Promise(() => {}),
    )
    render(<HomeUpcomingAppointment />)
    expect(
      screen.getByRole('status', { name: 'Đang tải lịch hẹn' }),
    ).toHaveAttribute('aria-busy', 'true')
  })

  it('renders the next confirmed appointment and its real specialist, skipping requested/cancelled entries', async () => {
    const next = homeAppointmentFixture()
    vi.mocked(appointmentBrowserClient.list).mockResolvedValue({
      items: [
        homeAppointmentFixture({ id: 'requested', status: 'REQUESTED' }),
        homeAppointmentFixture({ id: 'cancelled', status: 'CANCELLED' }),
        next,
        homeAppointmentFixture({
          id: 'later',
          scheduledStartAt: '2099-11-24T02:00:00Z',
          scheduledEndAt: '2099-11-24T02:50:00Z',
        }),
      ],
      count: 4,
      generatedAt: '2026-10-22T12:00:00Z',
    })
    render(<HomeUpcomingAppointment />)
    await screen.findByText(next.specialistDisplayName)
    expect(screen.getByText('09:00 – 09:50')).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Xem chi tiết buổi hẹn →' }),
    ).toHaveAttribute('href', `/appointments/${next.id}`)
    expect(screen.queryByText(/LĨNH VỰC|Tâm lý lâm sàng/)).toBeNull()
  })

  it('offers specialist discovery when no appointment is upcoming', async () => {
    render(<HomeUpcomingAppointment />)
    const message = await screen.findByText('Chưa có buổi hẹn nào sắp tới.')
    expect(message.parentElement?.querySelector('svg')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
    expect(
      screen.getByRole('link', { name: 'Tìm chuyên gia →' }),
    ).toHaveAttribute('href', '/specialists')
  })

  it('recovers from a section-local error with a fresh read', async () => {
    vi.mocked(appointmentBrowserClient.list).mockRejectedValueOnce(
      new Error('503'),
    )
    render(<HomeUpcomingAppointment />)
    await screen.findByText('Chưa tải được lịch hẹn.')
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    await screen.findByText('Chưa có buổi hẹn nào sắp tới.')
    expect(appointmentBrowserClient.list).toHaveBeenCalledTimes(2)
  })
})
