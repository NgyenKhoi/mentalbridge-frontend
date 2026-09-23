'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  JournalEntry,
  JournalMood,
  JournalSummary,
} from '@/lib/journal/journal-contract'
import {
  JOURNAL_MOODS,
  JOURNAL_PROMPTS,
  journalMood,
} from '@/features/journal/authoring'
import { JournalReflection } from '@/features/journal/reflection/JournalReflection'
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
type EditorSnapshot = {
  text: string
  tagText: string
  occurredAt: string
  mood: JournalMood | null
}
type FieldErrors = {
  mood?: string
  text?: string
  occurredAt?: string
  tags?: string
}
const DISCARD_MESSAGE = 'Bạn có thay đổi chưa lưu. Rời đi và bỏ bản nháp?'
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
  const [pageNotice, setPageNotice] = useState('')
  const [mode, setMode] = useState<Mode>('closed')
  const [selected, setSelected] = useState<JournalEntry | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [working, setWorking] = useState(false)
  const [modalError, setModalError] = useState('')
  const [text, setText] = useState('')
  const [tagText, setTagText] = useState('')
  const [occurredAt, setOccurredAt] = useState('')
  const [mood, setMood] = useState<JournalMood | null>(null)
  const [promptIndex, setPromptIndex] = useState(0)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [editorBaseline, setEditorBaseline] = useState<EditorSnapshot | null>(
    null,
  )
  const [clientEntryId, setClientEntryId] = useState('')
  const mutationKeys = useRef(new Map<string, string>())
  const triggerRef = useRef<HTMLElement | null>(null)
  const backgroundRef = useRef<HTMLDivElement | null>(null)
  const dialogRef = useRef<HTMLElement | null>(null)
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null)
  const firstMoodRef = useRef<HTMLInputElement | null>(null)
  const occurredAtRef = useRef<HTMLInputElement | null>(null)
  const tagsRef = useRef<HTMLInputElement | null>(null)
  const navigationAllowedRef = useRef(false)

  const editorSnapshot = { text, tagText, occurredAt, mood }
  const baseline = editorBaseline
  const dirty =
    (mode === 'create' || mode === 'edit') &&
    baseline !== null &&
    (baseline.text !== editorSnapshot.text ||
      baseline.tagText !== editorSnapshot.tagText ||
      baseline.occurredAt !== editorSnapshot.occurredAt ||
      baseline.mood !== editorSnapshot.mood)

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

  const discardAndClose = useCallback(() => {
    setMode('closed')
    setSelected(null)
    setModalError('')
    setFieldErrors({})
    setWorking(false)
    setEditorBaseline(null)
    navigationAllowedRef.current = false
    window.setTimeout(() => triggerRef.current?.focus(), 0)
  }, [])
  const requestClose = useCallback(() => {
    if (dirty && !window.confirm(DISCARD_MESSAGE)) return
    discardAndClose()
  }, [dirty, discardAndClose])
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
        requestClose()
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
  }, [mode, requestClose, working])

  useEffect(() => {
    if (!dirty) return
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (navigationAllowedRef.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    const protectLinkNavigation = (event: MouseEvent) => {
      if (
        navigationAllowedRef.current ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return
      const target = event.target
      const anchor =
        target instanceof Element
          ? target.closest<HTMLAnchorElement>('a[href]')
          : null
      if (
        !anchor ||
        anchor.target === '_blank' ||
        anchor.hasAttribute('download')
      )
        return
      const destination = new URL(anchor.href, window.location.href)
      if (
        destination.origin !== window.location.origin ||
        destination.href === window.location.href
      )
        return
      if (!window.confirm(DISCARD_MESSAGE)) {
        event.preventDefault()
        event.stopPropagation()
        return
      }
      navigationAllowedRef.current = true
    }
    window.addEventListener('beforeunload', beforeUnload)
    document.addEventListener('click', protectLinkNavigation, true)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      document.removeEventListener('click', protectLinkNavigation, true)
    }
  }, [dirty])
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
    const initialOccurredAt = formatJournalLocalDateTime(new Date())
    setText('')
    setTagText('')
    setMood(null)
    setPromptIndex(0)
    setFieldErrors({})
    setModalError('')
    setOccurredAt(initialOccurredAt)
    setClientEntryId(crypto.randomUUID())
    setEditorBaseline({
      text: '',
      tagText: '',
      occurredAt: initialOccurredAt,
      mood: null,
    })
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
      setMood(parsed.mood)
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
  function startEdit() {
    if (!selected) return
    const initial = {
      text: selected.content.text,
      tagText: selected.tags.join(', '),
      occurredAt: '',
      mood: selected.mood,
    }
    setText(initial.text)
    setTagText(initial.tagText)
    setMood(initial.mood)
    setFieldErrors({})
    setModalError('')
    setEditorBaseline(initial)
    setMode('edit')
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
  function validateEditor(tags: string[], occurredAtIso?: string | null) {
    const errors: FieldErrors = {}
    if (!mood) errors.mood = 'Hãy chọn cảm xúc phù hợp nhất.'
    if (text.trim().length === 0)
      errors.text = 'Hãy viết một vài dòng trước khi lưu.'
    else if (text.length > 12_000)
      errors.text = 'Nội dung không được dài quá 12000 ký tự.'
    if (
      tags.length > 20 ||
      new Set(tags).size !== tags.length ||
      tags.some((tag) => tag.length > 40)
    )
      errors.tags =
        'Dùng tối đa 20 thẻ không trùng nhau, mỗi thẻ tối đa 40 ký tự.'
    if (occurredAtIso === null)
      errors.occurredAt = 'Hãy chọn thời điểm ghi hợp lệ.'
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      window.requestAnimationFrame(() => {
        if (errors.mood) firstMoodRef.current?.focus()
        else if (errors.occurredAt) occurredAtRef.current?.focus()
        else if (errors.text) textAreaRef.current?.focus()
        else if (errors.tags) tagsRef.current?.focus()
      })
    }
    return Object.keys(errors).length === 0
  }
  async function create() {
    const tags = tagsOf(tagText)
    const occurredAtIso = journalLocalDateTimeToIso(occurredAt)
    if (!validateEditor(tags, occurredAtIso) || !occurredAtIso || !mood) return
    const payload = {
      clientEntryId,
      occurredAt: occurredAtIso,
      content: { text },
      mood,
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
      setPageNotice('Nhật ký đã được lưu.')
      discardAndClose()
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
    if (!validateEditor(tags) || !mood) return
    const scope = `revise:${selected.id}:${selected.currentRevision}:${mood}:${text}:${tagText}`
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
          body: JSON.stringify({ content: { text }, mood, tags }),
        },
        parseJournalEntry,
      )) as JournalEntry
      setSelected(updated)
      setMood(updated.mood)
      setEditorBaseline(null)
      setMode('view')
      setPageNotice('Nhật ký đã được cập nhật.')
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
            'Đã tải nội dung mới nhất. Bản nháp của bạn vẫn được giữ; hãy xem lại rồi nhấn Lưu nhật ký để thử lại.',
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
      setPageNotice('Nhật ký đã được xóa.')
      discardAndClose()
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
          {pageNotice && (
            <p className="journal-save-notice" role="status">
              {pageNotice}
            </p>
          )}
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
              <p>Ghi lại điều bạn muốn lưu giữ theo cách riêng của mình.</p>
              <button onClick={openCreate}>Viết nhật ký đầu tiên</button>
            </div>
          )}
          <div className="journal-live-grid">
            {entries.map((entry) => (
              <article key={entry.id} className="journal-live-card">
                <header>
                  <time>{formatDate(entry.occurredAt)}</time>
                  {journalMood(entry.mood) && (
                    <span className="journal-mood-badge">
                      <span aria-hidden="true">
                        {journalMood(entry.mood)?.emoji}
                      </span>{' '}
                      {journalMood(entry.mood)?.label}
                    </span>
                  )}
                </header>
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
            if (event.target === event.currentTarget && !working) requestClose()
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
              <button
                onClick={requestClose}
                disabled={working}
                aria-label="Đóng"
              >
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
                {journalMood(selected.mood) && (
                  <p className="journal-detail-mood">
                    <span aria-hidden="true">
                      {journalMood(selected.mood)?.emoji}
                    </span>{' '}
                    Bạn đã chọn: {journalMood(selected.mood)?.label}
                  </p>
                )}
                <p>{selected.content.text}</p>
                <div>
                  {selected.tags.map((tag) => (
                    <span key={tag}>#{tag}</span>
                  ))}
                </div>
                <JournalReflection
                  key={`${selected.id}:${selected.currentRevision}`}
                  entry={selected}
                />
                <footer>
                  <button className="danger" onClick={() => setMode('delete')}>
                    Xóa
                  </button>
                  <button onClick={startEdit}>Chỉnh sửa</button>
                </footer>
              </div>
            )}
            {(mode === 'create' || (mode === 'edit' && selected)) && (
              <div className="journal-form">
                <fieldset
                  className="journal-mood-field"
                  aria-describedby={
                    fieldErrors.mood ? 'journal-mood-error' : undefined
                  }
                >
                  <legend>Bạn đang cảm thấy thế nào? (bắt buộc)</legend>
                  <div className="journal-mood-options">
                    {JOURNAL_MOODS.map((option, index) => (
                      <label
                        key={option.value}
                        className={
                          mood === option.value ? 'selected' : undefined
                        }
                      >
                        <input
                          ref={index === 0 ? firstMoodRef : undefined}
                          type="radio"
                          name="journal-mood"
                          value={option.value}
                          checked={mood === option.value}
                          onChange={() => {
                            setMood(option.value)
                            setFieldErrors((current) => ({
                              ...current,
                              mood: undefined,
                            }))
                          }}
                        />
                        <span aria-hidden="true">{option.emoji}</span>
                        <strong>{option.label}</strong>
                      </label>
                    ))}
                  </div>
                  {fieldErrors.mood && (
                    <small
                      id="journal-mood-error"
                      className="journal-field-error"
                    >
                      {fieldErrors.mood}
                    </small>
                  )}
                </fieldset>
                <section
                  className="journal-prompts"
                  aria-labelledby="journal-prompts-title"
                >
                  <div>
                    <span>Gợi ý viết</span>
                    <h3 id="journal-prompts-title">
                      Nếu bạn chưa biết bắt đầu từ đâu
                    </h3>
                  </div>
                  <div className="journal-prompt-options">
                    {JOURNAL_PROMPTS.map((prompt, index) => (
                      <button
                        type="button"
                        key={prompt}
                        aria-pressed={promptIndex === index}
                        onClick={() => {
                          setPromptIndex(index)
                          textAreaRef.current?.focus()
                        }}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </section>
                {mode === 'create' && (
                  <label>
                    Thời điểm ghi
                    <input
                      ref={occurredAtRef}
                      aria-label="Thời điểm ghi"
                      type="datetime-local"
                      value={occurredAt}
                      aria-invalid={Boolean(fieldErrors.occurredAt)}
                      aria-describedby={
                        fieldErrors.occurredAt
                          ? 'journal-occurred-error'
                          : undefined
                      }
                      onChange={(event) => {
                        setOccurredAt(event.target.value)
                        setFieldErrors((current) => ({
                          ...current,
                          occurredAt: undefined,
                        }))
                      }}
                    />
                    {fieldErrors.occurredAt && (
                      <small
                        id="journal-occurred-error"
                        className="journal-field-error"
                      >
                        {fieldErrors.occurredAt}
                      </small>
                    )}
                  </label>
                )}
                <label>
                  Nội dung (bắt buộc)
                  <textarea
                    ref={textAreaRef}
                    aria-label="Nội dung"
                    aria-invalid={Boolean(fieldErrors.text)}
                    aria-describedby={
                      fieldErrors.text ? 'journal-text-error' : undefined
                    }
                    data-dialog-initial-focus
                    value={text}
                    maxLength={12_000}
                    placeholder={JOURNAL_PROMPTS[promptIndex]}
                    onChange={(event) => {
                      setText(event.target.value)
                      setFieldErrors((current) => ({
                        ...current,
                        text: undefined,
                      }))
                    }}
                    rows={10}
                  />
                  <span className="journal-field-meta">
                    {fieldErrors.text && (
                      <small
                        id="journal-text-error"
                        className="journal-field-error"
                      >
                        {fieldErrors.text}
                      </small>
                    )}
                    <small>{text.length}/12000</small>
                  </span>
                </label>
                <label>
                  Thẻ do bạn đặt
                  <input
                    ref={tagsRef}
                    aria-label="Thẻ do bạn đặt"
                    value={tagText}
                    aria-invalid={Boolean(fieldErrors.tags)}
                    aria-describedby={
                      fieldErrors.tags
                        ? 'journal-tags-help journal-tags-error'
                        : 'journal-tags-help'
                    }
                    onChange={(event) => {
                      setTagText(event.target.value)
                      setFieldErrors((current) => ({
                        ...current,
                        tags: undefined,
                      }))
                    }}
                    placeholder="công việc, gia đình"
                  />
                  <small id="journal-tags-help">
                    Phân cách bằng dấu phẩy, tối đa 20 thẻ.
                  </small>
                  {fieldErrors.tags && (
                    <small
                      id="journal-tags-error"
                      className="journal-field-error"
                    >
                      {fieldErrors.tags}
                    </small>
                  )}
                </label>
                <p className="journal-draft-state" role="status">
                  {working
                    ? 'Đang lưu thay đổi an toàn…'
                    : dirty
                      ? 'Có thay đổi chưa lưu. Bản nháp chỉ được giữ trên màn hình này.'
                      : 'Chưa có thay đổi mới.'}
                </p>
                <footer>
                  <button onClick={requestClose} disabled={working}>
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
                  Nhật ký sẽ không còn hiển thị trong danh sách hoặc có thể khôi
                  phục trong ứng dụng. Hệ thống chỉ giữ thông tin tối thiểu về
                  việc xóa để đồng bộ và kiểm tra; thao tác này không có nghĩa
                  dữ liệu vật lý được xóa ngay lập tức.
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
