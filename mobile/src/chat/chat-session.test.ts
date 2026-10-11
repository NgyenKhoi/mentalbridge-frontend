import { ApiError } from '@/api/api-error'
import { ChatSession } from './chat-session'
import {
  appointmentId,
  eligibility,
  fixtureApi,
  message,
  specialist,
  TestSocket,
  user,
  uuid,
} from './chat-fixtures'

const flush = async () => {
  for (let index = 0; index < 30; index++) await Promise.resolve()
}
function setup(role: 'USER' | 'SPECIALIST' = 'USER') {
  const api = fixtureApi()
  const sockets: TestSocket[] = []
  const factory = jest.fn(() => {
    const socket = new TestSocket()
    sockets.push(socket)
    return socket
  })
  const session = new ChatSession({
    api,
    factory,
    subject: role === 'USER' ? user : specialist,
    role,
    appointmentId,
    uuid,
  })
  return { api, sockets, factory, session }
}
async function ready(
  value: ReturnType<typeof setup>,
  role: 'USER' | 'SPECIALIST' = 'USER',
) {
  value.session.start()
  await flush()
  value.sockets.at(-1)!.ready(role === 'USER' ? user : specialist, role)
  await flush()
  expect(value.session.snapshot().phase).toBe('ready')
}
beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())
it('evidence failure after persistence remains unconfirmed and is reconciled from history', async () => {
  const value = setup()
  await ready(value)
  value.sockets[0]!.respond = (command, callback) =>
    callback({
      schemaVersion: 1,
      commandId: command.commandId,
      correlationId: command.correlationId,
      code: 'CHAT_EVIDENCE_UNAVAILABLE',
      message: 'safe',
      retryable: true,
    })
  await value.session.send('synthetic evidence outage')
  expect(value.session.snapshot().pending[0]?.state).toBe('unconfirmed')
  value.session.stop()
})
it('recovers missed pages to the prior accepted boundary', async () => {
  const value = setup()
  const older = message()
  jest
    .mocked(value.api.history)
    .mockResolvedValue({ items: [older], nextCursor: null, hasMore: false })
  await ready(value)
  value.sockets[0]!.event('disconnect', undefined)
  const missed = message({ sentAt: '2026-10-11T10:05:00Z' })
  jest
    .mocked(value.api.history)
    .mockResolvedValueOnce({
      items: [missed],
      nextCursor: 'next-page',
      hasMore: true,
    })
    .mockResolvedValueOnce({ items: [older], nextCursor: null, hasMore: false })
  jest.advanceTimersByTime(500)
  await flush()
  value.sockets[1]!.ready()
  await flush()
  expect(value.api.history).toHaveBeenCalledWith('next-page')
  expect(value.session.snapshot().messages).toEqual([older, missed])
  value.session.stop()
})
it('a delayed send decision cannot override a newer authoritative closed state', async () => {
  const value = setup()
  await ready(value)
  let resolveDecision: ((decision: typeof eligibility) => void) | undefined
  jest.mocked(value.api.eligibility).mockImplementation((operation) =>
    operation === 'SEND'
      ? new Promise((resolve) => {
          resolveDecision = resolve
        })
      : Promise.resolve({
          ...eligibility,
          phase: 'ENDED_PROCESSING',
          subscribeAllowed: false,
          sendAllowed: false,
          checkInAllowed: false,
        }),
  )
  const send = value.session.send('must not dispatch')
  await flush()
  await value.session.refresh()
  resolveDecision?.({ ...eligibility })
  await flush()
  expect(await send).toBe(false)
  expect(
    value.sockets[0]!.commands.some(
      (item) => item.commandType === 'message.send',
    ),
  ).toBe(false)
  expect(value.session.snapshot().eligibility?.sendAllowed).not.toBe(true)
  value.session.stop()
})
it('missing authoritative ready frame triggers bounded reconnect rather than enabling sends', async () => {
  const value = setup()
  value.session.start()
  await flush()
  jest.advanceTimersByTime(8000)
  await flush()
  expect(value.session.snapshot().phase).toBe('reconnecting')
  expect(await value.session.send('unready')).toBe(false)
  value.session.stop()
})
it.each(['USER', 'SPECIALIST'] as const)(
  'authorizes %s and subscribes before send; never fabricates receipts',
  async (role) => {
    const value = setup(role)
    await ready(value, role)
    await value.session.send('Synthetic user edit')
    const command = value.sockets[0]!.commands.find(
      (item) => item.commandType === 'message.send',
    )!
    expect(command.payload).toEqual({
      conversationId: appointmentId,
      clientMessageId: expect.any(String),
      type: 'TEXT',
      content: 'Synthetic user edit',
    })
    expect(value.api.eligibility).toHaveBeenCalledWith('SEND')
    expect(value.session.snapshot().pending[0]?.state).toBe('accepted')
    expect(value.session.snapshot().eligibility?.sessionOutcome).toBeNull()
    value.session.stop()
  },
)
it.each([
  'TOO_EARLY',
  'NOT_AVAILABLE',
  'ENDED_PROCESSING',
  'CANCELLED',
  'RESCHEDULED',
] as const)('fails closed for %s', async (phase) => {
  const value = setup()
  jest.mocked(value.api.eligibility).mockResolvedValue({
    ...eligibility,
    phase,
    subscribeAllowed: false,
    sendAllowed: false,
    checkInAllowed: false,
    historyAllowed: phase === 'ENDED_PROCESSING',
  })
  value.session.start()
  await flush()
  expect(value.factory).not.toHaveBeenCalled()
  expect(await value.session.send('must not send')).toBe(false)
  expect(value.session.snapshot().phase).toBe('blocked')
  value.session.stop()
})
it('waiting-room subscribe never grants sending or implicit check-in', async () => {
  const value = setup()
  jest
    .mocked(value.api.eligibility)
    .mockResolvedValue({ ...eligibility, phase: 'WAITING', sendAllowed: false })
  await ready(value)
  expect(await value.session.send('not started')).toBe(false)
  expect(value.sockets[0]!.commands.map((item) => item.commandType)).toEqual([
    'conversation.subscribe',
  ])
  value.session.stop()
})
it('refreshes at end boundary, never locally assigns completion', async () => {
  const value = setup()
  await ready(value)
  jest.mocked(value.api.eligibility).mockResolvedValue({
    ...eligibility,
    phase: 'ENDED_PROCESSING',
    subscribeAllowed: false,
    sendAllowed: false,
    checkInAllowed: false,
  })
  jest.advanceTimersByTime(10_000)
  await flush()
  expect(value.session.snapshot().eligibility?.phase).toBe('ENDED_PROCESSING')
  expect(value.session.snapshot().eligibility?.sessionOutcome).toBeNull()
  expect(value.sockets[0]!.disconnect).toHaveBeenCalled()
  expect(await value.session.send('closed')).toBe(false)
  value.session.stop()
})
it('reconnect gets a fresh one-use credential, reauthorizes, recovers and deduplicates/reorders history', async () => {
  const value = setup()
  await ready(value)
  const later = message({ sentAt: '2026-10-11T10:04:00Z' })
  const earlier = message()
  const event = {
    schemaVersion: 1,
    eventId: uuid(),
    correlationId: uuid(),
    occurredAt: later.sentAt,
    eventType: 'message.created',
    payload: later,
  }
  value.sockets[0]!.event('realtime.event', event)
  value.sockets[0]!.event('realtime.event', event)
  value.sockets[0]!.event('disconnect', undefined)
  expect(value.session.snapshot().phase).toBe('reconnecting')
  jest.mocked(value.api.history).mockResolvedValue({
    items: [later, earlier],
    nextCursor: null,
    hasMore: false,
  })
  jest.advanceTimersByTime(500)
  await flush()
  value.sockets[1]!.ready()
  await flush()
  expect(value.api.credential).toHaveBeenCalledTimes(2)
  expect(value.session.snapshot().messages).toEqual([earlier, later])
  expect(value.session.snapshot().phase).toBe('ready')
  value.session.stop()
})
it('lost ACK is explicit immutable retry, not a queue; accepted history reconciles it', async () => {
  const value = setup()
  await ready(value)
  value.sockets[0]!.respond = (command, callback) => {
    if (command.commandType !== 'message.send')
      callback({
        schemaVersion: 1,
        commandId: command.commandId,
        correlationId: command.correlationId,
        status: 'accepted',
        acknowledgedAt: eligibility.serverTime,
      })
  }
  const send = value.session.send('exact synthetic retry')
  await flush()
  jest.advanceTimersByTime(5000)
  await flush()
  await send
  const pending = value.session.snapshot().pending[0]!
  expect(pending.state).toBe('unconfirmed')
  expect(
    value.sockets[0]!.commands.filter(
      (item) => item.commandType === 'message.send',
    ),
  ).toHaveLength(1)
  const persisted = message({
    senderId: user,
    clientMessageId: pending.command.payload.clientMessageId!,
    content: pending.command.payload.content!,
  })
  jest
    .mocked(value.api.history)
    .mockResolvedValue({ items: [persisted], nextCursor: null, hasMore: false })
  value.sockets[0]!.respond = (command, callback) =>
    callback({
      schemaVersion: 1,
      commandId: command.commandId,
      correlationId: command.correlationId,
      status: 'duplicate',
      messageId: persisted.messageId,
      acknowledgedAt: eligibility.serverTime,
      liveDelivery: 'not_applicable',
    })
  await value.session.send(pending.command.payload.content!, pending.command)
  expect(
    value.sockets[0]!.commands.filter(
      (item) => item.commandType === 'message.send',
    ),
  ).toEqual([pending.command, pending.command])
  expect(value.session.snapshot().pending).toEqual([])
  expect(value.session.snapshot().messages).toEqual([persisted])
  value.session.stop()
})
it('background releases sockets and ignores late ACK/events; foreground recovers without replay', async () => {
  const value = setup()
  await ready(value)
  let acknowledge: ((value: unknown) => void) | undefined
  value.sockets[0]!.respond = (_command, callback) => {
    acknowledge = callback
  }
  const sent = value.session.send('background synthetic')
  await flush()
  value.session.stop()
  await flush()
  await sent
  expect(value.session.snapshot().phase).toBe('paused')
  expect(value.session.snapshot().pending[0]?.state).toBe('unconfirmed')
  acknowledge?.({})
  value.session.start()
  await flush()
  value.sockets[1]!.ready()
  await flush()
  expect(value.sockets[1]!.commands.map((item) => item.commandType)).toEqual([
    'conversation.subscribe',
  ])
  value.session.stop()
})
it.each([401, 403, 404])(
  'denies revoked/wrong actor HTTP %s and clears private display',
  async (status) => {
    const value = setup()
    await ready(value)
    jest
      .mocked(value.api.eligibility)
      .mockRejectedValue(
        new ApiError({ status, code: 'ACCESS_DENIED', message: 'synthetic' }),
      )
    await value.session.refresh()
    expect(value.session.snapshot()).toMatchObject({
      phase: 'blocked',
      eligibility: null,
      messages: [],
      pending: [],
    })
    value.session.stop()
  },
)
it('rejects foreign ready identity, wrong appointment message and conflicting duplicate', async () => {
  for (const scenario of ['actor', 'appointment', 'duplicate']) {
    const value = setup()
    value.session.start()
    await flush()
    if (scenario === 'actor') value.sockets[0]!.ready(specialist)
    else {
      value.sockets[0]!.ready()
      await flush()
      const item = message({
        conversationId: scenario === 'appointment' ? uuid() : appointmentId,
      })
      const emit = (content: string) =>
        value.sockets[0]!.event('realtime.event', {
          schemaVersion: 1,
          eventId: uuid(),
          correlationId: uuid(),
          occurredAt: item.sentAt,
          eventType: 'message.created',
          payload: { ...item, content },
        })
      emit(item.content)
      if (scenario === 'duplicate') emit('conflicting content')
    }
    await flush()
    expect(value.session.snapshot().phase).toBe('blocked')
    expect(value.session.snapshot().issue).toBe('CHAT_CONTRACT_MISMATCH')
    value.session.stop()
  }
})
it('dependency unavailable fails closed; stale credential never connects', async () => {
  const value = setup()
  jest.mocked(value.api.eligibility).mockRejectedValue(
    new ApiError({
      status: 503,
      code: 'CHAT_ELIGIBILITY_UNAVAILABLE',
      message: 'synthetic',
    }),
  )
  value.session.start()
  await flush()
  expect(value.factory).not.toHaveBeenCalled()
  value.session.stop()
  const expired = setup()
  jest.mocked(expired.api.credential).mockResolvedValue({
    accessToken: 'x'.repeat(64),
    expiresAt: '2000-01-01T00:00:00Z',
  })
  expired.session.start()
  await flush()
  expect(expired.factory).not.toHaveBeenCalled()
  expect(expired.session.snapshot().issue).toBe('AUTHENTICATION_EXPIRED')
  expired.session.stop()
})
