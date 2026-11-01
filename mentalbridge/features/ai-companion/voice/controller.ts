import { voiceClient } from './client'
import {
  terminal,
  VoiceError,
  type Connection,
  type Eligibility,
  type VoiceSession,
} from './contract'
import { LiveKitVoiceMedia, type Hint, type Media } from './media'

export type VoiceView = Readonly<{
  phase:
    | 'loading'
    | 'ready'
    | 'starting'
    | 'connected'
    | 'reconnecting'
    | 'ending'
    | 'ended'
    | 'error'
  eligibility?: Eligibility
  session?: VoiceSession
  hint: Hint
  muted: boolean
  audioBlocked: boolean
  error?: string
  uncertain: boolean
}>
type Api = typeof voiceClient
const codeOf = (error: unknown) =>
  error instanceof VoiceError
    ? error.code
    : error instanceof DOMException && error.name === 'NotAllowedError'
      ? 'MIC_DENIED'
      : 'VOICE_UNAVAILABLE'

export class VoiceController {
  private view: VoiceView = {
    phase: 'loading',
    hint: 'unavailable',
    muted: false,
    audioBlocked: false,
    uncertain: false,
  }
  private readonly listeners = new Set<() => void>()
  private epoch = 0
  private disposed = false
  private media: Media | undefined
  private createKey: string | undefined
  private endKey: string | undefined
  private preview: AbortController | undefined
  private polling: ReturnType<typeof setInterval> | undefined
  private reading = false
  constructor(
    private readonly api: Api = voiceClient,
    private readonly makeMedia: () => Media = () => new LiveKitVoiceMedia(),
  ) {}
  snapshot = () => this.view
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
      queueMicrotask(() => {
        if (this.listeners.size === 0) this.dispose()
      })
    }
  }
  private update(patch: Partial<VoiceView>) {
    if (this.disposed) return
    this.view = { ...this.view, ...patch }
    for (const listener of this.listeners) listener()
  }
  private current(epoch: number) {
    return !this.disposed && epoch === this.epoch
  }
  async refresh() {
    if (this.disposed || (this.view.session && !terminal(this.view.session)))
      return
    const epoch = ++this.epoch
    this.preview?.abort()
    this.preview = new AbortController()
    this.update({ phase: 'loading', error: undefined })
    try {
      const eligibility = await this.api.eligibility(this.preview.signal)
      if (this.current(epoch)) this.update({ eligibility, phase: 'ready' })
    } catch (error) {
      if (this.current(epoch))
        this.update({
          phase: 'error',
          eligibility: undefined,
          error: codeOf(error),
        })
    }
  }
  async start() {
    if (
      ['starting', 'connected', 'reconnecting', 'ending'].includes(
        this.view.phase,
      ) ||
      this.disposed
    )
      return
    const epoch = ++this.epoch
    this.preview?.abort()
    this.update({ phase: 'starting', error: undefined, hint: 'initializing' })
    const media = this.makeMedia()
    this.media?.close()
    this.media = media
    try {
      if (!this.view.uncertain) {
        const eligibility = await this.api.eligibility()
        if (!this.current(epoch)) return
        this.update({ eligibility })
        if (!eligibility.eligible) {
          media.close()
          this.update({ phase: 'ready', hint: 'unavailable' })
          return
        }
      }
      await media.permission()
      if (!this.current(epoch)) {
        media.close()
        return
      }
      const key = this.createKey ?? crypto.randomUUID()
      this.createKey = key
      const session = await this.api.create(key)
      if (!this.current(epoch)) {
        media.close()
        await this.api.end(session.voiceSessionId, crypto.randomUUID())
        return
      }
      this.update({ session, uncertain: false })
      if (terminal(session)) {
        media.close()
        this.update({ phase: 'ended', hint: 'unavailable' })
        return
      }
      const connection = await this.api.connection(
        session.voiceSessionId,
        crypto.randomUUID(),
      )
      if (!this.current(epoch)) {
        media.close()
        return
      }
      this.verifyConnection(connection, session)
      await media.connect(connection, {
        hint: (hint) => {
          if (this.current(epoch)) this.update({ hint })
        },
        reconnecting: () => {
          if (this.current(epoch))
            this.update({ phase: 'reconnecting', hint: 'unavailable' })
        },
        reconnected: () => {
          if (this.current(epoch)) void this.reconnect(epoch)
        },
        disconnected: () => {
          if (this.current(epoch)) void this.fail('CONNECTION_LOST')
        },
        audioBlocked: () => {
          if (this.current(epoch)) this.update({ audioBlocked: true })
        },
      })
      if (!this.current(epoch)) {
        media.close()
        return
      }
      this.update({ phase: 'connected' })
      this.poll()
    } catch (error) {
      media.close()
      if (!this.current(epoch)) return
      const code = codeOf(error)
      if (this.view.session && !terminal(this.view.session))
        await this.end(code)
      else
        this.update({
          phase: 'error',
          error: code,
          uncertain:
            this.view.uncertain ||
            ((code === 'OUTCOME_UNKNOWN' || code === 'INVALID_RESPONSE') &&
              !!this.createKey),
          hint: 'unavailable',
        })
    }
  }
  private verifyConnection(connection: Connection, session: VoiceSession) {
    if (
      connection.voiceSessionId !== session.voiceSessionId ||
      !session.hardStopAt ||
      connection.hardStopAt !== session.hardStopAt ||
      Date.parse(connection.tokenExpiresAt) > Date.parse(connection.hardStopAt)
    )
      throw new VoiceError('INVALID_RESPONSE')
  }
  private async reconnect(epoch: number) {
    const session = this.view.session
    if (!session) return
    try {
      const current = await this.api.session(session.voiceSessionId)
      if (!this.current(epoch)) return
      if (terminal(current) || current.state === 'ENDING') {
        await this.end()
        return
      }
      const connection = await this.api.connection(
        session.voiceSessionId,
        crypto.randomUUID(),
      )
      if (!this.current(epoch)) return
      this.verifyConnection(connection, session)
      await this.media?.resume(connection)
      if (this.current(epoch))
        this.update({
          session: current,
          phase: 'connected',
          hint: 'unavailable',
        })
    } catch (error) {
      if (this.current(epoch)) await this.fail(codeOf(error))
    }
  }
  async mute() {
    const value = !this.view.muted
    try {
      await this.media?.mute(value)
      this.update({ muted: value })
    } catch {
      await this.fail('MIC_UNAVAILABLE')
    }
  }
  async audio() {
    try {
      await this.media?.audio()
      this.update({ audioBlocked: false })
    } catch {
      this.update({ audioBlocked: true })
    }
  }
  private poll() {
    clearInterval(this.polling)
    this.polling = setInterval(() => {
      void this.readSession()
    }, 2000)
  }
  private async readSession() {
    const previous = this.view.session
    if (this.disposed || this.reading || !previous) return
    this.reading = true
    const epoch = this.epoch
    try {
      const session = await this.api.session(previous.voiceSessionId)
      if (!this.current(epoch)) return
      if (
        session.voiceSessionId !== previous.voiceSessionId ||
        session.hardStopAt !== previous.hardStopAt
      )
        throw new VoiceError('INVALID_RESPONSE')
      this.update({ session })
      if (terminal(session)) {
        this.media?.close()
        clearInterval(this.polling)
        this.createKey = undefined
        this.endKey = undefined
        this.update({ phase: 'ended', hint: 'unavailable' })
      } else if (session.state === 'ENDING' && this.view.phase !== 'ending')
        await this.end()
    } catch (error) {
      if (this.current(epoch)) {
        this.media?.close()
        if (this.view.phase === 'ending')
          this.update({ error: 'OUTCOME_UNKNOWN' })
        else await this.fail(codeOf(error))
      }
    } finally {
      this.reading = false
    }
  }
  private async fail(error: string) {
    this.media?.close()
    await this.end(error)
  }
  async end(error?: string) {
    ++this.epoch
    this.preview?.abort()
    this.media?.close()
    const session = this.view.session
    if (!session || terminal(session)) {
      this.update({ phase: 'ended', error, hint: 'unavailable' })
      return
    }
    this.update({ phase: 'ending', error, hint: 'unavailable' })
    const key = this.endKey ?? crypto.randomUUID()
    this.endKey = key
    try {
      const result = await this.api.end(session.voiceSessionId, key)
      if (result.voiceSessionId !== session.voiceSessionId)
        throw new VoiceError('INVALID_RESPONSE')
      this.update({
        session: result,
        phase: terminal(result) ? 'ended' : 'ending',
      })
      if (terminal(result)) {
        clearInterval(this.polling)
        this.createKey = undefined
        this.endKey = undefined
      } else this.poll()
    } catch {
      this.update({ phase: 'ending', error: error ?? 'OUTCOME_UNKNOWN' })
      this.poll()
    }
  }
  dispose = () => {
    if (this.disposed) return
    this.disposed = true
    ++this.epoch
    this.preview?.abort()
    clearInterval(this.polling)
    this.media?.close()
    const session = this.view.session
    if (session && !terminal(session))
      void this.api
        .end(
          session.voiceSessionId,
          this.endKey ?? crypto.randomUUID(),
          undefined,
          true,
        )
        .catch(() => undefined)
    this.listeners.clear()
  }
}
