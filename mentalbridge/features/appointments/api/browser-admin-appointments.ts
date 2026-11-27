import { browserApiClient } from '@/lib/api/browser-client'
import type {
  AdminAppointmentPage,
  AppointmentModality,
  AppointmentStatus,
} from '@/lib/consultation/consultation-validation'

export type AdminAppointmentSearch = Readonly<{
  from: string
  to: string
  status?: AppointmentStatus
  modality?: AppointmentModality
  userAccountId?: string
  specialistAccountId?: string
  cursor?: string
  limit?: number
}>

export const browserAdminAppointments = {
  async search(params: AdminAppointmentSearch) {
    const response = await browserApiClient.get<AdminAppointmentPage>(
      '/admin/appointments',
      { params },
    )
    return response.data
  },
}
