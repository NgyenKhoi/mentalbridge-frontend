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
}
