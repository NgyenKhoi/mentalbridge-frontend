import { io } from 'socket.io-client'

export interface CommunitySocket {
  connect(): void
  disconnect(): void
  removeAllListeners(): void
  on(event: string, listener: (value?: unknown) => void): void
  emit(
    event: 'community.command',
    command: unknown,
    acknowledgement: (value: unknown) => void,
  ): void
}
export type CommunitySocketFactory = (credential: string) => CommunitySocket
export function createCommunitySocketFactory(
  edge: string,
): CommunitySocketFactory {
  const url = new URL(edge)
  return (credential) =>
    io(`${url.origin}/community`, {
      path: `${url.pathname.replace(/\/$/, '')}/socket.io`,
      auth: { schemaVersion: 1, credential },
      autoConnect: false,
      reconnection: false,
      transports: ['websocket'],
      timeout: 5000,
      forceNew: true,
    })
}
