import { browserApiClient } from '@/lib/api/browser-client'

import type {
  ActivityDashboard,
  AnalyticsRange,
} from './activity-dashboard-contract'

export async function getAnalyticsEvents(
  range: AnalyticsRange,
  timezone: string,
) {
  return (
    await browserApiClient.get<ActivityDashboard>('/analytics', {
      params: { range, timezone },
    })
  ).data
}
