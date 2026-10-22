'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

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
import {
  CreateGroupDialog,
  GroupInvitations,
  GroupManagement,
} from './CommunityGroupControls'
import styles from './CommunityChatWorkspace.module.css'

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
}: Readonly<{
  initial: ChatPrivacy
  busy: boolean
  onSave: (value: ChatPrivacy) => void
}>) {
  const [value, setValue] = useState(initial)
  const toggle = (key: keyof ChatPrivacy) =>
    setValue((current) => ({ ...current, [key]: !current[key] }))
  return (
    <details className={styles.privacy}>
      <summary>Quyền riêng tư tin nhắn</summary>
      <fieldset disabled={busy}>
        <legend>Ai có thể bắt đầu trò chuyện?</legend>
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

export default function CommunityChatWorkspace({
  initialConversationId,
  recipientCommunityProfileId,
  initialTab,
}: Readonly<{
  initialConversationId?: string
  recipientCommunityProfileId?: string
  initialTab?: 'conversations' | 'requests'
}>) {
  const chat = useCommunityChatWorkspace({
    initialConversationId,
    recipientCommunityProfileId,
    initialTab,
  })
  const groups = useCommunityGroups({
    conversation: chat.conversation,
    viewerProfileId: chat.viewerProfileId,
    reloadOverview: chat.reload,
    onConversationUpdated: chat.updateConversation,
  })
  const [createGroupOpen, setCreateGroupOpen] = useState(false)
  const [reportTarget, setReportTarget] = useState<ChatMessage>()
  const [reportReason, setReportReason] =
    useState<ChatReportReason>('HARASSMENT')
  const [reportDetails, setReportDetails] = useState('')
  const [reportBusy, setReportBusy] = useState(false)
  const [reportError, setReportError] = useState('')
  const [reportNotice, setReportNotice] = useState('')
  const reportGeneration = useRef(0)
  const reportConversationId = useRef(initialConversationId)
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
  const activePeer = activeConversation?.peers.find(
    (peer) =>
      peer.state === 'AVAILABLE' &&
      peer.communityProfileId !== chat.viewerProfileId,
  )
  const inviteCandidates = Array.from(
    new Map(
      [chat.conversation, ...chat.conversations]
        .filter((item) => item?.kind === 'DIRECT' && item.state === 'ACTIVE')
        .flatMap((item) => item?.peers ?? [])
        .filter(
          (candidate): candidate is Extract<ChatPeer, { state: 'AVAILABLE' }> =>
            candidate.state === 'AVAILABLE' &&
            candidate.communityProfileId !== chat.viewerProfileId,
        )
        .map((candidate) => [candidate.communityProfileId, candidate] as const),
    ).values(),
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
    if (initialConversationId && lastMessageId)
      void markMessagesViewed(lastMessageId)
  }, [initialConversationId, lastMessageId, markMessagesViewed])

  useEffect(() => {
    reportConversationId.current = initialConversationId
    reportGeneration.current += 1
    reportAttempt.current = undefined
  }, [initialConversationId])

  async function submitReport() {
    if (
      !reportTarget ||
      reportTarget.conversationId !== reportConversationId.current ||
      reportDetails.length > 1000 ||
      reportBusy
    )
      return
    const details = reportDetails.trim()
    const signature = JSON.stringify({
      messageId: reportTarget.messageId,
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
          messageId: reportTarget.messageId,
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
    <section className={styles.page} aria-labelledby="community-chat-title">
      <header className={styles.intro}>
        <div>
          <p className={styles.eyebrow}>Không gian riêng trong cộng đồng</p>
          <h1 id="community-chat-title">Tin nhắn</h1>
          <p>Trò chuyện trực tiếp, có quyền chấp thuận và lối thoát an toàn.</p>
        </div>
        <Link href="/community">← Bảng tin</Link>
      </header>

      {chat.notice && (
        <p className={styles.notice} role="status">
          {chat.notice}
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
        className={`${styles.workspace} ${initialConversationId ? styles.hasSelected : ''}`}
      >
        <aside className={styles.inbox} aria-label="Hộp thư cộng đồng">
          <button
            type="button"
            className={styles.createGroupButton}
            onClick={() => setCreateGroupOpen(true)}
          >
            + Tạo nhóm riêng
          </button>
          <div
            className={styles.tabs}
            role="tablist"
            aria-label="Tin nhắn và lời mời"
          >
            <button
              type="button"
              role="tab"
              aria-selected={chat.activeTab === 'conversations'}
              onClick={() => chat.setActiveTab('conversations')}
            >
              Trò chuyện
            </button>
            <button
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

          {chat.loading ? (
            <div className={styles.state} role="status" aria-busy="true">
              Đang tải hộp thư…
            </div>
          ) : chat.error ? (
            <div className={styles.state} role="alert">
              <p>{chat.error}</p>
              <button type="button" onClick={() => void chat.reload()}>
                Thử lại
              </button>
            </div>
          ) : chat.activeTab === 'conversations' ? (
            chat.conversations.length ? (
              <>
                <ul className={styles.list}>
                  {chat.conversations.map((item) => {
                    const peer =
                      item.peers.find(
                        (candidate) =>
                          candidate.state === 'AVAILABLE' &&
                          candidate.communityProfileId !== chat.viewerProfileId,
                      ) ??
                      item.peers.find(
                        (candidate) => candidate.state === 'AVAILABLE',
                      )
                    return (
                      <li key={item.conversationId}>
                        <Link
                          href={`/community/messages/${item.conversationId}`}
                          aria-current={
                            item.conversationId === chat.selectedConversationId
                              ? 'page'
                              : undefined
                          }
                        >
                          {item.kind === 'GROUP' ? (
                            <span
                              className={styles.groupAvatar}
                              aria-hidden="true"
                            >
                              {initials(item.groupName)}
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
                <strong>Chưa có cuộc trò chuyện</strong>
                <p>Bạn có thể nhắn từ một bài viết dùng danh tính cộng đồng.</p>
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

          {chat.privacy && (
            <PrivacyPanel
              key={chat.privacy.version}
              initial={chat.privacy.preferences}
              busy={chat.busyKey === 'privacy'}
              onSave={(value) => void chat.savePrivacy(value)}
            />
          )}
        </aside>

        <article className={styles.thread} aria-label="Cuộc trò chuyện đang mở">
          {initialConversationId && (
            <Link className={styles.back} href="/community/messages">
              ← Hộp thư
            </Link>
          )}
          {chat.threadLoading ? (
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
                    {initials(activeConversation.groupName)}
                  </span>
                ) : (
                  <Avatar peer={activePeer} />
                )}
                <span>
                  <strong>
                    {activeConversation.kind === 'GROUP'
                      ? activeConversation.groupName
                      : peerName(activePeer)}
                  </strong>
                  <small>
                    {activeConversation.kind === 'GROUP'
                      ? activeConversation.state === 'ARCHIVED'
                        ? 'Nhóm riêng đã lưu trữ · Chỉ đọc'
                        : `Nhóm riêng · ${activeConversation.peers.length} thành viên · Chỉ người đã chấp thuận mới có thể đọc và gửi tin`
                      : activeConversation.state === 'READ_ONLY'
                        ? 'Cuộc trò chuyện chỉ đọc'
                        : 'Tin nhắn riêng tư trong cộng đồng'}
                  </small>
                </span>
                <details className={styles.safetyMenu}>
                  <summary aria-label="Mở thao tác an toàn">•••</summary>
                  <div>
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
                />
              )}

              <div className={styles.messages} aria-live="polite">
                {visibleMessages.length ? (
                  visibleMessages.map((message) => {
                    const mine =
                      message.sender.state === 'AVAILABLE' &&
                      message.sender.communityProfileId === chat.viewerProfileId
                    return (
                      <div
                        key={message.messageId}
                        className={mine ? styles.mine : styles.theirs}
                      >
                        <p>{message.content}</p>
                        <time dateTime={message.createdAt}>
                          {time(message.createdAt)}
                        </time>
                        <button
                          type="button"
                          className={styles.reportMessage}
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
                        >
                          Báo cáo tin nhắn
                        </button>
                      </div>
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
                  chat.send()
                }}
              >
                <label htmlFor="community-chat-message">Tin nhắn</label>
                <textarea
                  id="community-chat-message"
                  rows={2}
                  maxLength={4000}
                  value={chat.draft}
                  disabled={activeConversation.state !== 'ACTIVE'}
                  placeholder="Viết điều bạn muốn chia sẻ…"
                  onChange={(event) => chat.setDraft(event.target.value)}
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
                </button>
                <small>
                  Tin đã lưu không đồng nghĩa người nhận đang trực tuyến hoặc đã
                  đọc.
                </small>
              </form>
            </>
          ) : (
            <div className={styles.state}>
              <strong>Chọn một cuộc trò chuyện</strong>
              <p>
                Nội dung riêng tư chỉ xuất hiện khi bạn mở đúng cuộc trò chuyện.
              </p>
            </div>
          )}
        </article>
      </div>

      <CreateGroupDialog
        open={createGroupOpen}
        groups={groups}
        onOpenChange={setCreateGroupOpen}
      />

      <Dialog
        open={Boolean(
          reportTarget && reportTarget.conversationId === initialConversationId,
        )}
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
