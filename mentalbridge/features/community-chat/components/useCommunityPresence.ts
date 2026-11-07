'use client'

import { useEffect, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { browserApiClient } from '@/lib/api/browser-client'
import { getCommunityProfile } from '@/features/community/api/browser-community'
import { getChatConversations } from '../api/browser-community-chat'
import { parseCommunityMessageEvent } from '../api/community-message-events'
import { refreshCommunityInbox } from './CommunityInboxProvider'
import {
  parseCommunityCredential,
  isCommunityCommandAccepted,
  parsePresenceEvent,
  type PresenceState,
} from '../api/community-presence'

type Peer = { profileId: string; name: string; conversationId: string }
type Snapshot = {
  phase: 'loading' | 'ready' | 'unavailable'
  peers: Peer[]
  states: Record<string, PresenceState>
}

export function useCommunityPresence() {
  const [attempt, setAttempt] = useState(0)
  const [snapshot, setSnapshot] = useState<Snapshot>({
    phase: 'loading',
    peers: [],
    states: {},
  })
  useEffect(() => {
    let alive = true
    let socket: Socket | undefined
    let heartbeat: ReturnType<typeof setInterval> | undefined
    let lastForeground = 0
    const fail = () => {
      if (heartbeat) clearInterval(heartbeat)
      if (alive) setSnapshot({ phase: 'unavailable', peers: [], states: {} })
    }
    const onOffline = () => {
      fail()
      socket?.disconnect()
    }
    const sendCommand = (
      commandType:
        'community.conversation.subscribe' | 'community.presence.heartbeat',
      payload: { conversationId: string } | { foreground: boolean },
    ) => {
      const commandId = crypto.randomUUID()
      socket?.emit(
        'community.command',
        {
          schemaVersion: 1,
          commandId,
          correlationId: crypto.randomUUID(),
          commandType,
          payload,
        },
        (ack: unknown) => {
          if (
            alive &&
            socket?.connected &&
            !isCommunityCommandAccepted(ack, commandId)
          ) {
            fail()
            socket.disconnect()
          }
        },
      )
    }
    const onVisibility = () => {
      if (!socket?.connected) return
      const foreground = document.visibilityState === 'visible'
      if (foreground && Date.now() - lastForeground < 10_000) return
      if (foreground) lastForeground = Date.now()
      sendCommand('community.presence.heartbeat', { foreground })
    }
    const start = async () => {
      try {
        const [conversations, profile] = await Promise.all([
          getChatConversations(),
          getCommunityProfile(),
        ])
        if (!alive) return
        const direct = conversations.items
          .filter((item) => item.kind === 'DIRECT' && item.state === 'ACTIVE')
          .slice(0, 30)
        const peers = direct.flatMap((conversation) =>
          conversation.peers.flatMap((peer) =>
            peer.state === 'AVAILABLE' &&
            peer.communityProfileId !== profile.data.communityProfileId
              ? [
                  {
                    profileId: peer.communityProfileId,
                    name: peer.displayName,
                    conversationId: conversation.conversationId,
                  },
                ]
              : [],
          ),
        )
        const response = await browserApiClient.post<unknown>(
          '/community/socket-credentials',
        )
        if (!alive) return
        const credential = parseCommunityCredential(
          typeof response.data === 'object' && response.data !== null
            ? Object.fromEntries(
                Object.entries(response.data).filter(
                  ([key]) => key !== 'endpoint',
                ),
              )
            : null,
        )
        const endpoint =
          typeof response.data === 'object' &&
          response.data !== null &&
          'endpoint' in response.data &&
          typeof response.data.endpoint === 'string'
            ? response.data.endpoint
            : null
        if (
          !credential ||
          !endpoint ||
          !['http:', 'https:'].includes(new URL(endpoint).protocol) ||
          Date.parse(credential.expiresAt) <= Date.now()
        ) {
          fail()
          return
        }
        socket = io(`${endpoint.replace(/\/$/, '')}/community`, {
          auth: { schemaVersion: 1, credential: credential.credential },
          transports: ['websocket'],
          autoConnect: false,
          reconnection: false,
        })
        const peerIds = new Set(peers.map((peer) => peer.profileId))
        const conversationIds = new Set(
          direct.map((item) => item.conversationId),
        )
        socket.on('connect', () => {
          if (!alive || !socket) return
          setSnapshot({ phase: 'ready', peers, states: {} })
          direct.forEach((conversation) =>
            sendCommand('community.conversation.subscribe', {
              conversationId: conversation.conversationId,
            }),
          )
          onVisibility()
          heartbeat = setInterval(onVisibility, 20_000)
        })
        socket.on('community.event', (wire: unknown) => {
          if (!alive || !socket?.connected) return
          if (parseCommunityMessageEvent(wire)) refreshCommunityInbox()
          const event = parsePresenceEvent(wire)
          if (!event) return
          if (
            event.kind === 'invalidated' &&
            conversationIds.has(event.conversationId)
          ) {
            fail()
            socket.disconnect()
            return
          }
          if (event.kind === 'presence' && peerIds.has(event.profileId))
            setSnapshot((current) => ({
              ...current,
              states: { ...current.states, [event.profileId]: event.state },
            }))
        })
        socket.on('disconnect', fail)
        socket.on('connect_error', fail)
        document.addEventListener('visibilitychange', onVisibility)
        window.addEventListener('offline', onOffline)
        socket.connect()
      } catch {
        fail()
      }
    }
    void start()
    return () => {
      alive = false
      if (heartbeat) clearInterval(heartbeat)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('offline', onOffline)
      socket?.disconnect()
    }
  }, [attempt])
  return {
    ...snapshot,
    reconnect: () => {
      setSnapshot({ phase: 'loading', peers: [], states: {} })
      setAttempt((value) => value + 1)
    },
  }
}
