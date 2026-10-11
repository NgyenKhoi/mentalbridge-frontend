import type { AxiosInstance } from 'axios'
import { z } from 'zod'

import { ApiError } from '@/api/api-error'

import {
  appointmentListSchema,
  appointmentSchema,
  appointmentVersionSchema,
  bookableSlotsSchema,
  commandKeySchema,
  creditAccountSchema,
  requestAppointmentSchema,
  type Appointment,
  type AppointmentList,
  type CreditAccount,
  type RequestAppointment,
} from './appointment-contract'

export interface AppointmentApi {
  list(): Promise<AppointmentList>
  credits(): Promise<CreditAccount>
  slots(): Promise<z.infer<typeof bookableSlotsSchema>>
  request(
    body: RequestAppointment,
    key: string,
    version?: number,
  ): Promise<Appointment>
  cancel(id: string, version: number, key: string): Promise<Appointment>
}
function mismatch(): never {
  throw new ApiError({
    code: 'APPOINTMENT_CONTRACT_MISMATCH',
    status: 502,
    message: 'Appointment response identity mismatch.',
  })
}
export function createAppointmentApi(
  client: AxiosInstance,
  subject: string,
): AppointmentApi {
  return {
    async list() {
      return appointmentListSchema.parse(
        (await client.get('/api/v1/appointments')).data,
      )
    },
    async credits() {
      const value = creditAccountSchema.parse(
        (await client.get('/api/v1/service-credits')).data,
      )
      if (value.accountId !== subject) mismatch()
      return value
    },
    async slots() {
      return bookableSlotsSchema.parse(
        (await client.get('/api/v1/bookable-slots')).data,
      )
    },
    async request(input, key, version) {
      const body = requestAppointmentSchema.parse(input)
      const headers = {
        'Idempotency-Key': commandKeySchema.parse(key),
        ...(body.replacesAppointmentId
          ? { 'If-Match': `"${appointmentVersionSchema.parse(version)}"` }
          : {}),
      }
      const value = appointmentSchema.parse(
        (await client.post('/api/v1/appointments', body, { headers })).data,
      )
      if (
        value.slotId !== body.slotId ||
        value.modality !== body.modality ||
        value.replacesAppointmentId !== (body.replacesAppointmentId ?? null)
      )
        mismatch()
      return value
    },
    async cancel(appointmentId, version, key) {
      const id = z.uuid().parse(appointmentId)
      const value = appointmentSchema.parse(
        (
          await client.post(
            `/api/v1/appointments/${encodeURIComponent(id)}/cancel`,
            undefined,
            {
              headers: {
                'If-Match': `"${appointmentVersionSchema.parse(version)}"`,
                'Idempotency-Key': commandKeySchema.parse(key),
              },
            },
          )
        ).data,
      )
      if (value.id !== id || value.status !== 'CANCELLED') mismatch()
      return value
    },
  }
}
