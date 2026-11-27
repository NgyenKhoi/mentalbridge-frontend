import { describe, expect, it } from 'vitest'
import { appointmentDaysAway, homeAppointmentView } from './home-appointment'
import { homeAppointmentFixture } from './testing/home-secondary-fixtures'

describe('Home appointment presentation', () => {
  const appointment = homeAppointmentFixture({
    scheduledStartAt: '2026-10-24T02:00:00Z',
    scheduledEndAt: '2026-10-24T02:50:00Z',
  })

  it('formats the real appointment date and time in Vietnamese and its own timezone', () => {
    const view = homeAppointmentView(
      appointment,
      new Date('2026-10-22T12:00:00Z'),
    )
    expect(view.weekday).toBe('Thứ Bảy')
    expect(view.day).toBe('24')
    expect(view.month).toBe('tháng 10')
    expect(view.timeRange).toBe('09:00 – 09:50')
    expect(view.countdown).toBe('còn 2 ngày')
    expect(view.modality).toBe('Gọi video')
    expect(view.specialistName).toBe('Nguyễn Minh An')
    expect(view.href).toBe(`/appointments/${appointment.id}`)
  })

  it('counts calendar days instead of rounding the remaining hours', () => {
    expect(
      appointmentDaysAway(appointment, new Date('2026-10-23T16:59:00Z')),
    ).toBe(1)
    expect(
      appointmentDaysAway(appointment, new Date('2026-10-23T17:01:00Z')),
    ).toBe(0)
    expect(
      homeAppointmentView(appointment, new Date('2026-10-24T00:00:00Z'))
        .countdown,
    ).toBe('hôm nay')
  })

  it('shows ongoing status and chat modality without granting session authority', () => {
    const view = homeAppointmentView(
      { ...appointment, status: 'IN_PROGRESS', modality: 'IN_APP_CHAT' },
      new Date('2026-10-24T02:10:00Z'),
    )
    expect(view.countdown).toBe('đang diễn ra')
    expect(view.modality).toBe('Nhắn tin')
    expect(view.href).toBe(`/appointments/${appointment.id}`)
  })
})
