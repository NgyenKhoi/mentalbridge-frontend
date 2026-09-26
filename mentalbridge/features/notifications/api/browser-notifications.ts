import type { components } from '@/contracts/content.generated'
import { browserApiClient } from '@/lib/api/browser-client'

export type Notification = components['schemas']['Notification']
export type NotificationPage = components['schemas']['NotificationPage']

export async function getNotifications(cursor?: string) {
  const response = await browserApiClient.get<NotificationPage>(
    '/notifications',
    { params: { limit: 20, ...(cursor ? { cursor } : {}) } },
  )
  return response.data
}

export async function markNotificationRead(id: string) {
  const response = await browserApiClient.patch<Notification>(
    `/notifications/${encodeURIComponent(id)}/read`,
  )
  return response.data
}

export async function markAllNotificationsRead() {
  const response = await browserApiClient.post<{ updatedCount: number }>(
    '/notifications/mark-all-read',
  )
  return response.data
}

export async function deleteNotification(id: string) {
  await browserApiClient.delete(`/notifications/${encodeURIComponent(id)}`)
}
