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
  clearChatConversation,
  decideChatRequest,
  getChatConversation,
  getChatConversations,
  getChatMessages,
  getChatPrivacy,
  getChatRequests,
  putChatPrivacy,
  retractChatMessage,
  sendChatMessage,
  startDirectConversation,
  type ChatConversation,
  type ChatMessage,
  type ChatPrivacy,
  type ChatRequest,
} from '../api/browser-community-chat'
import { UUID_PATTERN } from '../api/community-chat-contract'

type FailedSend = Readonly<{
  conversationId: string
  clientMessageId: string
  content: string
}>

type FailedRetraction = Readonly<{
  conversationId: string
  messageId: string
}>

function friendlyError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 403 || error.status === 404)
      return 'Cuộc trò chuyện này không còn khả dụng.'
    if (error.status === 409)
      return 'Dữ liệu vừa thay đổi ở nơi khác. Hãy tải lại và thử lại.'
    if (error.status === 429)
      return 'Bạn đang thao tác hơi nhanh. Hãy chờ một chút rồi thử lại.'
    if (error.status === 503 || error.status === 504)
      return 'Kết nối trò chuyện đang gián đoạn. Bạn có thể thử lại.'
  }
  return 'Chưa thể hoàn tất lúc này. Bạn có thể thử lại.'
}

function isAccessRevoked(error: unknown) {
  return (
    error instanceof ApiError && (error.status === 403 || error.status === 404)
  )
}

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const byId = new Map(current.map((message) => [message.messageId, message]))
  for (const message of incoming) byId.set(message.messageId, message)
  return [...byId.values()]
}

function mergeById<T>(current: T[], incoming: T[], id: (item: T) => string) {
  const ids = new Set(current.map(id))
  return [
    ...current,
    ...incoming.filter((item) => {
      const itemId = id(item)
      if (ids.has(itemId)) return false
      ids.add(itemId)
      return true
    }),
  ]
}

export function useCommunityChatWorkspace({
  initialConversationId,
  recipientCommunityProfileId,
  initialTab = 'conversations',
}: Readonly<{
  initialConversationId?: string
  recipientCommunityProfileId?: string
  initialTab?: 'conversations' | 'requests'
}>) {
  const router = useRouter()
  const startAttempted = useRef<string | undefined>(undefined)
  const threadGeneration = useRef(0)
  const messageCursorRef = useRef<string | null>(null)
  const deferredMessages = useRef<ChatMessage[]>([])
  const viewedMessage = useRef('')
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [requests, setRequests] = useState<ChatRequest[]>([])
  const [privacy, setPrivacy] = useState<
    { version: string; preferences: ChatPrivacy } | undefined
  >()
  const [viewerProfileId, setViewerProfileId] = useState<string>()
  const [conversation, setConversation] = useState<ChatConversation>()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draftState, setDraftState] = useState({
    conversationId: initialConversationId,
    value: '',
  })
  const [loading, setLoading] = useState(true)
  const [threadLoading, setThreadLoading] = useState(true)
  const [error, setError] = useState('')
  const [threadErrorState, setThreadErrorState] = useState({
    conversationId: initialConversationId,
    message: '',
  })
  const [notice, setNotice] = useState('')
  const [busyKey, setBusyKey] = useState('')
  const [sendBusyConversationId, setSendBusyConversationId] = useState<
    string | undefined
  >()
  const [failedSend, setFailedSend] = useState<FailedSend>()
  const [retractBusyMessageId, setRetractBusyMessageId] = useState<string>()
  const [failedRetraction, setFailedRetraction] = useState<FailedRetraction>()
  const [retractError, setRetractError] = useState('')
  const [clearBusy, setClearBusy] = useState(false)
  const [clearError, setClearError] = useState('')
  const clearAttempt = useRef<
    { conversationId: string; idempotencyKey: string } | undefined
  >(undefined)
  const [conversationCursor, setConversationCursor] = useState<string | null>(
    null,
  )
  const [requestCursor, setRequestCursor] = useState<string | null>(null)
  const [messageCursor, setMessageCursor] = useState<string | null>(null)
  const [conversationPageLoading, setConversationPageLoading] = useState(false)
  const [requestPageLoading, setRequestPageLoading] = useState(false)
  const [messagePageLoading, setMessagePageLoading] = useState(false)
  const [conversationPageError, setConversationPageError] = useState('')
  const [requestPageError, setRequestPageError] = useState('')
  const [messagePageError, setMessagePageError] = useState('')
  const [activeTab, setActiveTab] = useState<'conversations' | 'requests'>(
    initialTab,
  )

  // The inbox route must never silently open or acknowledge its first item.
  const [selectedConversationId, setSelectedConversationId] = useState(
    initialConversationId,
  )
  const [selectionSource, setSelectionSource] = useState(initialConversationId)
  if (selectionSource !== initialConversationId) {
    setSelectionSource(initialConversationId)
    setSelectedConversationId(initialConversationId)
  }

  const setNextMessageCursor = useCallback((cursor: string | null) => {
    messageCursorRef.current = cursor
    setMessageCursor(cursor)
  }, [])

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
      setConversationCursor(conversationResult.value.nextCursor)
      if (!initialConversationId) setThreadLoading(false)
    }
    if (requestResult.status === 'fulfilled') {
      setRequests(
        requestResult.value.items.filter(
          (request) => request.state === 'PENDING',
        ),
      )
      setRequestCursor(requestResult.value.nextCursor)
    }
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

  const loadThread = useCallback(
    async (generation: number) => {
      if (!selectedConversationId) {
        if (threadGeneration.current === generation) setThreadLoading(false)
        return
      }
      const conversationId = selectedConversationId
      setThreadLoading(true)
      setThreadErrorState({ conversationId, message: '' })
      setConversation(undefined)
      setMessages([])
      setNextMessageCursor(null)
      deferredMessages.current = []
      viewedMessage.current = ''
      setDraftState({ conversationId, value: '' })
      setFailedSend(undefined)
      setFailedRetraction(undefined)
      setRetractBusyMessageId(undefined)
      setRetractError('')
      setSendBusyConversationId(undefined)
      setMessagePageLoading(false)
      setMessagePageError('')
      try {
        const nextConversation = await getChatConversation(conversationId)
        if (threadGeneration.current !== generation) return
        const page = await getChatMessages(conversationId)
        if (threadGeneration.current !== generation) return
        setConversation(nextConversation)
        setMessages(mergeMessages([], page.items))
        setNextMessageCursor(page.nextCursor)
        setMessagePageError('')
      } catch (cause) {
        if (threadGeneration.current !== generation) return
        setConversation(undefined)
        setMessages([])
        setNextMessageCursor(null)
        deferredMessages.current = []
        setThreadErrorState({
          conversationId,
          message: friendlyError(cause),
        })
      } finally {
        if (threadGeneration.current === generation) setThreadLoading(false)
      }
    },
    [selectedConversationId, setNextMessageCursor],
  )

  useEffect(() => {
    const generation = ++threadGeneration.current
    const timeout = window.setTimeout(() => void loadThread(generation), 0)
    return () => {
      window.clearTimeout(timeout)
      if (threadGeneration.current === generation) threadGeneration.current += 1
    }
  }, [loadThread])

  const markMessagesViewed = useCallback(
    async (messageId: string) => {
      if (
        !selectedConversationId ||
        !conversation ||
        conversation.conversationId !== selectedConversationId ||
        document.visibilityState === 'hidden'
      )
        return
      const conversationId = selectedConversationId
      const generation = threadGeneration.current
      const marker = `${conversationId}:${messageId}`
      if (viewedMessage.current === marker) return
      viewedMessage.current = marker
      try {
        const read = await advanceChatReadCursor(conversationId, messageId)
        if (
          threadGeneration.current !== generation ||
          selectedConversationId !== conversationId
        )
          return
        setConversations((current) =>
          current.map((item) =>
            item.conversationId === conversationId
              ? { ...item, unreadCount: read.unreadCount }
              : item,
          ),
        )
      } catch {
        if (viewedMessage.current === marker) viewedMessage.current = ''
      }
    },
    [conversation, selectedConversationId],
  )

  async function loadMoreConversations() {
    if (!conversationCursor || conversationPageLoading) return
    const cursor = conversationCursor
    setConversationPageLoading(true)
    setConversationPageError('')
    try {
      const page = await getChatConversations(cursor)
      setConversations((current) =>
        mergeById(current, page.items, (item) => item.conversationId),
      )
      setConversationCursor(page.nextCursor)
    } catch (cause) {
      setConversationPageError(friendlyError(cause))
    } finally {
      setConversationPageLoading(false)
    }
  }

  async function loadMoreRequests() {
    if (!requestCursor || requestPageLoading) return
    const cursor = requestCursor
    setRequestPageLoading(true)
    setRequestPageError('')
    try {
      const page = await getChatRequests(cursor)
      setRequests((current) =>
        mergeById(
          current,
          page.items.filter((request) => request.state === 'PENDING'),
          (item) => item.requestId,
        ),
      )
      setRequestCursor(page.nextCursor)
    } catch (cause) {
      setRequestPageError(friendlyError(cause))
    } finally {
      setRequestPageLoading(false)
    }
  }

  async function loadMoreMessages() {
    if (!selectedConversationId || !messageCursor || messagePageLoading) return
    const conversationId = selectedConversationId
    const cursor = messageCursor
    const generation = threadGeneration.current
    setMessagePageLoading(true)
    setMessagePageError('')
    try {
      const page = await getChatMessages(conversationId, cursor)
      if (threadGeneration.current !== generation) return
      setNextMessageCursor(page.nextCursor)
      const deferred = page.nextCursor === null ? deferredMessages.current : []
      if (page.nextCursor === null) deferredMessages.current = []
      setMessages((current) =>
        mergeMessages(mergeMessages(current, page.items), deferred),
      )
    } catch (cause) {
      if (threadGeneration.current !== generation) return
      if (isAccessRevoked(cause)) {
        setConversation(undefined)
        setMessages([])
        setNextMessageCursor(null)
        deferredMessages.current = []
        setMessagePageError('')
        setThreadErrorState({
          conversationId,
          message: friendlyError(cause),
        })
      } else {
        setMessagePageError(friendlyError(cause))
      }
    } finally {
      if (threadGeneration.current === generation) setMessagePageLoading(false)
    }
  }

  const peer = useMemo(() => {
    if (
      !conversation ||
      conversation.kind !== 'DIRECT' ||
      conversation.conversationId !== selectedConversationId
    )
      return undefined
    return (
      conversation.peers.find(
        (item) =>
          item.state === 'AVAILABLE' &&
          item.communityProfileId !== viewerProfileId,
      ) ?? conversation.peers.find((item) => item.state === 'AVAILABLE')
    )
  }, [conversation, selectedConversationId, viewerProfileId])

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
    if (send.conversationId !== selectedConversationId) return
    const generation = threadGeneration.current
    setSendBusyConversationId(send.conversationId)
    setThreadErrorState({ conversationId: send.conversationId, message: '' })
    setFailedSend(undefined)
    try {
      const result = await sendChatMessage(
        send.conversationId,
        send.content,
        send.clientMessageId,
      )
      if (
        threadGeneration.current !== generation ||
        selectedConversationId !== send.conversationId
      )
        return
      if (result.message.conversationId !== send.conversationId) {
        setFailedSend(send)
        setThreadErrorState({
          conversationId: send.conversationId,
          message: 'Phản hồi tin nhắn không khớp cuộc trò chuyện. Hãy thử lại.',
        })
        return
      }
      if (messageCursorRef.current) {
        deferredMessages.current = mergeMessages(deferredMessages.current, [
          result.message,
        ])
        setNotice(
          'Tin nhắn đã được lưu. Tải phần lịch sử còn lại để xem đúng thứ tự.',
        )
      } else {
        setMessages((current) => mergeMessages(current, [result.message]))
      }
      setDraftState({ conversationId: send.conversationId, value: '' })
    } catch (cause) {
      if (
        threadGeneration.current !== generation ||
        selectedConversationId !== send.conversationId
      )
        return
      setFailedSend(send)
      setThreadErrorState({
        conversationId: send.conversationId,
        message: friendlyError(cause),
      })
    } finally {
      if (
        threadGeneration.current === generation &&
        selectedConversationId === send.conversationId
      )
        setSendBusyConversationId(undefined)
    }
  }

  function send() {
    const visibleDraft =
      draftState.conversationId === selectedConversationId
        ? draftState.value
        : ''
    const content = visibleDraft.trim()
    if (
      !selectedConversationId ||
      !content ||
      [...content].length > 4000 ||
      sendBusyConversationId === selectedConversationId
    )
      return
    void deliver({
      conversationId: selectedConversationId,
      clientMessageId: crypto.randomUUID(),
      content,
    })
  }

  async function retract(target: FailedRetraction) {
    if (target.conversationId !== selectedConversationId) return false
    const generation = threadGeneration.current
    setRetractBusyMessageId(target.messageId)
    setFailedRetraction(undefined)
    setRetractError('')
    try {
      const message = await retractChatMessage(
        target.conversationId,
        target.messageId,
      )
      if (
        threadGeneration.current !== generation ||
        selectedConversationId !== target.conversationId
      )
        return false
      if (
        message.conversationId !== target.conversationId ||
        message.messageId !== target.messageId ||
        message.state !== 'RETRACTED'
      ) {
        setFailedRetraction(target)
        setRetractError(
          'Phản hồi gỡ tin nhắn không khớp cuộc trò chuyện. Hãy thử lại.',
        )
        return false
      }
      setMessages((current) => mergeMessages(current, [message]))
      deferredMessages.current = mergeMessages(deferredMessages.current, [
        message,
      ])
      setNotice('Đã gỡ tin nhắn cho mọi người.')
      return true
    } catch (cause) {
      if (
        threadGeneration.current !== generation ||
        selectedConversationId !== target.conversationId
      )
        return
      setFailedRetraction(target)
      setRetractError(friendlyError(cause))
      return false
    } finally {
      if (
        threadGeneration.current === generation &&
        selectedConversationId === target.conversationId
      )
        setRetractBusyMessageId(undefined)
    }
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

  function finishClear(conversationId: string) {
    setConversations((current) =>
      current.filter((item) => item.conversationId !== conversationId),
    )
    if (selectedConversationId === conversationId) {
      threadGeneration.current += 1
      setSelectedConversationId(undefined)
      setConversation(undefined)
      setMessages([])
      setNextMessageCursor(null)
      deferredMessages.current = []
      viewedMessage.current = ''
      setThreadErrorState({ conversationId: undefined, message: '' })
      router.replace('/community/messages')
    }
    clearAttempt.current = undefined
    setClearError('')
  }

  async function conversationIsVisible(conversationId: string) {
    let cursor: string | undefined
    do {
      const page = await getChatConversations(cursor)
      if (page.items.some((item) => item.conversationId === conversationId))
        return true
      cursor = page.nextCursor ?? undefined
    } while (cursor)
    return false
  }

  async function clearConversation() {
    if (!selectedConversationId || clearBusy) return false
    const conversationId = selectedConversationId
    const generation = threadGeneration.current
    if (clearAttempt.current?.conversationId !== conversationId) {
      clearAttempt.current = {
        conversationId,
        idempotencyKey: crypto.randomUUID(),
      }
    }
    const attempt = clearAttempt.current
    setClearBusy(true)
    setClearError('')
    try {
      await clearChatConversation(conversationId, attempt.idempotencyKey)
      if (
        threadGeneration.current !== generation ||
        selectedConversationId !== conversationId
      )
        return false
      finishClear(conversationId)
      return true
    } catch (cause) {
      if (
        threadGeneration.current !== generation ||
        selectedConversationId !== conversationId
      )
        return false
      try {
        if (!(await conversationIsVisible(conversationId))) {
          finishClear(conversationId)
          return true
        }
      } catch {
        clearAttempt.current = attempt
      }
      setClearError(
        `${friendlyError(cause)} Chưa xác nhận đã xóa; bạn có thể thử lại an toàn.`,
      )
      return false
    } finally {
      if (selectedConversationId === conversationId) setClearBusy(false)
    }
  }

  return {
    activeTab,
    setActiveTab,
    conversations,
    requests,
    privacy,
    conversation,
    updateConversation: (updated: ChatConversation) => {
      setConversation((current) =>
        current?.conversationId === updated.conversationId ? updated : current,
      )
    },
    messages,
    peer,
    viewerProfileId,
    selectedConversationId,
    selectConversation: setSelectedConversationId,
    draft:
      draftState.conversationId === selectedConversationId
        ? draftState.value
        : '',
    setDraft: (value: string) => {
      setDraftState({ conversationId: selectedConversationId, value })
    },
    loading,
    threadLoading,
    error,
    threadError:
      threadErrorState.conversationId === selectedConversationId
        ? threadErrorState.message
        : '',
    notice,
    busyKey,
    sendBusy: sendBusyConversationId === selectedConversationId,
    failedSend:
      failedSend?.conversationId === selectedConversationId
        ? failedSend
        : undefined,
    retractBusyMessageId,
    failedRetraction:
      failedRetraction?.conversationId === selectedConversationId
        ? failedRetraction
        : undefined,
    retractError,
    clearBusy,
    clearError,
    conversationCursor,
    requestCursor,
    messageCursor,
    conversationPageLoading,
    requestPageLoading,
    messagePageLoading,
    conversationPageError,
    requestPageError,
    messagePageError,
    loadMoreConversations,
    loadMoreRequests,
    loadMoreMessages,
    markMessagesViewed,
    reload: () => {
      setLoading(true)
      setError('')
      void loadOverview()
    },
    reloadThread: () => {
      setThreadLoading(true)
      setThreadErrorState({
        conversationId: selectedConversationId,
        message: '',
      })
      const generation = ++threadGeneration.current
      void loadThread(generation)
    },
    decide,
    savePrivacy,
    send,
    retrySend: () => {
      if (!failedSend || failedSend.conversationId !== selectedConversationId)
        return
      void deliver(failedSend)
    },
    retractMessage: (messageId: string) => {
      if (!selectedConversationId) return Promise.resolve(false)
      return retract({ conversationId: selectedConversationId, messageId })
    },
    retryRetraction: () => {
      if (
        !failedRetraction ||
        failedRetraction.conversationId !== selectedConversationId
      )
        return Promise.resolve(false)
      return retract(failedRetraction)
    },
    clearConversation,
    resetClearAttempt: () => {
      if (!clearBusy) {
        clearAttempt.current = undefined
        setClearError('')
      }
    },
    blockPeer,
  }
}
