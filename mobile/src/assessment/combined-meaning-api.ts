import type { AxiosInstance } from 'axios'
import { z } from 'zod'

import { combinedScreeningMeaningSchema } from './combined-meaning-contract'

export function createCombinedMeaningApi(client: AxiosInstance) {
  return {
    async getCombinedScreeningMeaning(supportEvaluationId: string) {
      const expectedId = z.uuid().parse(supportEvaluationId)
      const response = await client.get(
        `/api/v1/support-evaluations/${encodeURIComponent(expectedId)}/combined-meaning`,
      )
      const parsed = combinedScreeningMeaningSchema.parse(response.data)
      if (parsed.supportEvaluationId.toLowerCase() !== expectedId.toLowerCase())
        throw new Error('Combined meaning does not match the requested result.')
      return parsed
    },
  }
}
