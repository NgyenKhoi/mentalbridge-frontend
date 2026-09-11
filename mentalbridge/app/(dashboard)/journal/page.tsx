'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  JournalEntry,
  JournalSummary,
} from '@/lib/journal/journal-contract'
import {
  parseJournalEntry,
  parseJournalPage,
  parseTombstone,
} from '@/lib/journal/journal-validation'
import {
  formatJournalLocalDateTime,
  journalLocalDateTimeToIso,
} from '@/lib/journal/journal-datetime'
import './journal.css'

type Problem = { code?: string; title?: string }
type Mode = 'closed' | 'create' | 'view' | 'edit' | 'delete'
class JournalUiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message)
    this.name = 'JournalUiError'
  }
}
const read = async (response: Response) => {
  try {
    return (await response.json()) as unknown
  } catch {
    return null
  }
}
const errorMessage = (problem: Problem | null, fallback: string) =>
  ({
    AUTHENTICATION_REQUIRED:
      'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    RESOURCE_NOT_FOUND: 'Nhật ký này không còn tồn tại.',
    PRECONDITION_FAILED:
      'Nhật ký đã được cập nhật ở nơi khác. Tải lại bản mới trước khi sửa tiếp.',
    JOURNAL_MUTATION_OUTCOME_UNKNOWN:
      'Chưa thể xác nhận thao tác. Nội dung vẫn được giữ để bạn thử lại an toàn.',
    JOURNAL_MALFORMED_RESPONSE:
      'Dịch vụ trả về dữ liệu không hợp lệ. Không có dữ liệu nào được hiển thị.',
    JOURNAL_UNAVAILABLE:
      'Dịch vụ nhật ký hiện không khả dụng. Vui lòng thử lại.',
    DEPENDENCY_UNAVAILABLE:
      'Dịch vụ nhật ký hiện không khả dụng. Vui lòng thử lại.',
    VALIDATION_FAILED: 'Nội dung hoặc thẻ chưa hợp lệ.',
  })[problem?.code ?? ''] ??
  problem?.title ??
  fallback
const formatDate = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(value))
const tagsOf = (value: string) =>
  value
    .split(',')
    .map((tag) => tag.trim().replace(/^#/, ''))
    .filter(Boolean)
const focusableSelector =
  'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

async function fetchJournalEntry(id: string) {
  const response = await fetch(`/api/journals/${id}`, { cache: 'no-store' })
  const value = await read(response)
  const parsed = response.ok ? parseJournalEntry(value) : null
  if (parsed) return parsed
  const problem = value && typeof value === 'object' ? (value as Problem) : null
  throw new JournalUiError(
    errorMessage(problem, 'Không thể tải chi tiết nhật ký.'),
    problem?.code,
  )
}

export default function JournalPage() {
  const [entries, setEntries] = useState<JournalSummary[]>([])
  const [cursor, setCursor] = useState<string>()
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [pageError, setPageError] = useState('')
  const [mode, setMode] = useState<Mode>('closed')
  const [selected, setSelected] = useState<JournalEntry | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [working, setWorking] = useState(false)
  const [modalError, setModalError] = useState('')
  const [text, setText] = useState('')
  const [tagText, setTagText] = useState('')
  const [occurredAt, setOccurredAt] = useState('')
  const [clientEntryId, setClientEntryId] = useState('')
  const mutationKeys = useRef(new Map<string, string>())
  const triggerRef = useRef<HTMLElement | null>(null)
  const backgroundRef = useRef<HTMLDivElement | null>(null)
  const dialogRef = useRef<HTMLElement | null>(null)

  const load = useCallback(async (next?: string) => {
    if (next) setLoadingMore(true)
    else setLoading(true)
    setPageError('')
    try {
      const response = await fetch(
        `/api/journals${next ? `?cursor=${encodeURIComponent(next)}` : ''}`,
        { cache: 'no-store' },
      )
      const value = await read(response)
      const parsed = response.ok ? parseJournalPage(value) : null
      if (!parsed)
        throw new Error(
          errorMessage(
            value && typeof value === 'object' ? (value as Problem) : null,
            'Không thể tải nhật ký.',
          ),
        )
      setEntries((current) =>
        next ? [...current, ...parsed.items] : parsed.items,
      )
      setCursor(parsed.page.nextCursor)
      setHasMore(parsed.page.hasMore)
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : 'Không thể tải nhật ký.',
      )
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])
  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(initialLoad)
  }, [load])

  const close = useCallback(() => {
    setMode('closed')
    setSelected(null)
    setModalError('')
    setWorking(false)
    window.setTimeout(() => triggerRef.current?.focus(), 0)
  }, [])
  useEffect(() => {
    if (mode === 'closed') return
    const overflow = document.body.style.overflow
    const background = backgroundRef.current
    if (background) {
      background.inert = true
      background.setAttribute('aria-hidden', 'true')
    }
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !working) {
        event.preventDefault()
        close()
        return
      }
      if (event.key !== 'Tab') return
      const dialog = dialogRef.current
      if (!dialog) return
      const focusable = [
        ...dialog.querySelectorAll<HTMLElement>(focusableSelector),
      ]
      if (focusable.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }
      const first = focusable[0]
      const last = focusable.at(-1)
      if (
        (event.shiftKey && document.activeElement === first) ||
        (!event.shiftKey && document.activeElement === last)
      ) {
        event.preventDefault()
        ;(event.shiftKey ? last : first)?.focus()
      }
    }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', keyboard)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', keyboard)
      if (background) {
        background.inert = false
        background.removeAttribute('aria-hidden')
      }
    }
  }, [close, mode, working])
  useEffect(() => {
    if (mode === 'closed') return
    const frame = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current
      const initial = dialog?.querySelector<HTMLElement>(
        '[data-dialog-initial-focus]',
      )
      ;(initial ?? dialog)?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [detailLoading, mode])
  function openCreate(event: React.MouseEvent<HTMLButtonElement>) {
    triggerRef.current = event.currentTarget
    setText('')
    setTagText('')
    setModalError('')
    setOccurredAt(formatJournalLocalDateTime(new Date()))
    setClientEntryId(crypto.randomUUID())
    setMode('create')
  }
  async function openDetail(entry: JournalSummary, target: HTMLElement) {
    triggerRef.current = target
    setMode('view')
    setDetailLoading(true)
    setModalError('')
    try {
      const parsed = await fetchJournalEntry(entry.id)
      setSelected(parsed)
      setText(parsed.content.text)
      setTagText(parsed.tags.join(', '))
    } catch (error) {
      setModalError(
        error instanceof Error
          ? error.message
          : 'Không thể tải chi tiết nhật ký.',
      )
    } finally {
      setDetailLoading(false)
    }
  }
  function commandKey(scope: string) {
    const current = mutationKeys.current.get(scope)
    if (current) return current
    const created = crypto.randomUUID()
    mutationKeys.current.set(scope, created)
    return created
  }
  async function mutate(
    scope: string,
    url: string,
    options: RequestInit,
    parser: (value: unknown) => unknown,
  ) {
    setWorking(true)
    setModalError('')
    try {
      const response = await fetch(url, {
        ...options,
        headers: { ...options.headers, 'Idempotency-Key': commandKey(scope) },
      })
      const value = await read(response)
      const parsed = response.ok ? parser(value) : null
      if (!parsed) {
        const problem =
          value && typeof value === 'object' ? (value as Problem) : null
        const code = response.ok
          ? 'JOURNAL_MUTATION_OUTCOME_UNKNOWN'
          : problem?.code
        if (code !== 'JOURNAL_MUTATION_OUTCOME_UNKNOWN')
          mutationKeys.current.delete(scope)
        throw new JournalUiError(
          errorMessage(
            code === problem?.code ? problem : { code },
            'Không thể hoàn tất thao tác.',
          ),
          code,
        )
      }
      mutationKeys.current.delete(scope)
      return parsed
    } finally {
      setWorking(false)
    }
  }
  function valid(textValue: string, tags: string[]) {
    return (
      textValue.length > 0 &&
      textValue.length <= 12_000 &&
      tags.length <= 20 &&
      new Set(tags).size === tags.length &&
      tags.every((tag) => tag.length <= 40)
    )
  }
  async function create() {
    const tags = tagsOf(tagText)
    const occurredAtIso = journalLocalDateTimeToIso(occurredAt)
    if (!valid(text, tags) || !occurredAtIso) {
      setModalError('Nhập nội dung và tối đa 20 thẻ không trùng nhau.')
      return
    }
    const payload = {
      clientEntryId,
      occurredAt: occurredAtIso,
      content: { text },
      tags,
    }
    try {
      await mutate(
        `create:${clientEntryId}`,
        '/api/journals',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
        parseJournalEntry,
      )
      close()
      await load()
    } catch (error) {
      setModalError(
        error instanceof Error ? error.message : 'Không thể tạo nhật ký.',
      )
    }
  }
  async function revise() {
    if (!selected) return
    const tags = tagsOf(tagText)
    if (!valid(text, tags)) {
      setModalError('Nhập nội dung và tối đa 20 thẻ không trùng nhau.')
      return
    }
    const scope = `revise:${selected.id}:${selected.currentRevision}:${text}:${tagText}`
    try {
      const updated = (await mutate(
        scope,
        `/api/journals/${selected.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'If-Match-Revision': String(selected.currentRevision),
          },
          body: JSON.stringify({ content: { text }, tags }),
        },
        parseJournalEntry,
      )) as JournalEntry
      setSelected(updated)
      setMode('view')
      await load()
    } catch (error) {
      if (
        error instanceof JournalUiError &&
        error.code === 'PRECONDITION_FAILED'
      ) {
        setWorking(true)
        try {
          const authoritative = await fetchJournalEntry(selected.id)
          setSelected(authoritative)
          setModalError(
            'Đã tải phiên bản mới nhất. Bản nháp của bạn vẫn được giữ; hãy xem lại rồi nhấn Lưu nhật ký để thử lại.',
          )
        } catch (refreshError) {
          setModalError(
            refreshError instanceof Error
              ? `${error.message} ${refreshError.message}`
              : error.message,
          )
        } finally {
          setWorking(false)
        }
        return
      }
      setModalError(
        error instanceof Error ? error.message : 'Không thể cập nhật nhật ký.',
      )
    }
  }
  async function remove() {
    if (!selected) return
    try {
      await mutate(
        `delete:${selected.id}`,
        `/api/journals/${selected.id}`,
        { method: 'DELETE' },
        parseTombstone,
      )
      close()
      await load()
    } catch (error) {
      setModalError(
        error instanceof Error ? error.message : 'Không thể xóa nhật ký.',
      )
    }
  }

  return (
    <main className="journal-live">
      <div ref={backgroundRef} className="journal-page-content">
        <header className="journal-live-hero">
          <div>
            <span>Nhật ký riêng tư</span>
            <h1>Nhật ký của bạn</h1>
            <p>
              Nội dung được mã hóa trước khi lưu và chỉ tài khoản của bạn có thể
              truy cập.
            </p>
          </div>
          <button onClick={openCreate}>+ Viết nhật ký</button>
        </header>
        <section
          aria-labelledby="journal-list-title"
          className="journal-live-list"
        >
          <div className="journal-live-heading">
            <h2 id="journal-list-title">Các ghi chép gần đây</h2>
            <button onClick={() => void load()} disabled={loading}>
              Tải lại
            </button>
          </div>
          {loading && (
            <p className="journal-status" role="status">
              Đang tải nhật ký…
            </p>
          )}
          {!loading && pageError && (
            <div className="journal-status journal-error" role="alert">
              <p>{pageError}</p>
              <button onClick={() => void load()}>Thử lại</button>
            </div>
          )}
          {!loading && !pageError && entries.length === 0 && (
            <div className="journal-status">
              <h3>Chưa có nhật ký</h3>
              <p>
                Ghi lại điều bạn muốn lưu giữ. Nội dung không được dùng để diễn
                giải lâm sàng.
              </p>
              <button onClick={openCreate}>Viết nhật ký đầu tiên</button>
            </div>
          )}
          <div className="journal-live-grid">
            {entries.map((entry) => (
              <article key={entry.id} className="journal-live-card">
                <time>{formatDate(entry.occurredAt)}</time>
                <p>{entry.content.preview}</p>
                <div>
                  {entry.tags.map((tag) => (
                    <span key={tag}>#{tag}</span>
                  ))}
                </div>
                <button
                  onClick={(event) =>
                    void openDetail(entry, event.currentTarget)
                  }
                >
                  Xem chi tiết
                </button>
              </article>
            ))}
          </div>
          {hasMore && !pageError && (
            <button
              className="journal-load-more"
              onClick={() => void load(cursor)}
              disabled={loadingMore}
            >
              {loadingMore ? 'Đang tải…' : 'Xem thêm'}
            </button>
          )}
        </section>
      </div>
      {mode !== 'closed' && (
        <div
          className="journal-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !working) close()
          }}
        >
          <section
            ref={dialogRef}
            className="journal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="journal-dialog-title"
            aria-busy={working || detailLoading}
            tabIndex={-1}
          >
            <header>
              <div>
                <span>Nhật ký riêng tư</span>
                <h2 id="journal-dialog-title">
                  {mode === 'create'
                    ? 'Viết nhật ký'
                    : mode === 'edit'
                      ? 'Chỉnh sửa nhật ký'
                      : mode === 'delete'
                        ? 'Xác nhận xóa'
                        : 'Chi tiết nhật ký'}
                </h2>
              </div>
              <button onClick={close} disabled={working} aria-label="Đóng">
                ×
              </button>
            </header>
            {detailLoading && (
              <p role="status" className="journal-status">
                Đang tải nội dung…
              </p>
            )}
            {modalError && (
              <div role="alert" className="journal-modal-error">
                <p>{modalError}</p>
              </div>
            )}
            {!detailLoading && mode === 'view' && selected && (
              <div className="journal-detail">
                <time>{formatDate(selected.occurredAt)}</time>
                <p>{selected.content.text}</p>
                <div>
                  {selected.tags.map((tag) => (
                    <span key={tag}>#{tag}</span>
                  ))}
                </div>
                <small>
                  Phiên bản {selected.currentRevision} · Mã hóa{' '}
                  {selected.encryption.algorithm}
                </small>
                <footer>
                  <button className="danger" onClick={() => setMode('delete')}>
                    Xóa
                  </button>
                  <button onClick={() => setMode('edit')}>Chỉnh sửa</button>
                </footer>
              </div>
            )}
            {(mode === 'create' || (mode === 'edit' && selected)) && (
              <div className="journal-form">
                {mode === 'create' && (
                  <label>
                    Thời điểm ghi
                    <input
                      aria-label="Thời điểm ghi"
                      type="datetime-local"
                      value={occurredAt}
                      onChange={(event) => setOccurredAt(event.target.value)}
                    />
                  </label>
                )}
                <label>
                  Nội dung
                  <textarea
                    aria-label="Nội dung"
                    data-dialog-initial-focus
                    value={text}
                    maxLength={12_000}
                    onChange={(event) => setText(event.target.value)}
                    rows={10}
                  />
                  <small>{text.length}/12000</small>
                </label>
                <label>
                  Thẻ do bạn đặt
                  <input
                    aria-label="Thẻ do bạn đặt"
                    value={tagText}
                    onChange={(event) => setTagText(event.target.value)}
                    placeholder="công việc, gia đình"
                  />
                  <small>Phân cách bằng dấu phẩy, tối đa 20 thẻ.</small>
                </label>
                <footer>
                  <button onClick={close} disabled={working}>
                    Hủy
                  </button>
                  <button
                    onClick={() =>
                      void (mode === 'create' ? create() : revise())
                    }
                    disabled={working}
                  >
                    {working ? 'Đang lưu…' : 'Lưu nhật ký'}
                  </button>
                </footer>
              </div>
            )}
            {mode === 'delete' && selected && (
              <div className="journal-delete">
                <p>
                  Nhật ký sẽ biến mất khỏi danh sách. Hệ thống lưu một tombstone
                  theo chính sách dữ liệu; thao tác này không có nghĩa dữ liệu
                  vật lý được xóa ngay lập tức.
                </p>
                <footer>
                  <button onClick={() => setMode('view')} disabled={working}>
                    Giữ lại
                  </button>
                  <button
                    className="danger"
                    onClick={() => void remove()}
                    disabled={working}
                  >
                    {working ? 'Đang xóa…' : 'Xóa nhật ký'}
                  </button>
                </footer>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  )
}
