'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { ApiError } from '@/lib/api/api-error'
import {
  blockCommunityProfile,
  getCommunityProfile,
} from '@/features/community/api/browser-community'
import {
  advanceChatReadCursor,
  decideChatRequest,
  getChatConversation,
  getChatConversations,
  getChatMessages,
  getChatPrivacy,
  getChatRequests,
  putChatPrivacy,
  sendChatMessage,
  startDirectConversation,
  type ChatConversation,
  type ChatMessage,
  type ChatPrivacy,
  type ChatRequest,
} from '../api/browser-community-chat'
import { UUID_PATTERN } from '../api/community-chat-contract'

type FailedSend = Readonly<{
  clientMessageId: string
  content: string
}>

function friendlyError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 404) return 'Cuộc trò chuyện này không còn khả dụng.'
    if (error.status === 409)
      return 'Dữ liệu vừa thay đổi ở nơi khác. Hãy tải lại và thử lại.'
    if (error.status === 429)
      return 'Bạn đang thao tác hơi nhanh. Hãy chờ một chút rồi thử lại.'
    if (error.status === 503 || error.status === 504)
      return 'Kết nối trò chuyện đang gián đoạn. Bạn có thể thử lại.'
  }
  return 'Chưa thể hoàn tất lúc này. Bạn có thể thử lại.'
}

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const ids = new Set<string>()
  return [...current, ...incoming].filter((message) => {
    if (ids.has(message.messageId)) return false
    ids.add(message.messageId)
    return true
  })
}

export function useCommunityChatWorkspace({
  initialConversationId,
  recipientCommunityProfileId,
}: Readonly<{
  initialConversationId?: string
  recipientCommunityProfileId?: string
}>) {
  const router = useRouter()
  const startAttempted = useRef<string | undefined>(undefined)
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [requests, setRequests] = useState<ChatRequest[]>([])
  const [privacy, setPrivacy] = useState<
    { version: string; preferences: ChatPrivacy } | undefined
  >()
  const [viewerProfileId, setViewerProfileId] = useState<string>()
  const [conversation, setConversation] = useState<ChatConversation>()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [threadLoading, setThreadLoading] = useState(true)
  const [error, setError] = useState('')
  const [threadError, setThreadError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyKey, setBusyKey] = useState('')
  const [failedSend, setFailedSend] = useState<FailedSend>()
  const [activeTab, setActiveTab] = useState<'conversations' | 'requests'>(
    'conversations',
  )

  const selectedConversationId =
    initialConversationId ?? conversations[0]?.conversationId

  const loadOverview = useCallback(async () => {
    const [conversationResult, requestResult, privacyResult, profileResult] =
      await Promise.allSettled([
        getChatConversations(),
        getChatRequests(),
        getChatPrivacy(),
        getCommunityProfile(),
      ])
    if (conversationResult.status === 'fulfilled') {
      setConversations(conversationResult.value.items)
      if (conversationResult.value.items.length === 0 && !initialConversationId)
        setThreadLoading(false)
    }
    if (requestResult.status === 'fulfilled')
      setRequests(
        requestResult.value.items.filter(
          (request) => request.state === 'PENDING',
        ),
      )
    if (privacyResult.status === 'fulfilled') setPrivacy(privacyResult.value)
    if (profileResult.status === 'fulfilled')
      setViewerProfileId(profileResult.value.data.communityProfileId)
    if (
      conversationResult.status === 'rejected' &&
      requestResult.status === 'rejected' &&
      privacyResult.status === 'rejected'
    )
      setError(friendlyError(conversationResult.reason))
    setLoading(false)
  }, [initialConversationId])

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadOverview(), 0)
    return () => window.clearTimeout(timeout)
  }, [loadOverview])

  useEffect(() => {
    if (
      !recipientCommunityProfileId ||
      !UUID_PATTERN.test(recipientCommunityProfileId) ||
      startAttempted.current === recipientCommunityProfileId
    )
      return
    startAttempted.current = recipientCommunityProfileId
    setBusyKey('start')
    setNotice('')
    void startDirectConversation(
      recipientCommunityProfileId,
      crypto.randomUUID(),
    )
      .then((result) => {
        if (result.state === 'ACTIVE') {
          router.replace(`/community/messages/${result.conversationId}`)
        } else {
          setActiveTab('requests')
          setNotice(
            'Đã gửi lời mời trò chuyện. Bạn chỉ có thể nhắn sau khi người nhận chấp thuận.',
          )
        }
      })
      .catch((cause) => setNotice(friendlyError(cause)))
      .finally(() => setBusyKey(''))
  }, [recipientCommunityProfileId, router])

  const loadThread = useCallback(async () => {
    if (!selectedConversationId) {
      return
    }
    try {
      const [nextConversation, page] = await Promise.all([
        getChatConversation(selectedConversationId),
        getChatMessages(selectedConversationId),
      ])
      setConversation(nextConversation)
      setMessages(mergeMessages([], page.items))
      const lastMessage = page.items.at(-1)
      if (lastMessage) {
        void advanceChatReadCursor(
          selectedConversationId,
          lastMessage.messageId,
        ).then((read) =>
          setConversations((current) =>
            current.map((item) =>
              item.conversationId === selectedConversationId
                ? { ...item, unreadCount: read.unreadCount }
                : item,
            ),
          ),
        )
      }
    } catch (cause) {
      setConversation(undefined)
      setMessages([])
      setThreadError(friendlyError(cause))
    } finally {
      setThreadLoading(false)
    }
  }, [selectedConversationId])

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadThread(), 0)
    return () => window.clearTimeout(timeout)
  }, [loadThread])

  const peer = useMemo(
    () =>
      conversation?.peers.find(
        (item) =>
          item.state === 'AVAILABLE' &&
          item.communityProfileId !== viewerProfileId,
      ) ?? conversation?.peers.find((item) => item.state === 'AVAILABLE'),
    [conversation, viewerProfileId],
  )

  async function decide(
    request: ChatRequest,
    decision: 'ACCEPT' | 'DECLINE' | 'BLOCK',
  ) {
    setBusyKey(request.requestId)
    setNotice('')
    try {
      const result = await decideChatRequest(
        request.requestId,
        decision,
        request.version,
      )
      setRequests((current) =>
        current.filter((item) => item.requestId !== request.requestId),
      )
      if (result?.state === 'ACTIVE') {
        await loadOverview()
        router.push(`/community/messages/${result.conversationId}`)
      } else {
        setNotice(
          decision === 'BLOCK'
            ? 'Đã chặn người gửi và đóng lời mời.'
            : 'Đã từ chối lời mời trò chuyện.',
        )
      }
    } catch (cause) {
      setNotice(friendlyError(cause))
    } finally {
      setBusyKey('')
    }
  }

  async function savePrivacy(preferences: ChatPrivacy) {
    if (!privacy) return
    setBusyKey('privacy')
    setNotice('')
    try {
      const saved = await putChatPrivacy(preferences, privacy.version)
      setPrivacy(saved)
      setNotice('Đã lưu quyền riêng tư cho tin nhắn cộng đồng.')
    } catch (cause) {
      setNotice(friendlyError(cause))
    } finally {
      setBusyKey('')
    }
  }

  async function deliver(send: FailedSend) {
    if (!selectedConversationId) return
    setBusyKey('send')
    setThreadError('')
    setFailedSend(undefined)
    try {
      const result = await sendChatMessage(
        selectedConversationId,
        send.content,
        send.clientMessageId,
      )
      setMessages((current) => mergeMessages(current, [result.message]))
      setDraft('')
    } catch (cause) {
      setFailedSend(send)
      setThreadError(friendlyError(cause))
    } finally {
      setBusyKey('')
    }
  }

  function send() {
    const content = draft.trim()
    if (!content || [...content].length > 4000 || busyKey === 'send') return
    void deliver({ clientMessageId: crypto.randomUUID(), content })
  }

  async function blockPeer() {
    if (!peer || peer.state !== 'AVAILABLE') return
    setBusyKey('block')
    try {
      await blockCommunityProfile(peer.communityProfileId)
      setNotice('Đã chặn thành viên này. Cuộc trò chuyện không còn khả dụng.')
      router.push('/community/messages')
      await loadOverview()
    } catch (cause) {
      setNotice(friendlyError(cause))
    } finally {
      setBusyKey('')
    }
  }

  return {
    activeTab,
    setActiveTab,
    conversations,
    requests,
    privacy,
    conversation,
    messages,
    peer,
    viewerProfileId,
    selectedConversationId,
    draft,
    setDraft,
    loading,
    threadLoading,
    error,
    threadError,
    notice,
    busyKey,
    failedSend,
    reload: () => {
      setLoading(true)
      setError('')
      void loadOverview()
    },
    reloadThread: () => {
      setThreadLoading(true)
      setThreadError('')
      void loadThread()
    },
    decide,
    savePrivacy,
    send,
    retrySend: () => failedSend && void deliver(failedSend),
    blockPeer,
  }
}
