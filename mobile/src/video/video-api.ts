import type { AxiosInstance } from 'axios'
import { z } from 'zod'
import { ApiError } from '@/api/api-error'
import {
  appointmentVersionSchema,
  commandKeySchema,
} from '@/appointments/appointment-contract'
import {
  videoSessionSchema,
  videoAccessSchema,
  videoCompletionSchema,
} from './video-contract'

function response<T extends { appointmentId: string }>(
  schema: z.ZodType<T>,
  input: unknown,
  appointmentId: string,
): T {
  const parsed = schema.safeParse(input)
  if (!parsed.success || parsed.data.appointmentId !== appointmentId)
    throw new ApiError({
      code: 'VIDEO_CONTRACT_MISMATCH',
      status: 502,
      message: 'Video response is unavailable.',
    })
  return parsed.data
}
export function createVideoApi(client: AxiosInstance) {
  return {
    async session(appointmentId: string) {
      const id = z.uuid().parse(appointmentId)
      return response(
        videoSessionSchema,
        (
          await client.get(
            `/api/v1/appointments/${encodeURIComponent(id)}/video-session`,
          )
        ).data,
        id,
      )
    },
    async access(appointmentId: string) {
      const id = z.uuid().parse(appointmentId)
      return response(
        videoAccessSchema,
        (
          await client.post(
            `/api/v1/appointments/${encodeURIComponent(id)}/video-access`,
          )
        ).data,
        id,
      )
    },
    async complete(appointmentId: string, version: number, key: string) {
      const id = z.uuid().parse(appointmentId)
      const data = (
        await client.post(
          `/api/v1/specialist/appointments/${encodeURIComponent(id)}/video-completion`,
          { confirmation: 'CONSULTATION_FINISHED' },
          {
            headers: {
              'If-Match': `"${appointmentVersionSchema.parse(version)}"`,
              'Idempotency-Key': commandKeySchema.parse(key),
            },
          },
        )
      ).data
      return response(videoCompletionSchema, data, id)
    },
  }
}
export type VideoApi = ReturnType<typeof createVideoApi>
