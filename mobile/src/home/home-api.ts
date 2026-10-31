import type { AxiosInstance } from 'axios'

import { homeNextStepSchema, type HomeNextStep } from './home-contract'

export interface HomeApi {
  getNextStep(timeZone?: string): Promise<HomeNextStep>
}

export function createHomeApi(client: AxiosInstance): HomeApi {
  return {
    async getNextStep(timeZone) {
      const response = await client.get('/api/v1/home-next-step', {
        params: timeZone ? { timezone: timeZone } : undefined,
      })
      return homeNextStepSchema.parse(response.data)
    },
  }
}
