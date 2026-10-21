import { ApiError } from '@/api/api-error'
import type { CommunityChatApi } from './community-chat-api'
import { chatMismatch } from './community-chat-api'
import {
  eventSchema,
  type CommunityConversation,
  type CommunityMessage,
  type Versioned,
} from './community-chat-contract'
import type {
  CommunitySocket,
  CommunitySocketFactory,
} from './community-chat-socket'

type PendingSend = Readonly<{
  content: string
  clientMessageId: string
  key: string
}>
export type CommunityChatState = Readonly<{
  phase: 'checking' | 'ready' | 'paused' | 'unavailable'
  conversation: Versioned<CommunityConversation> | null
  messages: readonly CommunityMessage[]
  nextCursor: string | null
  presence: Readonly<Record<string, 'ONLINE' | 'OFFLINE' | 'UNKNOWN'>>
  issue: string | null
  sending: boolean
  unconfirmed: boolean
}>
const initial: CommunityChatState = {
  phase: 'checking',
  conversation: null,
  messages: [],
  nextCursor: null,
  presence: {},
  issue: null,
  sending: false,
  unconfirmed: false,
}
export class CommunityChatSession {
  private state: CommunityChatState = initial
  private generation = 0
  private active = false
  private socket: CommunitySocket | undefined
  private heartbeat: ReturnType<typeof setInterval> | undefined
  private listeners = new Set<() => void>()
  private waits = new Set<() => void>()
  private pending: PendingSend | undefined
  private pages = 1
  private repairing = false
  private repairAgain = false
  private authorizationEpoch = 0
  constructor(
    private readonly options: Readonly<{
      api: CommunityChatApi
      factory: CommunitySocketFactory
      conversationId: string
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
  private patch(value: Partial<CommunityChatState>) {
    this.state = { ...this.state, ...value }
    this.listeners.forEach((listener) => listener())
  }
  private current(generation: number) {
    return this.active && generation === this.generation
  }
  private close() {
    if (this.heartbeat) clearInterval(this.heartbeat)
    this.heartbeat = undefined
    this.socket?.removeAllListeners()
    this.socket?.disconnect()
    this.socket = undefined
    this.waits.forEach((cancel) => cancel())
    this.waits.clear()
  }
  stop() {
    this.active = false
    this.generation++
    this.close()
    this.patch({ ...initial, phase: 'paused', unconfirmed: !!this.pending })
  }
  clear() {
    this.pending = undefined
    this.pages = 1
    this.stop()
  }
  private fail(error: unknown) {
    const code =
      error instanceof ApiError ? error.code : 'DEPENDENCY_UNAVAILABLE'
    if (
      error instanceof ApiError &&
      [401, 403, 404].includes(error.status ?? 0)
    )
      this.pending = undefined
    this.active = false
    this.generation++
    this.close()
    this.patch({
      ...initial,
      phase: 'unavailable',
      issue: code,
      unconfirmed: !!this.pending,
    })
  }
  async start(): Promise<void> {
    if (this.active) return
    this.active = true
    const generation = ++this.generation
    this.patch({ ...initial, unconfirmed: !!this.pending })
    try {
      const credential = await this.options.api.credential()
      if (!this.current(generation)) return
      if (Date.parse(credential.expiresAt) <= Date.now())
        throw new ApiError({
          code: 'UNAUTHENTICATED',
          status: 401,
          message: 'Socket credential expired.',
        })
      const socket = this.options.factory(credential.credential)
      this.socket = socket
      socket.on('community.event', (value) => {
        if (this.current(generation)) this.receive(value)
      })
      await this.connected(socket)
      if (!this.current(generation)) return
      socket.on('disconnect', () => {
        if (this.current(generation)) this.fail(new Error('Disconnected'))
      })
      socket.on('connect_error', () => {
        if (this.current(generation))
          this.fail(new Error('Connection unavailable'))
      })
      await this.command('community.conversation.subscribe', {
        conversationId: this.options.conversationId,
      })
      if (!this.current(generation)) return
      await this.repair()
      if (!this.current(generation)) return
      await this.command('community.presence.heartbeat', { foreground: true })
      if (!this.current(generation)) return
      this.heartbeat = setInterval(() => {
        void this.command('community.presence.heartbeat', {
          foreground: true,
        }).catch((error) => {
          if (this.current(generation)) this.fail(error)
        })
      }, 20_000)
    } catch (error) {
      if (this.current(generation)) this.fail(error)
    }
  }
  private connected(socket: CommunitySocket): Promise<void> {
    return new Promise((resolve, reject) => {
      const cancel = () => {
        clearTimeout(timer)
        this.waits.delete(cancel)
        reject(new Error('Connection stopped'))
      }
      const timer = setTimeout(cancel, 5000)
      this.waits.add(cancel)
      socket.on('connect', () => {
        clearTimeout(timer)
        this.waits.delete(cancel)
        resolve()
      })
      socket.on('connect_error', cancel)
      socket.connect()
    })
  }
  private command(commandType: string, payload: unknown): Promise<void> {
    const socket = this.socket
    if (!socket) return Promise.reject(new Error('Socket unavailable'))
    const commandId = this.options.uuid()
    return new Promise((resolve, reject) => {
      const cancel = () => {
        clearTimeout(timer)
        this.waits.delete(cancel)
        reject(new Error('Command not confirmed'))
      }
      const timer = setTimeout(cancel, 5000)
      this.waits.add(cancel)
      socket.emit(
        'community.command',
        {
          schemaVersion: 1,
          commandId,
          correlationId: this.options.uuid(),
          commandType,
          payload,
        },
        (wire) => {
          clearTimeout(timer)
          this.waits.delete(cancel)
          const result = eventSchema.safeParse(wire)
          if (
            !result.success ||
            !('commandId' in result.data.payload) ||
            result.data.payload.commandId !== commandId
          ) {
            reject(new Error('Invalid acknowledgement'))
            return
          }
          if (result.data.eventType !== 'community.command.ack') {
            const code =
              result.data.eventType === 'community.command.error'
                ? result.data.payload.code
                : 'DEPENDENCY_UNAVAILABLE'
            reject(
              new ApiError({
                code,
                ...(code === 'TARGET_UNAVAILABLE'
                  ? { status: 404 }
                  : code === 'UNAUTHENTICATED'
                    ? { status: 401 }
                    : {}),
                message: 'Command unavailable.',
              }),
            )
            return
          }
          resolve()
        },
      )
    })
  }
  private receive(wire: unknown) {
    const parsed = eventSchema.safeParse(wire)
    if (!parsed.success) {
      this.fail(new Error('Invalid event'))
      return
    }
    const event = parsed.data
    if (event.eventType === 'community.presence.changed') {
      const profile = event.payload.communityProfileId
      if (
        this.state.phase === 'ready' &&
        this.state.conversation?.value.peers.some(
          (peer) =>
            peer.state === 'AVAILABLE' && peer.communityProfileId === profile,
        )
      )
        this.patch({
          presence: { ...this.state.presence, [profile]: event.payload.state },
        })
      return
    }
    const conversation =
      event.eventType === 'community.message.created'
        ? event.payload.message.conversationId
        : 'conversationId' in event.payload
          ? event.payload.conversationId
          : null
    if (conversation !== this.options.conversationId) return
    if (event.eventType === 'community.conversation.invalidated') {
      this.authorizationEpoch++
      this.patch({
        phase: 'checking',
        conversation: null,
        messages: [],
        presence: {},
        nextCursor: null,
      })
    }
    if (
      event.eventType === 'community.read-state.changed' &&
      this.state.conversation
    ) {
      this.patch({
        conversation: {
          ...this.state.conversation,
          value: {
            ...this.state.conversation.value,
            unreadCount: event.payload.unreadCount,
          },
        },
      })
      return
    }
    void this.repair()
  }
  async repair(): Promise<void> {
    if (!this.active) return
    if (this.repairing) {
      this.repairAgain = true
      return
    }
    const generation = this.generation
    const authorizationEpoch = this.authorizationEpoch
    this.repairing = true
    try {
      const conversation = await this.options.api.conversation(
        this.options.conversationId,
      )
      if (
        !this.current(generation) ||
        authorizationEpoch !== this.authorizationEpoch
      )
        return
      let cursor: string | undefined
      const messages: CommunityMessage[] = [],
        cursors = new Set<string>()
      for (let page = 0; page < this.pages; page++) {
        const result = await this.options.api.messages(
          this.options.conversationId,
          cursor,
        )
        if (
          !this.current(generation) ||
          authorizationEpoch !== this.authorizationEpoch
        )
          return
        messages.push(...result.items)
        cursor = result.nextCursor ?? undefined
        if (!cursor) break
        if (cursors.has(cursor)) chatMismatch()
        cursors.add(cursor)
      }
      if (
        !this.current(generation) ||
        authorizationEpoch !== this.authorizationEpoch
      )
        return
      const unique = [
        ...new Map(
          messages.map((message) => [message.messageId, message]),
        ).values(),
      ]
      this.patch({
        phase: 'ready',
        conversation,
        messages: unique,
        nextCursor: cursor ?? null,
        issue: null,
      })
    } catch (error) {
      if (this.current(generation)) this.fail(error)
    } finally {
      this.repairing = false
      if (this.repairAgain && this.active) {
        this.repairAgain = false
        void this.repair()
      }
    }
  }
  async more() {
    if (this.state.phase !== 'ready' || !this.state.nextCursor) return
    this.pages++
    await this.repair()
  }
  async send(content: string): Promise<boolean> {
    if (
      this.state.phase !== 'ready' ||
      this.state.sending ||
      this.state.conversation?.value.state !== 'ACTIVE'
    )
      return false
    if (this.pending && this.pending.content !== content)
      throw new ApiError({
        code: 'UNCONFIRMED_MESSAGE',
        message: 'Reconcile the pending message before changing it.',
      })
    this.pending ??= {
      content,
      clientMessageId: this.options.uuid(),
      key: this.options.uuid(),
    }
    const pending = this.pending,
      generation = this.generation
    this.patch({ sending: true, issue: null })
    try {
      await this.options.api.send(
        this.options.conversationId,
        pending.clientMessageId,
        pending.content,
        pending.key,
      )
      if (!this.current(generation)) return false
      this.pending = undefined
      this.patch({ unconfirmed: false })
      await this.repair()
      return true
    } catch (error) {
      if (!this.current(generation)) return false
      if (
        error instanceof ApiError &&
        [401, 403, 404].includes(error.status ?? 0)
      )
        this.fail(error)
      else {
        const definitive =
          error instanceof ApiError &&
          error.status !== undefined &&
          error.status < 500 &&
          ![408, 429].includes(error.status)
        if (definitive) this.pending = undefined
        this.patch({
          issue:
            error instanceof ApiError ? error.code : 'DEPENDENCY_UNAVAILABLE',
          unconfirmed: !definitive,
        })
      }
      return false
    } finally {
      if (this.current(generation)) this.patch({ sending: false })
    }
  }
  async markRead() {
    const last = this.state.messages.at(-1)
    if (this.state.phase !== 'ready' || !last) return
    const generation = this.generation
    try {
      await this.options.api.read(this.options.conversationId, last.messageId)
      if (this.current(generation)) await this.repair()
    } catch (error) {
      if (this.current(generation)) this.fail(error)
    }
  }
}
