import { router } from 'expo-router'

export interface SpecialistChatHandoff {
  available: boolean
  openAppointmentChat(appointmentId: string): void
}

export const sharedAppointmentChatHandoff: SpecialistChatHandoff = {
  // Route availability is not chat authorization; MB-631 rechecks each operation.
  available: true,
  openAppointmentChat(appointmentId) {
    router.push({
      pathname: '/(specialist)/messages',
      params: { appointmentId },
    })
  },
}
