import type { AxiosInstance } from 'axios'
import { z } from 'zod'

import { ApiError } from '@/api/api-error'
import { commandKeySchema } from '@/appointments/appointment-contract'

import {
  appointmentDisputeSchema,
  openAppointmentDisputeSchema,
  type AppointmentDispute,
  type OpenAppointmentDispute,
} from './appointment-dispute-contract'

export interface AppointmentDisputeApi {
  get(appointmentId: string): Promise<AppointmentDispute>
  open(
    appointmentId: string,
    body: OpenAppointmentDispute,
    key: string,
  ): Promise<AppointmentDispute>
}

function mismatch(): never {
  throw new ApiError({
    code: 'APPOINTMENT_DISPUTE_CONTRACT_MISMATCH',
    status: 502,
    message: 'Appointment dispute response identity mismatch.',
  })
}

function path(appointmentId: string) {
  const id = z.uuid().parse(appointmentId)
  return {
    id,
    value: `/api/v1/appointments/${encodeURIComponent(id)}/dispute`,
  }
}

export function createAppointmentDisputeApi(
  client: AxiosInstance,
): AppointmentDisputeApi {
  return {
    async get(appointmentId) {
      const target = path(appointmentId)
      const value = appointmentDisputeSchema.parse(
        (await client.get(target.value)).data,
      )
      if (value.appointmentId !== target.id) mismatch()
      return value
    },
    async open(appointmentId, input, key) {
      const target = path(appointmentId)
      const body = openAppointmentDisputeSchema.parse(input)
      const value = appointmentDisputeSchema.parse(
        (
          await client.post(target.value, body, {
            headers: { 'Idempotency-Key': commandKeySchema.parse(key) },
          })
        ).data,
      )
      if (
        value.appointmentId !== target.id ||
        value.reasonCode !== body.reasonCode
      )
        mismatch()
      return value
    },
  }
}
