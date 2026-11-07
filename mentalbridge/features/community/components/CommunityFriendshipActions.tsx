'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { MessageSquare, UserCheck, UserPlus } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ApiError } from '@/lib/api/api-error'
import {
  acceptFriend,
  removeFriend,
  requestFriend,
} from '../api/browser-community-social'
import type { FriendshipState } from '../api/community-social'
import styles from './CommunitySocial.module.css'

export default function CommunityFriendshipActions({
  profileId,
  displayName,
  relationship,
  onChange,
}: {
  profileId: string
  displayName: string
  relationship: FriendshipState
  onChange: (state: FriendshipState) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(false)
  const pending = useRef(false)

  async function change(action: 'request' | 'accept' | 'remove') {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      if (action === 'remove') {
        if (!relationship.friendshipId) return
        await removeFriend(relationship.friendshipId)
        onChange({ state: 'NONE', friendshipId: null })
      } else {
        const result =
          action === 'accept' && relationship.friendshipId
            ? await acceptFriend(relationship.friendshipId)
            : await requestFriend(profileId)
        onChange({ state: result.state, friendshipId: result.friendshipId })
      }
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.status === 404
          ? 'Kết nối này vừa thay đổi hoặc không còn khả dụng. Hãy tải lại trang.'
          : 'Chưa thể cập nhật kết bạn. Bạn có thể thử lại.',
      )
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  if (relationship.state === 'SELF')
    return (
      <Link className={styles.secondary} href="/community/profile">
        Chỉnh sửa danh tính
      </Link>
    )
  return (
    <div className={styles.friendActions} aria-busy={busy}>
      {relationship.state === 'NONE' && (
        <button
          className={styles.primary}
          disabled={busy}
          onClick={() => void change('request')}
        >
          <UserPlus size={17} /> Kết bạn
        </button>
      )}
      {relationship.state === 'INCOMING' && (
        <>
          <button
            className={styles.primary}
            disabled={busy}
            onClick={() => void change('accept')}
          >
            Chấp nhận kết bạn
          </button>
          <button
            className={styles.secondary}
            disabled={busy}
            onClick={() => void change('remove')}
          >
            Từ chối
          </button>
        </>
      )}
      {relationship.state === 'OUTGOING' && (
        <button
          className={styles.secondary}
          disabled={busy}
          onClick={() => void change('remove')}
        >
          Hủy lời mời kết bạn
        </button>
      )}
      {relationship.state === 'FRIENDS' && (
        <>
          <Link
            className={styles.primary}
            href={`/community/messages?to=${profileId}`}
          >
            <MessageSquare size={17} /> Nhắn tin
          </Link>
          <button
            className={styles.secondary}
            disabled={busy}
            onClick={() => setConfirm(true)}
          >
            <UserCheck size={17} /> Bạn bè
          </button>
        </>
      )}
      {busy && <span role="status">Đang cập nhật…</span>}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <ConfirmDialog
        request={
          confirm
            ? {
                title: `Hủy kết bạn với ${displayName}?`,
                description:
                  'Các cuộc trò chuyện hiện có vẫn tiếp tục dùng được. Lời mời vào nhóm mới sẽ cần kết bạn lại.',
                confirmLabel: 'Hủy kết bạn',
              }
            : null
        }
        onResolve={(confirmed) => {
          setConfirm(false)
          if (confirmed) void change('remove')
        }}
      />
    </div>
  )
}
