'use client'

import Link from 'next/link'
import { useState } from 'react'

import type { ChatPeer, ChatPrivacy } from '../api/community-chat-contract'
import { useCommunityChatWorkspace } from './useCommunityChatWorkspace'
import styles from './CommunityChatWorkspace.module.css'

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
}: Readonly<{
  initialConversationId?: string
  recipientCommunityProfileId?: string
}>) {
  const chat = useCommunityChatWorkspace({
    initialConversationId,
    recipientCommunityProfileId,
  })
  const activeConversation =
    chat.conversation ??
    chat.conversations.find(
      (item) => item.conversationId === chat.selectedConversationId,
    )
  const activePeer =
    chat.peer ??
    activeConversation?.peers.find((peer) => peer.state === 'AVAILABLE')

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
      {recipientCommunityProfileId && chat.busyKey === 'start' && (
        <p className={styles.notice} role="status">
          Đang mở cuộc trò chuyện an toàn…
        </p>
      )}

      <div
        className={`${styles.workspace} ${initialConversationId ? styles.hasSelected : ''}`}
      >
        <aside className={styles.inbox} aria-label="Hộp thư cộng đồng">
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
              {chat.requests.length > 0 && <span>{chat.requests.length}</span>}
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
                        <Avatar peer={peer} />
                        <span className={styles.rowCopy}>
                          <strong>{peerName(peer)}</strong>
                          <small>
                            {item.state === 'READ_ONLY'
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
            ) : (
              <div className={styles.state}>
                <strong>Chưa có cuộc trò chuyện</strong>
                <p>Bạn có thể nhắn từ một bài viết dùng danh tính cộng đồng.</p>
                <Link href="/community">Khám phá bảng tin</Link>
              </div>
            )
          ) : chat.requests.length ? (
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
                    Lời mời không chứa nội dung tin nhắn. Chỉ chấp thuận nếu bạn
                    thấy thoải mái.
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
          ) : (
            <div className={styles.state}>
              <strong>Không có lời mời đang chờ</strong>
              <p>Bạn luôn có quyền chấp thuận, từ chối hoặc chặn.</p>
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
                <Avatar peer={activePeer} />
                <span>
                  <strong>{peerName(activePeer)}</strong>
                  <small>
                    {activeConversation.state === 'READ_ONLY'
                      ? 'Cuộc trò chuyện chỉ đọc'
                      : 'Tin nhắn riêng tư trong cộng đồng'}
                  </small>
                </span>
                <details className={styles.safetyMenu}>
                  <summary aria-label="Mở thao tác an toàn">•••</summary>
                  <div>
                    <Link
                      href={`/safety-directory?from=community-chat&conversationId=${activeConversation.conversationId}`}
                    >
                      Báo cáo hoặc tìm hỗ trợ
                    </Link>
                    <button
                      type="button"
                      disabled={chat.busyKey === 'block'}
                      onClick={() => void chat.blockPeer()}
                    >
                      Chặn thành viên
                    </button>
                  </div>
                </details>
              </header>

              <div className={styles.messages} aria-live="polite">
                {chat.messages.length ? (
                  chat.messages.map((message) => {
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
                      </div>
                    )
                  })
                ) : (
                  <div className={styles.emptyThread}>
                    <strong>Bắt đầu thật nhẹ nhàng</strong>
                    <p>
                      Chỉ chia sẻ điều bạn thấy an toàn. Bạn có thể chặn và rời
                      đi bất cứ lúc nào.
                    </p>
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
                    chat.busyKey === 'send'
                  }
                >
                  {chat.busyKey === 'send' ? 'Đang gửi…' : 'Gửi'}
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
    </section>
  )
}
