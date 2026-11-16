import type { AxiosInstance } from 'axios'

import {
  specialistAnalyticsSchema,
  specialistEarningsSummarySchema,
  type SpecialistAnalytics,
  type SpecialistEarningsSummary,
} from './specialist-commercial-contract'

export interface SpecialistCommercialApi {
  analytics(): Promise<SpecialistAnalytics>
  earnings(): Promise<SpecialistEarningsSummary>
}

export function createSpecialistCommercialApi(
  client: AxiosInstance,
): SpecialistCommercialApi {
  return {
    async analytics() {
      return specialistAnalyticsSchema.parse(
        (await client.get('/api/v1/specialist/analytics')).data,
      )
    },
    async earnings() {
      return specialistEarningsSummarySchema.parse(
        (await client.get('/api/v1/specialist/earnings')).data,
      )
    },
  }
}
