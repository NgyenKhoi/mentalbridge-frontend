import type { AxiosInstance } from 'axios'
import { z } from 'zod'
import { ApiError } from '@/api/api-error'
import {
  channelsSchema,
  emailSchema,
  groupsSchema,
  preferencesSchema,
  quietHoursSchema,
} from '@/notifications/notification-contract'
import type { ReminderOverview, ReminderSource } from './reminder-model'

const timeZoneSchema = z
  .string()
  .min(1)
  .max(64)
  .refine((timeZone) => {
    try {
      new Intl.DateTimeFormat('vi-VN', { timeZone }).format()
      return true
    } catch {
      return false
    }
  })
const time = z.iso.datetime({ offset: true })
const deliveryStateSchema = z.enum([
  'PENDING',
  'PROCESSING',
  'CLAIMED',
  'DELIVERED',
  'FAILED',
  'CANCELLED',
  'INVALIDATED',
  'SUPPRESSED',
  'EXPIRED',
  'UNKNOWN',
])
const previewSchema = z.object({
  kind: z.enum([
    'JOURNAL_REMINDER',
    'EMOTION_CHECKIN_REMINDER',
    'DAILY_DIGEST',
    'RESOURCE_REMINDER',
    'APPOINTMENT_EMAIL',
  ]),
  channel: z.enum(['IN_APP', 'EMAIL']),
  state: z.enum([
    'ELIGIBLE',
    'SCHEDULED',
    'QUIET_HOURS',
    'PAUSED',
    'DISABLED',
    'COMPLETED',
    'NOT_NEEDED',
    'ALREADY_DELIVERED',
    'IN_PROGRESS',
    'UNAVAILABLE',
  ]),
  nextEligibleAt: time.nullable(),
  estimate: z.literal(true),
  latestDelivery: z
    .object({ state: deliveryStateSchema, recordedAt: time })
    .nullable(),
})
const activitySchema = z.object({
  id: z.string().min(1).max(64),
  category: z.enum(['JOURNAL', 'EMOTION_CHECK_IN']),
  status: z.enum(['DUE', 'COMPLETED']),
  action: z.enum(['OPEN_JOURNAL', 'OPEN_EMOTION_CHECK_IN']),
})

function localDate(instant: string, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(instant))
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((value) => value.type === type)?.value ?? ''
    return `${part('year')}-${part('month')}-${part('day')}`
  } catch {
    return null
  }
}

export const reminderResponseSchema = z
  .object({
    schemaVersion: z.literal('1.0'),
    asOf: time,
    localDate: z.iso.date(),
    timeZone: timeZoneSchema,
    preferences: preferencesSchema.strip().extend({
      channels: channelsSchema.strip(),
      contentGroups: groupsSchema.strip(),
      quietHours: quietHoursSchema.strip().extend({ timeZone: timeZoneSchema }),
      email: emailSchema.strip(),
    }),
    today: z.array(activitySchema).max(2),
    previews: z.array(previewSchema).max(5),
    unavailableCategories: z
      .array(z.enum(['SUPPORT_PLAN', 'RESOURCES', 'ASSESSMENT', 'PUSH']))
      .max(4),
  })
  .superRefine((value, context) => {
    const invalid =
      value.timeZone !== value.preferences.quietHours.timeZone ||
      localDate(value.asOf, value.timeZone) !== value.localDate ||
      (!value.preferences.notificationsEnabled &&
        value.previews.some((item) => item.state !== 'PAUSED')) ||
      new Set(value.today.map((item) => item.category)).size !==
        value.today.length ||
      new Set(value.previews.map((item) => item.kind)).size !==
        value.previews.length ||
      new Set(value.unavailableCategories).size !==
        value.unavailableCategories.length ||
      value.today.some(
        (item) =>
          item.id !== `${item.category}:${value.localDate}` ||
          item.action !==
            (item.category === 'JOURNAL'
              ? 'OPEN_JOURNAL'
              : 'OPEN_EMOTION_CHECK_IN'),
      ) ||
      value.previews.some(
        (item) =>
          item.channel !==
            (['JOURNAL_REMINDER', 'EMOTION_CHECKIN_REMINDER'].includes(
              item.kind,
            )
              ? 'IN_APP'
              : 'EMAIL') ||
          (item.nextEligibleAt !== null &&
            (!['ELIGIBLE', 'SCHEDULED', 'QUIET_HOURS'].includes(item.state) ||
              Date.parse(item.nextEligibleAt) < Date.parse(value.asOf) ||
              localDate(item.nextEligibleAt, value.timeZone) !==
                value.localDate)),
      )
    if (invalid)
      context.addIssue({
        code: 'custom',
        message: 'Reminder response is inconsistent.',
      })
  })
export type ReminderResponse = z.infer<typeof reminderResponseSchema>

const previewLabels: Record<
  ReminderResponse['previews'][number]['kind'],
  string
> = {
  JOURNAL_REMINDER: 'Nhắc viết nhật ký',
  EMOTION_CHECKIN_REMINDER: 'Nhắc ghi nhận cảm xúc',
  DAILY_DIGEST: 'Tổng hợp việc hôm nay',
  RESOURCE_REMINDER: 'Nhắc tài nguyên',
  APPOINTMENT_EMAIL: 'Email nhắc lịch hẹn',
}
const stateLabels: Record<
  ReminderResponse['previews'][number]['state'],
  string
> = {
  ELIGIBLE: 'Có thể được nhắc',
  SCHEDULED: 'Thời điểm nhắc dự kiến',
  QUIET_HOURS: 'Đang trong giờ yên tĩnh',
  PAUSED: 'Đang tạm dừng',
  DISABLED: 'Đã tắt',
  COMPLETED: 'Hoạt động đã hoàn thành',
  NOT_NEEDED: 'Hiện không có nội dung cần nhắc',
  ALREADY_DELIVERED: 'Đã có ghi nhận gửi',
  IN_PROGRESS: 'Đang xử lý',
  UNAVAILABLE: 'Chưa có thời điểm nhắc khả dụng',
}
const deliveryLabels: Record<z.infer<typeof deliveryStateSchema>, string> = {
  PENDING: 'Đang chờ',
  PROCESSING: 'Đang xử lý',
  CLAIMED: 'Đang xử lý',
  DELIVERED: 'Đã gửi',
  FAILED: 'Gửi chưa thành công',
  CANCELLED: 'Đã hủy lời nhắc',
  INVALIDATED: 'Lời nhắc không còn hiệu lực',
  SUPPRESSED: 'Lời nhắc đã được ngừng',
  EXPIRED: 'Lời nhắc đã hết hạn',
  UNKNOWN: 'Chưa xác nhận được kết quả gửi',
}
const unsupportedLabels = {
  SUPPORT_PLAN: 'Kế hoạch hỗ trợ',
  RESOURCES: 'Tài nguyên riêng lẻ',
  ASSESSMENT: 'Sàng lọc lại',
  PUSH: 'Thông báo đẩy',
} as const

export function toReminderOverview(
  response: ReminderResponse,
): ReminderOverview {
  const times = response.previews
    .flatMap((item) => (item.nextEligibleAt ? [item.nextEligibleAt] : []))
    .sort((a, b) => Date.parse(a) - Date.parse(b))
  return {
    state: 'ready',
    localDate: response.localDate,
    timeZone: response.timeZone,
    today: response.today.map((item) => ({
      id: item.id,
      title: item.category === 'JOURNAL' ? 'Viết nhật ký' : 'Ghi nhận cảm xúc',
      category: item.category === 'JOURNAL' ? 'journal' : 'emotion',
      status: item.status === 'COMPLETED' ? 'completed' : 'due',
      scheduledAt: null,
      destination: item.category === 'JOURNAL' ? 'journal' : 'emotion',
    })),
    upcoming: [],
    delivery: !response.preferences.notificationsEnabled
      ? { state: 'paused' }
      : response.previews.some((item) => item.state === 'QUIET_HOURS')
        ? {
            state: 'quiet-hours',
            start: response.preferences.quietHours.start,
            end: response.preferences.quietHours.end,
          }
        : { state: 'available', nextEligibleAt: times[0] ?? null },
    deliveryPreviews: response.previews.map((item) => ({
      id: item.kind,
      title: previewLabels[item.kind],
      channel: item.channel === 'IN_APP' ? 'Trong ứng dụng' : 'Email',
      status: stateLabels[item.state],
      nextEligibleAt: item.nextEligibleAt,
      latestDelivery: item.latestDelivery
        ? {
            label: deliveryLabels[item.latestDelivery.state],
            recordedAt: item.latestDelivery.recordedAt,
          }
        : null,
    })),
    unsupportedCategories: response.unavailableCategories.map(
      (item) => unsupportedLabels[item],
    ),
  }
}

export function createReminderSource(client: AxiosInstance): ReminderSource {
  return {
    async read(signal) {
      let data: unknown
      try {
        data = (await client.get('/api/v1/reminder-overview', { signal })).data
      } catch (error) {
        if (error instanceof ApiError && [404, 501].includes(error.status ?? 0))
          return { state: 'unavailable' }
        throw error
      }
      const parsed = reminderResponseSchema.safeParse(data)
      if (!parsed.success)
        throw new ApiError({
          code: 'REMINDER_CONTRACT_MISMATCH',
          status: 502,
          message: 'Reminder response is inconsistent.',
        })
      return toReminderOverview(parsed.data)
    },
  }
}
