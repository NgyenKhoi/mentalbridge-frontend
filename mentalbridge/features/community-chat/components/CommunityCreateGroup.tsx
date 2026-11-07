'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Check, Search, Users, X, LockKeyhole } from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import CommunityAvatar from '@/features/community/components/CommunityAvatar'
import type { useCommunityFriends } from '@/features/community/components/useCommunityFriends'
import type { useCommunityGroups } from './useCommunityGroups'
import styles from './CommunityGroupComposer.module.css'

export default function CommunityCreateGroup({
  open,
  groups,
  friends,
  onOpenChange,
}: {
  open: boolean
  groups: ReturnType<typeof useCommunityGroups>
  friends: ReturnType<typeof useCommunityFriends>
  onOpenChange: (open: boolean) => void
}) {
  const [name, setName] = useState('')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const busy = groups.busyKey === 'create'
  const valid =
    name.trim().length > 0 &&
    [...name.trim()].length <= 80 &&
    selected.length > 0
  const items = friends.items.filter(({ peer }) =>
    peer.displayName
      .toLocaleLowerCase('vi')
      .includes(query.trim().toLocaleLowerCase('vi')),
  )
  function toggle(id: string) {
    setSelected((old) =>
      old.includes(id)
        ? old.filter((value) => value !== id)
        : old.length < 19
          ? [...old, id]
          : old,
    )
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next)
      }}
      labelledBy="create-community-group-title"
      className={styles.dialog}
    >
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault()
          if (valid && !busy)
            void groups.create(name.trim(), selected).then((created) => {
              if (created) {
                setName('')
                setSelected([])
                setQuery('')
                onOpenChange(false)
              }
            })
        }}
      >
        <header className={styles.header}>
          <span className={styles.groupIcon}>
            <Users size={24} />
          </span>
          <div>
            <h2 id="create-community-group-title">Tạo nhóm trò chuyện</h2>
            <p>Cùng trò chuyện trong một không gian riêng.</p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            aria-label="Đóng tạo nhóm"
          >
            <X size={20} />
          </button>
        </header>
        <div className={styles.name}>
          <label htmlFor="new-chat-group-name">Tên nhóm</label>
          <input
            id="new-chat-group-name"
            value={name}
            maxLength={80}
            disabled={busy}
            onChange={(event) => setName(event.target.value)}
            placeholder="Đặt tên cho nhóm của bạn"
            autoComplete="off"
          />
          <small>{[...name].length}/80</small>
        </div>
        <div className={styles.body}>
          <section className={styles.picker}>
            <label className={styles.search}>
              <Search size={17} />
              <input
                aria-label="Tìm bạn bè để mời"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm theo tên bạn bè…"
              />
            </label>
            <strong className={styles.sectionTitle}>Bạn bè của bạn</strong>
            <div className={styles.friendList}>
              {friends.loading ? (
                <p role="status">Đang tải bạn bè…</p>
              ) : friends.error ? (
                <div role="alert">
                  <p>{friends.error}</p>
                  <button type="button" onClick={friends.refresh}>
                    Thử lại
                  </button>
                </div>
              ) : !items.length ? (
                <p>
                  {friends.items.length ? (
                    'Chưa có tên phù hợp.'
                  ) : (
                    <Link href="/community/friends">
                      Kết bạn để mời vào nhóm
                    </Link>
                  )}
                </p>
              ) : (
                items.map(({ peer }) => (
                  <label
                    key={peer.communityProfileId}
                    className={styles.friend}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(peer.communityProfileId)}
                      disabled={
                        busy ||
                        (!selected.includes(peer.communityProfileId) &&
                          selected.length >= 19)
                      }
                      onChange={() => toggle(peer.communityProfileId)}
                    />
                    <CommunityAvatar
                      displayName={peer.displayName}
                      avatarPreset={peer.avatarPreset}
                      avatarImage={peer.avatarImage}
                    />
                    <span>{peer.displayName}</span>
                    <i aria-hidden="true">
                      {selected.includes(peer.communityProfileId) && (
                        <Check size={13} />
                      )}
                    </i>
                  </label>
                ))
              )}
            </div>
            {friends.cursor && (
              <button
                type="button"
                className={styles.loadMore}
                disabled={friends.loadingMore}
                onClick={friends.loadMore}
              >
                {friends.loadingMore ? 'Đang tải…' : 'Xem thêm bạn bè'}
              </button>
            )}
          </section>
          <aside className={styles.selected}>
            <strong>
              Đã chọn <span>{selected.length}/19</span>
            </strong>
            {selected.length ? (
              selected.map((id) => {
                const person = friends.items.find(
                  ({ peer }) => peer.communityProfileId === id,
                )?.peer
                return (
                  <div key={id}>
                    <span>{person?.displayName ?? 'Bạn bè đã chọn'}</span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => toggle(id)}
                      aria-label={`Bỏ chọn ${person?.displayName ?? 'thành viên'}`}
                    >
                      <X size={14} />
                    </button>
                  </div>
                )
              })
            ) : (
              <p>Chọn người bạn muốn mời vào nhóm.</p>
            )}
          </aside>
        </div>
        <div className={styles.privacy}>
          <LockKeyhole size={15} />
          <span>
            Người được mời sẽ quyết định tham gia trước khi xem và gửi tin nhắn.
          </span>
        </div>
        {groups.notice && (
          <p className={styles.notice} role="status">
            {groups.notice}
          </p>
        )}
        <footer className={styles.footer}>
          <span>
            {selected.length
              ? `${selected.length} lời mời sẽ được gửi`
              : 'Chọn ít nhất một người bạn'}
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Hủy
          </button>
          <button type="submit" disabled={!valid || busy}>
            {busy ? 'Đang tạo nhóm…' : 'Tạo nhóm'}
          </button>
        </footer>
      </form>
    </Dialog>
  )
}
