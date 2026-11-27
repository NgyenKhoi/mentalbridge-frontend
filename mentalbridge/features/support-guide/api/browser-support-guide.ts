import { browserApiClient } from '@/lib/api/browser-client'
import type { GuidedJourney } from '@/features/assessment/api/care-contract'
import type {
  SupportGuide,
  SupportGuideHistory,
} from './support-guide-contract'

export async function ensureCurrentSupportGuide() {
  return (await browserApiClient.post<SupportGuide>('/care/support-guides'))
    .data
}

export async function getGuidedJourney() {
  return (await browserApiClient.get<GuidedJourney>('/care/guided-journey'))
    .data
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
