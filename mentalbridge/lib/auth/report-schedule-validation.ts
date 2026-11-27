import type {
  PlatformReportSchedule,
  PlatformReportScheduleRequest,
} from '@/features/auth/api/identity-contract'

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validScope(value: Record<string, unknown>) {
  if (
    value.reportType !== 'ACCOUNT_ACTIVITY' ||
    !['DAILY', 'WEEKLY', 'MONTHLY'].includes(String(value.cadence)) ||
    typeof value.timezone !== 'string' ||
    value.timezone.length > 64 ||
    typeof value.localTime !== 'string' ||
    !/^([01]\d|2[0-3]):[0-5]\d(:00)?$/.test(value.localTime) ||
    typeof value.periodDays !== 'number' ||
    !Number.isInteger(value.periodDays) ||
    value.periodDays < 1 ||
    value.periodDays > 366 ||
    value.recipientGroup !== 'ADMIN' ||
    value.deliveryTarget !== 'ADMIN_REPORT_HISTORY'
  )
    return false
  try {
    new Intl.DateTimeFormat('vi', { timeZone: value.timezone })
    return value.timezone.length > 0
  } catch {
    return false
  }
}

export function parseReportScheduleRequest(
  value: unknown,
): PlatformReportScheduleRequest | null {
  if (
    !record(value) ||
    !validScope(value) ||
    typeof value.enabled !== 'boolean' ||
    Object.keys(value).some(
      (key) =>
        ![
          'reportType',
          'cadence',
          'timezone',
          'localTime',
          'periodDays',
          'recipientGroup',
          'deliveryTarget',
          'enabled',
        ].includes(key),
    )
  )
    return null
  return value as PlatformReportScheduleRequest
}

export function parseReportSchedule(
  value: unknown,
): PlatformReportSchedule | null {
  if (
    !record(value) ||
    !validScope(value) ||
    typeof value.scheduleId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value.scheduleId,
    ) ||
    !['ACTIVE', 'PAUSED'].includes(String(value.status)) ||
    typeof value.version !== 'number' ||
    !Number.isSafeInteger(value.version) ||
    value.version < 0 ||
    !['nextRunAt', 'createdAt', 'updatedAt'].every(
      (key) =>
        typeof value[key] === 'string' &&
        Number.isFinite(Date.parse(value[key])),
    ) ||
    (value.lastFailureCode !== null &&
      value.lastFailureCode !== 'ADMIN_ACCESS_UNAVAILABLE')
  )
    return null
  return {
    scheduleId: value.scheduleId,
    reportType: 'ACCOUNT_ACTIVITY',
    cadence: value.cadence as PlatformReportSchedule['cadence'],
    timezone: value.timezone as string,
    localTime: value.localTime as string,
    periodDays: value.periodDays as number,
    recipientGroup: 'ADMIN',
    deliveryTarget: 'ADMIN_REPORT_HISTORY',
    status: value.status as PlatformReportSchedule['status'],
    nextRunAt: value.nextRunAt as string,
    createdAt: value.createdAt as string,
    updatedAt: value.updatedAt as string,
    version: value.version,
    lastFailureCode: value.lastFailureCode,
  }
}

export function parseReportSchedules(
  value: unknown,
): PlatformReportSchedule[] | null {
  if (!Array.isArray(value) || value.length > 50) return null
  const schedules = value.map(parseReportSchedule)
  return schedules.every(
    (item): item is PlatformReportSchedule => item !== null,
  )
    ? schedules
    : null
}
