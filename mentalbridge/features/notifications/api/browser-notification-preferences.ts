import type { components } from '@/contracts/content.generated'
import { ApiError } from '@/lib/api/api-error'
import { browserApiClient } from '@/lib/api/browser-client'

export type NotificationPreferences =
  components['schemas']['NotificationPreferences']
export type NotificationPreferencePatch =
  components['schemas']['NotificationPreferencePatch']

export type VersionedNotificationPreferences = Readonly<{
  preferences: NotificationPreferences
  etag: string
}>

function versioned(
  preferences: NotificationPreferences,
  etag: string | undefined,
): VersionedNotificationPreferences {
  if (!etag || !/^"(0|[1-9]\d*)"$/.test(etag)) {
    throw new ApiError({
      message: 'Notification preferences returned an invalid version.',
      code: 'CONTENT_MALFORMED_RESPONSE',
      status: 502,
    })
  }
  return { preferences, etag }
}

export async function getNotificationPreferences() {
  const response = await browserApiClient.get<NotificationPreferences>(
    '/notifications/preferences',
  )
  return versioned(response.data, response.headers.etag)
}

export async function saveNotificationPreferences(
  patch: NotificationPreferencePatch,
  etag: string,
) {
  const response = await browserApiClient.patch<NotificationPreferences>(
    '/notifications/preferences',
    patch,
    { headers: { 'If-Match': etag } },
  )
  return versioned(response.data, response.headers.etag)
}
