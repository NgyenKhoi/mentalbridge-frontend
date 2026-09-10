import { io, type Socket } from 'socket.io-client'

import type { HandshakeV1 } from './envelopes'

export type SocketListener = (...args: unknown[]) => void

export interface RealtimeSocket {
  connect(): void
  disconnect(): void
  on(event: string, listener: SocketListener): void
  off(event: string, listener: SocketListener): void
  emit(
    event: 'realtime.command',
    payload: unknown,
    acknowledgement: (payload: unknown) => void,
  ): void
}

export type RealtimeSocketFactory = (handshake: HandshakeV1) => RealtimeSocket

export function createSocketIoFactory(endpoint: string): RealtimeSocketFactory {
  return (handshake) => {
    const socket: Socket = io(`${endpoint.replace(/\/$/, '')}/realtime`, {
      auth: handshake,
      autoConnect: false,
      reconnection: false,
      transports: ['websocket', 'polling'],
    })
    return socket as unknown as RealtimeSocket
  }
}
