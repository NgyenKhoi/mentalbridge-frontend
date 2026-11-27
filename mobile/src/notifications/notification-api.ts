import type { AxiosInstance } from 'axios'
import { z } from 'zod'
import { ApiError } from '@/api/api-error'
import {
  etagSchema,
  notificationSchema,
  notificationPageSchema,
  preferencesSchema,
  preferencePatchSchema,
  type InboxNotification,
  type NotificationPage,
  type PreferencePatch,
  type VersionedPreferences,
} from './notification-contract'

export interface NotificationApi {
  list(cursor?: string): Promise<NotificationPage>
  markRead(id: string): Promise<InboxNotification>
  markAllRead(): Promise<{ updatedCount: number }>
  preferences(): Promise<VersionedPreferences>
  savePreferences(
    patch: PreferencePatch,
    etag: string,
  ): Promise<VersionedPreferences>
}
function mismatch(): never {
  throw new ApiError({
    code: 'NOTIFICATION_CONTRACT_MISMATCH',
    status: 502,
    message: 'Notification response is inconsistent.',
  })
}
function versioned(data: unknown, header: unknown): VersionedPreferences {
  const preferences = preferencesSchema.parse(data)
  const etag = etagSchema.parse(header)
  if (etag !== `"${preferences.version}"`) mismatch()
  return { preferences, etag }
}
export function createNotificationApi(client: AxiosInstance): NotificationApi {
  return {
    async list(cursor) {
      const page = notificationPageSchema.parse(
        (
          await client.get('/api/v1/notifications', {
            params: {
              limit: 20,
              ...(cursor
                ? { cursor: z.string().min(1).max(256).parse(cursor) }
                : {}),
            },
          })
        ).data,
      )
      if (cursor && page.nextCursor === cursor) mismatch()
      return page
    },
    async markRead(id) {
      const expected = z.uuid().parse(id)
      const item = notificationSchema.parse(
        (
          await client.patch(
            `/api/v1/notifications/${encodeURIComponent(expected)}/read`,
          )
        ).data,
      )
      if (item.id !== expected || !item.read) mismatch()
      return item
    },
    async markAllRead() {
      return z
        .strictObject({ updatedCount: z.number().int().nonnegative() })
        .parse((await client.post('/api/v1/notifications/mark-all-read')).data)
    },
    async preferences() {
      const response = await client.get('/api/v1/notification-preferences')
      return versioned(response.data, response.headers.etag)
    },
    async savePreferences(patch, etag) {
      const response = await client.patch(
        '/api/v1/notification-preferences',
        preferencePatchSchema.parse(patch),
        { headers: { 'If-Match': etagSchema.parse(etag) } },
      )
      return versioned(response.data, response.headers.etag)
    },
  }
}
