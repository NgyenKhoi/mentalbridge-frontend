import { router } from 'expo-router'

import { sharedAppointmentChatHandoff } from './specialist-chat-handoff'
import { APPOINTMENT_ID } from './specialist-appointment-test-fixtures'

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))

it('opens the existing MB-631 SPECIALIST route with the exact appointment, not a nested relative destination', () => {
  expect(sharedAppointmentChatHandoff.available).toBe(true)
  sharedAppointmentChatHandoff.openAppointmentChat(APPOINTMENT_ID)
  expect(router.push).toHaveBeenCalledWith({
    pathname: '/(specialist)/messages',
    params: { appointmentId: APPOINTMENT_ID },
  })
})
