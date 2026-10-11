import type { AxiosInstance } from 'axios'
import { z } from 'zod'
import { ApiError } from '@/api/api-error'
import { appointmentListSchema } from '@/appointments/appointment-contract'
import {
  credentialSchema,
  eligibilitySchema,
  historySchema,
  type ChatOperation,
  type ChatRole,
} from './chat-contract'

export function contractMismatch(): never {
  throw new ApiError({
    code: 'CHAT_CONTRACT_MISMATCH',
    status: 502,
    message: 'Chat contract identity mismatch.',
  })
}
export function createChatAppointmentsApi(
  client: AxiosInstance,
  subject: string,
  role: ChatRole,
) {
  return {
    async list() {
      const value = appointmentListSchema.parse(
        (
          await client.get(
            role === 'USER'
              ? '/api/v1/appointments'
              : '/api/v1/specialist/appointments',
          )
        ).data,
      )
      if (
        role === 'SPECIALIST' &&
        value.items.some((item) => item.specialistAccountId !== subject)
      )
        contractMismatch()
      return value
    },
  }
}
export function createChatApi(
  client: AxiosInstance,
  subject: string,
  role: ChatRole,
  appointmentId: string,
) {
  const id = z.uuid().parse(appointmentId)
  return {
    async eligibility(operation: ChatOperation) {
      const value = eligibilitySchema.parse(
        (
          await client.get(`/internal/v1/appointments/${id}/chat-eligibility`, {
            params: { operation },
          })
        ).data,
      )
      if (
        value.appointmentId !== id ||
        value.conversationId !== id ||
        (role === 'USER' ? value.userAccountId : value.specialistAccountId) !==
          subject ||
        value.userAccountId === value.specialistAccountId
      )
        contractMismatch()
      return value
    },
    async credential() {
      return credentialSchema.parse(
        (await client.post('/internal/v1/socket-credentials')).data,
      )
    },
    async history(cursor?: string) {
      const value = historySchema.parse(
        (
          await client.get(`/api/v1/conversations/${id}/messages`, {
            params: { limit: 100, ...(cursor ? { cursor } : {}) },
          })
        ).data,
      )
      if (value.items.some((item) => item.conversationId !== id))
        contractMismatch()
      return value
    },
  }
}
export type ChatApi = ReturnType<typeof createChatApi>
