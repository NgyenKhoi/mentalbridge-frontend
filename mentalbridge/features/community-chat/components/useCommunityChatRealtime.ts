'use client'

import { useEffect, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { browserApiClient } from '@/lib/api/browser-client'
import {
  isCommunityCommandAccepted,
  parseCommunityCredential,
} from '../api/community-presence'
import { parseCommunityMessageEvent } from '../api/community-message-events'
import type { ChatMessage } from '../api/community-chat-contract'
import { refreshCommunityInbox } from './CommunityInboxProvider'

export function useCommunityChatRealtime(
  conversationId: string | undefined,
  onMessage: (message: ChatMessage) => void,
  onResync: () => void,
  onInvalidated: () => void,
) {
  const [phase, setPhase] = useState<
    'idle' | 'connecting' | 'ready' | 'unavailable'
  >('idle')

  useEffect(() => {
    if (!conversationId) return
    let alive = true
    let socket: Socket | undefined
    let retry: ReturnType<typeof setTimeout> | undefined
    let starting = false
    const fail = () => {
      if (!alive) return
      setPhase('unavailable')
      if (retry) clearTimeout(retry)
      if (!document.hidden && navigator.onLine)
        retry = setTimeout(() => void start(), 5000)
    }
    async function start() {
      if (
        !alive ||
        starting ||
        socket?.connected ||
        document.hidden ||
        !navigator.onLine
      )
        return
      starting = true
      setPhase('connecting')
      socket?.removeAllListeners()
      socket?.disconnect()
      try {
        const response = await browserApiClient.post<unknown>(
          '/community/socket-credentials',
          {},
        )
        const value = response.data
        if (!alive) return
        if (
          value === null ||
          typeof value !== 'object' ||
          !('endpoint' in value) ||
          typeof value.endpoint !== 'string'
        )
          throw new Error('Invalid connection response')
        const { endpoint, ...wire } = value
        const credential = parseCommunityCredential(wire)
        const url = new URL(endpoint, window.location.origin)
        if (
          !credential ||
          Date.parse(credential.expiresAt) <= Date.now() ||
          !['http:', 'https:'].includes(url.protocol)
        )
          throw new Error('Invalid connection credential')
        socket = io(`${endpoint.replace(/\/$/, '')}/community`, {
          autoConnect: false,
          reconnection: false,
          transports: ['websocket'],
          auth: { schemaVersion: 1, credential: credential.credential },
        })
        socket.on('connect', () => {
          const commandId = crypto.randomUUID()
          socket?.timeout(5000).emit(
            'community.command',
            {
              schemaVersion: 1,
              commandId,
              correlationId: crypto.randomUUID(),
              commandType: 'community.conversation.subscribe',
              payload: { conversationId },
            },
            (error: Error | null, ack: unknown) => {
              if (!alive) return
              if (error || !isCommunityCommandAccepted(ack, commandId)) {
                socket?.disconnect()
                fail()
                return
              }
              setPhase('ready')
              onResync()
            },
          )
        })
        socket.on('community.event', (wire: unknown) => {
          if (!alive || !socket?.connected) return
          const event = parseCommunityMessageEvent(wire)
          if (event) refreshCommunityInbox()
          if (
            event?.kind === 'message' &&
            event.message.conversationId === conversationId
          )
            onMessage(event.message)
          else if (
            event &&
            event.kind !== 'message' &&
            event.conversationId === conversationId
          ) {
            if (event.kind === 'invalidate') {
              onInvalidated()
              socket?.disconnect()
            } else onResync()
          }
        })
        socket.on('disconnect', fail)
        socket.on('connect_error', fail)
        socket.connect()
      } catch {
        fail()
      } finally {
        starting = false
      }
    }
    const foreground = () => {
      if (!document.hidden) void start()
    }
    document.addEventListener('visibilitychange', foreground)
    window.addEventListener('online', foreground)
    void start()
    return () => {
      alive = false
      if (retry) clearTimeout(retry)
      document.removeEventListener('visibilitychange', foreground)
      window.removeEventListener('online', foreground)
      socket?.removeAllListeners()
      socket?.disconnect()
    }
  }, [conversationId, onMessage, onResync, onInvalidated])
  return conversationId ? phase : 'idle'
}
