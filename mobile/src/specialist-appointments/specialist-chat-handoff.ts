export interface SpecialistChatHandoff {
  available: boolean
  openAppointmentChat(appointmentId: string): void
}

export const pendingSharedChatHandoff: SpecialistChatHandoff = {
  available: false,
  openAppointmentChat() {},
}
