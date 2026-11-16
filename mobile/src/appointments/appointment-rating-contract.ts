import { z } from 'zod'

const id = z.uuid()
const instant = z.iso.datetime({ offset: true })

export const appointmentRatingSchema = z.strictObject({
  appointmentId: id,
  specialistAccountId: id,
  rating: z.number().int().min(1).max(5),
  createdAt: instant,
  updatedAt: instant,
  version: z.number().int().nonnegative().safe(),
  specialistAggregate: z.strictObject({
    averageRating: z.number().min(1).max(5),
    ratingCount: z.number().int().positive().safe(),
  }),
})

export const saveAppointmentRatingSchema = z.strictObject({
  rating: z.number().int().min(1).max(5),
})

export type AppointmentRating = z.infer<typeof appointmentRatingSchema>
