'use client'

import Link from 'next/link'
import { useCallback, useRef } from 'react'
import { Users, X } from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import CommunityAvatar from '@/features/community/components/CommunityAvatar'
import type { useCommunityFriends } from '@/features/community/components/useCommunityFriends'
import styles from '@/features/community/components/CommunitySocial.module.css'

export default function CommunityNewConversation({
  open,
  onOpenChange,
  onCreateGroup,
  friends,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateGroup: () => void
  friends: ReturnType<typeof useCommunityFriends>
}) {
  const createGroupAfterClose = useRef(false)
  const afterClose = useCallback(() => {
    if (!createGroupAfterClose.current) return
    createGroupAfterClose.current = false
    onCreateGroup()
  }, [onCreateGroup])

  if (!open) return null
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      labelledBy="new-community-conversation-title"
      className={styles.dialog}
      onAfterClose={afterClose}
    >
      <div className={styles.dialogContent}>
        <header className={styles.dialogHeading}>
          <h2 id="new-community-conversation-title">Tin nhắn mới</h2>
          <button
            className={styles.secondary}
            onClick={() => onOpenChange(false)}
            aria-label="Đóng chọn người nhắn tin"
          >
            <X size={18} />
          </button>
        </header>
        <button
          className={styles.secondary}
          onClick={() => {
            onOpenChange(false)
            createGroupAfterClose.current = true
            onCreateGroup()
          }}
        >
          <Users size={18} /> Tạo nhóm trò chuyện
        </button>
        <p>Chọn một người bạn để bắt đầu trò chuyện.</p>
        {friends.loading && <p role="status">Đang tải bạn bè…</p>}
        {friends.error && (
          <div role="alert">
            <p>{friends.error}</p>
            <button className={styles.secondary} onClick={friends.refresh}>
              Thử lại
            </button>
          </div>
        )}
        {!friends.loading && !friends.error && !friends.items.length && (
          <div className={styles.state}>
            <p>Bạn chưa có bạn bè trong cộng đồng.</p>
            <Link
              className={styles.primary}
              href="/community/friends"
              onClick={() => onOpenChange(false)}
            >
              Tìm và kết bạn
            </Link>
          </div>
        )}
        <div className={styles.contacts}>
          {friends.items.map((friend) => (
            <Link
              className={styles.person}
              key={friend.friendshipId}
              href={`/community/messages?to=${friend.peer.communityProfileId}`}
              onClick={() => onOpenChange(false)}
            >
              <span className={styles.personIdentity}>
                <CommunityAvatar
                  displayName={friend.peer.displayName}
                  avatarPreset={friend.peer.avatarPreset}
                  avatarImage={friend.peer.avatarImage}
                />
                <strong>{friend.peer.displayName}</strong>
              </span>
              <span>Nhắn tin →</span>
            </Link>
          ))}
        </div>
        {friends.cursor && (
          <button
            className={styles.secondary}
            disabled={friends.loadingMore}
            onClick={friends.loadMore}
          >
            {friends.loadingMore ? 'Đang tải…' : 'Xem thêm bạn bè'}
          </button>
        )}
      </div>
    </Dialog>
  )
}
