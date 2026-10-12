import { io } from 'socket.io-client'
import type { ChatCommand } from './chat-contract'

export interface ChatSocket {
  connect(): void
  disconnect(): void
  on(event: string, listener: (value: unknown) => void): void
  removeAllListeners(): void
  emit(
    event: 'realtime.command',
    command: ChatCommand,
    acknowledgement: (value: unknown) => void,
  ): void
}
export type ChatSocketFactory = (
  credential: string,
  correlationId: string,
) => ChatSocket
export function createChatSocketFactory(edge: string): ChatSocketFactory {
  // One public edge; no provider endpoint or extra public environment key.
  const url = new URL(edge)
  return (accessToken, correlationId) =>
    io(`${url.origin}/realtime`, {
      path: `${url.pathname.replace(/\/$/, '')}/socket.io`,
      auth: { schemaVersion: 1, accessToken, correlationId },
      autoConnect: false,
      reconnection: false,
      transports: ['websocket'],
      timeout: 5000,
      forceNew: true,
    })
}
