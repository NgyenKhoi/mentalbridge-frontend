import type {
  EmotionCheckIn,
  EmotionCheckInCreate,
  EmotionCheckInValue,
} from '@/lib/emotion-check-in/contract'
import { browserApiClient } from '@/lib/api/browser-client'

export async function getEmotionCheckIn(localDate: string) {
  const response = await browserApiClient.get<EmotionCheckIn>(
    `/emotion-check-ins/${encodeURIComponent(localDate)}`,
  )
  return response.data
}

export async function createEmotionCheckIn(
  body: EmotionCheckInCreate,
  idempotencyKey: string,
) {
  const response = await browserApiClient.post<EmotionCheckIn>(
    '/emotion-check-ins',
    body,
    { headers: { 'Idempotency-Key': idempotencyKey } },
  )
  return response.data
}

export async function updateEmotionCheckIn(
  localDate: string,
  revision: number,
  body: EmotionCheckInValue,
  idempotencyKey: string,
) {
  const response = await browserApiClient.patch<EmotionCheckIn>(
    `/emotion-check-ins/${encodeURIComponent(localDate)}`,
    body,
    {
      headers: {
        'Idempotency-Key': idempotencyKey,
        'If-Match-Revision': String(revision),
      },
    },
  )
  return response.data
}
