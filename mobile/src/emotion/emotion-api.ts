import type { AxiosInstance } from 'axios'

import {
  emotionCheckInListSchema,
  emotionCheckInProgressSchema,
  emotionCheckInSchema,
  emotionCheckInTombstoneSchema,
  type CreateEmotionCheckIn,
  type EmotionCheckIn,
  type EmotionCheckInList,
  type EmotionCheckInProgress,
  type EmotionCheckInTombstone,
  type EmotionCheckInValue,
} from './emotion-contract'

export interface EmotionApi {
  getCheckIn(localDate: string): Promise<EmotionCheckIn>
  listCheckIns(limit: number): Promise<EmotionCheckInList>
  getProgress(timezone: string): Promise<EmotionCheckInProgress>
  createCheckIn(
    request: CreateEmotionCheckIn,
    idempotencyKey: string,
  ): Promise<EmotionCheckIn>
  updateCheckIn(
    localDate: string,
    revision: number,
    request: EmotionCheckInValue,
    idempotencyKey: string,
  ): Promise<EmotionCheckIn>
  deleteCheckIn(
    localDate: string,
    idempotencyKey: string,
  ): Promise<EmotionCheckInTombstone>
}

export function createEmotionApi(client: AxiosInstance): EmotionApi {
  return {
    async getCheckIn(localDate) {
      const response = await client.get(
        `/api/v1/emotion-check-ins/${encodeURIComponent(localDate)}`,
      )
      return emotionCheckInSchema.parse(response.data)
    },
    async listCheckIns(limit) {
      const response = await client.get('/api/v1/emotion-check-ins', {
        params: { limit },
      })
      return emotionCheckInListSchema.parse(response.data)
    },
    async getProgress(timezone) {
      const response = await client.get('/api/v1/emotion-check-in-progress', {
        params: { timezone },
      })
      return emotionCheckInProgressSchema.parse(response.data)
    },
    async createCheckIn(request, idempotencyKey) {
      const response = await client.post('/api/v1/emotion-check-ins', request, {
        headers: { 'Idempotency-Key': idempotencyKey },
      })
      return emotionCheckInSchema.parse(response.data)
    },
    async updateCheckIn(localDate, revision, request, idempotencyKey) {
      const response = await client.patch(
        `/api/v1/emotion-check-ins/${encodeURIComponent(localDate)}`,
        request,
        {
          headers: {
            'Idempotency-Key': idempotencyKey,
            'If-Match-Revision': String(revision),
          },
        },
      )
      return emotionCheckInSchema.parse(response.data)
    },
    async deleteCheckIn(localDate, idempotencyKey) {
      const response = await client.delete(
        `/api/v1/emotion-check-ins/${encodeURIComponent(localDate)}`,
        { headers: { 'Idempotency-Key': idempotencyKey } },
      )
      return emotionCheckInTombstoneSchema.parse(response.data)
    },
  }
}
