import { browserApiClient } from '@/lib/api/browser-client'
import type {
  SupportGuide,
  SupportGuideHistory,
} from './support-guide-contract'

export async function generateSupportGuide(idempotencyKey: string) {
  return (
    await browserApiClient.post<SupportGuide>(
      '/care/support-guides',
      undefined,
      {
        headers: { 'Idempotency-Key': idempotencyKey },
      },
    )
  ).data
}

export async function getSupportGuideHistory(cursor?: string) {
  return (
    await browserApiClient.get<SupportGuideHistory>('/care/support-guides', {
      params: { limit: 10, ...(cursor ? { cursor } : {}) },
    })
  ).data
}

export async function getSupportGuide(supportGuideId: string) {
  return (
    await browserApiClient.get<SupportGuide>(
      `/care/support-guides/${encodeURIComponent(supportGuideId)}`,
    )
  ).data
}
