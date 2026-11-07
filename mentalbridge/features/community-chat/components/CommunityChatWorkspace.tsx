'use client'

import Link from 'next/link'
import {
  LockKeyhole,
  MessageSquare,
  Plus,
  Search,
  Send,
  Users,
  X,
  MoreHorizontal,
  Undo2,
  Flag,
  ChevronDown,
  Check,
} from 'lucide-react'
import { Fragment, useCallback, useEffect, useRef, useState } from 'react'

import LightSelect from '@/components/LightSelect'
import { Dialog } from '@/components/ui/Dialog'
import { ApiError } from '@/lib/api/api-error'
import {
  reportChatMessage,
  type ChatReportReason,
} from '../api/browser-community-chat'
import type {
  ChatMessage,
  ChatPeer,
  ChatPrivacy,
} from '../api/community-chat-contract'
import { useCommunityChatWorkspace } from './useCommunityChatWorkspace'
import { useCommunityGroups } from './useCommunityGroups'
import { useCommunityFriends } from '@/features/community/components/useCommunityFriends'
import CommunityNewConversation from './CommunityNewConversation'
import CommunityCreateGroup from './CommunityCreateGroup'
import { GroupInvitations, GroupManagement } from './CommunityGroupControls'
import styles from './CommunityChatWorkspace.module.css'
import { useCommunityPresenceContext } from './CommunityPresenceProvider'

const reportReasons: Array<{ value: ChatReportReason; label: string }> = [
  { value: 'HARASSMENT', label: 'Quấy rối' },
  { value: 'SPAM', label: 'Nội dung rác' },
  { value: 'PRIVACY_CONCERN', label: 'Lo ngại về quyền riêng tư' },
  {
    value: 'SELF_HARM_OR_CRISIS_CONCERN',
    label: 'Lo ngại tự hại hoặc khủng hoảng',
  },
  { value: 'OTHER', label: 'Lý do khác' },
]

function reportErrorMessage(error: unknown) {
  if (
    error instanceof ApiError &&
    (error.status === 403 || error.status === 404)
  )
    return 'Bạn không thể báo cáo tin nhắn này hoặc tin nhắn không còn khả dụng.'
  return 'Chưa thể gửi báo cáo lúc này. Hãy thử lại.'
}

function peerName(peer: ChatPeer | undefined) {
  return peer?.state === 'AVAILABLE'
    ? peer.displayName
    : 'Thành viên không khả dụng'
}

function initials(name: string) {
  return name
    .split(/\s+/u)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function time(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function day(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(value))
}

function sameMessageGroup(first: ChatMessage | undefined, second: ChatMessage) {
  return (
    first?.sender.state === 'AVAILABLE' &&
    second.sender.state === 'AVAILABLE' &&
    first.sender.communityProfileId === second.sender.communityProfileId &&
    new Date(first.createdAt).toDateString() ===
      new Date(second.createdAt).toDateString() &&
    Math.abs(Date.parse(second.createdAt) - Date.parse(first.createdAt)) <
      180000
  )
}

function messageDay(value: string) {
  const date = new Date(value)
  return date.toDateString() === new Date().toDateString()
    ? 'Hôm nay'
    : new Intl.DateTimeFormat('vi-VN', {
        weekday: 'short',
        day: 'numeric',
        month: 'numeric',
      }).format(date)
}

function Avatar({ peer }: Readonly<{ peer?: ChatPeer }>) {
  const name = peerName(peer)
  return (
    <span className={styles.avatar} aria-hidden="true">
      {peer?.state === 'AVAILABLE' ? initials(name) : '—'}
    </span>
  )
}

function PrivacyPanel({
  initial,
  busy,
  onSave,
  friendsOnly = false,
}: Readonly<{
  initial: ChatPrivacy
  busy: boolean
  onSave: (value: ChatPrivacy) => void
  friendsOnly?: boolean
}>) {
  const [value, setValue] = useState(initial)
  const toggle = (key: keyof ChatPrivacy) =>
    setValue((current) => ({ ...current, [key]: !current[key] }))
  return (
    <details id="community-chat-privacy" className={styles.privacy}>
      <summary>Quyền riêng tư tin nhắn</summary>
      <fieldset disabled={busy}>
        <legend>Ai có thể bắt đầu trò chuyện?</legend>
        {friendsOnly ? (
          <p>
            Chỉ bạn bè đã chấp nhận mới có thể bắt đầu cuộc trò chuyện mới. Các
            cuộc trò chuyện hiện có vẫn tiếp tục dùng được.
          </p>
        ) : (
          <>
            <label>
              <input
                type="radio"
                name="direct-message-policy"
                checked={value.directMessagePolicy === 'APPROVAL_REQUIRED'}
                onChange={() =>
                  setValue((current) => ({
                    ...current,
                    directMessagePolicy: 'APPROVAL_REQUIRED',
                  }))
                }
              />
              Cần tôi chấp thuận
            </label>
            <label>
              <input
                type="radio"
                name="direct-message-policy"
                checked={value.directMessagePolicy === 'ANYONE'}
                onChange={() =>
                  setValue((current) => ({
                    ...current,
                    directMessagePolicy: 'ANYONE',
                  }))
                }
              />
              Cho phép nhắn trực tiếp
            </label>
          </>
        )}
        {(
          [
            ['presenceVisible', 'Hiển thị trạng thái hoạt động'],
            ['typingVisible', 'Hiển thị khi đang nhập'],
            ['readReceiptsVisible', 'Hiển thị xác nhận đã đọc'],
            ['invisible', 'Ẩn trạng thái của tôi'],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={value[key]}
              onChange={() => toggle(key)}
            />
            {label}
          </label>
        ))}
        <button type="button" onClick={() => onSave(value)}>
          {busy ? 'Đang lưu…' : 'Lưu quyền riêng tư'}
        </button>
      </fieldset>
    </details>
  )
}

function ThreadWelcome({ unavailable = false }: { unavailable?: boolean }) {
  return (
    <div className={`${styles.state} ${styles.threadPlaceholder}`}>
      <svg
        className={styles.welcomeIllustration}
        viewBox="0 0 190 140"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="96" cy="70" r="64" fill="var(--surface-soft)" />
        <path
          d="M75 42h70a18 18 0 0 1 18 18v26a18 18 0 0 1-18 18h-9l-17 13v-13H75a18 18 0 0 1-18-18V60a18 18 0 0 1 18-18Z"
          fill="var(--teal-pale)"
          stroke="var(--teal)"
          strokeWidth="1.5"
        />
        <path
          d="M39 25h66a18 18 0 0 1 18 18v23a18 18 0 0 1-18 18H64L45 98V84h-6a18 18 0 0 1-18-18V43a18 18 0 0 1 18-18Z"
          fill="var(--surface)"
          stroke="var(--teal)"
          strokeWidth="1.5"
        />
        <circle cx="53" cy="55" r="3.5" fill="var(--teal)" />
        <circle cx="72" cy="55" r="3.5" fill="var(--teal)" />
        <circle cx="91" cy="55" r="3.5" fill="var(--teal)" />
      </svg>
      <h2>
        {unavailable ? 'Tin nhắn và nhóm riêng' : 'Chọn một cuộc trò chuyện'}
      </h2>
      <p>
        {unavailable
          ? 'Trò chuyện cá nhân, chia sẻ trong nhóm và quản lý lời mời ngay trong một hộp thư khi tính năng khả dụng.'
          : 'Chọn một người hoặc nhóm ở bên trái để xem tin nhắn. Bạn cũng có thể tạo một nhóm riêng từ hộp thư này.'}
      </p>
      <div className={styles.welcomeTypes}>
        <span>
          <MessageSquare size={16} /> Cá nhân
        </span>
        <span>
          <Users size={17} /> Nhóm riêng
        </span>
      </div>
      <span className={styles.privacyHint}>
        <LockKeyhole size={15} aria-hidden="true" /> Nội dung trò chuyện không
        xuất hiện trên bảng tin
      </span>
    </div>
  )
}

export default function CommunityChatWorkspace({
  initialConversationId,
  recipientCommunityProfileId,
  initialTab,
  groupsOnly = false,
}: Readonly<{
  initialConversationId?: string
  recipientCommunityProfileId?: string
  initialTab?: 'conversations' | 'requests'
  groupsOnly?: boolean
}>) {
  const chat = useCommunityChatWorkspace({
    initialConversationId,
    recipientCommunityProfileId,
    initialTab,
  })
  const presence = useCommunityPresenceContext()
  const transcript = useRef<HTMLDivElement>(null)
  const followLatest = useRef(true)
  const [newMessagesBelow, setNewMessagesBelow] = useState(false)
  const friends = useCommunityFriends()
  const groups = useCommunityGroups({
    conversation: chat.conversation,
    viewerProfileId: chat.viewerProfileId,
    reloadOverview: chat.reload,
    onConversationUpdated: chat.updateConversation,
  })
  const [createGroupOpen, setCreateGroupOpen] = useState(false)
  const [newConversationOpen, setNewConversationOpen] = useState(false)
  const openCreateGroup = useCallback(() => setCreateGroupOpen(true), [])
  const [conversationFilter, setConversationFilter] = useState<
    'all' | 'direct' | 'groups'
  >(groupsOnly ? 'groups' : 'all')
  const [inboxSearch, setInboxSearch] = useState('')
  const searchText = (value: string) =>
    value
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLocaleLowerCase('vi-VN')
      .replace(/đ/g, 'd')
  const query = searchText(inboxSearch.trim())
  const listedConversations = chat.conversations.filter((item) => {
    if (conversationFilter === 'groups' && item.kind !== 'GROUP') return false
    if (conversationFilter === 'direct' && item.kind !== 'DIRECT') return false
    if (!query) return true
    if (item.kind === 'GROUP') return searchText(item.groupName).includes(query)
    return item.peers.some(
      (peer) =>
        peer.state === 'AVAILABLE' &&
        peer.communityProfileId !== chat.viewerProfileId &&
        searchText(peer.displayName).includes(query),
    )
  })
  const [reportTarget, setReportTarget] = useState<ChatMessage>()
  const [retractTarget, setRetractTarget] = useState<ChatMessage>()
  const [clearConversationId, setClearConversationId] = useState<string>()
  const [reportReason, setReportReason] =
    useState<ChatReportReason>('HARASSMENT')
  const [reportDetails, setReportDetails] = useState('')
  const [reportBusy, setReportBusy] = useState(false)
  const [reportError, setReportError] = useState('')
  const [reportNotice, setReportNotice] = useState('')
  const [dialogConversationId, setDialogConversationId] = useState(
    chat.selectedConversationId,
  )
  if (dialogConversationId !== chat.selectedConversationId) {
    setDialogConversationId(chat.selectedConversationId)
    setReportTarget(undefined)
    setRetractTarget(undefined)
    setClearConversationId(undefined)
    setReportReason('HARASSMENT')
    setReportDetails('')
    setReportBusy(false)
    setReportError('')
    setReportNotice('')
  }
  const reportGeneration = useRef(0)
  const reportConversationId = useRef(chat.selectedConversationId)
  const reportAttempt = useRef<{ signature: string; key: string } | undefined>(
    undefined,
  )
  const activeConversation =
    (chat.conversation?.conversationId === chat.selectedConversationId
      ? chat.conversation
      : undefined) ??
    chat.conversations.find(
      (item) => item.conversationId === chat.selectedConversationId,
    )
  const activeReportTarget =
    reportTarget?.conversationId === chat.selectedConversationId
      ? reportTarget
      : undefined
  const activeRetractTarget =
    retractTarget?.conversationId === chat.selectedConversationId
      ? retractTarget
      : undefined
  const activeClearConversationId =
    clearConversationId === chat.selectedConversationId
      ? clearConversationId
      : undefined
  const activePeer = activeConversation?.peers.find(
    (peer) =>
      peer.state === 'AVAILABLE' &&
      peer.communityProfileId !== chat.viewerProfileId,
  )
  const inviteCandidates: ChatPeer[] = friends.items.flatMap((friend) =>
    friend.peer.communityProfileId
      ? [
          {
            state: 'AVAILABLE' as const,
            communityProfileId: friend.peer.communityProfileId,
            displayName: friend.peer.displayName,
          },
        ]
      : [],
  )
  const visibleMessages = activeConversation
    ? chat.messages.filter(
        (message) =>
          message.conversationId === activeConversation.conversationId,
      )
    : []
  const lastMessageId = visibleMessages.at(-1)?.messageId
  const markMessagesViewed = chat.markMessagesViewed

  useEffect(() => {
    followLatest.current = true
  }, [chat.selectedConversationId])

  useEffect(() => {
    if (!lastMessageId) return
    const frame = requestAnimationFrame(() => {
      if (followLatest.current && transcript.current) {
        transcript.current.scrollTop = transcript.current.scrollHeight
        setNewMessagesBelow(false)
        if (document.hasFocus()) void markMessagesViewed(lastMessageId)
      } else setNewMessagesBelow(true)
    })
    return () => cancelAnimationFrame(frame)
  }, [lastMessageId, markMessagesViewed])

  useEffect(() => {
    const viewed = () => {
      if (
        !document.hidden &&
        document.hasFocus() &&
        followLatest.current &&
        lastMessageId
      )
        void markMessagesViewed(lastMessageId)
    }
    window.addEventListener('focus', viewed)
    document.addEventListener('visibilitychange', viewed)
    return () => {
      window.removeEventListener('focus', viewed)
      document.removeEventListener('visibilitychange', viewed)
    }
  }, [lastMessageId, markMessagesViewed])

  useEffect(() => {
    reportConversationId.current = chat.selectedConversationId
    reportGeneration.current += 1
    reportAttempt.current = undefined
  }, [chat.selectedConversationId])

  async function submitReport() {
    if (
      !activeReportTarget ||
      activeReportTarget.conversationId !== reportConversationId.current ||
      reportDetails.length > 1000 ||
      reportBusy
    )
      return
    const details = reportDetails.trim()
    const signature = JSON.stringify({
      messageId: activeReportTarget.messageId,
      reasonCode: reportReason,
      details,
    })
    if (reportAttempt.current?.signature !== signature)
      reportAttempt.current = { signature, key: crypto.randomUUID() }
    const generation = reportGeneration.current
    setReportBusy(true)
    setReportError('')
    try {
      await reportChatMessage(
        {
          messageId: activeReportTarget.messageId,
          reasonCode: reportReason,
          ...(details ? { details } : {}),
        },
        reportAttempt.current.key,
      )
      if (reportGeneration.current !== generation) return
      setReportTarget(undefined)
      setReportNotice('Đã gửi báo cáo cho riêng tin nhắn đã chọn.')
    } catch (cause) {
      if (reportGeneration.current === generation)
        setReportError(reportErrorMessage(cause))
    } finally {
      if (reportGeneration.current === generation) setReportBusy(false)
    }
  }

  return (
    <section
      data-community-messaging
      className={styles.page}
      aria-labelledby="community-chat-title"
    >
      {chat.notice && (
        <p className={styles.notice} role="status">
          {chat.notice}
        </p>
      )}
      {chat.selectedConversationId && chat.realtimePhase === 'unavailable' && (
        <p className={styles.notice} role="status">
          Kết nối cập nhật tin nhắn đang gián đoạn. Đang tự kết nối lại.
        </p>
      )}
      {reportNotice && (
        <p className={styles.notice} role="status">
          {reportNotice}
        </p>
      )}
      {groups.notice && (
        <p className={styles.notice} role="status">
          {groups.notice}
        </p>
      )}
      {recipientCommunityProfileId && chat.busyKey === 'start' && (
        <p className={styles.notice} role="status">
          Đang mở cuộc trò chuyện an toàn…
        </p>
      )}

      <div
        className={`${styles.workspace} ${chat.selectedConversationId ? styles.hasSelected : ''}`}
      >
        <aside className={styles.inbox} aria-label="Hộp thư cộng đồng">
          <header className={styles.inboxHeading}>
            <div>
              <h1 id="community-chat-title">Tin nhắn</h1>
              <p>Cá nhân và nhóm riêng, cùng một nơi</p>
            </div>
            <button
              type="button"
              className={styles.createGroupButton}
              disabled={chat.unavailable || chat.loading}
              onClick={() => setNewConversationOpen(true)}
              aria-label="Tin nhắn mới hoặc tạo nhóm"
              title="Tin nhắn mới hoặc tạo nhóm"
            >
              <Plus size={21} aria-hidden="true" />
            </button>
          </header>
          {chat.activeTab === 'conversations' && (
            <div className={styles.searchBox}>
              <Search size={17} aria-hidden="true" />
              <input
                aria-label="Tìm người hoặc nhóm trong hộp thư"
                placeholder="Tìm người hoặc nhóm…"
                value={inboxSearch}
                onChange={(event) => setInboxSearch(event.target.value)}
                disabled={chat.unavailable || chat.loading}
                maxLength={120}
              />
              {inboxSearch && (
                <button
                  type="button"
                  onClick={() => setInboxSearch('')}
                  aria-label="Xóa tìm kiếm hộp thư"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          )}
          <div
            className={styles.tabs}
            role="tablist"
            aria-label="Tin nhắn và lời mời"
          >
            <button
              id="community-chat-conversations-tab"
              type="button"
              role="tab"
              aria-selected={chat.activeTab === 'conversations'}
              onClick={() => chat.setActiveTab('conversations')}
            >
              Trò chuyện
            </button>
            <button
              id="community-chat-requests-tab"
              type="button"
              role="tab"
              aria-selected={chat.activeTab === 'requests'}
              onClick={() => chat.setActiveTab('requests')}
            >
              Lời mời
              {chat.requests.length + groups.invitations.length > 0 && (
                <span>{chat.requests.length + groups.invitations.length}</span>
              )}
            </button>
          </div>
          {chat.activeTab === 'conversations' && (
            <div
              className={styles.inboxFilters}
              role="group"
              aria-label="Lọc hội thoại"
            >
              {(
                [
                  { value: 'all', label: 'Tất cả' },
                  { value: 'direct', label: 'Cá nhân' },
                  { value: 'groups', label: 'Nhóm' },
                ] as const
              ).map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  aria-pressed={conversationFilter === filter.value}
                  onClick={() => setConversationFilter(filter.value)}
                >
                  {filter.value === 'groups' && (
                    <Users size={14} aria-hidden="true" />
                  )}
                  {filter.label}
                </button>
              ))}
            </div>
          )}
          <div
            className={styles.inboxBody}
            role="tabpanel"
            aria-labelledby={
              chat.activeTab === 'conversations'
                ? 'community-chat-conversations-tab'
                : 'community-chat-requests-tab'
            }
          >
            {chat.loading ? (
              <div className={styles.state} role="status" aria-busy="true">
                Đang tải hộp thư…
              </div>
            ) : chat.unavailable ? (
              <div className={styles.state} role="status">
                <strong>Tin nhắn hiện chưa khả dụng</strong>
                <p>Bạn vẫn có thể đọc và chia sẻ trên bảng tin cộng đồng.</p>
                <Link href="/community">Trở về bảng tin →</Link>
              </div>
            ) : chat.error ? (
              <div className={styles.state} role="alert">
                <p>{chat.error}</p>
                <button type="button" onClick={() => void chat.reload()}>
                  Thử lại
                </button>
              </div>
            ) : chat.activeTab === 'conversations' ? (
              listedConversations.length ? (
                <>
                  <ul className={styles.list}>
                    {listedConversations.map((item) => {
                      const peer =
                        item.peers.find(
                          (candidate) =>
                            candidate.state === 'AVAILABLE' &&
                            candidate.communityProfileId !==
                              chat.viewerProfileId,
                        ) ??
                        item.peers.find(
                          (candidate) => candidate.state === 'AVAILABLE',
                        )
                      return (
                        <li key={item.conversationId}>
                          <Link
                            href={`/community/messages/${item.conversationId}`}
                            onClick={() =>
                              chat.selectConversation(item.conversationId)
                            }
                            aria-current={
                              item.conversationId ===
                              chat.selectedConversationId
                                ? 'page'
                                : undefined
                            }
                          >
                            {item.kind === 'GROUP' ? (
                              <span
                                className={styles.groupAvatar}
                                aria-hidden="true"
                              >
                                <Users size={20} />
                              </span>
                            ) : (
                              <Avatar peer={peer} />
                            )}
                            <span className={styles.rowCopy}>
                              <strong>
                                {item.kind === 'GROUP'
                                  ? item.groupName
                                  : peerName(peer)}
                              </strong>
                              <small>
                                {item.kind === 'GROUP'
                                  ? item.state === 'ARCHIVED'
                                    ? 'Nhóm đã lưu trữ · Chỉ đọc'
                                    : `${item.viewerRole === 'OWNER' ? 'Chủ nhóm' : item.viewerRole === 'ADMIN' ? 'Quản trị viên' : 'Thành viên'} · ${item.peers.length} người`
                                  : peer?.state === 'AVAILABLE' &&
                                      presence?.states[
                                        peer.communityProfileId
                                      ] === 'ONLINE'
                                    ? 'Đang trực tuyến'
                                    : item.state === 'READ_ONLY'
                                      ? 'Chỉ có thể xem'
                                      : item.unreadCount
                                        ? `${item.unreadCount} tin chưa đọc`
                                        : 'Mở cuộc trò chuyện'}
                              </small>
                            </span>
                            {item.unreadCount > 0 && (
                              <span
                                className={styles.badge}
                                aria-label={`${item.unreadCount} tin chưa đọc`}
                              >
                                {item.unreadCount}
                              </span>
                            )}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                  {(chat.conversationCursor || chat.conversationPageError) && (
                    <div className={styles.pageActions}>
                      {chat.conversationPageError && (
                        <span role="alert">{chat.conversationPageError}</span>
                      )}
                      <button
                        type="button"
                        disabled={chat.conversationPageLoading}
                        onClick={() => void chat.loadMoreConversations()}
                      >
                        {chat.conversationPageLoading
                          ? 'Đang tải…'
                          : chat.conversationPageError
                            ? 'Thử lại'
                            : 'Tải thêm cuộc trò chuyện'}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className={styles.state}>
                  <span className={styles.inboxEmptyIcon} aria-hidden="true">
                    {conversationFilter === 'groups' ? (
                      <Users size={23} />
                    ) : (
                      <MessageSquare size={23} />
                    )}
                  </span>
                  <strong>
                    {query
                      ? 'Chưa tìm thấy hội thoại phù hợp'
                      : conversationFilter === 'groups'
                        ? 'Chưa có nhóm riêng trong danh sách này'
                        : conversationFilter === 'direct'
                          ? 'Chưa có trò chuyện cá nhân trong danh sách này'
                          : 'Chưa có cuộc trò chuyện'}
                  </strong>
                  <p>
                    {query
                      ? 'Thử một tên khác hoặc xóa từ khóa để xem lại danh sách.'
                      : conversationFilter === 'groups'
                        ? 'Tạo một nhóm nhỏ để trò chuyện với những người bạn đã kết nối.'
                        : 'Bạn có thể nhắn từ một bài viết dùng danh tính cộng đồng.'}
                  </p>
                  {query && (
                    <button type="button" onClick={() => setInboxSearch('')}>
                      Xóa tìm kiếm
                    </button>
                  )}
                  {chat.conversationCursor ? (
                    <button
                      type="button"
                      disabled={chat.conversationPageLoading}
                      onClick={() => void chat.loadMoreConversations()}
                    >
                      {chat.conversationPageLoading
                        ? 'Đang tải…'
                        : 'Tải thêm cuộc trò chuyện'}
                    </button>
                  ) : (
                    <Link href="/community">Khám phá bảng tin</Link>
                  )}
                </div>
              )
            ) : chat.requests.length ||
              groups.invitations.length ||
              groups.invitationLoading ||
              groups.invitationError ? (
              <>
                <GroupInvitations groups={groups} />
                <ul className={styles.requests}>
                  {chat.requests.map((request) => (
                    <li key={request.requestId}>
                      <div className={styles.requestIdentity}>
                        <Avatar peer={request.requester} />
                        <span>
                          <strong>{peerName(request.requester)}</strong>
                          <small>Hết hạn {day(request.expiresAt)}</small>
                        </span>
                      </div>
                      <p>
                        Lời mời không chứa nội dung tin nhắn. Chỉ chấp thuận nếu
                        bạn thấy thoải mái.
                      </p>
                      <div className={styles.requestActions}>
                        <button
                          type="button"
                          disabled={chat.busyKey === request.requestId}
                          onClick={() => void chat.decide(request, 'ACCEPT')}
                        >
                          Chấp thuận
                        </button>
                        <button
                          type="button"
                          disabled={chat.busyKey === request.requestId}
                          onClick={() => void chat.decide(request, 'DECLINE')}
                        >
                          Từ chối
                        </button>
                        <button
                          type="button"
                          disabled={chat.busyKey === request.requestId}
                          onClick={() => void chat.decide(request, 'BLOCK')}
                        >
                          Chặn
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                {(chat.requestCursor || chat.requestPageError) && (
                  <div className={styles.pageActions}>
                    {chat.requestPageError && (
                      <span role="alert">{chat.requestPageError}</span>
                    )}
                    <button
                      type="button"
                      disabled={chat.requestPageLoading}
                      onClick={() => void chat.loadMoreRequests()}
                    >
                      {chat.requestPageLoading
                        ? 'Đang tải…'
                        : chat.requestPageError
                          ? 'Thử lại'
                          : 'Tải thêm lời mời'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className={styles.state}>
                <strong>Không có lời mời đang chờ</strong>
                <p>Bạn luôn có quyền chấp thuận, từ chối hoặc chặn.</p>
                {chat.requestCursor && (
                  <button
                    type="button"
                    disabled={chat.requestPageLoading}
                    onClick={() => void chat.loadMoreRequests()}
                  >
                    {chat.requestPageLoading ? 'Đang tải…' : 'Tải thêm lời mời'}
                  </button>
                )}
              </div>
            )}
          </div>
          {chat.privacy && (
            <PrivacyPanel
              friendsOnly={!friends.loading && !friends.error}
              key={chat.privacy.version}
              initial={chat.privacy.preferences}
              busy={chat.busyKey === 'privacy'}
              onSave={(value) => void chat.savePrivacy(value)}
            />
          )}
        </aside>

        <article className={styles.thread} aria-label="Cuộc trò chuyện đang mở">
          {chat.selectedConversationId && (
            <Link className={styles.back} href="/community/messages">
              ← Hộp thư
            </Link>
          )}
          {chat.unavailable ? (
            <ThreadWelcome unavailable />
          ) : chat.threadLoading ? (
            <div className={styles.state} role="status" aria-busy="true">
              Đang tải cuộc trò chuyện…
            </div>
          ) : chat.threadError && !activeConversation ? (
            <div className={styles.state} role="alert">
              <strong>Không thể mở cuộc trò chuyện</strong>
              <p>{chat.threadError}</p>
              <button type="button" onClick={() => void chat.reloadThread()}>
                Thử lại
              </button>
              <Link href="/community/messages">Trở về hộp thư</Link>
            </div>
          ) : activeConversation ? (
            <>
              <header className={styles.threadHeader}>
                {activeConversation.kind === 'GROUP' ? (
                  <span className={styles.groupAvatar} aria-hidden="true">
                    <Users size={25} strokeWidth={1.7} />
                  </span>
                ) : (
                  <Avatar peer={activePeer} />
                )}
                <span>
                  <strong>
                    {activeConversation.kind === 'GROUP' ? (
                      activeConversation.groupName
                    ) : activePeer?.state === 'AVAILABLE' ? (
                      <Link
                        href={`/community/members/${activePeer.communityProfileId}`}
                      >
                        {peerName(activePeer)}
                      </Link>
                    ) : (
                      peerName(activePeer)
                    )}
                  </strong>
                  <small>
                    {activeConversation.kind === 'GROUP'
                      ? activeConversation.state === 'ARCHIVED'
                        ? 'Nhóm riêng đã lưu trữ · Chỉ đọc'
                        : `Nhóm chat · ${activeConversation.peers.length} thành viên`
                      : activeConversation.state === 'READ_ONLY'
                        ? 'Cuộc trò chuyện chỉ đọc'
                        : 'Tin nhắn riêng tư trong cộng đồng'}
                  </small>
                  {activeConversation.kind === 'DIRECT' &&
                    activePeer?.state === 'AVAILABLE' &&
                    presence?.states[activePeer.communityProfileId] ===
                      'ONLINE' && (
                      <small className={styles.onlineLabel}>
                        <i aria-hidden="true" /> Đang trực tuyến · Đã bật chia
                        sẻ trạng thái
                      </small>
                    )}
                </span>
                <details className={styles.safetyMenu}>
                  <summary aria-label="Mở thao tác an toàn">
                    <MoreHorizontal size={22} />
                  </summary>
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        chat.resetClearAttempt()
                        setClearConversationId(
                          activeConversation.conversationId,
                        )
                      }}
                    >
                      Xóa phía tôi
                    </button>
                    <Link href="/safety-directory?trigger=community-chat">
                      Tìm hỗ trợ
                    </Link>
                    {activeConversation.kind === 'DIRECT' && (
                      <button
                        type="button"
                        disabled={chat.busyKey === 'block'}
                        onClick={() => void chat.blockPeer()}
                      >
                        Chặn thành viên
                      </button>
                    )}
                  </div>
                </details>
              </header>

              {activeConversation.kind === 'GROUP' && (
                <GroupManagement
                  groups={groups}
                  viewerProfileId={chat.viewerProfileId}
                  inviteCandidates={inviteCandidates}
                  onLoadMoreCandidates={
                    friends.cursor ? friends.loadMore : undefined
                  }
                  loadingCandidates={friends.loading || friends.loadingMore}
                  candidateError={friends.error}
                  onRetryCandidates={friends.refresh}
                />
              )}

              <div
                className={styles.messages}
                ref={transcript}
                role="log"
                aria-label="Lịch sử trò chuyện"
                aria-live="polite"
                onScroll={() => {
                  const element = transcript.current
                  if (!element) return
                  followLatest.current =
                    element.scrollHeight -
                      element.scrollTop -
                      element.clientHeight <
                    64
                  if (followLatest.current) {
                    setNewMessagesBelow(false)
                    if (lastMessageId && document.hasFocus())
                      void markMessagesViewed(lastMessageId)
                  }
                }}
              >
                {visibleMessages.length ? (
                  visibleMessages.map((message, index) => {
                    const mine =
                      message.sender.state === 'AVAILABLE' &&
                      message.sender.communityProfileId === chat.viewerProfileId
                    const retracting =
                      chat.retractBusyMessageId === message.messageId
                    const retractionFailed =
                      chat.failedRetraction?.messageId === message.messageId
                    const previous = visibleMessages[index - 1]
                    const grouped = sameMessageGroup(previous, message)
                    const next = visibleMessages[index + 1]
                    const continues = next && sameMessageGroup(message, next)
                    const showDay =
                      !previous ||
                      new Date(previous.createdAt).toDateString() !==
                        new Date(message.createdAt).toDateString()
                    return (
                      <Fragment key={message.messageId}>
                        {showDay && (
                          <div className={styles.dayDivider}>
                            <span>{messageDay(message.createdAt)}</span>
                          </div>
                        )}
                        <div
                          className={`${styles.messageRow} ${mine ? styles.ownRow : ''} ${grouped ? styles.groupedRow : ''}`}
                          data-continues={continues || undefined}
                        >
                          {!mine && (
                            <span
                              className={`${styles.messageAvatar} ${grouped ? styles.avatarSpacer : ''}`}
                              aria-hidden="true"
                            >
                              <Avatar peer={message.sender} />
                            </span>
                          )}
                          <div className={styles.messageContent}>
                            <div
                              className={[
                                styles.messageBubble,
                                mine ? styles.mine : styles.theirs,
                                message.state === 'RETRACTED'
                                  ? styles.retracted
                                  : '',
                              ]
                                .filter(Boolean)
                                .join(' ')}
                              title={time(message.createdAt)}
                            >
                              {activeConversation.kind === 'GROUP' &&
                                !mine &&
                                !grouped &&
                                message.sender.state === 'AVAILABLE' && (
                                  <strong className={styles.senderName}>
                                    {message.sender.displayName}
                                  </strong>
                                )}
                              <p>
                                {message.state === 'ACTIVE'
                                  ? message.content
                                  : mine
                                    ? 'Bạn đã gỡ tin nhắn'
                                    : message.sender.state === 'AVAILABLE'
                                      ? `${message.sender.displayName} đã gỡ tin nhắn`
                                      : 'Tin nhắn đã được gỡ'}
                              </p>
                            </div>
                            <div className={styles.messageMeta}>
                              <time dateTime={message.createdAt}>
                                {time(message.createdAt)}
                              </time>
                              {mine && message.state === 'ACTIVE' && (
                                <span
                                  title="Đã lưu tin nhắn"
                                  aria-label="Đã lưu tin nhắn"
                                >
                                  <Check size={12} />
                                </span>
                              )}
                            </div>
                            {message.state === 'ACTIVE' &&
                              (mine ? (
                                <button
                                  type="button"
                                  className={styles.messageAction}
                                  disabled={retracting}
                                  onClick={() => setRetractTarget(message)}
                                  aria-label="Gỡ tin nhắn này cho mọi người"
                                  title="Gỡ tin nhắn"
                                >
                                  <Undo2 size={15} />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className={styles.messageAction}
                                  onClick={() => {
                                    setReportTarget(message)
                                    setReportReason('HARASSMENT')
                                    setReportDetails('')
                                    setReportBusy(false)
                                    setReportError('')
                                    setReportNotice('')
                                    reportAttempt.current = undefined
                                  }}
                                  aria-label={`Báo cáo tin nhắn: ${message.content}`}
                                  title="Báo cáo tin nhắn"
                                >
                                  <Flag size={15} />
                                </button>
                              ))}
                            {retractionFailed && (
                              <span
                                className={styles.retractFailure}
                                role="alert"
                              >
                                {chat.retractError}
                                <button
                                  type="button"
                                  disabled={retracting}
                                  onClick={() => void chat.retryRetraction()}
                                >
                                  Thử lại
                                </button>
                              </span>
                            )}
                          </div>
                        </div>
                      </Fragment>
                    )
                  })
                ) : (
                  <div className={styles.emptyThread}>
                    <strong>
                      {activeConversation.kind === 'GROUP'
                        ? 'Bắt đầu cùng nhóm thật nhẹ nhàng'
                        : 'Bắt đầu thật nhẹ nhàng'}
                    </strong>
                    <p>
                      {activeConversation.kind === 'GROUP'
                        ? 'Chỉ thành viên đã chấp thuận mới có thể xem lịch sử và gửi tin trong nhóm này.'
                        : 'Chỉ chia sẻ điều bạn thấy an toàn. Bạn có thể chặn và rời đi bất cứ lúc nào.'}
                    </p>
                  </div>
                )}
                {(chat.messageCursor || chat.messagePageError) && (
                  <div className={styles.messagePageActions}>
                    {chat.messagePageError && (
                      <span role="alert">{chat.messagePageError}</span>
                    )}
                    <button
                      type="button"
                      disabled={chat.messagePageLoading}
                      onClick={() => void chat.loadMoreMessages()}
                    >
                      {chat.messagePageLoading
                        ? 'Đang tải…'
                        : chat.messagePageError
                          ? 'Thử tải lại tin nhắn'
                          : 'Tải tin nhắn tiếp theo'}
                    </button>
                  </div>
                )}
              </div>

              {newMessagesBelow && (
                <button
                  type="button"
                  className={styles.jumpLatest}
                  onClick={() => {
                    followLatest.current = true
                    if (transcript.current)
                      transcript.current.scrollTop =
                        transcript.current.scrollHeight
                    setNewMessagesBelow(false)
                    if (lastMessageId) void markMessagesViewed(lastMessageId)
                  }}
                >
                  <ChevronDown size={16} /> Tin nhắn mới
                </button>
              )}

              {chat.threadError && (
                <div className={styles.sendError} role="alert">
                  <span>{chat.threadError}</span>
                  {chat.failedSend && (
                    <button type="button" onClick={chat.retrySend}>
                      Gửi lại
                    </button>
                  )}
                </div>
              )}

              <form
                className={styles.composer}
                onSubmit={(event) => {
                  event.preventDefault()
                  followLatest.current = true
                  chat.send()
                }}
              >
                <label htmlFor="community-chat-message">Tin nhắn</label>
                <textarea
                  id="community-chat-message"
                  rows={1}
                  maxLength={4000}
                  value={chat.draft}
                  disabled={activeConversation.state !== 'ACTIVE'}
                  placeholder="Viết điều bạn muốn chia sẻ…"
                  onChange={(event) => chat.setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === 'Enter' &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault()
                      if (
                        !chat.sendBusy &&
                        chat.draft.trim() &&
                        activeConversation.state === 'ACTIVE'
                      ) {
                        followLatest.current = true
                        chat.send()
                      }
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={
                    activeConversation.state !== 'ACTIVE' ||
                    !chat.draft.trim() ||
                    chat.sendBusy
                  }
                >
                  {chat.sendBusy ? 'Đang gửi…' : 'Gửi'}
                  {!chat.sendBusy && <Send size={17} aria-hidden="true" />}
                </button>
                <small>
                  Tin đã lưu không đồng nghĩa người nhận đang trực tuyến hoặc đã
                  đọc.
                </small>
              </form>
            </>
          ) : (
            <ThreadWelcome />
          )}
        </article>
      </div>

      <CommunityCreateGroup
        open={createGroupOpen}
        groups={groups}
        friends={friends}
        onOpenChange={setCreateGroupOpen}
      />
      <CommunityNewConversation
        open={newConversationOpen}
        onOpenChange={setNewConversationOpen}
        onCreateGroup={openCreateGroup}
        friends={friends}
      />

      <Dialog
        open={Boolean(activeClearConversationId)}
        onOpenChange={(open) => {
          if (!open && !chat.clearBusy) {
            setClearConversationId(undefined)
            chat.resetClearAttempt()
          }
        }}
        labelledBy="community-chat-clear-title"
        describedBy="community-chat-clear-description"
        className={styles.clearDialog}
      >
        <div className={styles.clearPrompt}>
          <h2 id="community-chat-clear-title">Xóa cuộc trò chuyện phía bạn?</h2>
          <p id="community-chat-clear-description">
            Cuộc trò chuyện và lịch sử hiện tại sẽ biến mất khỏi hộp thư của
            bạn. Những người khác vẫn giữ nguyên lịch sử. Khi có tin nhắn mới,
            cuộc trò chuyện sẽ xuất hiện lại và chỉ hiển thị tin nhắn mới.
          </p>
          {chat.clearError && <p role="alert">{chat.clearError}</p>}
          <div className={styles.reportActions}>
            <button
              type="button"
              disabled={chat.clearBusy}
              onClick={() => {
                setClearConversationId(undefined)
                chat.resetClearAttempt()
              }}
            >
              Giữ lại
            </button>
            <button
              type="button"
              disabled={chat.clearBusy}
              onClick={() => {
                void chat.clearConversation().then((succeeded) => {
                  if (succeeded) setClearConversationId(undefined)
                })
              }}
            >
              {chat.clearBusy ? 'Đang xóa…' : 'Xóa phía tôi'}
            </button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={Boolean(
          activeRetractTarget && activeRetractTarget.state === 'ACTIVE',
        )}
        onOpenChange={(open) => {
          if (!open && !chat.retractBusyMessageId) setRetractTarget(undefined)
        }}
        labelledBy="community-chat-retract-title"
        describedBy="community-chat-retract-description"
        className={styles.retractDialog}
      >
        <div className={styles.retractPrompt}>
          <h2 id="community-chat-retract-title">Gỡ tin nhắn cho mọi người?</h2>
          <p id="community-chat-retract-description">
            Nội dung sẽ được thay bằng thông báo đã gỡ đối với mọi người trong
            cuộc trò chuyện.
          </p>
          <div className={styles.reportActions}>
            <button
              type="button"
              disabled={Boolean(chat.retractBusyMessageId)}
              onClick={() => setRetractTarget(undefined)}
            >
              Giữ lại
            </button>
            <button
              type="button"
              disabled={Boolean(chat.retractBusyMessageId)}
              onClick={() => {
                if (!activeRetractTarget) return
                void chat
                  .retractMessage(activeRetractTarget.messageId)
                  .then((succeeded) => {
                    if (succeeded) setRetractTarget(undefined)
                  })
              }}
            >
              {chat.retractBusyMessageId ? 'Đang gỡ…' : 'Gỡ tin nhắn'}
            </button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={Boolean(activeReportTarget)}
        onOpenChange={(open) => {
          if (!open && !reportBusy) setReportTarget(undefined)
        }}
        labelledBy="community-chat-report-title"
        describedBy="community-chat-report-description"
        className={styles.reportDialog}
      >
        <form
          className={styles.reportForm}
          onSubmit={(event) => {
            event.preventDefault()
            void submitReport()
          }}
        >
          <h2 id="community-chat-report-title">Báo cáo tin nhắn</h2>
          <p id="community-chat-report-description">
            Chỉ tin nhắn này được gửi để đội ngũ kiểm duyệt xem xét. Các tin
            nhắn khác không được đính kèm.
          </p>
          <label id="community-chat-report-reason-label">Lý do báo cáo</label>
          <LightSelect
            id="community-chat-report-reason"
            value={reportReason}
            labelledBy="community-chat-report-reason-label"
            options={reportReasons}
            disabled={reportBusy}
            onChange={(value) => {
              setReportReason(value as ChatReportReason)
              setReportError('')
            }}
          />
          <label htmlFor="community-chat-report-details">
            Chi tiết bổ sung (không bắt buộc)
          </label>
          <textarea
            id="community-chat-report-details"
            rows={4}
            maxLength={1000}
            value={reportDetails}
            disabled={reportBusy}
            onChange={(event) => {
              setReportDetails(event.target.value)
              setReportError('')
            }}
          />
          <small>{reportDetails.length}/1000 ký tự</small>
          {reportError && <p role="alert">{reportError}</p>}
          <div className={styles.reportActions}>
            <button
              type="button"
              disabled={reportBusy}
              onClick={() => setReportTarget(undefined)}
            >
              Hủy
            </button>
            <button type="submit" disabled={reportBusy}>
              {reportBusy ? 'Đang gửi…' : 'Xác nhận gửi báo cáo'}
            </button>
          </div>
        </form>
      </Dialog>
    </section>
  )
}
