import { socketCredential } from '@/features/appointments/api/chat-browser-client'
import {
  createSocketIoFactory,
  type RealtimeSocket,
} from '@/lib/realtime/socket'

const RETRY_MIN_MS = 5_000
const RETRY_MAX_MS = 60_000

// notification.created is only a pointer (contracts/websocket/realtime/
// notification-server-event-v1): the caller refetches REST state. The socket
// credential is one-use, so every reconnect asks for a new one; failures back
// off silently because the bell keeps polling as the fallback.
export function subscribeNotificationCreated(
  onCreated: (notificationId: string) => void,
): () => void {
  let socket: RealtimeSocket | undefined
  let timer: number | undefined
  let stopped = false
  let delay = RETRY_MIN_MS

  const retry = () => {
    if (stopped || timer !== undefined) return
    timer = window.setTimeout(() => {
      timer = undefined
      void connect()
    }, delay)
    delay = Math.min(delay * 2, RETRY_MAX_MS)
  }

  async function connect() {
    try {
      const credential = await socketCredential()
      if (stopped) return
      const next = createSocketIoFactory(credential.endpoint)({
        schemaVersion: 1,
        accessToken: credential.accessToken,
      })
      socket = next
      next.on('connect', () => {
        delay = RETRY_MIN_MS
      })
      next.on('notification.created', (event) => {
        const { eventType, payload } = (event ?? {}) as {
          eventType?: unknown
          payload?: { notificationId?: unknown }
        }
        if (
          eventType === 'notification.created' &&
          typeof payload?.notificationId === 'string'
        )
          onCreated(payload.notificationId)
      })
      const drop = () => {
        next.disconnect()
        if (socket === next) socket = undefined
        retry()
      }
      next.on('disconnect', drop)
      next.on('connect_error', drop)
      next.connect()
    } catch {
      retry()
    }
  }

  void connect()
  return () => {
    stopped = true
    window.clearTimeout(timer)
    socket?.disconnect()
  }
}
