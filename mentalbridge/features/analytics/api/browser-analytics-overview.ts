import { browserApiClient } from '@/lib/api/browser-client'

import type { AnalyticsOverview } from './analytics-overview-contract'

export async function getAnalyticsOverview(timezone: string) {
  return (
    await browserApiClient.get<AnalyticsOverview>('/analytics/overview', {
      params: { timezone },
    })
  ).data
}
