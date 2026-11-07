'use client'

import Link from 'next/link'
import { HeartHandshake, RefreshCw } from 'lucide-react'
import CommunityAvatar from '@/features/community/components/CommunityAvatar'
import { useCommunityPresenceContext } from './CommunityPresenceProvider'
import styles from '@/features/community/components/CommunityDiscovery.module.css'

export default function CommunityPresencePanel() {
  const presence = useCommunityPresenceContext()
  if (!presence) return null
  const online = presence.peers.filter(
    (peer) => presence.states[peer.profileId] === 'ONLINE',
  )
  return (
    <section
      className={styles.members}
      aria-labelledby="community-members-title"
    >
      <h2 id="community-members-title">
        <HeartHandshake size={16} /> Người đồng hành trực tuyến{' '}
        {presence.phase === 'ready' && (
          <span className={styles.onlineCount}>{online.length}</span>
        )}
      </h2>
      <p>Trong các kết nối gần đây đã tự nguyện chia sẻ trạng thái.</p>
      {presence.phase === 'loading' ? (
        <p role="status">Đang kiểm tra trạng thái…</p>
      ) : presence.phase === 'unavailable' ? (
        <div className={styles.membersEmpty}>
          <p>Trạng thái trực tuyến hiện chưa khả dụng.</p>
          <button
            className={styles.presenceRetry}
            type="button"
            onClick={presence.reconnect}
          >
            <RefreshCw size={13} /> Kết nối lại
          </button>
        </div>
      ) : online.length ? (
        online.map((peer) => (
          <Link
            key={peer.profileId}
            href={`/community/messages/${peer.conversationId}`}
          >
            <span className={styles.onlineAvatar}>
              <CommunityAvatar displayName={peer.name} avatarPreset={null} />
              <i aria-hidden="true" />
            </span>
            <span>
              <strong>{peer.name}</strong>
              <small>Đang trực tuyến</small>
            </span>
          </Link>
        ))
      ) : (
        <div className={styles.membersEmpty}>
          Chưa có người đồng hành nào hiển thị trực tuyến lúc này.
        </div>
      )}
      <Link
        className={styles.presenceSettings}
        href="/community/messages#community-chat-privacy"
      >
        Quản lý trạng thái của bạn →
      </Link>
    </section>
  )
}
