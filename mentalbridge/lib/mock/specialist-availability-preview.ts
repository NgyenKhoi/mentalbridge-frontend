export const FEATURES: { repeatWeekly: boolean } = {
  repeatWeekly: true,
} as const

export const MOCK_AVAILABILITY_REST_DAYS = ['2026-10-16']

export function nextWeekAtLocalTime(instant: string, timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  })
  const values = (date: Date) => Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  )
  const original = values(new Date(instant))
  const desired = Date.UTC(
    Number(original.year), Number(original.month) - 1, Number(original.day) + 7,
    Number(original.hour), Number(original.minute), Number(original.second),
  )
  let candidate = desired
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const represented = values(new Date(candidate))
    const representedUtc = Date.UTC(
      Number(represented.year), Number(represented.month) - 1, Number(represented.day),
      Number(represented.hour), Number(represented.minute), Number(represented.second),
    )
    candidate += desired - representedUtc
  }
  return new Date(candidate).toISOString()
}
