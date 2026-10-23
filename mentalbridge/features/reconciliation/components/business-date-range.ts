const BUSINESS_OFFSET_HOURS = 7

function utcBoundary(value: string, nextDay: boolean): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 1000) return null
  const calendarDay = new Date(Date.UTC(year, month - 1, day))
  if (
    calendarDay.getUTCFullYear() !== year ||
    calendarDay.getUTCMonth() !== month - 1 ||
    calendarDay.getUTCDate() !== day
  )
    return null
  return new Date(
    Date.UTC(year, month - 1, day + Number(nextDay), -BUSINESS_OFFSET_HOURS),
  ).toISOString()
}

export function businessDateRange(
  fromDate: string,
  toDate: string,
): {
  error: string | null
  query: Record<string, string>
} {
  const from = fromDate ? utcBoundary(fromDate, false) : null
  const toExclusive = toDate ? utcBoundary(toDate, true) : null
  if ((fromDate && !from) || (toDate && !toExclusive)) {
    return { error: 'Ngày không hợp lệ', query: {} }
  }
  if (from && toExclusive && from >= toExclusive) {
    return { error: 'Từ ngày không thể lớn hơn đến ngày', query: {} }
  }
  return {
    error: null,
    query: {
      ...(from ? { from } : {}),
      ...(toExclusive ? { toExclusive } : {}),
    },
  }
}
