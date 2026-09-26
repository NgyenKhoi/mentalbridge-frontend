import { browserApiClient } from '@/lib/api/browser-client'
import type {
  Appointment,
  AppointmentList,
  AppointmentModality,
  BookableSlotList,
} from '@/lib/consultation/consultation-validation'

export const appointmentBrowserClient = {
  async slots() {
    return (
      await browserApiClient.get<BookableSlotList>(
        '/consultation/bookable-slots',
      )
    ).data
  },
  async list() {
    return (
      await browserApiClient.get<AppointmentList>('/consultation/appointments')
    ).data
  },
  async request(
    slotId: string,
    modality: AppointmentModality,
    idempotencyKey: string,
    replacesAppointmentId?: string,
  ) {
    return (
      await browserApiClient.post<Appointment>(
        '/consultation/appointments',
        {
          slotId,
          modality,
          ...(replacesAppointmentId ? { replacesAppointmentId } : {}),
        },
        { headers: { 'Idempotency-Key': idempotencyKey } },
      )
    ).data
  },
  async assigned() {
    return (
      await browserApiClient.get<AppointmentList>(
        '/consultation/specialist/appointments',
      )
    ).data
  },
  async decide(
    appointmentId: string,
    decision: 'accept' | 'reject',
    version: number,
    idempotencyKey: string,
  ) {
    return (
      await browserApiClient.post<Appointment>(
        `/consultation/specialist/appointments/${encodeURIComponent(appointmentId)}/${decision}`,
        undefined,
        {
          headers: {
            'If-Match': `"${version}"`,
            'Idempotency-Key': idempotencyKey,
          },
        },
      )
    ).data
  },
}
