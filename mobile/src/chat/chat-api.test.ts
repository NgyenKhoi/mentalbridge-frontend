import { create, type AxiosAdapter } from 'axios'
import { createChatApi, createChatAppointmentsApi } from './chat-api'
import {
  acknowledgementSchema,
  errorSchema,
  eventSchema,
  historySchema,
} from './chat-contract'
import {
  appointmentId,
  eligibility,
  message,
  specialist,
  user,
  uuid,
} from './chat-fixtures'
import { appointment } from '@/appointments/appointment-fixtures'

it('SPECIALIST list uses its assigned endpoint, never USER owner endpoint', async () => {
  const value = client({
    items: [{ ...appointment, specialistAccountId: specialist }],
    count: 1,
    generatedAt: eligibility.serverTime,
  })
  await createChatAppointmentsApi(value.client, specialist, 'SPECIALIST').list()
  expect(value.requests[0]?.url).toBe('/api/v1/specialist/appointments')
  const foreign = client({
    items: [{ ...appointment, specialistAccountId: user }],
    count: 1,
    generatedAt: eligibility.serverTime,
  })
  await expect(
    createChatAppointmentsApi(foreign.client, specialist, 'SPECIALIST').list(),
  ).rejects.toMatchObject({ code: 'CHAT_CONTRACT_MISMATCH' })
})

function client(data: unknown) {
  const requests: Parameters<AxiosAdapter>[0][] = []
  return {
    requests,
    client: create({
      adapter: async (config) => {
        requests.push(config)
        return { data, status: 200, statusText: 'OK', headers: {}, config }
      },
    }),
  }
}
it.each(['USER', 'SPECIALIST'] as const)(
  'uses bearer-injected HTTP contract paths for %s without actor payload',
  async (role) => {
    const value = client(eligibility)
    const api = createChatApi(
      value.client,
      role === 'USER' ? user : specialist,
      role,
      appointmentId,
    )
    expect(await api.eligibility('SEND')).toEqual(eligibility)
    expect(value.requests[0]?.url).toBe(
      `/internal/v1/appointments/${appointmentId}/chat-eligibility`,
    )
    expect(value.requests[0]?.params).toEqual({ operation: 'SEND' })
    expect(value.requests[0]?.data).toBeUndefined()
  },
)
it.each([
  { ...eligibility, appointmentId: uuid() },
  { ...eligibility, conversationId: uuid() },
  { ...eligibility, userAccountId: specialist },
])('rejects swapped response identity', async (data) => {
  const value = client(data)
  await expect(
    createChatApi(value.client, user, 'USER', appointmentId).eligibility(
      'SUBSCRIBE',
    ),
  ).rejects.toMatchObject({ code: 'CHAT_CONTRACT_MISMATCH' })
})
it('validates strict credential, history identities and bounded opaque pagination', async () => {
  const value = client({
    accessToken: 'c'.repeat(64),
    expiresAt: '2099-01-01T00:00:00Z',
  })
  await createChatApi(value.client, user, 'USER', appointmentId).credential()
  expect(value.requests[0]?.url).toBe('/internal/v1/socket-credentials')
  expect(value.requests[0]?.data).toBeUndefined()
  const history = client({
    items: [message()],
    nextCursor: 'opaque',
    hasMore: true,
  })
  await createChatApi(history.client, user, 'USER', appointmentId).history(
    'opaque',
  )
  expect(history.requests[0]?.params).toEqual({ limit: 100, cursor: 'opaque' })
  const swapped = client({
    items: [message({ conversationId: uuid() })],
    nextCursor: null,
    hasMore: false,
  })
  await expect(
    createChatApi(swapped.client, user, 'USER', appointmentId).history(),
  ).rejects.toMatchObject({ code: 'CHAT_CONTRACT_MISMATCH' })
  expect(
    historySchema.safeParse({ items: [], nextCursor: null, hasMore: true })
      .success,
  ).toBe(false)
})
it('parses published ack/errors/events only; no fabricated delivery/read/completion events', () => {
  expect(
    acknowledgementSchema.safeParse({
      schemaVersion: 1,
      commandId: uuid(),
      correlationId: uuid(),
      status: 'accepted',
      acknowledgedAt: eligibility.serverTime,
      liveDelivery: 'not_applicable',
    }).success,
  ).toBe(true)
  expect(
    acknowledgementSchema.safeParse({
      schemaVersion: 1,
      commandId: uuid(),
      correlationId: uuid(),
      status: 'read',
      acknowledgedAt: eligibility.serverTime,
    }).success,
  ).toBe(false)
  expect(
    errorSchema.safeParse({
      schemaVersion: 1,
      correlationId: uuid(),
      code: 'CHAT_ENDED',
      message: 'safe',
      retryable: false,
    }).success,
  ).toBe(true)
  expect(
    eventSchema.safeParse({
      schemaVersion: 1,
      eventId: uuid(),
      correlationId: uuid(),
      occurredAt: eligibility.serverTime,
      eventType: 'conversation.completed',
      payload: {},
    }).success,
  ).toBe(false)
})
