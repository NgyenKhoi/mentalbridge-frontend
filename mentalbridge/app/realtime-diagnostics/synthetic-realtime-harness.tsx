'use client'

import { useEffect, useRef, useState } from 'react'

import {
  createMessageCommand,
  createSubscribeCommand,
} from '@/lib/realtime/commands'
import type { HandshakeV1 } from '@/lib/realtime/envelopes'
import type {
  ConversationEligibility,
  EligibilityResult,
} from '@/lib/realtime/policies'
import type {
  RealtimeSocket,
  RealtimeSocketFactory,
  SocketListener,
} from '@/lib/realtime/socket'
import {
  RealtimeTransport,
  type ConnectionState,
} from '@/lib/realtime/transport'

const accountId = '11111111-1111-4111-8111-111111111111'
const conversationId = '22222222-2222-4222-8222-222222222222'
const senderId = '33333333-3333-4333-8333-333333333333'
const initialState: ConnectionState = {
  phase: 'connecting',
  reconnectAttempt: 0,
  recovery: 'not-needed',
}

class SyntheticSocket implements RealtimeSocket {
  private readonly listeners = new Map<string, Set<SocketListener>>()

  constructor(private readonly handshake: HandshakeV1) {}

  connect(): void {
    queueMicrotask(() => {
      this.trigger('connect')
      this.trigger('realtime.event', this.readyEvent())
    })
  }

  disconnect(): void {}

  on(event: string, listener: SocketListener): void {
    const listeners = this.listeners.get(event) ?? new Set()
    listeners.add(listener)
    this.listeners.set(event, listeners)
  }

  off(event: string, listener: SocketListener): void {
    this.listeners.get(event)?.delete(listener)
  }

  emit(
    _event: 'realtime.command',
    payload: unknown,
    acknowledgement: (payload: unknown) => void,
  ): void {
    const command = payload as ReturnType<typeof createMessageCommand>
    acknowledgement({
      schemaVersion: 1,
      commandId: command.commandId,
      correlationId: command.correlationId,
      status: 'accepted',
      acknowledgedAt: new Date().toISOString(),
      liveDelivery: 'not_applicable',
      ...(command.commandType === 'message.send'
        ? { messageId: accountId }
        : {}),
    })
    if (command.commandType === 'message.send')
      this.trigger('realtime.event', this.messageEvent(command))
  }

  trigger(event: string, payload?: unknown): void {
    for (const listener of this.listeners.get(event) ?? []) listener(payload)
  }

  duplicateEvent(): void {
    const command = createMessageCommand(conversationId, 'Synthetic duplicate')
    const event = this.messageEvent(command)
    this.trigger('realtime.event', event)
    this.trigger('realtime.event', event)
  }

  private readyEvent() {
    return {
      schemaVersion: 1,
      eventId: crypto.randomUUID(),
      eventType: 'connection.ready',
      correlationId: this.handshake.correlationId ?? 'synthetic-browser',
      occurredAt: new Date().toISOString(),
      payload: { accountId, role: 'USER', presence: 'connected' },
    }
  }

  private messageEvent(command: ReturnType<typeof createMessageCommand>) {
    if (command.commandType !== 'message.send')
      throw new Error('Synthetic fixture expected message.send')
    return {
      schemaVersion: 1,
      eventId: crypto.randomUUID(),
      eventType: 'message.created',
      correlationId: command.correlationId,
      occurredAt: new Date().toISOString(),
      payload: {
        messageId: accountId,
        conversationId,
        senderId,
        clientMessageId: command.payload.clientMessageId,
        type: 'TEXT',
        content: command.payload.content,
        sentAt: new Date().toISOString(),
        schemaVersion: 1,
      },
    }
  }
}

export function SyntheticRealtimeHarness() {
  const [state, setState] = useState(initialState)
  const [eventCount, setEventCount] = useState(0)
  const [ackCount, setAckCount] = useState(0)
  const [lastDelivery, setLastDelivery] = useState('none')
  const [historyCount, setHistoryCount] = useState(0)
  const [eligibility, setEligibility] = useState<EligibilityResult>('eligible')
  const [lastAction, setLastAction] = useState('booting')
  const socket = useRef<SyntheticSocket | undefined>(undefined)
  const transport = useRef<RealtimeTransport | undefined>(undefined)
  const eligibilityValue = useRef<EligibilityResult>('eligible')

  useEffect(() => {
    const socketFactory: RealtimeSocketFactory = (handshake) => {
      const created = new SyntheticSocket(handshake)
      socket.current = created
      return created
    }
    const eligibilityAdapter: ConversationEligibility = {
      check: async () => eligibilityValue.current,
    }
    const created = new RealtimeTransport({
      socketFactory,
      credentialProvider: async () => ({
        status: 'available',
        credential: {
          accessToken: 'synthetic-browser-fixture',
          correlationId: 'synthetic-browser',
          expiresAtEpochMs: Date.now() + 60_000,
        },
      }),
      eligibility: eligibilityAdapter,
      history: {
        recover: async (_id, boundary) => {
          setHistoryCount((count) => count + (boundary.afterEventId ? 1 : 0))
          return {
            status: 'recovered',
            boundary,
            count: boundary.afterEventId ? 1 : 0,
          }
        },
      },
      baseReconnectDelayMs: 10,
      maxReconnectDelayMs: 10,
      random: () => 0,
      onState: setState,
      onEvent: (event) => {
        if (event.eventType === 'message.created')
          setEventCount((count) => count + 1)
      },
      onAcknowledgement: (_acknowledgement, delivery) => {
        setAckCount((count) => count + 1)
        setLastDelivery(delivery)
      },
    })
    transport.current = created
    created.connect()
    return () => created.stop()
  }, [])

  const subscribe = async () => {
    const result = await transport.current?.subscribe(
      conversationId,
      createSubscribeCommand(conversationId),
    )
    setLastAction(`subscribe:${result}`)
  }

  const send = async () => {
    const result = await transport.current?.sendMessage(
      conversationId,
      createMessageCommand(conversationId, 'Synthetic browser message'),
    )
    setLastAction(`send:${result}`)
  }

  const changeEligibility = () => {
    eligibilityValue.current = 'unavailable'
    setEligibility('unavailable')
    setLastAction('eligibility:unavailable')
  }

  return (
    <main className="realtime-diagnostic-shell">
      <p className="realtime-diagnostic-kicker">
        Browser E2E · synthetic fixtures only
      </p>
      <h1>Realtime transport diagnostic</h1>
      <p>This is a bounded contract harness, not live consultation chat.</p>
      <dl className="realtime-diagnostic-grid">
        <div>
          <dt>Connection</dt>
          <dd data-testid="phase">{state.phase}</dd>
        </div>
        <div>
          <dt>Recovery</dt>
          <dd data-testid="recovery">{state.recovery}</dd>
        </div>
        <div>
          <dt>Eligibility</dt>
          <dd data-testid="eligibility">{eligibility}</dd>
        </div>
        <div>
          <dt>Last issue</dt>
          <dd data-testid="issue">{state.issue?.code ?? 'none'}</dd>
        </div>
        <div>
          <dt>Acknowledgements</dt>
          <dd data-testid="ack-count">{ackCount}</dd>
        </div>
        <div>
          <dt>Events applied</dt>
          <dd data-testid="event-count">{eventCount}</dd>
        </div>
        <div>
          <dt>Delivery meaning</dt>
          <dd data-testid="delivery">{lastDelivery}</dd>
        </div>
        <div>
          <dt>History boundaries</dt>
          <dd data-testid="history-count">{historyCount}</dd>
        </div>
      </dl>
      <p data-testid="last-action">{lastAction}</p>
      <div className="realtime-diagnostic-actions">
        <button onClick={() => void subscribe()}>Subscribe fixture</button>
        <button onClick={() => void send()}>Send fixture</button>
        <button onClick={() => socket.current?.duplicateEvent()}>
          Duplicate event
        </button>
        <button
          onClick={() => socket.current?.trigger('realtime.event', '{broken')}
        >
          Malformed event
        </button>
        <button
          onClick={() =>
            socket.current?.trigger('disconnect', 'transport close')
          }
        >
          Disconnect
        </button>
        <button
          onClick={() =>
            socket.current?.trigger('realtime.error', {
              schemaVersion: 1,
              correlationId: 'synthetic-browser',
              code: 'AUTHENTICATION_EXPIRED',
              message: 'Authentication has expired',
              retryable: false,
            })
          }
        >
          Expire authentication
        </button>
        <button onClick={changeEligibility}>
          Make eligibility unavailable
        </button>
      </div>
    </main>
  )
}
