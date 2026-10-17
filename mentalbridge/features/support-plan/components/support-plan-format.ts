import type { SupportPlanOccurrence } from '../api/support-plan-contract'

const DISPLAY_TIME_ZONE = 'Asia/Ho_Chi_Minh'

function partsFor(value: Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('vi-VN', options)
    .formatToParts(value)
    .reduce<Record<string, string>>((parts, part) => {
      if (part.type !== 'literal') parts[part.type] = part.value
      return parts
    }, {})
}

export function formatSupportPlanUpdatedAt(value?: string) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const parts = partsFor(date, {
    timeZone: DISPLAY_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour12: false,
  })

  return `${parts.hour}:${parts.minute}, ${parts.day}/${parts.month}/${parts.year}`
}

export function formatActivityDate(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return dateValue

  const parts = partsFor(date, {
    timeZone: 'UTC',
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const weekday = parts.weekday
    ? `${parts.weekday.charAt(0).toUpperCase()}${parts.weekday.slice(1)}`
    : ''

  return `${weekday}, ${parts.day}/${parts.month}/${parts.year}`
}

export function formatActivityDateTime(occurrence: SupportPlanOccurrence) {
  return `${formatActivityDate(occurrence.localDate)} · ${occurrence.localTime.slice(0, 5)}`
}
