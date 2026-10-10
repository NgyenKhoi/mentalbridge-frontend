export function dateInTimezone(instant: number, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(instant))
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  )
  return `${values.year}-${values.month}-${values.day}`
}

export function dateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function addDays(date: string, days: number) {
  const result = new Date(`${date}T12:00:00Z`)
  result.setUTCDate(result.getUTCDate() + days)
  return dateKey(result)
}

export function availabilityWindow(date: string) {
  return {
    from: `${addDays(date, -7)}T00:00:00.000Z`,
    to: `${addDays(date, 90)}T00:00:00.000Z`,
  }
}

export function formatDate(date: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'UTC',
    ...options,
  }).format(new Date(`${date}T12:00:00Z`))
}

export function validTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat('vi-VN', { timeZone: timezone }).format()
    return timezone.length > 0
  } catch {
    return false
  }
}

export function timezoneOffset(timezone: string, instant: number) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: timezone,
    timeZoneName: 'shortOffset',
  })
    .formatToParts(new Date(instant))
    .find((part) => part.type === 'timeZoneName')?.value
}

function partsAt(instant: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant)
  return Object.fromEntries(parts.map((part) => [part.type, part.value]))
}

export function localSlotToUtc(date: string, time: string, timezone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time)
  if (!match || !timeMatch) throw new Error('Ngày hoặc giờ không hợp lệ.')
  const desired = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
  )
  let candidate = desired
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const values = partsAt(new Date(candidate), timezone)
    const represented = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second),
    )
    candidate += desired - represented
  }
  const verified = partsAt(new Date(candidate), timezone)
  if (
    verified.year !== match[1] ||
    verified.month !== match[2] ||
    verified.day !== match[3] ||
    verified.hour !== timeMatch[1] ||
    verified.minute !== timeMatch[2]
  ) {
    throw new Error('Giờ đã chọn không tồn tại trong múi giờ này.')
  }
  const startAt = new Date(candidate)
  return {
    startAt: startAt.toISOString(),
    endAt: new Date(startAt.getTime() + 60 * 60 * 1000).toISOString(),
  }
}

export function formatTime(instant: string, timezone: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(instant))
}
