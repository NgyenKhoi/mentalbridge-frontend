const localDateTimePattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/

export function formatJournalLocalDateTime(date: Date): string {
  const localTime = new Date(
    date.getTime() - date.getTimezoneOffset() * 60 * 1_000,
  )
  return localTime.toISOString().slice(0, 16)
}

export function journalLocalDateTimeToIso(value: string): string | null {
  const match = localDateTimePattern.exec(value)
  if (!match) return null
  const [
    ,
    yearValue,
    monthValue,
    dayValue,
    hourValue,
    minuteValue,
    secondValue,
  ] = match
  const year = Number(yearValue)
  const month = Number(monthValue)
  const day = Number(dayValue)
  const hour = Number(hourValue)
  const minute = Number(minuteValue)
  const second = Number(secondValue ?? '0')
  const local = new Date(year, month - 1, day, hour, minute, second, 0)
  if (
    local.getFullYear() !== year ||
    local.getMonth() !== month - 1 ||
    local.getDate() !== day ||
    local.getHours() !== hour ||
    local.getMinutes() !== minute ||
    local.getSeconds() !== second
  )
    return null
  return local.toISOString()
}
