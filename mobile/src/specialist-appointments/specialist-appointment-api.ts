import type { AxiosInstance } from 'axios'

import {
  specialistAppointmentListSchema,
  specialistAppointmentSchema,
  type SpecialistAppointment,
  type SpecialistAppointmentList,
} from './specialist-appointment-contract'

export type AppointmentDecision = 'accept' | 'reject'

export interface SpecialistAppointmentApi {
  listAssigned(): Promise<SpecialistAppointmentList>
  decide(
    appointment: SpecialistAppointment,
    decision: AppointmentDecision,
    idempotencyKey: string,
  ): Promise<SpecialistAppointment>
}

export function createSpecialistAppointmentApi(
  client: AxiosInstance,
): SpecialistAppointmentApi {
  return {
    async listAssigned() {
      const response = await client.get('/api/v1/specialist/appointments')
      return specialistAppointmentListSchema.parse(response.data)
    },
    async decide(appointment, decision, idempotencyKey) {
      const response = await client.post(
        `/api/v1/specialist/appointments/${encodeURIComponent(appointment.id)}/${decision}`,
        undefined,
        {
          headers: {
            'If-Match': `"${appointment.version}"`,
            'Idempotency-Key': idempotencyKey,
          },
        },
      )
      return specialistAppointmentSchema.parse(response.data)
    },
  }
}
