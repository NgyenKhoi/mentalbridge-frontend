import type { AxiosInstance } from 'axios'

import {
  specialistClientContinuityListSchema,
  specialistConsultationBriefSchema,
  type SpecialistClientContinuityList,
  type SpecialistConsultationBrief,
} from './specialist-continuity-contract'

export interface SpecialistContinuityApi {
  list(): Promise<SpecialistClientContinuityList>
  getBrief(appointmentId: string): Promise<SpecialistConsultationBrief>
}

export function createSpecialistContinuityApi(
  client: AxiosInstance,
): SpecialistContinuityApi {
  return {
    async list() {
      const response = await client.get('/api/v1/specialist/client-continuity')
      return specialistClientContinuityListSchema.parse(response.data)
    },
    async getBrief(appointmentId) {
      const response = await client.get(
        `/api/v1/specialist/consultation-briefs/${encodeURIComponent(appointmentId)}`,
      )
      return specialistConsultationBriefSchema.parse(response.data)
    },
  }
}
