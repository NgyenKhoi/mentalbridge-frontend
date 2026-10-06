import { browserApiClient } from '@/lib/api/browser-client'
import type {
  Appointment,
  AppointmentList,
  AppointmentModality,
  AppointmentRating,
  AppointmentDispute,
  AppointmentDisputeList,
  BookableSlotList,
  OpenAppointmentDisputeInput,
  ResolveAppointmentDisputeInput,
} from '@/lib/consultation/consultation-validation'

export const appointmentBrowserClient = {
  async dispute(appointmentId: string, role: 'USER' | 'SPECIALIST') {
    const prefix = role === 'USER' ? '' : '/specialist'
    return (
      await browserApiClient.get<AppointmentDispute>(
        `/consultation${prefix}/appointments/${encodeURIComponent(appointmentId)}/dispute`,
      )
    ).data
  },
  async openDispute(
    appointmentId: string,
    role: 'USER' | 'SPECIALIST',
    body: OpenAppointmentDisputeInput,
    idempotencyKey: string,
  ) {
    const prefix = role === 'USER' ? '' : '/specialist'
    return (
      await browserApiClient.post<AppointmentDispute>(
        `/consultation${prefix}/appointments/${encodeURIComponent(appointmentId)}/dispute`,
        body,
        { headers: { 'Idempotency-Key': idempotencyKey } },
      )
    ).data
  },
  async disputes(status: 'OPEN' | 'RESOLVED') {
    return (
      await browserApiClient.get<AppointmentDisputeList>(
        `/consultation/admin/appointment-disputes?status=${status}`,
      )
    ).data
  },
  async resolveDispute(
    disputeId: string,
    body: ResolveAppointmentDisputeInput,
    version: number,
    idempotencyKey: string,
  ) {
    return (
      await browserApiClient.post<AppointmentDispute>(
        `/consultation/admin/appointment-disputes/${encodeURIComponent(disputeId)}/resolve`,
        body,
        {
          headers: {
            'If-Match': `"${version}"`,
            'Idempotency-Key': idempotencyKey,
          },
        },
      )
    ).data
  },
  async rating(appointmentId: string) {
    return (
      await browserApiClient.get<AppointmentRating>(
        `/consultation/appointments/${encodeURIComponent(appointmentId)}/rating`,
      )
    ).data
  },
  async saveRating(appointmentId: string, rating: number, version?: number) {
    return (
      await browserApiClient.put<AppointmentRating>(
        `/consultation/appointments/${encodeURIComponent(appointmentId)}/rating`,
        { rating },
        {
          headers: version === undefined ? {} : { 'If-Match': `"${version}"` },
        },
      )
    ).data
  },
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
    replacesAppointmentVersion?: number,
  ) {
    return (
      await browserApiClient.post<Appointment>(
        '/consultation/appointments',
        {
          slotId,
          modality,
          ...(replacesAppointmentId ? { replacesAppointmentId } : {}),
        },
        {
          headers: {
            'Idempotency-Key': idempotencyKey,
            ...(replacesAppointmentId &&
            replacesAppointmentVersion !== undefined
              ? { 'If-Match': `"${replacesAppointmentVersion}"` }
              : {}),
          },
        },
      )
    ).data
  },
  async cancel(appointmentId: string, version: number, idempotencyKey: string) {
    return (
      await browserApiClient.post<Appointment>(
        `/consultation/appointments/${encodeURIComponent(appointmentId)}/cancel`,
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
