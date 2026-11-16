import type { AxiosInstance } from 'axios'

import { ApiError } from '@/api/api-error'

import {
  appointmentRatingSchema,
  saveAppointmentRatingSchema,
  type AppointmentRating,
} from './appointment-rating-contract'

export interface AppointmentRatingApi {
  current(appointmentId: string): Promise<AppointmentRating | null>
  save(
    appointmentId: string,
    rating: number,
    version?: number,
  ): Promise<AppointmentRating>
}

function mismatch(): never {
  throw new ApiError({
    code: 'APPOINTMENT_RATING_CONTRACT_MISMATCH',
    status: 502,
    message: 'Appointment rating response identity mismatch.',
  })
}

export function createAppointmentRatingApi(
  client: AxiosInstance,
): AppointmentRatingApi {
  return {
    async current(appointmentId) {
      try {
        const value = appointmentRatingSchema.parse(
          (
            await client.get(
              `/api/v1/appointments/${encodeURIComponent(appointmentId)}/rating`,
            )
          ).data,
        )
        if (value.appointmentId !== appointmentId) mismatch()
        return value
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null
        throw error
      }
    },
    async save(appointmentId, rating, version) {
      const body = saveAppointmentRatingSchema.parse({ rating })
      const value = appointmentRatingSchema.parse(
        (
          await client.put(
            `/api/v1/appointments/${encodeURIComponent(appointmentId)}/rating`,
            body,
            {
              headers:
                version === undefined ? {} : { 'If-Match': `"${version}"` },
            },
          )
        ).data,
      )
      if (value.appointmentId !== appointmentId || value.rating !== rating)
        mismatch()
      return value
    },
  }
}
