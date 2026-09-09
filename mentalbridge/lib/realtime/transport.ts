import {
  parseAcknowledgementV1,
  parseHandshakeV1,
  parseSafeErrorV1,
  parseServerEventV1,
  type AcknowledgementV1,
  type CommandEnvelopeV1,
  type SafeErrorV1,
  type ServerEventV1,
} from './envelopes'
import {
  unavailableConversationEligibility,
  unavailableHistoryAdapter,
  type ConversationEligibility,
  type HistoryBoundary,
  type RealtimeHistoryAdapter,
} from './policies'
import type {
  RealtimeSocket,
  RealtimeSocketFactory,
  SocketListener,
} from './socket'

export type ConnectionPhase =
  | 'stopped'
  | 'connecting'
  | 'ready'
  | 'degraded'
  | 'authentication-expired'
  | 'disconnected'
  | 'reconnecting'
  | 'resubscribing'

export type RecoveryStatus =
  'not-needed' | 'pending' | 'recovered' | 'history-unavailable' | 'failed'

export interface TransportIssue {
  readonly code:
    | SafeErrorV1['code']
    | 'MALFORMED_FRAME'
    | 'DUPLICATE_CONFLICT'
    | 'OFFLINE'
    | 'RECONNECT_EXHAUSTED'
    | 'CREDENTIAL_UNAVAILABLE'
  readonly message: string
  readonly retryable: boolean
}

export interface ConnectionState {
  readonly phase: ConnectionPhase
  readonly reconnectAttempt: number
  readonly recovery: RecoveryStatus
  readonly issue?: TransportIssue
}

export interface BrowserSocketCredential {
  readonly accessToken: string
  readonly correlationId?: string
  readonly expiresAtEpochMs: number
}

export type CredentialResult =
  | {
      readonly status: 'available'
      readonly credential: BrowserSocketCredential
    }
  | { readonly status: 'unavailable'; readonly reason: string }

export type CredentialProvider = () => Promise<CredentialResult>

export interface Scheduler {
  setTimeout(callback: () => void, delayMs: number): unknown
  clearTimeout(handle: unknown): void
}

const browserScheduler: Scheduler = {
  setTimeout: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  clearTimeout: (handle) =>
    globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
}

export interface RealtimeTransportOptions {
  readonly socketFactory: RealtimeSocketFactory
  readonly credentialProvider: CredentialProvider
  readonly eligibility?: ConversationEligibility
  readonly history?: RealtimeHistoryAdapter
  readonly scheduler?: Scheduler
  readonly random?: () => number
  readonly online?: () => boolean
  readonly now?: () => number
  readonly baseReconnectDelayMs?: number
  readonly maxReconnectDelayMs?: number
  readonly maxReconnectAttempts?: number
  readonly onState?: (state: ConnectionState) => void
  readonly onEvent?: (event: ServerEventV1) => void
  readonly onAcknowledgement?: (
    acknowledgement: AcknowledgementV1,
    delivery: 'delivered' | 'degraded' | 'unconfirmed',
  ) => void
  readonly onError?: (error: SafeErrorV1 | TransportIssue) => void
}

type BoundListener = {
  readonly event: string
  readonly listener: SocketListener
}

type AuthorizedOperation = 'subscribe' | 'send'

type CommandAuthorization = {
  readonly conversationId: string
  readonly operation: AuthorizedOperation
  readonly fingerprint: string
}

const initialState: ConnectionState = {
  phase: 'stopped',
  reconnectAttempt: 0,
  recovery: 'not-needed',
}

function fingerprint(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(fingerprint).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${fingerprint(nested)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

export class RealtimeTransport {
  private readonly eligibility: ConversationEligibility
  private readonly history: RealtimeHistoryAdapter
  private readonly scheduler: Scheduler
  private socket?: RealtimeSocket
  private listeners: BoundListener[] = []
  private reconnectTimer?: unknown
  private deliberateStop = true
  private generation = 0
  private state: ConnectionState = initialState
  private readonly subscriptions = new Map<string, CommandEnvelopeV1>()
  private readonly historyBoundaries = new Map<string, HistoryBoundary>()
  private readonly commandFingerprints = new Map<string, string>()
  private readonly commandAuthorizations = new Map<
    string,
    CommandAuthorization
  >()
  private readonly acknowledgementFingerprints = new Map<string, string>()
  private readonly eventFingerprints = new Map<string, string>()
  private readonly messageFingerprints = new Map<string, string>()

  constructor(private readonly options: RealtimeTransportOptions) {
    this.eligibility = options.eligibility ?? unavailableConversationEligibility
    this.history = options.history ?? unavailableHistoryAdapter
    this.scheduler = options.scheduler ?? browserScheduler
  }

  getState(): ConnectionState {
    return this.state
  }

  connect(): void {
    if (
      !this.deliberateStop &&
      [
        'connecting',
        'ready',
        'degraded',
        'reconnecting',
        'resubscribing',
      ].includes(this.state.phase)
    )
      return
    this.deliberateStop = false
    this.clearReconnect()
    this.transition({
      phase: 'connecting',
      reconnectAttempt: 0,
      recovery: 'not-needed',
    })
    void this.establish(this.generation)
  }

  resume(): void {
    if (this.deliberateStop || this.socket || this.reconnectTimer) return
    this.transition({ ...this.state, phase: 'reconnecting', issue: undefined })
    void this.establish(this.generation)
  }

  stop(): void {
    this.deliberateStop = true
    this.generation += 1
    this.clearReconnect()
    this.releaseSocket(true)
    this.transition({
      phase: 'stopped',
      reconnectAttempt: 0,
      recovery: 'not-needed',
    })
  }

  async subscribe(
    conversationId: string,
    command: CommandEnvelopeV1,
  ): Promise<'sent' | 'unavailable' | 'denied' | 'conflict'> {
    const scope = this.commandScope(command)
    if (
      !scope ||
      scope.operation !== 'subscribe' ||
      scope.conversationId !== conversationId
    ) {
      this.authorizationIssue('Subscription command scope does not match.')
      return 'denied'
    }
    const generation = this.generation
    const eligible = await this.eligibility.check(conversationId, 'subscribe')
    if (!this.isActiveGeneration(generation)) return 'unavailable'
    if (eligible !== 'eligible') {
      this.eligibilityIssue(eligible)
      return eligible
    }
    const authorization = this.authorize(command, scope)
    if (authorization === 'conflict') return authorization
    this.subscriptions.set(conversationId, command)
    return this.dispatch(command)
  }

  async sendMessage(
    conversationId: string,
    command: CommandEnvelopeV1,
  ): Promise<'sent' | 'unavailable' | 'denied' | 'conflict'> {
    const scope = this.commandScope(command)
    if (
      !scope ||
      scope.operation !== 'send' ||
      scope.conversationId !== conversationId
    ) {
      this.authorizationIssue('Message command scope does not match.')
      return 'denied'
    }
    const generation = this.generation
    const eligible = await this.eligibility.check(conversationId, 'send')
    if (!this.isActiveGeneration(generation)) return 'unavailable'
    if (eligible !== 'eligible') {
      this.eligibilityIssue(eligible)
      return eligible
    }
    const authorization = this.authorize(command, scope)
    if (authorization === 'conflict') return authorization
    return this.dispatch(command)
  }

  async retry(
    command: CommandEnvelopeV1,
  ): Promise<'sent' | 'unavailable' | 'denied' | 'conflict'> {
    const generation = this.generation
    if (!this.isActiveGeneration(generation)) return 'unavailable'
    const authorization = this.commandAuthorizations.get(command.commandId)
    if (!authorization) {
      this.authorizationIssue('Command was not previously authorized.')
      return 'denied'
    }
    const scope = this.commandScope(command)
    if (
      !scope ||
      scope.conversationId !== authorization.conversationId ||
      scope.operation !== authorization.operation
    ) {
      this.authorizationIssue('Retry command scope does not match.')
      return 'denied'
    }
    if (fingerprint(command) !== authorization.fingerprint) {
      this.duplicateCommandIssue()
      return 'conflict'
    }
    const eligible = await this.eligibility.check(
      authorization.conversationId,
      authorization.operation,
    )
    if (!this.isActiveGeneration(generation)) return 'unavailable'
    if (eligible !== 'eligible') {
      this.eligibilityIssue(eligible)
      return eligible
    }
    return this.dispatch(command)
  }

  private commandScope(command: CommandEnvelopeV1):
    | {
        readonly conversationId: string
        readonly operation: AuthorizedOperation
      }
    | undefined {
    if (command.commandType === 'conversation.subscribe')
      return {
        conversationId: command.payload.conversationId,
        operation: 'subscribe',
      }
    if (command.commandType === 'message.send')
      return {
        conversationId: command.payload.conversationId,
        operation: 'send',
      }
    return undefined
  }

  private authorize(
    command: CommandEnvelopeV1,
    scope: {
      readonly conversationId: string
      readonly operation: AuthorizedOperation
    },
  ): 'authorized' | 'conflict' {
    const valueFingerprint = fingerprint(command)
    const prior = this.commandAuthorizations.get(command.commandId)
    if (prior && prior.fingerprint !== valueFingerprint) {
      this.duplicateCommandIssue()
      return 'conflict'
    }
    this.commandAuthorizations.set(command.commandId, {
      ...scope,
      fingerprint: valueFingerprint,
    })
    return 'authorized'
  }

  private async establish(generation: number): Promise<void> {
    if (this.options.online?.() === false) {
      this.reportIssue(
        {
          code: 'OFFLINE',
          message: 'Browser is offline; reconnect is paused.',
          retryable: true,
        },
        'disconnected',
      )
      return
    }
    const credential = await this.options
      .credentialProvider()
      .catch((): CredentialResult => ({
        status: 'unavailable',
        reason: 'A browser-safe socket credential could not be obtained.',
      }))
    if (generation !== this.generation || this.deliberateStop) return
    if (credential.status === 'unavailable') {
      this.reportIssue(
        {
          code: 'CREDENTIAL_UNAVAILABLE',
          message: credential.reason,
          retryable: false,
        },
        'disconnected',
      )
      return
    }
    if (
      credential.credential.expiresAtEpochMs <=
      (this.options.now?.() ?? Date.now())
    ) {
      this.reportIssue(
        {
          code: 'AUTHENTICATION_EXPIRED',
          message: 'Socket credential has expired.',
          retryable: false,
        },
        'authentication-expired',
      )
      return
    }
    const handshake = parseHandshakeV1({
      schemaVersion: 1,
      accessToken: credential.credential.accessToken,
      ...(credential.credential.correlationId
        ? { correlationId: credential.credential.correlationId }
        : {}),
    })
    if (!handshake.ok) {
      this.reportIssue(
        {
          code: 'CREDENTIAL_UNAVAILABLE',
          message: 'Socket credential handshake is invalid.',
          retryable: false,
        },
        'disconnected',
      )
      return
    }
    try {
      this.releaseSocket(false)
      this.socket = this.options.socketFactory(handshake.value)
      this.bindSocket(this.socket)
      this.socket.connect()
    } catch {
      this.scheduleReconnect('Socket construction failed.')
    }
  }

  private bindSocket(socket: RealtimeSocket): void {
    this.bind(socket, 'connect_error', () =>
      this.scheduleReconnect('Socket connection failed.'),
    )
    this.bind(socket, 'disconnect', () => this.onDisconnect())
    this.bind(socket, 'realtime.error', (payload) => this.handleError(payload))
    this.bind(socket, 'realtime.event', (payload) => this.handleEvent(payload))
  }

  private bind(
    socket: RealtimeSocket,
    event: string,
    listener: SocketListener,
  ): void {
    socket.on(event, listener)
    this.listeners.push({ event, listener })
  }

  private onDisconnect(): void {
    this.releaseSocket(false)
    if (this.deliberateStop || this.state.phase === 'authentication-expired')
      return
    this.scheduleReconnect('Realtime connection was interrupted.')
  }

  private scheduleReconnect(message: string): void {
    this.releaseSocket(false)
    if (
      this.deliberateStop ||
      this.reconnectTimer ||
      this.state.phase === 'authentication-expired'
    )
      return
    if (this.options.online?.() === false) {
      this.reportIssue(
        {
          code: 'OFFLINE',
          message: 'Browser is offline; reconnect is paused.',
          retryable: true,
        },
        'disconnected',
      )
      return
    }
    const nextAttempt = this.state.reconnectAttempt + 1
    const maximumAttempts = this.options.maxReconnectAttempts ?? 5
    if (nextAttempt > maximumAttempts) {
      this.reportIssue(
        {
          code: 'RECONNECT_EXHAUSTED',
          message: 'Reconnect attempt limit reached.',
          retryable: true,
        },
        'disconnected',
      )
      return
    }
    const base = this.options.baseReconnectDelayMs ?? 500
    const cap = this.options.maxReconnectDelayMs ?? 10_000
    const jitter = 0.5 + (this.options.random?.() ?? Math.random()) * 0.5
    const delay = Math.min(cap, base * 2 ** (nextAttempt - 1)) * jitter
    this.transition({
      phase: 'reconnecting',
      reconnectAttempt: nextAttempt,
      recovery: 'pending',
      issue: { code: 'DEPENDENCY_UNAVAILABLE', message, retryable: true },
    })
    this.reconnectTimer = this.scheduler.setTimeout(() => {
      this.reconnectTimer = undefined
      void this.establish(this.generation)
    }, delay)
  }

  private dispatch(
    command: CommandEnvelopeV1,
  ): 'sent' | 'unavailable' | 'conflict' {
    const commandFingerprint = fingerprint(command)
    const prior = this.commandFingerprints.get(command.commandId)
    if (prior && prior !== commandFingerprint) {
      this.duplicateCommandIssue()
      return 'conflict'
    }
    if (
      !this.socket ||
      !['ready', 'degraded', 'resubscribing'].includes(this.state.phase)
    )
      return 'unavailable'
    this.commandFingerprints.set(command.commandId, commandFingerprint)
    this.socket.emit('realtime.command', command, (payload) =>
      this.handleAcknowledgement(payload),
    )
    return 'sent'
  }

  private handleAcknowledgement(payload: unknown): void {
    const acknowledgement = parseAcknowledgementV1(payload)
    if (!acknowledgement.ok) {
      const error = parseSafeErrorV1(payload)
      if (error.ok) this.applySafeError(error.value)
      else this.reportMalformed('Malformed acknowledgement or error frame.')
      return
    }
    const key = acknowledgement.value.commandId
    const valueFingerprint = fingerprint({
      commandId: acknowledgement.value.commandId,
      correlationId: acknowledgement.value.correlationId,
      messageId: acknowledgement.value.messageId,
      liveDelivery: acknowledgement.value.liveDelivery,
    })
    const prior = this.acknowledgementFingerprints.get(key)
    if (prior === valueFingerprint) return
    if (prior) {
      this.reportIssue(
        {
          code: 'DUPLICATE_CONFLICT',
          message: 'Conflicting acknowledgement reused a command ID.',
          retryable: false,
        },
        'degraded',
      )
      return
    }
    this.acknowledgementFingerprints.set(key, valueFingerprint)
    const liveDelivery = acknowledgement.value.liveDelivery
    const delivery =
      liveDelivery === 'delivered'
        ? 'delivered'
        : liveDelivery === 'degraded'
          ? 'degraded'
          : 'unconfirmed'
    this.options.onAcknowledgement?.(acknowledgement.value, delivery)
  }

  private handleError(payload: unknown): void {
    const result = parseSafeErrorV1(payload)
    if (!result.ok) {
      this.reportMalformed('Malformed realtime error frame.')
      return
    }
    this.applySafeError(result.value)
  }

  private applySafeError(error: SafeErrorV1): void {
    this.options.onError?.(error)
    if (
      error.code === 'AUTHENTICATION_EXPIRED' ||
      error.code === 'AUTHENTICATION_REQUIRED'
    ) {
      this.clearReconnect()
      this.releaseSocket(true)
      this.transition({
        phase: 'authentication-expired',
        reconnectAttempt: this.state.reconnectAttempt,
        recovery: 'failed',
        issue: error,
      })
      return
    }
    this.transition({ ...this.state, phase: 'degraded', issue: error })
  }

  private handleEvent(payload: unknown): void {
    const result = parseServerEventV1(payload)
    if (!result.ok) {
      this.reportMalformed('Malformed realtime server event.')
      return
    }
    const event = result.value
    const eventFingerprint = fingerprint(event)
    const priorEvent = this.eventFingerprints.get(event.eventId)
    if (priorEvent === eventFingerprint) return
    if (priorEvent) {
      this.reportIssue(
        {
          code: 'DUPLICATE_CONFLICT',
          message: 'Conflicting event reused an event ID.',
          retryable: false,
        },
        'degraded',
      )
      return
    }
    if (event.eventType === 'message.created') {
      const messageKey = event.payload.clientMessageId
      const messageFingerprint = fingerprint(event.payload)
      const priorMessage = this.messageFingerprints.get(messageKey)
      if (priorMessage === messageFingerprint) return
      if (priorMessage) {
        this.reportIssue(
          {
            code: 'DUPLICATE_CONFLICT',
            message: 'Conflicting event reused message identifiers.',
            retryable: false,
          },
          'degraded',
        )
        return
      }
      this.messageFingerprints.set(messageKey, messageFingerprint)
      this.historyBoundaries.set(event.payload.conversationId, {
        afterEventId: event.eventId,
        afterOccurredAt: event.occurredAt,
      })
    }
    this.eventFingerprints.set(event.eventId, eventFingerprint)
    this.options.onEvent?.(event)
    if (event.eventType === 'connection.ready') {
      this.transition({
        phase: event.payload.presence === 'connected' ? 'ready' : 'degraded',
        reconnectAttempt: 0,
        recovery: this.subscriptions.size ? 'pending' : 'not-needed',
      })
      if (this.subscriptions.size) void this.recover(this.generation)
    }
  }

  private async recover(generation: number): Promise<void> {
    if (!this.isActiveGeneration(generation)) return
    this.transition({
      ...this.state,
      phase: 'resubscribing',
      recovery: 'pending',
    })
    let recovery: RecoveryStatus = 'recovered'
    for (const [conversationId, subscribeCommand] of this.subscriptions) {
      const eligibility = await this.eligibility.check(
        conversationId,
        'subscribe',
      )
      if (!this.isActiveGeneration(generation)) return
      if (eligibility !== 'eligible') {
        recovery = 'failed'
        this.eligibilityIssue(eligibility)
        continue
      }
      if (!this.isActiveGeneration(generation)) return
      if (this.dispatch(subscribeCommand) !== 'sent') {
        recovery = 'failed'
        continue
      }
      const historyEligibility = await this.eligibility.check(
        conversationId,
        'history',
      )
      if (!this.isActiveGeneration(generation)) return
      if (historyEligibility !== 'eligible') {
        recovery =
          historyEligibility === 'unavailable'
            ? 'history-unavailable'
            : 'failed'
        continue
      }
      const result = await this.history.recover(
        conversationId,
        this.historyBoundaries.get(conversationId) ?? {},
      )
      if (!this.isActiveGeneration(generation)) return
      if (result.status === 'unavailable') recovery = 'history-unavailable'
      if (result.status === 'failed') recovery = 'failed'
    }
    if (!this.isActiveGeneration(generation)) return
    this.transition({
      ...this.state,
      phase: recovery === 'recovered' ? 'ready' : 'degraded',
      recovery,
      ...(recovery === 'history-unavailable'
        ? {
            issue: {
              code: 'DEPENDENCY_UNAVAILABLE',
              message: 'Realtime history recovery is unavailable.',
              retryable: true,
            } as TransportIssue,
          }
        : {}),
    })
  }

  private eligibilityIssue(result: 'denied' | 'unavailable'): void {
    const issue: TransportIssue =
      result === 'denied'
        ? {
            code: 'ACCESS_DENIED',
            message: 'Conversation access is denied.',
            retryable: false,
          }
        : {
            code: 'CHAT_ELIGIBILITY_UNAVAILABLE',
            message: 'Conversation eligibility is unavailable.',
            retryable: true,
          }
    this.reportIssue(issue, 'degraded')
  }

  private authorizationIssue(message: string): void {
    this.reportIssue(
      { code: 'ACCESS_DENIED', message, retryable: false },
      'degraded',
    )
  }

  private duplicateCommandIssue(): void {
    this.reportIssue(
      {
        code: 'DUPLICATE_CONFLICT',
        message: 'A command ID was reused with different content.',
        retryable: false,
      },
      'degraded',
    )
  }

  private isActiveGeneration(generation: number): boolean {
    return generation === this.generation && !this.deliberateStop
  }

  private reportMalformed(message: string): void {
    this.reportIssue(
      { code: 'MALFORMED_FRAME', message, retryable: false },
      'degraded',
    )
  }

  private reportIssue(issue: TransportIssue, phase: ConnectionPhase): void {
    this.options.onError?.(issue)
    this.transition({ ...this.state, phase, issue })
  }

  private transition(state: ConnectionState): void {
    this.state = state
    this.options.onState?.(state)
  }

  private releaseSocket(disconnect: boolean): void {
    const socket = this.socket
    if (!socket) return
    for (const { event, listener } of this.listeners)
      socket.off(event, listener)
    this.listeners = []
    this.socket = undefined
    if (disconnect) socket.disconnect()
  }

  private clearReconnect(): void {
    if (this.reconnectTimer === undefined) return
    this.scheduler.clearTimeout(this.reconnectTimer)
    this.reconnectTimer = undefined
  }
}
