import { ApiError } from '@/api/api-error'
import type { ChatApi } from './chat-api'
import { contractMismatch } from './chat-api'
import {
  acknowledgementSchema,
  errorSchema,
  eventSchema,
  type ChatCommand,
  type ChatMessage,
  type ChatRole,
  type Eligibility,
} from './chat-contract'
import type { ChatSocket, ChatSocketFactory } from './chat-socket'

export type PendingMessage = Readonly<{
  command: ChatCommand
  state: 'pending' | 'unconfirmed' | 'failed' | 'accepted'
  code?: string
}>
export type ChatState = Readonly<{
  phase:
    'checking' | 'connecting' | 'ready' | 'reconnecting' | 'paused' | 'blocked'
  eligibility: Eligibility | null
  messages: readonly ChatMessage[]
  pending: readonly PendingMessage[]
  nextCursor: string | null
  issue: string | null
}>
export const initialChatState: ChatState = {
  phase: 'checking',
  eligibility: null,
  messages: [],
  pending: [],
  nextCursor: null,
  issue: null,
}

// Appointment/account-bound, volatile only. Never an offline queue or lifecycle authority.
export class ChatSession {
  private state: ChatState = initialChatState
  private generation = 0
  private authoritySequence = 0
  private active = false
  private socket: ChatSocket | undefined
  private attempt = 0
  private commandBusy = false
  private refreshing: Promise<Eligibility> | undefined
  private timers = new Set<ReturnType<typeof setTimeout>>()
  private interval: ReturnType<typeof setInterval> | undefined
  private heartbeat: ReturnType<typeof setInterval> | undefined
  private listeners = new Set<() => void>()
  private events = new Map<string, string>()
  private waits = new Map<string, () => void>()
  constructor(
    private readonly options: Readonly<{
      api: ChatApi
      factory: ChatSocketFactory
      subject: string
      role: ChatRole
      appointmentId: string
      uuid: () => string
    }>,
  ) {}
  snapshot = () => this.state
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  private patch(value: Partial<ChatState>) {
    this.state = { ...this.state, ...value }
    this.listeners.forEach((listener) => listener())
  }
  private alive(generation: number) {
    return this.active && generation === this.generation
  }
  private later(callback: () => void, delay: number) {
    const timer = setTimeout(() => {
      this.timers.delete(timer)
      callback()
    }, delay)
    this.timers.add(timer)
    return timer
  }
  private release() {
    this.socket?.removeAllListeners()
    this.socket?.disconnect()
    this.socket = undefined
    if (this.heartbeat) clearInterval(this.heartbeat)
    this.heartbeat = undefined
    for (const cancel of this.waits.values()) cancel()
    this.waits.clear()
  }
  stop() {
    this.active = false
    this.generation += 1
    this.refreshing = undefined
    if (this.interval) clearInterval(this.interval)
    this.interval = undefined
    this.timers.forEach(clearTimeout)
    this.timers.clear()
    this.release()
    this.patch({
      phase: 'paused',
      eligibility: null,
      pending: this.state.pending.map((item) =>
        item.state === 'pending' ? { ...item, state: 'unconfirmed' } : item,
      ),
    })
  }
  start() {
    this.stop()
    this.active = true
    this.attempt = 0
    const generation = this.generation
    this.patch({ phase: 'checking', issue: null })
    this.interval = setInterval(() => {
      void this.refresh()
    }, 10_000)
    void this.establish(generation)
  }
  private failure(error: unknown) {
    this.authoritySequence += 1
    const code =
      error instanceof ApiError ? error.code : 'CHAT_CONTRACT_MISMATCH'
    const privateDenied =
      error instanceof ApiError && [401, 403, 404].includes(error.status ?? 0)
    this.patch({
      phase: 'blocked',
      eligibility: null,
      issue: code,
      ...(privateDenied ? { messages: [], pending: [], nextCursor: null } : {}),
    })
    this.release()
  }
  private async authority(
    operation: 'SUBSCRIBE' | 'SEND' | 'HISTORY' | 'CHECK_IN',
    generation: number,
  ) {
    const sequence = ++this.authoritySequence
    const decision = await this.options.api.eligibility(operation)
    if (!this.alive(generation))
      throw new ApiError({
        code: 'CHAT_INTERRUPTED',
        status: 0,
        message: 'Chat interrupted.',
      })
    if (sequence !== this.authoritySequence)
      throw new ApiError({
        code: 'CHAT_AUTHORITY_STALE',
        status: 503,
        message: 'A newer authority read superseded this decision.',
      })
    const previous = this.state.eligibility
    if (
      decision.appointmentId !== this.options.appointmentId ||
      decision.conversationId !== this.options.appointmentId ||
      (this.options.role === 'USER'
        ? decision.userAccountId
        : decision.specialistAccountId) !== this.options.subject ||
      (previous &&
        (previous.userAccountId !== decision.userAccountId ||
          previous.specialistAccountId !== decision.specialistAccountId))
    )
      contractMismatch()
    this.patch({ eligibility: decision, issue: null })
    return decision
  }
  async refresh() {
    if (!this.active || this.refreshing) return
    const generation = this.generation
    this.refreshing = this.authority('SUBSCRIBE', generation)
    try {
      const decision = await this.refreshing
      if (!decision.subscribeAllowed) {
        this.release()
        this.patch({ phase: 'blocked' })
        if (!decision.historyAllowed)
          this.patch({ messages: [], nextCursor: null })
        else await this.history(generation)
      } else if (
        !this.socket &&
        this.state.phase !== 'reconnecting' &&
        this.state.phase !== 'connecting'
      ) {
        void this.establish(generation)
      } else if (this.socket && this.state.phase === 'checking') {
        this.patch({ phase: 'ready' })
      }
    } catch (error) {
      if (this.alive(generation)) this.failure(error)
    } finally {
      if (this.alive(generation)) this.refreshing = undefined
    }
  }
  private async establish(generation: number) {
    try {
      const decision = await this.authority('SUBSCRIBE', generation)
      if (!decision.subscribeAllowed) {
        this.patch({ phase: 'blocked' })
        if (decision.historyAllowed) await this.history(generation)
        return
      }
      this.patch({ phase: 'connecting' })
      const credential = await this.options.api.credential()
      if (!this.alive(generation)) return
      if (Date.parse(credential.expiresAt) <= Date.now())
        throw new ApiError({
          code: 'AUTHENTICATION_EXPIRED',
          status: 401,
          message: 'Expired socket credential.',
        })
      this.release()
      const socket = this.options.factory(
        credential.accessToken,
        this.options.uuid(),
      )
      this.socket = socket
      const current = () => this.alive(generation) && this.socket === socket
      const readyTimer = this.later(() => {
        if (current() && this.state.phase === 'connecting')
          this.reconnect(generation)
      }, 8000)
      socket.on('connect_error', (value) => {
        if (!current()) return
        const safe = errorSchema.safeParse(
          typeof value === 'object' && value !== null
            ? Reflect.get(value, 'data')
            : undefined,
        )
        if (safe.success && safe.data.code.startsWith('AUTHENTICATION_')) {
          this.failure(
            new ApiError({
              code: safe.data.code,
              status: 401,
              message: 'Authentication required.',
            }),
          )
          return
        }
        this.reconnect(generation)
      })
      socket.on('disconnect', () => {
        if (current()) this.reconnect(generation)
      })
      socket.on('realtime.error', (value) => {
        if (current()) this.frameError(value)
      })
      socket.on('realtime.event', (value) => {
        if (!current()) return
        try {
          const event = eventSchema.parse(value)
          const fingerprint = JSON.stringify(event)
          const prior = this.events.get(event.eventId)
          if (prior === fingerprint) return
          if (prior) contractMismatch()
          this.events.set(event.eventId, fingerprint)
          if (event.eventType === 'connection.ready') {
            clearTimeout(readyTimer)
            this.timers.delete(readyTimer)
            if (
              event.payload.accountId !== this.options.subject ||
              event.payload.role !== this.options.role
            )
              contractMismatch()
            void this.recover(generation, socket)
          } else this.merge([event.payload])
        } catch (error) {
          this.failure(error)
        }
      })
      socket.connect()
    } catch (error) {
      if (this.alive(generation)) this.failure(error)
    }
  }
  private reconnect(generation: number) {
    this.release()
    this.patch({
      phase: 'reconnecting',
      eligibility: null,
      pending: this.state.pending.map((item) =>
        item.state === 'pending' ? { ...item, state: 'unconfirmed' } : item,
      ),
    })
    this.attempt += 1
    if (this.attempt > 5) {
      this.patch({ phase: 'blocked', issue: 'RECONNECT_EXHAUSTED' })
      return
    }
    this.later(
      () => {
        if (this.alive(generation)) void this.establish(generation)
      },
      Math.min(8000, 500 * 2 ** (this.attempt - 1)),
    )
  }
  private async recover(generation: number, socket: ChatSocket) {
    try {
      const recoveryBoundary = this.state.messages.at(-1)?.messageId
      const decision = await this.authority('SUBSCRIBE', generation)
      if (!decision.subscribeAllowed) {
        this.release()
        this.patch({ phase: 'blocked' })
        return
      }
      await this.dispatch(this.command('conversation.subscribe'), generation)
      await this.history(generation, false, recoveryBoundary)
      if (!this.alive(generation) || this.socket !== socket) return
      // A final decision follows potentially slow history recovery.
      const fresh = await this.authority('SUBSCRIBE', generation)
      if (!fresh.subscribeAllowed) {
        this.release()
        this.patch({ phase: 'blocked' })
        return
      }
      this.attempt = 0
      this.patch({ phase: 'ready' })
      this.heartbeat = setInterval(() => {
        void this.dispatch(
          this.command('presence.heartbeat'),
          generation,
        ).catch((error: unknown) => {
          if (this.alive(generation)) {
            this.patch({
              issue:
                error instanceof ApiError
                  ? error.code
                  : 'CHAT_CONTRACT_MISMATCH',
            })
            void this.refresh()
          }
        })
      }, 15_000)
      // Timer only prompts an authoritative read. It never settles/completes a session.
      this.later(
        () => {
          if (this.alive(generation)) {
            this.patch({ phase: 'checking' })
            void this.refresh().then(() => {
              if (
                this.alive(generation) &&
                this.socket === socket &&
                this.state.eligibility?.subscribeAllowed
              )
                this.patch({ phase: 'ready' })
            })
          }
        },
        Math.max(
          0,
          Date.parse(fresh.scheduledEndAt) - Date.parse(fresh.serverTime),
        ),
      )
    } catch (error) {
      if (this.alive(generation)) this.failure(error)
    }
  }
  private frameError(value: unknown) {
    const safe = errorSchema.safeParse(value)
    if (!safe.success) {
      this.failure(undefined)
      return
    }
    const error = safe.data
    if (error.code.startsWith('AUTHENTICATION_')) {
      this.failure(
        new ApiError({
          code: error.code,
          status: 401,
          message: 'Authentication required.',
        }),
      )
      return
    }
    this.patch({ phase: 'checking', eligibility: null, issue: error.code })
    void this.refresh()
  }
  private command(
    commandType: ChatCommand['commandType'],
    content?: string,
  ): ChatCommand {
    return {
      schemaVersion: 1,
      commandId: this.options.uuid(),
      correlationId: this.options.uuid(),
      sentAt: new Date().toISOString(),
      commandType,
      payload:
        commandType === 'presence.heartbeat'
          ? {}
          : {
              conversationId: this.options.appointmentId,
              ...(content !== undefined
                ? {
                    clientMessageId: this.options.uuid(),
                    type: 'TEXT' as const,
                    content,
                  }
                : {}),
            },
    }
  }
  private dispatch(command: ChatCommand, generation: number) {
    return new Promise<ReturnType<typeof acknowledgementSchema.parse>>(
      (resolve, reject) => {
        const socket = this.socket
        if (!this.alive(generation) || !socket) {
          reject(
            new ApiError({
              code: 'CHAT_INTERRUPTED',
              status: 0,
              message: 'Chat interrupted.',
            }),
          )
          return
        }
        const cancel = () =>
          finish(
            new ApiError({
              code: 'CHAT_ACK_UNCONFIRMED',
              status: 0,
              message: 'Acceptance unconfirmed.',
            }),
          )
        const timer = this.later(cancel, 5000)
        let done = false
        const finish = (
          error?: unknown,
          ack?: ReturnType<typeof acknowledgementSchema.parse>,
        ) => {
          if (done) return
          done = true
          clearTimeout(timer)
          this.timers.delete(timer)
          this.waits.delete(command.commandId)
          if (error) reject(error)
          else if (ack) resolve(ack)
        }
        this.waits.set(command.commandId, cancel)
        socket.emit('realtime.command', command, (value) => {
          if (done || !this.alive(generation) || this.socket !== socket) return
          const safe = errorSchema.safeParse(value)
          if (safe.success) {
            if (
              safe.data.correlationId !== command.correlationId ||
              (safe.data.commandId && safe.data.commandId !== command.commandId)
            ) {
              finish(new Error('Invalid acknowledgement scope.'))
              return
            }
            finish(
              new ApiError({
                code: safe.data.code,
                status: safe.data.code.startsWith('AUTHENTICATION_')
                  ? 401
                  : 409,
                message: 'Chat command rejected.',
              }),
            )
            return
          }
          const result = acknowledgementSchema.safeParse(value)
          if (
            !result.success ||
            result.data.commandId !== command.commandId ||
            result.data.correlationId !== command.correlationId ||
            (command.commandType === 'message.send' && !result.data.messageId)
          ) {
            finish(new Error('Invalid acknowledgement scope.'))
            return
          }
          finish(undefined, result.data)
        })
      },
    )
  }
  private merge(items: readonly ChatMessage[]) {
    const decision = this.state.eligibility
    if (!decision) contractMismatch()
    const messages = [...this.state.messages]
    for (const item of items) {
      if (
        item.conversationId !== this.options.appointmentId ||
        ![decision.userAccountId, decision.specialistAccountId].includes(
          item.senderId,
        )
      )
        contractMismatch()
      const previous = messages.find(
        (value) =>
          value.messageId === item.messageId ||
          (value.senderId === item.senderId &&
            value.clientMessageId === item.clientMessageId),
      )
      if (
        previous &&
        (Object.keys(previous) as (keyof ChatMessage)[]).some(
          (key) => previous[key] !== item[key],
        )
      )
        contractMismatch()
      if (!previous) messages.push(item)
    }
    messages.sort(
      (a, b) =>
        Date.parse(a.sentAt) - Date.parse(b.sentAt) ||
        a.messageId.localeCompare(b.messageId),
    )
    const pending = this.state.pending.filter(
      (item) =>
        !messages.some(
          (message) =>
            message.senderId === this.options.subject &&
            message.clientMessageId === item.command.payload.clientMessageId &&
            message.content === item.command.payload.content,
        ),
    )
    this.patch({ messages, pending })
  }
  private async history(
    generation: number,
    older = false,
    recoveryBoundary?: string,
  ) {
    const decision = await this.authority('HISTORY', generation)
    if (!decision.historyAllowed) {
      this.patch({ messages: [], nextCursor: null })
      return
    }
    let cursor = older ? (this.state.nextCursor ?? undefined) : undefined
    const visited = new Set<string>()
    for (let count = 0; count < 20; count += 1) {
      const page = await this.options.api.history(cursor)
      if (!this.alive(generation)) return
      this.merge(page.items)
      this.patch({ nextCursor: page.nextCursor })
      if (
        !recoveryBoundary ||
        !page.hasMore ||
        page.items.some((item) => item.messageId === recoveryBoundary)
      )
        return
      if (!page.nextCursor || visited.has(page.nextCursor)) contractMismatch()
      visited.add(page.nextCursor)
      cursor = page.nextCursor
    }
    throw new ApiError({
      code: 'CHAT_HISTORY_RECOVERY_INCOMPLETE',
      status: 503,
      message: 'Bounded history recovery incomplete.',
    })
  }
  async loadOlder() {
    if (!this.state.nextCursor || !this.active) return
    const generation = this.generation
    try {
      await this.history(generation, true)
    } catch (error) {
      if (this.alive(generation)) this.failure(error)
    }
  }
  async checkIn() {
    if (this.commandBusy || this.state.phase !== 'ready') return
    this.commandBusy = true
    const generation = this.generation
    try {
      const decision = await this.authority('CHECK_IN', generation)
      if (!decision.checkInAllowed) return
      await this.dispatch(this.command('conversation.check-in'), generation)
      await this.authority('SUBSCRIBE', generation)
    } catch (error) {
      if (this.alive(generation)) this.failure(error)
    } finally {
      this.commandBusy = false
    }
  }
  async send(content: string, replay?: ChatCommand) {
    if (
      this.commandBusy ||
      this.state.phase !== 'ready' ||
      !content.trim() ||
      content.length > 4000
    )
      return false
    this.commandBusy = true
    const generation = this.generation
    let command = replay
    try {
      if (
        replay &&
        !this.state.pending.some(
          (item) =>
            item.command === replay &&
            item.state !== 'pending' &&
            item.state !== 'accepted',
        )
      )
        return false
      const decision = await this.authority('SEND', generation)
      if (!decision.sendAllowed || !decision.subscribeAllowed) {
        this.patch({ phase: 'blocked' })
        this.release()
        return false
      }
      command ??= this.command('message.send', content)
      this.patch({
        pending: [
          ...this.state.pending.filter((item) => item.command !== command),
          { command, state: 'pending' },
        ],
      })
      const ack = await this.dispatch(command, generation)
      if (!this.alive(generation)) return false
      this.patch({
        pending: this.state.pending.map((item) =>
          item.command === command ? { ...item, state: 'accepted' } : item,
        ),
      })
      // Accepted is durable persistence, NOT a read/delivery receipt.
      const own = this.state.messages.find(
        (item) =>
          item.senderId === this.options.subject &&
          item.clientMessageId === command?.payload.clientMessageId,
      )
      if (own && own.messageId !== ack.messageId) contractMismatch()
      await this.history(generation)
      return true
    } catch (error) {
      if (this.alive(generation)) {
        const code =
          error instanceof ApiError ? error.code : 'CHAT_CONTRACT_MISMATCH'
        const unconfirmed =
          !(error instanceof ApiError) ||
          !error.status ||
          error.status >= 500 ||
          [
            'CHAT_EVIDENCE_UNAVAILABLE',
            'DEPENDENCY_UNAVAILABLE',
            'INTERNAL_ERROR',
          ].includes(code)
        this.patch({ issue: code })
        if (command)
          this.patch({
            pending: this.state.pending.map((item) =>
              item.command === command && item.state !== 'accepted'
                ? {
                    ...item,
                    state: unconfirmed ? 'unconfirmed' : 'failed',
                    code,
                  }
                : item,
            ),
            issue: code,
          })
        if (
          !(error instanceof ApiError) ||
          [401, 403, 404].includes(error.status ?? 0)
        )
          this.failure(error)
        else void this.refresh()
      }
      return false
    } finally {
      this.commandBusy = false
    }
  }
}
