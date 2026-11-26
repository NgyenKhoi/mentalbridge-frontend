import { z } from 'zod'

const state = z.enum(['AVAILABLE', 'EMPTY', 'BLOCKED', 'UNAVAILABLE'])
const count = z.number().int().nonnegative()
const dateTime = z.iso.datetime({ offset: true })

export const specialistDashboardSchema = z.object({
  generatedAt: dateTime,
  operationalStatus: z.enum([
    'READY',
    'PROFILE_REQUIRED',
    'PENDING_APPROVAL',
    'PROFILE_REJECTED',
    'SUSPENDED',
  ]),
  profile: z.object({
    displayName: z.string().nullable(),
    timezone: z.string().nullable(),
  }),
  ratingAggregate: z.object({
    state,
    averageRating: z.number().min(1).max(5).nullable(),
    ratingCount: count,
  }),
  todayConfirmedSessions: z.object({ state, count }),
  pendingAppointmentRequests: z.object({ state, count }),
  availability: z.object({ state, count }),
  nextAppointment: z.object({
    state,
    item: z
      .object({
        appointmentId: z.uuid(),
        status: z.enum(['REQUESTED', 'CONFIRMED', 'IN_PROGRESS']),
        modality: z.enum(['IN_APP_CHAT', 'IN_APP_VIDEO']),
        scheduledStartAt: dateTime,
        timezone: z.string(),
      })
      .nullable(),
  }),
  actionRequired: z.array(
    z.object({
      type: z.enum([
        'COMPLETE_PROFILE',
        'AWAIT_PROFILE_APPROVAL',
        'UPDATE_REJECTED_PROFILE',
        'CONTACT_SUPPORT',
        'REVIEW_APPOINTMENT_REQUESTS',
        'PUBLISH_AVAILABILITY',
      ]),
      count,
    }),
  ),
})

export type SpecialistDashboard = z.infer<typeof specialistDashboardSchema>
