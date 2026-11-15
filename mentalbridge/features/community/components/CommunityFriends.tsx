'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronRight,
  HeartHandshake,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRoundPlus,
  Users,
} from 'lucide-react'
import { searchMembers } from '../api/browser-community-social'
import type { MemberPage } from '../api/community-social'
import { useCommunityPresenceContext } from '@/features/community-chat/components/CommunityPresenceProvider'
import { useCommunityFriends } from './useCommunityFriends'
import CommunityAvatar from './CommunityAvatar'
import CommunityFriendshipActions from './CommunityFriendshipActions'
import styles from './CommunityFriends.module.css'

type Friends = ReturnType<typeof useCommunityFriends>

function countLabel(friends: Friends) {
  return `${friends.items.length}${friends.cursor ? '+' : ''}`
}

function FriendsList({
  friends,
  view,
  onlineOnly,
  onShowAll,
  onChange,
}: {
  friends: Friends
  view: string
  onlineOnly: boolean
  onShowAll: () => void
  onChange: () => void
}) {
  const presence = useCommunityPresenceContext()
  const items = friends.items
    .filter(
      (friend) =>
        !onlineOnly ||
        presence?.states[friend.peer.communityProfileId] === 'ONLINE',
    )
    .toSorted((first, second) =>
      first.peer.displayName.localeCompare(second.peer.displayName, 'vi'),
    )
  return (
    <section
      className={styles.listPanel}
      aria-label="Danh sách kết nối của bạn"
    >
      <header className={styles.listHeading}>
        <span>
          {view === 'accepted'
            ? 'Những kết nối bạn chọn'
            : view === 'incoming'
              ? 'Lời mời đang chờ bạn'
              : 'Những lời mời bạn đã gửi'}
        </span>
        <small>Sắp xếp theo tên A–Z</small>
      </header>
      {friends.loading ? (
        <div className={styles.state} role="status">
          Đang tải kết nối của bạn…
        </div>
      ) : friends.error ? (
        <div className={styles.state} role="alert">
          <p>{friends.error}</p>
          <button className={styles.secondary} onClick={friends.refresh}>
            Thử lại
          </button>
        </div>
      ) : !items.length ? (
        <div className={styles.state}>
          <span className={styles.emptyIcon}>
            <Users size={25} />
          </span>
          <h2>
            {onlineOnly
              ? 'Chưa có bạn bè chia sẻ trạng thái trực tuyến trong danh sách đã tải'
              : view === 'accepted'
                ? 'Một kết nối mới có thể bắt đầu từ một câu chuyện'
                : view === 'incoming'
                  ? 'Chưa có lời mời kết bạn mới'
                  : 'Bạn chưa gửi lời mời nào'}
          </h2>
          <p>
            {onlineOnly
              ? 'Bạn vẫn có thể mở cuộc trò chuyện với bạn bè của mình.'
              : 'Tìm theo tên cộng đồng hoặc mở trang cá nhân từ một bài viết để kết nối.'}
          </p>
          {onlineOnly && (
            <button className={styles.secondary} onClick={onShowAll}>
              Xem tất cả bạn bè
            </button>
          )}
        </div>
      ) : (
        <div className={styles.people}>
          {items.map((friend) => {
            const online =
              presence?.phase === 'ready' &&
              presence.states[friend.peer.communityProfileId] === 'ONLINE'
            return (
              <article className={styles.person} key={friend.friendshipId}>
                <Link
                  className={styles.avatarFrame}
                  href={`/community/members/${friend.peer.communityProfileId}`}
                  aria-label={`Trang cá nhân của ${friend.peer.displayName}`}
                >
                  <CommunityAvatar
                    displayName={friend.peer.displayName}
                    avatarPreset={friend.peer.avatarPreset}
                    avatarImage={friend.peer.avatarImage}
                  />
                  {online && (
                    <i className={styles.onlineDot} aria-hidden="true" />
                  )}
                </Link>
                <div className={styles.personInfo}>
                  <div className={styles.personName}>
                    <Link
                      href={`/community/members/${friend.peer.communityProfileId}`}
                    >
                      {friend.peer.displayName}
                    </Link>
                    <span className={styles.relationship}>
                      {friend.state === 'FRIENDS'
                        ? 'Bạn bè cộng đồng'
                        : friend.state === 'INCOMING'
                          ? 'Muốn kết nối với bạn'
                          : 'Đang chờ chấp nhận'}
                    </span>
                    {online && (
                      <span className={styles.onlineLabel}>
                        <i />
                        Trực tuyến
                      </span>
                    )}
                  </div>
                  <Link
                    className={styles.profileLink}
                    href={`/community/members/${friend.peer.communityProfileId}`}
                  >
                    Trang cá nhân cộng đồng <ArrowUpRight size={12} />
                  </Link>
                  {friend.state !== 'FRIENDS' && (
                    <small>
                      Lời mời ngày{' '}
                      {new Intl.DateTimeFormat('vi-VN', {
                        day: 'numeric',
                        month: 'numeric',
                        year: 'numeric',
                      }).format(new Date(friend.createdAt))}
                    </small>
                  )}
                </div>
                <div className={styles.actions}>
                  <CommunityFriendshipActions
                    profileId={friend.peer.communityProfileId}
                    displayName={friend.peer.displayName}
                    relationship={{
                      state: friend.state,
                      friendshipId: friend.friendshipId,
                    }}
                    onChange={onChange}
                  />
                </div>
              </article>
            )
          })}
        </div>
      )}
      {!friends.loading && !friends.error && (
        <footer className={styles.listFooter}>
          <span role="status">
            {onlineOnly
              ? `${items.length} người đang trực tuyến trong ${friends.items.length} kết nối đã tải`
              : friends.cursor
                ? `Đã tải ${friends.items.length} kết nối`
                : `${friends.items.length} kết nối`}
          </span>
          {friends.cursor && (
            <button
              className={styles.secondary}
              disabled={friends.loadingMore}
              onClick={friends.loadMore}
            >
              {friends.loadingMore ? 'Đang tải…' : 'Xem thêm kết nối'}
              <ChevronRight size={14} />
            </button>
          )}
        </footer>
      )}
    </section>
  )
}

export default function CommunityFriends() {
  const accepted = useCommunityFriends('accepted')
  const incoming = useCommunityFriends('incoming')
  const outgoing = useCommunityFriends('outgoing')
  const presence = useCommunityPresenceContext()
  const searchInput = useRef<HTMLInputElement>(null)
  const [view, setView] = useState('accepted')
  const [onlineOnly, setOnlineOnly] = useState(false)
  const [query, setQuery] = useState('')
  const [searched, setSearched] = useState('')
  const [results, setResults] = useState<MemberPage>({
    items: [],
    nextCursor: null,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const generation = useRef(0)
  const active =
    view === 'accepted' ? accepted : view === 'incoming' ? incoming : outgoing
  const onlineCount = accepted.items.filter(
    (friend) => presence?.states[friend.peer.communityProfileId] === 'ONLINE',
  ).length
  useEffect(
    () => () => {
      generation.current += 1
    },
    [],
  )

  function refresh() {
    accepted.refresh()
    incoming.refresh()
    outgoing.refresh()
  }

  function chooseView(next: string) {
    generation.current += 1
    setView(next)
    setOnlineOnly(false)
    setSearched('')
    setLoading(false)
    setError('')
  }

  async function search(cursor?: string) {
    const name = cursor ? searched : query.trim()
    if ([...name].length < 2 || [...name].length > 80) {
      setError('Nhập từ 2 đến 80 ký tự để tìm theo tên cộng đồng.')
      return
    }
    const current = ++generation.current
    setLoading(true)
    setError('')
    setSearched(name)
    if (!cursor) setResults({ items: [], nextCursor: null })
    try {
      const page = await searchMembers(name, cursor)
      if (generation.current === current)
        setResults((old) => ({
          ...page,
          items: cursor
            ? [
                ...old.items,
                ...page.items.filter(
                  (item) =>
                    !old.items.some(
                      (previous) =>
                        previous.communityProfileId === item.communityProfileId,
                    ),
                ),
              ]
            : page.items,
        }))
    } catch {
      if (generation.current === current)
        setError('Chưa tìm được thành viên. Bạn có thể thử lại.')
    } finally {
      if (generation.current === current) setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>
            <i />
            Không gian đồng hành
          </span>
          <h1>Danh sách bạn bè & Người đồng hành</h1>
          <p>
            Kết nối qua những câu chuyện. Bạn chọn người lắng nghe và nhịp độ
            trò chuyện của mình.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.secondary}
            onClick={refresh}
            disabled={accepted.loading || incoming.loading || outgoing.loading}
          >
            <RefreshCw size={14} />
            Tải lại danh sách
          </button>
          <button
            className={styles.primary}
            onClick={() => searchInput.current?.focus()}
          >
            <UserRoundPlus size={15} />
            Tìm bạn trong cộng đồng
          </button>
        </div>
      </header>
      <aside className={styles.privacy}>
        <span className={styles.privacyIcon}>
          <ShieldCheck size={20} />
        </span>
        <p>
          <strong>Quyền riêng tư & ranh giới của bạn</strong>
          <span>
            Bạn chủ động chọn chia sẻ trạng thái hoạt động và quản lý những kết
            nối của mình.
          </span>
        </p>
        <Link href="/community/messages#community-chat-privacy">
          Quản lý quyền riêng tư <ChevronRight size={14} />
        </Link>
      </aside>
      <section className={styles.controls} aria-label="Tìm kiếm và lọc kết nối">
        <nav className={styles.tabs} aria-label="Danh sách kết nối">
          {[
            { key: 'accepted', label: 'Bạn bè', data: accepted },
            { key: 'incoming', label: 'Lời mời kết bạn', data: incoming },
            { key: 'outgoing', label: 'Lời mời đã gửi', data: outgoing },
          ].map((tab) => (
            <button
              key={tab.key}
              aria-pressed={view === tab.key && !searched}
              onClick={() => chooseView(tab.key)}
            >
              {tab.label}
              {!tab.data.loading && !tab.data.error && (
                <span>{countLabel(tab.data)}</span>
              )}
            </button>
          ))}
        </nav>
        {!searched && view === 'accepted' && (
          <div className={styles.quickFilters}>
            <span>Lọc nhanh</span>
            <button
              aria-pressed={!onlineOnly}
              onClick={() => setOnlineOnly(false)}
            >
              Tất cả
            </button>
            <button
              aria-pressed={onlineOnly}
              disabled={presence?.phase !== 'ready'}
              onClick={() => setOnlineOnly(true)}
            >
              <i />
              Đang trực tuyến{' '}
              {presence?.phase === 'ready' && `(${onlineCount})`}
            </button>
            {presence?.phase === 'unavailable' && (
              <button onClick={presence.reconnect}>Thử lại trạng thái</button>
            )}
          </div>
        )}
        <form
          className={styles.search}
          onSubmit={(event) => {
            event.preventDefault()
            void search()
          }}
        >
          <Search size={16} aria-hidden="true" />
          <input
            ref={searchInput}
            aria-label="Tìm bạn theo tên cộng đồng"
            placeholder="Tìm theo tên cộng đồng hoặc biệt danh…"
            value={query}
            maxLength={80}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button className={styles.primary} type="submit" disabled={loading}>
            Tìm kiếm
          </button>
        </form>
      </section>
      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
      {!searched &&
        view !== 'incoming' &&
        !incoming.loading &&
        !incoming.error &&
        incoming.items.length > 0 && (
          <aside className={styles.invitationNotice}>
            <span>
              <Mail size={20} />
            </span>
            <p>
              <strong>
                Bạn có {countLabel(incoming)} lời mời kết bạn đang chờ
              </strong>
              <small>Mở lời mời để chọn kết nối bạn muốn đón nhận.</small>
            </p>
            <button
              className={styles.secondary}
              onClick={() => chooseView('incoming')}
            >
              Xem lời mời <ChevronRight size={14} />
            </button>
          </aside>
        )}
      {searched ? (
        <section className={styles.listPanel}>
          <header className={styles.listHeading}>
            <span>Kết quả cho “{searched}”</span>
            <button
              className={styles.textButton}
              onClick={() => chooseView(view)}
            >
              Về danh sách bạn bè
            </button>
          </header>
          {loading && (
            <p className={styles.state} role="status">
              Đang tìm thành viên…
            </p>
          )}
          {!loading && !error && !results.items.length && (
            <p className={styles.state}>Chưa tìm thấy tên cộng đồng phù hợp.</p>
          )}
          <div className={styles.people}>
            {results.items.map((person) => (
              <Link
                className={styles.searchPerson}
                href={`/community/members/${person.communityProfileId}`}
                key={person.communityProfileId}
              >
                <span className={styles.avatarFrame}>
                  <CommunityAvatar
                    displayName={person.displayName}
                    avatarPreset={person.avatarPreset}
                    avatarImage={person.avatarImage}
                  />
                </span>
                <strong>{person.displayName}</strong>
                <span>
                  Xem trang cá nhân <ArrowUpRight size={14} />
                </span>
              </Link>
            ))}
          </div>
          {results.nextCursor && (
            <footer className={styles.listFooter}>
              <span>{results.items.length} thành viên đã tải</span>
              <button
                className={styles.secondary}
                disabled={loading}
                onClick={() => void search(results.nextCursor ?? undefined)}
              >
                Xem thêm kết quả
                <ChevronRight size={14} />
              </button>
            </footer>
          )}
        </section>
      ) : (
        <FriendsList
          friends={active}
          view={view}
          onlineOnly={onlineOnly}
          onShowAll={() => setOnlineOnly(false)}
          onChange={refresh}
        />
      )}
      <footer className={styles.pageFooter}>
        <Link href="/community">
          <ArrowLeft size={14} />
          Về bảng tin cộng đồng
        </Link>
        <span>
          <HeartHandshake size={14} />
          Một kết nối, theo nhịp của bạn.
        </span>
      </footer>
    </div>
  )
}
