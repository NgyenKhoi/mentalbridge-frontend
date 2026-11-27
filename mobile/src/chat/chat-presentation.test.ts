import { appointment } from '@/appointments/appointment-fixtures'
import {
  chatDayKey,
  chatTime,
  hasConversation,
  sortedConversations,
} from './chat-presentation'

it('matches the web inbox eligibility and sorting without showing unconfirmed requests', () => {
  const requested = { ...appointment, id: 'request' }
  const waiting = {
    ...appointment,
    id: 'waiting',
    status: 'CONFIRMED' as const,
  }
  const active = {
    ...appointment,
    id: 'active',
    status: 'IN_PROGRESS' as const,
  }
  const ended = { ...appointment, id: 'ended', status: 'COMPLETED' as const }
  const cancelled = {
    ...appointment,
    id: 'cancelled',
    status: 'CANCELLED' as const,
    history: [{ toStatus: 'CONFIRMED' }] as typeof appointment.history,
  }
  expect(hasConversation(requested)).toBe(false)
  expect(hasConversation(cancelled)).toBe(true)
  expect(hasConversation({ ...waiting, modality: 'IN_APP_VIDEO' })).toBe(false)
  expect(
    sortedConversations([ended, waiting, requested, active]).map(
      (item) => item.id,
    ),
  ).toEqual(['active', 'waiting', 'ended'])
})

it('groups chat dates and formats 24-hour times in the appointment timezone', () => {
  const instant = '2026-11-14T23:05:00Z'
  expect(chatTime(instant, 'Asia/Ho_Chi_Minh')).toBe('06:05')
  expect(chatDayKey(instant, 'Asia/Ho_Chi_Minh')).not.toBe(
    chatDayKey(instant, 'UTC'),
  )
})
