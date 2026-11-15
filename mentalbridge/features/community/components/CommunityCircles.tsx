'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ChevronRight,
  LockKeyhole,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  UserRoundPlus,
  Users,
  X,
} from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ApiError } from '@/lib/api/api-error'
import * as api from '../api/browser-community-circles'
import type {
  Circle,
  CircleDetail,
  CircleEntry,
  CirclePage,
  EntryPage,
} from '../api/community-circles'
import { getCommunityProfile } from '../api/browser-community'
import CommunityAvatar from './CommunityAvatar'
import { useCommunityFriends } from './useCommunityFriends'
import styles from './CommunityCircles.module.css'

function failure(error: unknown) {
  return error instanceof ApiError && [403, 404].includes(error.status ?? 0)
    ? 'Nhóm hoặc nội dung này không còn khả dụng với bạn.'
    : error instanceof ApiError && error.status === 429
      ? 'Bạn đang thao tác hơi nhanh. Hãy chờ một chút rồi thử lại.'
      : 'Chưa hoàn tất được thao tác. Bạn có thể thử lại.'
}
function timestamp(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
const emptyEntries: EntryPage = { items: [], nextCursor: null }

function EntryComposer({
  groupId,
  parent,
  onSaved,
}: {
  groupId: string
  parent?: string
  onSaved: (entry: CircleEntry) => void
}) {
  const [text, setText] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const lock = useRef(false),
    attempt = useRef({ text: '', key: '' })
  const valid = [...text.trim()].length > 0 && [...text.trim()].length <= 5000
  async function save() {
    if (lock.current || !valid) return
    lock.current = true
    setBusy(true)
    setError('')
    if (attempt.current.text !== text.trim())
      attempt.current = { text: text.trim(), key: crypto.randomUUID() }
    try {
      const entry = await api.publishCircleEntry(
        groupId,
        text.trim(),
        attempt.current.key,
        parent,
      )
      onSaved(entry)
      setText('')
      attempt.current = { text: '', key: '' }
    } catch (error) {
      setError(failure(error))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <form
      className={`${styles.composer} ${parent ? styles.commentComposer : ''}`}
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <label htmlFor={`circle-entry-${parent ?? 'new'}`}>
        {parent ? 'Viết bình luận' : 'Chia sẻ cùng nhóm'}
      </label>
      <textarea
        id={`circle-entry-${parent ?? 'new'}`}
        value={text}
        onChange={(event) => setText(event.target.value)}
        disabled={busy}
        maxLength={5000}
        rows={parent ? 2 : 3}
        placeholder={
          parent
            ? 'Gửi một lời chia sẻ tôn trọng…'
            : 'Một câu chuyện, một điều bạn muốn chia sẻ hôm nay…'
        }
      />
      <footer>
        <span>
          <LockKeyhole size={13} />
          {parent
            ? `${[...text].length}/5.000`
            : 'Chỉ thành viên nhóm nhìn thấy'}
        </span>
        <button type="submit" disabled={!valid || busy}>
          <Send size={14} />
          {busy ? 'Đang gửi…' : parent ? 'Gửi' : 'Đăng bài'}
        </button>
      </footer>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </form>
  )
}

function EntryCard({
  entry,
  groupId,
  onDeleted,
}: {
  entry: CircleEntry
  groupId: string
  onDeleted: () => void
}) {
  const [open, setOpen] = useState(false),
    [comments, setComments] = useState<EntryPage>(emptyEntries),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [confirm, setConfirm] = useState<CircleEntry | null>(null),
    [busy, setBusy] = useState(false)
  const generation = useRef(0)
  useEffect(
    () => () => {
      generation.current += 1
    },
    [],
  )
  async function load(cursor?: string) {
    const current = ++generation.current
    setLoading(true)
    setError('')
    try {
      const page = await api.circleEntries(groupId, entry.id, cursor)
      if (current === generation.current)
        setComments((old) => ({
          ...page,
          items: cursor
            ? [
                ...old.items,
                ...page.items.filter(
                  (item) => !old.items.some((prior) => prior.id === item.id),
                ),
              ]
            : page.items,
        }))
    } catch (error) {
      if (current === generation.current) setError(failure(error))
    } finally {
      if (current === generation.current) setLoading(false)
    }
  }
  async function remove() {
    if (!confirm || busy) return
    setBusy(true)
    setError('')
    try {
      await api.deleteCircleEntry(groupId, confirm.id, confirm.id !== entry.id)
      if (confirm.id === entry.id) onDeleted()
      else
        setComments((old) => ({
          ...old,
          items: old.items.filter((item) => item.id !== confirm.id),
        }))
      setConfirm(null)
    } catch (error) {
      setError(failure(error))
    } finally {
      setBusy(false)
    }
  }
  const author = entry.author
  return (
    <article className={styles.post}>
      <header>
        <CommunityAvatar
          displayName={author?.displayName ?? 'Thành viên'}
          avatarPreset={author?.avatarPreset ?? null}
          avatarImage={author?.avatarImage}
        />
        <div>
          <strong>
            {author?.communityProfileId ? (
              <Link href={`/community/members/${author.communityProfileId}`}>
                {author.displayName}
              </Link>
            ) : (
              'Thành viên'
            )}
          </strong>
          <small>{timestamp(entry.createdAt)} · Trong nhóm riêng</small>
        </div>
        {entry.canDelete && (
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Xóa bài viết"
            onClick={() => setConfirm(entry)}
          >
            <Trash2 size={16} />
          </button>
        )}
      </header>
      <p className={styles.postText}>{entry.text}</p>
      <footer className={styles.postActions}>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => {
            setOpen(!open)
            if (!open) void load()
          }}
        >
          <MessageSquare size={16} />
          Bình luận
        </button>
        <span>
          <LockKeyhole size={12} />
          Nhóm riêng
        </span>
      </footer>
      {open && (
        <section className={styles.comments} aria-label="Bình luận trong nhóm">
          {loading && <p role="status">Đang tải bình luận…</p>}
          {!loading && !error && !comments.items.length && (
            <p>Chưa có bình luận. Bạn có thể bắt đầu bằng một lời đồng hành.</p>
          )}
          {comments.items.map((comment) => (
            <div className={styles.comment} key={comment.id}>
              <CommunityAvatar
                displayName={comment.author?.displayName ?? 'Thành viên'}
                avatarPreset={comment.author?.avatarPreset ?? null}
                avatarImage={comment.author?.avatarImage}
              />
              <div>
                <strong>{comment.author?.displayName ?? 'Thành viên'}</strong>
                <p>{comment.text}</p>
                <small>{timestamp(comment.createdAt)}</small>
              </div>
              {comment.canDelete && (
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label="Xóa bình luận"
                  onClick={() => setConfirm(comment)}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          {comments.nextCursor && (
            <button
              className={styles.textButton}
              disabled={loading}
              onClick={() => void load(comments.nextCursor ?? undefined)}
            >
              Xem bình luận trước
            </button>
          )}
          {error && (
            <div role="alert" className={styles.error}>
              {error} <button onClick={() => void load()}>Thử lại</button>
            </div>
          )}
          <EntryComposer
            groupId={groupId}
            parent={entry.id}
            onSaved={(comment) =>
              setComments((old) => ({ ...old, items: [comment, ...old.items] }))
            }
          />
        </section>
      )}
      {!open && error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <ConfirmDialog
        request={
          confirm
            ? {
                title:
                  confirm.id === entry.id
                    ? 'Xóa bài viết này?'
                    : 'Xóa bình luận này?',
                description: 'Nội dung sẽ được gỡ khỏi nhóm.',
                confirmLabel: busy ? 'Đang xóa…' : 'Xóa nội dung',
              }
            : null
        }
        onResolve={(yes) => {
          if (yes) void remove()
          else if (!busy) setConfirm(null)
        }}
      />
    </article>
  )
}

function CreateCircle({
  open,
  onClose,
  onCreated,
  friends,
}: {
  open: boolean
  onClose: () => void
  onCreated: (group: Circle) => void
  friends: ReturnType<typeof useCommunityFriends>
}) {
  const [name, setName] = useState(''),
    [description, setDescription] = useState(''),
    [selected, setSelected] = useState<string[]>([]),
    [query, setQuery] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const lock = useRef(false),
    attempt = useRef({ signature: '', key: '' })
  async function create() {
    if (lock.current || !name.trim()) return
    lock.current = true
    setBusy(true)
    setError('')
    const input = {
      name: name.trim(),
      description: description.trim(),
      invitees: selected,
    }
    const signature = JSON.stringify(input)
    if (attempt.current.signature !== signature)
      attempt.current = { signature, key: crypto.randomUUID() }
    try {
      const group = await api.createCircle(input, attempt.current.key)
      onCreated(group)
      setName('')
      setDescription('')
      setSelected([])
      attempt.current = { signature: '', key: '' }
      onClose()
    } catch (error) {
      setError(failure(error))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onClose()
      }}
      labelledBy="create-circle-title"
      className={styles.dialog}
    >
      <form
        className={styles.createForm}
        onSubmit={(event) => {
          event.preventDefault()
          void create()
        }}
      >
        <header>
          <div>
            <h2 id="create-circle-title">Tạo nhóm cộng đồng riêng</h2>
            <p>Một bảng tin dành cho những người bạn chọn.</p>
          </div>
          <button
            type="button"
            aria-label="Đóng tạo nhóm"
            disabled={busy}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        <label>
          Tên nhóm
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            required
            disabled={busy}
            placeholder="Đặt tên cho không gian chia sẻ"
          />
        </label>
        <label>
          Giới thiệu nhóm
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={500}
            rows={2}
            disabled={busy}
            placeholder="Nhóm dành để chia sẻ điều gì?"
          />
        </label>
        <div className={styles.privacy}>
          <LockKeyhole size={18} />
          <span>
            Chỉ người được mời và đã chấp nhận mới xem được bài viết, bình luận
            và danh sách thành viên.
          </span>
        </div>
        <label className={styles.search}>
          <Search size={16} />
          <input
            placeholder="Tìm bạn bè để mời…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <strong className={styles.label}>
          Mời bạn bè <span>{selected.length}/19</span>
        </strong>
        <div className={styles.friendPicker}>
          {friends.loading ? (
            <p role="status">Đang tải bạn bè…</p>
          ) : friends.error ? (
            <p role="alert">
              {friends.error}{' '}
              <button type="button" onClick={friends.refresh}>
                Thử lại
              </button>
            </p>
          ) : !friends.items.length ? (
            <p>Bạn có thể tạo nhóm trước và mời bạn bè sau.</p>
          ) : (
            friends.items
              .filter(({ peer }) =>
                peer.displayName
                  .toLowerCase()
                  .includes(query.trim().toLowerCase()),
              )
              .map(({ peer }) => (
                <label key={peer.communityProfileId}>
                  <CommunityAvatar
                    displayName={peer.displayName}
                    avatarPreset={peer.avatarPreset}
                    avatarImage={peer.avatarImage}
                  />
                  <span>{peer.displayName}</span>
                  <input
                    type="checkbox"
                    disabled={
                      busy ||
                      (!selected.includes(peer.communityProfileId) &&
                        selected.length >= 19)
                    }
                    checked={selected.includes(peer.communityProfileId)}
                    onChange={() =>
                      setSelected((old) =>
                        old.includes(peer.communityProfileId)
                          ? old.filter((id) => id !== peer.communityProfileId)
                          : [...old, peer.communityProfileId],
                      )
                    }
                  />
                </label>
              ))
          )}
        </div>
        {friends.cursor && (
          <button
            type="button"
            disabled={friends.loadingMore}
            onClick={friends.loadMore}
          >
            Xem thêm bạn bè
          </button>
        )}
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <footer>
          <button type="button" disabled={busy} onClick={onClose}>
            Hủy
          </button>
          <button type="submit" disabled={!name.trim() || busy}>
            {busy ? 'Đang tạo…' : 'Tạo nhóm riêng'}
          </button>
        </footer>
      </form>
    </Dialog>
  )
}

export default function CommunityCircles({
  selectedId,
}: {
  selectedId?: string
}) {
  const router = useRouter(),
    friends = useCommunityFriends('accepted')
  const [list, setList] = useState<CirclePage>({ items: [], nextCursor: null }),
    [listLoading, setListLoading] = useState(true),
    [listError, setListError] = useState('')
  const [detail, setDetail] = useState<CircleDetail | null>(null),
    [posts, setPosts] = useState<EntryPage>(emptyEntries),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(''),
    [create, setCreate] = useState(false),
    [manage, setManage] = useState(false),
    [viewer, setViewer] = useState(''),
    [invitee, setInvitee] = useState(''),
    [confirm, setConfirm] = useState<{
      kind: 'archive' | 'leave' | 'remove'
      id?: string
      name?: string
    } | null>(null)
  const generation = useRef(0),
    listGeneration = useRef(0),
    mutation = useRef(false)
  const loadList = useCallback(async (cursor?: string) => {
    const current = ++listGeneration.current
    setListLoading(true)
    setListError('')
    try {
      const page = await api.listCircles(cursor)
      if (current === listGeneration.current)
        setList((old) => ({
          ...page,
          items: cursor
            ? [
                ...old.items,
                ...page.items.filter(
                  (item) => !old.items.some((before) => before.id === item.id),
                ),
              ]
            : page.items,
        }))
    } catch (error) {
      if (current === listGeneration.current) setListError(failure(error))
    } finally {
      if (current === listGeneration.current) setListLoading(false)
    }
  }, [])
  const loadDetail = useCallback(async () => {
    if (!selectedId) return
    const current = ++generation.current
    setLoading(true)
    setError('')
    try {
      const [info, entries] = await Promise.all([
        api.getCircle(selectedId),
        api.circleEntries(selectedId),
      ])
      if (current === generation.current) {
        setDetail(info)
        setPosts(entries)
      }
    } catch (error) {
      if (current === generation.current) {
        setDetail(null)
        setError(failure(error))
      }
    } finally {
      if (current === generation.current) setLoading(false)
    }
  }, [selectedId])
  useEffect(() => {
    const timer = window.setTimeout(() => void loadList(), 0)
    return () => {
      window.clearTimeout(timer)
      listGeneration.current += 1
    }
  }, [loadList])
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDetail(null)
      setPosts(emptyEntries)
      setManage(false)
      setNotice('')
      void loadDetail()
    }, 0)
    return () => {
      window.clearTimeout(timer)
      generation.current += 1
    }
  }, [loadDetail])
  useEffect(() => {
    let alive = true
    void getCommunityProfile()
      .then((result) => {
        if (alive) setViewer(result.data.communityProfileId)
      })
      .catch(() => {
        if (alive) setViewer('')
      })
    return () => {
      alive = false
    }
  }, [])
  async function command(
    work: () => Promise<void>,
    message: string,
    navigate = false,
  ) {
    if (mutation.current) return false
    mutation.current = true
    setBusy(true)
    setNotice('')
    try {
      await work()
      setNotice(message)
      setConfirm(null)
      void loadList()
      if (navigate) {
        setManage(false)
        router.push('/community/groups')
      } else if (selectedId) {
        const info = await api.getCircle(selectedId)
        setDetail(info)
      }
      return true
    } catch (error) {
      setConfirm(null)
      setNotice(failure(error))
      return false
    } finally {
      mutation.current = false
      setBusy(false)
    }
  }
  async function morePosts() {
    if (!selectedId || !posts.nextCursor || loading) return
    const current = generation.current
    setLoading(true)
    setError('')
    try {
      const page = await api.circleEntries(
        selectedId,
        undefined,
        posts.nextCursor,
      )
      if (current === generation.current)
        setPosts((old) => ({
          ...page,
          items: [
            ...old.items,
            ...page.items.filter(
              (item) => !old.items.some((before) => before.id === item.id),
            ),
          ],
        }))
    } catch (error) {
      if (current === generation.current) setError(failure(error))
    } finally {
      if (current === generation.current) setLoading(false)
    }
  }
  const invitations = list.items.filter(
      (group) => group.membership === 'PENDING',
    ),
    joined = list.items.filter((group) => group.membership === 'ACTIVE')
  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>
            <Users size={14} />
            Nhóm cộng đồng
          </span>
          <h1>Những vòng kết nối riêng</h1>
          <p>Cùng chia sẻ những câu chuyện trong một nhóm bạn chọn.</p>
        </div>
        <button className={styles.primary} onClick={() => setCreate(true)}>
          <Plus size={17} />
          Tạo nhóm riêng
        </button>
      </header>
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <header>
            <strong>Nhóm của bạn</strong>
            <button
              className={styles.iconButton}
              onClick={() => void loadList()}
              aria-label="Tải lại nhóm"
            >
              <RefreshCw size={15} />
            </button>
          </header>
          {listError && (
            <p role="alert" className={styles.error}>
              {listError}{' '}
              <button onClick={() => void loadList()}>Thử lại</button>
            </p>
          )}
          {listLoading && !list.items.length && (
            <p role="status" className={styles.state}>
              Đang tải nhóm…
            </p>
          )}
          {!listLoading && !listError && !joined.length && (
            <p className={styles.sidebarEmpty}>
              Tạo nhóm hoặc chấp nhận lời mời để bắt đầu chia sẻ.
            </p>
          )}
          {joined.map((group) => (
            <Link
              className={styles.groupLink}
              aria-current={selectedId === group.id ? 'page' : undefined}
              href={`/community/groups/${group.id}`}
              key={group.id}
            >
              <span className={styles.groupIcon}>
                <Users size={20} />
              </span>
              <div>
                <strong>{group.name}</strong>
                <small>{group.memberCount} thành viên · Riêng tư</small>
              </div>
              <ChevronRight size={15} />
            </Link>
          ))}
          {invitations.length > 0 && (
            <section className={styles.invites}>
              <h2>
                Lời mời tham gia <span>{invitations.length}</span>
              </h2>
              {invitations.map((group) => (
                <article key={group.id}>
                  <strong>{group.name}</strong>
                  <p>
                    {group.description ||
                      'Bạn được mời tham gia nhóm cộng đồng riêng.'}
                  </p>
                  <small>
                    <LockKeyhole size={12} />
                    Nội dung mở sau khi bạn chấp nhận
                  </small>
                  <div>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void command(
                          () => api.decideCircle(group.id, 'ACCEPT'),
                          'Đã tham gia nhóm.',
                        ).then((accepted) => {
                          if (accepted)
                            router.push(`/community/groups/${group.id}`)
                        })
                      }
                    >
                      Tham gia
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void command(
                          () => api.decideCircle(group.id, 'DECLINE'),
                          'Đã từ chối lời mời.',
                        )
                      }
                    >
                      Từ chối
                    </button>
                  </div>
                </article>
              ))}
            </section>
          )}
          {list.nextCursor && (
            <button
              className={styles.textButton}
              disabled={listLoading}
              onClick={() => void loadList(list.nextCursor ?? undefined)}
            >
              Xem thêm nhóm
            </button>
          )}
          <Link href="/community/messages" className={styles.chatLink}>
            <MessageSquare size={15} />
            Mở nhóm trò chuyện <ChevronRight size={14} />
          </Link>
        </aside>
        <section className={styles.main} aria-label="Bảng tin nhóm riêng">
          {notice && (
            <p className={styles.notice} role="status">
              {notice}
            </p>
          )}
          {selectedId ? (
            detail ? (
              <>
                <header className={styles.cover}>
                  <span className={styles.coverIcon}>
                    <Users size={32} />
                  </span>
                  <span className={styles.privateBadge}>
                    <LockKeyhole size={12} />
                    Nhóm riêng tư
                  </span>
                  <h2>{detail.group.name}</h2>
                  {detail.group.description && (
                    <p>{detail.group.description}</p>
                  )}
                  <footer>
                    <span>{detail.group.memberCount} thành viên</span>
                    <button onClick={() => setManage(true)}>
                      <Users size={15} />
                      Thành viên & thông tin
                    </button>
                  </footer>
                </header>
                <EntryComposer
                  key={selectedId}
                  groupId={selectedId}
                  onSaved={(entry) =>
                    setPosts((old) => ({
                      ...old,
                      items: [entry, ...old.items],
                    }))
                  }
                />
                {!loading && !posts.items.length && (
                  <div className={styles.state}>
                    <MessageSquare size={28} />
                    <h2>Bắt đầu câu chuyện đầu tiên</h2>
                    <p>Một lời chào cũng có thể mở đầu một kết nối.</p>
                  </div>
                )}
                {posts.items.map((entry) => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    groupId={selectedId}
                    onDeleted={() =>
                      setPosts((old) => ({
                        ...old,
                        items: old.items.filter((item) => item.id !== entry.id),
                      }))
                    }
                  />
                ))}
                {posts.nextCursor && (
                  <button
                    className={styles.more}
                    disabled={loading}
                    onClick={() => void morePosts()}
                  >
                    Xem bài viết trước
                  </button>
                )}
              </>
            ) : loading ? (
              <div className={styles.state} role="status">
                Đang mở nhóm của bạn…
              </div>
            ) : (
              <div className={styles.state} role="alert">
                <p>{error || 'Bạn cần chấp nhận lời mời để mở nhóm.'}</p>
                <button onClick={() => void loadDetail()}>Thử lại</button>
                <Link href="/community/groups">Về danh sách nhóm</Link>
              </div>
            )
          ) : (
            <div className={styles.welcome}>
              <span>
                <Users size={38} />
              </span>
              <h2>Một nơi để cùng chia sẻ</h2>
              <p>
                Tạo bảng tin riêng cho bạn bè. Bài viết, bình luận và danh sách
                thành viên chỉ hiện trong nhóm đã tham gia.
              </p>
              <button
                className={styles.primary}
                onClick={() => setCreate(true)}
              >
                <Plus size={16} />
                Tạo nhóm cộng đồng
              </button>
              <small>
                <LockKeyhole size={13} />
                Tham gia qua lời mời, theo lựa chọn của mỗi người.
              </small>
            </div>
          )}
          {detail && error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </section>
      </div>
      <CreateCircle
        open={create}
        onClose={() => setCreate(false)}
        onCreated={(group) => {
          void loadList()
          router.push(`/community/groups/${group.id}`)
        }}
        friends={friends}
      />
      <Dialog
        open={manage && Boolean(detail)}
        onOpenChange={(next) => {
          if (!busy) setManage(next)
        }}
        labelledBy="circle-members-title"
        className={styles.dialog}
      >
        {detail && (
          <div className={styles.management}>
            <header>
              <div>
                <h2 id="circle-members-title">Thành viên & thông tin</h2>
                <p>{detail.group.name}</p>
              </div>
              <button
                aria-label="Đóng thông tin nhóm"
                onClick={() => setManage(false)}
                disabled={busy}
              >
                <X size={20} />
              </button>
            </header>
            <p className={styles.privacy}>
              <LockKeyhole size={16} />
              Chỉ người đã tham gia mới xem được nội dung nhóm.
            </p>
            {notice && (
              <p className={styles.notice} role="status">
                {notice}
              </p>
            )}
            {detail.group.role === 'OWNER' && (
              <form
                className={styles.inviteForm}
                onSubmit={(event) => {
                  event.preventDefault()
                  if (invitee)
                    void command(
                      () => api.inviteCircle(detail.group.id, invitee),
                      'Đã gửi lời mời tham gia nhóm.',
                    ).then(() => setInvitee(''))
                }}
              >
                <label htmlFor="circle-invite-member">Mời bạn bè</label>
                <div>
                  <select
                    id="circle-invite-member"
                    value={invitee}
                    onChange={(event) => setInvitee(event.target.value)}
                    disabled={busy}
                  >
                    <option value="">Chọn bạn để mời</option>
                    {friends.items
                      .filter(
                        ({ peer }) =>
                          !detail.members.some(
                            (member) =>
                              member.profile.communityProfileId ===
                              peer.communityProfileId,
                          ),
                      )
                      .map(({ peer }) => (
                        <option
                          key={peer.communityProfileId}
                          value={peer.communityProfileId}
                        >
                          {peer.displayName}
                        </option>
                      ))}
                  </select>
                  <button disabled={!invitee || busy}>
                    <UserRoundPlus size={15} />
                    Mời
                  </button>
                </div>
                {friends.error && (
                  <p role="alert">
                    {friends.error}{' '}
                    <button type="button" onClick={friends.refresh}>
                      Thử lại
                    </button>
                  </p>
                )}
                {friends.cursor && (
                  <button
                    type="button"
                    disabled={friends.loadingMore}
                    onClick={friends.loadMore}
                  >
                    Xem thêm bạn bè
                  </button>
                )}
              </form>
            )}
            <h3>{detail.group.memberCount} thành viên</h3>
            {detail.members.map((member) => (
              <div
                className={styles.member}
                key={
                  member.profile.communityProfileId ??
                  member.profile.displayName
                }
              >
                <CommunityAvatar
                  displayName={member.profile.displayName}
                  avatarPreset={member.profile.avatarPreset}
                  avatarImage={member.profile.avatarImage}
                />
                <div>
                  <strong>{member.profile.displayName}</strong>
                  <small>
                    {member.role === 'OWNER' ? 'Chủ nhóm' : 'Thành viên'}
                  </small>
                </div>
                {detail.group.role === 'OWNER' && member.role !== 'OWNER' && (
                  <button
                    className={styles.iconButton}
                    disabled={busy}
                    aria-label={`Xóa ${member.profile.displayName} khỏi nhóm`}
                    onClick={() =>
                      setConfirm({
                        kind: 'remove',
                        id: member.profile.communityProfileId ?? undefined,
                        name: member.profile.displayName,
                      })
                    }
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            ))}
            <footer>
              <button
                className={styles.danger}
                disabled={busy || !viewer}
                onClick={() =>
                  setConfirm({
                    kind: detail.group.role === 'OWNER' ? 'archive' : 'leave',
                  })
                }
              >
                {detail.group.role === 'OWNER' ? 'Lưu trữ nhóm' : 'Rời nhóm'}
              </button>
            </footer>
          </div>
        )}
      </Dialog>
      <ConfirmDialog
        request={
          confirm
            ? {
                title:
                  confirm.kind === 'archive'
                    ? 'Lưu trữ nhóm này?'
                    : confirm.kind === 'leave'
                      ? 'Rời nhóm này?'
                      : `Xóa ${confirm.name ?? 'thành viên'} khỏi nhóm?`,
                description:
                  confirm.kind === 'archive'
                    ? 'Bài viết và lời mời của nhóm sẽ không còn mở được.'
                    : 'Người rời nhóm sẽ không còn xem được bài viết, bình luận và thành viên.',
                confirmLabel: 'Xác nhận',
              }
            : null
        }
        onResolve={(yes) => {
          if (!yes) {
            if (!busy) setConfirm(null)
            return
          }
          if (!detail || busy) return
          const action = confirm?.kind
          if (action === 'archive')
            void command(
              () => api.archiveCircle(detail.group.id),
              'Đã lưu trữ nhóm.',
              true,
            )
          else if (action === 'leave')
            void command(
              () => api.removeCircleMember(detail.group.id, viewer),
              'Đã rời nhóm.',
              true,
            )
          else if (confirm?.id) {
            const id = confirm.id
            void command(
              () => api.removeCircleMember(detail.group.id, id),
              'Đã xóa thành viên khỏi nhóm.',
            )
          }
        }}
      />
      <Link className={styles.back} href="/community">
        <ArrowLeft size={14} />
        Về bảng tin cộng đồng
      </Link>
    </div>
  )
}
