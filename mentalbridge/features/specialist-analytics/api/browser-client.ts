import { browserApiClient } from '@/lib/api/browser-client'
import type { SpecialistOperationalAnalytics } from '@/lib/consultation/consultation-validation'

export type AnalyticsPeriodDays = 7 | 30 | 90

export const specialistAnalyticsBrowserClient = {
  async get(days: AnalyticsPeriodDays) {
    return (
      await browserApiClient.get<SpecialistOperationalAnalytics>(
        `/consultation/specialist/analytics?days=${days}`,
      )
    ).data
  },
}
