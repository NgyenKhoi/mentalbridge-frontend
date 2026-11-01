import type { Appointment } from '@/lib/consultation/consultation-validation'

/** Calendar-day countdown in the appointment's own zone, including DST boundaries. */
export function appointmentDaysAway(appointment: Appointment, now: Date) {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: appointment.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return Math.max(
    0,
    Math.round(
      (Date.parse(formatter.format(new Date(appointment.scheduledStartAt))) -
        Date.parse(formatter.format(now))) /
        86_400_000,
    ),
  )
}

export function homeAppointmentView(appointment: Appointment, now: Date) {
  const start = new Date(appointment.scheduledStartAt)
  const end = new Date(appointment.scheduledEndAt)
  const format = (options: Intl.DateTimeFormatOptions, value = start) =>
    new Intl.DateTimeFormat('vi-VN', {
      ...options,
      timeZone: appointment.timezone,
    }).format(value)
  const days = appointmentDaysAway(appointment, now)
  return {
    weekday: format({ weekday: 'long' }),
    day: format({ day: 'numeric' }),
    month: format({ month: 'long' }).toLocaleLowerCase('vi-VN'),
    dateLabel: format({ dateStyle: 'full' }),
    timeRange: `${format({ hour: '2-digit', minute: '2-digit' })} – ${format(
      { hour: '2-digit', minute: '2-digit' },
      end,
    )}`,
    modality:
      appointment.modality === 'IN_APP_VIDEO' ? 'Gọi video' : 'Nhắn tin',
    countdown:
      appointment.status === 'IN_PROGRESS'
        ? 'đang diễn ra'
        : days === 0
          ? 'hôm nay'
          : `còn ${days} ngày`,
    specialistName: appointment.specialistDisplayName,
    specialistInitials:
      appointment.specialistDisplayName
        .trim()
        .split(/\s+/)
        .slice(-2)
        .map((part) => part[0])
        .join('') || 'CG',
    href: `/appointments/${encodeURIComponent(appointment.id)}`,
  }
}
