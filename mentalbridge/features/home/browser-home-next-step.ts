import { browserApiClient } from '@/lib/api/browser-client'
import type { HomeNextStep } from '@/features/assessment/api/care-contract'

/** Every visit asks Care again; the decision is never held in a query cache. */
export async function getHomeNextStep(signal?: AbortSignal) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return (
    await browserApiClient.get<HomeNextStep>('/care/home-next-step', {
      params: { timezone },
      signal,
    })
  ).data
}
