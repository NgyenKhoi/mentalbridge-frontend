import type { ChatApi } from './chat-api'
import type { ChatCommand, ChatMessage, Eligibility } from './chat-contract'
import type { ChatSocket } from './chat-socket'

export const user = '00000000-0000-4000-8000-000000000001'
export const specialist = '00000000-0000-4000-8000-000000000002'
export const appointmentId = '00000000-0000-4000-8000-000000000003'
let sequence = 10
export const uuid = () =>
  `00000000-0000-4000-8000-${String(sequence++).padStart(12, '0')}`
export const eligibility: Eligibility = {
  conversationId: appointmentId,
  appointmentId,
  userAccountId: user,
  specialistAccountId: specialist,
  phase: 'ACTIVE',
  reasonCode: 'APPOINTMENT_ACTIVE',
  subscribeAllowed: true,
  sendAllowed: true,
  historyAllowed: true,
  checkInAllowed: true,
  participantCheckedIn: false,
  sessionOutcome: null,
  creditState: 'HELD',
  scheduledStartAt: '2026-10-11T10:00:00Z',
  scheduledEndAt: '2026-10-11T11:00:00Z',
  serverTime: '2026-10-11T10:01:00Z',
}
export const message = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  schemaVersion: 1,
  messageId: uuid(),
  conversationId: appointmentId,
  senderId: specialist,
  clientMessageId: uuid(),
  type: 'TEXT',
  content: 'Synthetic contract message',
  sentAt: '2026-10-11T10:02:00Z',
  ...overrides,
})
export class TestSocket implements ChatSocket {
  listeners = new Map<string, (value: unknown) => void>()
  commands: ChatCommand[] = []
  respond: (command: ChatCommand, callback: (value: unknown) => void) => void =
    (command, callback) =>
      callback({
        schemaVersion: 1,
        commandId: command.commandId,
        correlationId: command.correlationId,
        status: 'accepted',
        acknowledgedAt: '2026-10-11T10:03:00Z',
        ...(command.commandType === 'message.send'
          ? { messageId: uuid() }
          : {}),
        liveDelivery: 'not_applicable',
      })
  connect = jest.fn()
  disconnect = jest.fn()
  on(event: string, listener: (value: unknown) => void) {
    this.listeners.set(event, listener)
  }
  removeAllListeners() {
    this.listeners.clear()
  }
  emit(
    _event: 'realtime.command',
    command: ChatCommand,
    callback: (value: unknown) => void,
  ) {
    this.commands.push(command)
    this.respond(command, callback)
  }
  event(event: string, value: unknown) {
    this.listeners.get(event)?.(value)
  }
  ready(subject = user, role = 'USER') {
    this.event('realtime.event', {
      schemaVersion: 1,
      eventId: uuid(),
      correlationId: uuid(),
      occurredAt: '2026-10-11T10:01:00Z',
      eventType: 'connection.ready',
      payload: { accountId: subject, role, presence: 'connected' },
    })
  }
}
export function fixtureApi(): ChatApi {
  return {
    eligibility: jest.fn().mockResolvedValue({ ...eligibility }),
    credential: jest.fn().mockResolvedValue({
      accessToken: 'x'.repeat(64),
      expiresAt: '2099-01-01T00:00:00Z',
    }),
    history: jest
      .fn()
      .mockResolvedValue({ items: [], hasMore: false, nextCursor: null }),
  }
}
