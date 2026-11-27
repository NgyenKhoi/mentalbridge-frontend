import type { AxiosInstance } from 'axios'
import { z } from 'zod'

import { ApiError } from '@/api/api-error'

const registrationSchema = z.strictObject({
  platform: z.literal('ANDROID'),
  provider: z.literal('EXPO'),
  providerToken: z.string().min(1).max(512),
  permissionStatus: z.enum(['GRANTED', 'DENIED']),
  appVersion: z.string().max(32).optional(),
})

export type PushRegistration = z.infer<typeof registrationSchema>

export interface PushApi {
  register(installationId: string, body: PushRegistration): Promise<void>
  revoke(installationId: string): Promise<void>
}

const path = (installationId: string) =>
  `/api/v1/push-devices/${encodeURIComponent(z.uuid().parse(installationId))}`

export function createPushApi(client: AxiosInstance): PushApi {
  return {
    async register(installationId, body) {
      await client.put(path(installationId), registrationSchema.parse(body))
    },
    async revoke(installationId) {
      try {
        await client.delete(path(installationId))
      } catch (error) {
        // Already revoked or never registered: the goal state holds.
        if (error instanceof ApiError && error.status === 404) return
        throw error
      }
    },
  }
}
