'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Laugh,
  Smile,
  Meh,
  Frown,
  CloudRain,
  Lock,
  X,
  Clock,
  RotateCw,
  HeartHandshake,
  Briefcase,
  Users,
  GraduationCap,
  Activity,
  Moon,
} from 'lucide-react'
import Link from 'next/link'
import type {
  JournalEntry,
  JournalMood,
  JournalSummary,
} from '@/lib/journal/journal-contract'
import {
  JOURNAL_MOODS,
  JOURNAL_PROMPTS,
  MOOD_PROMPTS,
  getMoodCategory,
  journalMood,
} from '@/features/journal/authoring'

import { JournalReflection } from '@/features/journal/reflection/JournalReflection'
import { useFeedback } from '@/components/ui/FeedbackProvider'
import { lockBodyScroll } from '@/lib/dom/body-scroll-lock'
import {
  parseJournalEntry,
  parseJournalPage,
  parseTombstone,
} from '@/lib/journal/journal-validation'
import {
  formatJournalLocalDateTime,
  journalLocalDateTimeToIso,
} from '@/lib/journal/journal-datetime'
import { JournalHero } from './components/JournalHero'
import { JournalStats } from './components/JournalStats'
import { JournalFilters } from './components/JournalFilters'
import { JournalTimeline } from './components/JournalTimeline'
import { JournalCalendar } from './components/JournalCalendar'
import { MoodDistribution } from './components/MoodDistribution'
import { useJournalTimeline } from './hooks/useJournalTimeline'
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

const MOOD_ICONS: Record<JournalMood, typeof Laugh> = {
  GREAT: Laugh,
  GOOD: Smile,
  OKAY: Meh,
  LOW: Frown,
  VERY_LOW: CloudRain,
}

const PRESET_TAGS = [
  { id: 'cong-viec', label: 'Công việc', icon: Briefcase },
  { id: 'gia-dinh', label: 'Gia đình', icon: Users },
  { id: 'hoc-tap', label: 'Học tập', icon: GraduationCap },
  { id: 'moi-quan-he', label: 'Các mối quan hệ', icon: HeartHandshake },
  { id: 'suc-khoe', label: 'Sức khỏe', icon: Activity },
  { id: 'giac-ngu', label: 'Giấc ngủ', icon: Moon },
] as const

export default function JournalPage() {
  const { showActionToast } = useFeedback()
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
  const [promptOffset, setPromptOffset] = useState(0)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [editorBaseline, setEditorBaseline] = useState<EditorSnapshot | null>(
    null,
  )
  const [clientEntryId, setClientEntryId] = useState('')

  // Timeline calendar and filters
  const [yearMonth, setYearMonth] = useState<[number, number]>(() => {
    const now = new Date()
    return [now.getFullYear(), now.getMonth()]
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMood, setSelectedMood] = useState<'all' | JournalMood>('all')
  const [selectedTag, setSelectedTag] = useState('all')
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const { stats, calendarData, groupedByDate, availableTags } =
    useJournalTimeline({
      entries,
      yearMonth,
      searchQuery,
      selectedMood,
      selectedTag,
      selectedDay,
    })

  const shiftMonth = (offset: number) => {
    setYearMonth(([y, m]) => {
      const nextMonthDate = new Date(y, m + offset, 1)
      return [nextMonthDate.getFullYear(), nextMonthDate.getMonth()]
    })
    setSelectedDay(null)
  }

  const handleResetFilters = () => {
    setSearchQuery('')
    setSelectedMood('all')
    setSelectedTag('all')
    setSelectedDay(null)
  }
  const mutationKeys = useRef(new Map<string, string>())
  const triggerRef = useRef<HTMLElement | null>(null)
  const backgroundRef = useRef<HTMLDivElement | null>(null)
  const dialogRef = useRef<HTMLElement | null>(null)
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null)
  const firstMoodRef = useRef<HTMLInputElement | null>(null)
  const occurredAtRef = useRef<HTMLInputElement | null>(null)
  const tagsRef = useRef<HTMLInputElement | null>(null)
  const navigationAllowedRef = useRef(false)

  const moodCategory = getMoodCategory(mood)
  const activePrompts = MOOD_PROMPTS[moodCategory]

  const updateMood = (nextMood: JournalMood | null) => {
    setMood(nextMood)
    setPromptOffset(0)
  }

  const currentDisplayedPrompts = [
    activePrompts[promptOffset % activePrompts.length],
    activePrompts[(promptOffset + 1) % activePrompts.length],
    activePrompts[(promptOffset + 2) % activePrompts.length],
  ]

  const handleRotatePrompts = () => {
    setPromptOffset((prev) => (prev + 3) % activePrompts.length)
  }

  const handleInsertPrompt = (promptText: string) => {
    setText((prev) => {
      const trimmed = prev.trim()
      if (!trimmed) return promptText + '\n'
      return trimmed + '\n\n' + promptText + '\n'
    })
    setFieldErrors((current) => ({ ...current, text: undefined }))
    textAreaRef.current?.focus()
  }

  const togglePresetTag = (presetLabel: string) => {
    const currentTags = tagsOf(tagText)
    const exists = currentTags.some(
      (t) => t.toLowerCase() === presetLabel.toLowerCase(),
    )
    let nextTags: string[]
    if (exists) {
      nextTags = currentTags.filter(
        (t) => t.toLowerCase() !== presetLabel.toLowerCase(),
      )
    } else {
      if (currentTags.length >= 20) {
        setFieldErrors((c) => ({
          ...c,
          tags: 'Dùng tối đa 20 thẻ không trùng nhau, mỗi thẻ tối đa 40 ký tự.',
        }))
        return
      }
      nextTags = [...currentTags, presetLabel]
    }
    setTagText(nextTags.join(', '))
    setFieldErrors((c) => ({ ...c, tags: undefined }))
  }

  const removeTag = (tagToRemove: string) => {
    const currentTags = tagsOf(tagText)
    const nextTags = currentTags.filter(
      (t) => t.toLowerCase() !== tagToRemove.toLowerCase(),
    )
    setTagText(nextTags.join(', '))
  }

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
    const releaseScrollLock = lockBodyScroll()
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
    document.addEventListener('keydown', keyboard)
    return () => {
      releaseScrollLock()
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
  function openCreate(
    event?: React.MouseEvent<HTMLButtonElement> | HTMLElement | null,
  ) {
    if (event) {
      triggerRef.current =
        'currentTarget' in event ? event.currentTarget : event
    }
    const initialOccurredAt = formatJournalLocalDateTime(new Date())
    setText('')
    setTagText('')
    updateMood(null)
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
      updateMood(parsed.mood)
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
    updateMood(initial.mood)
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
      showActionToast({ title: 'Đã lưu nhật ký' })
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
      updateMood(updated.mood)
      setEditorBaseline(null)
      setMode('view')
      setPageNotice('Nhật ký đã được cập nhật.')
      showActionToast({ title: 'Đã cập nhật nhật ký' })
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
      showActionToast({
        title: 'Đã xóa nhật ký',
        description: 'Nhật ký không còn hiển thị trong danh sách của bạn.',
      })
      discardAndClose()
      await load()
    } catch (error) {
      setModalError(
        error instanceof Error ? error.message : 'Không thể xóa nhật ký.',
      )
    }
  }

  return (
    <div className="journal-live">
      <div ref={backgroundRef} className="journal-page-content">
        <div className="journal-wrap">
          {pageNotice && (
            <p className="journal-save-notice" role="status">
              {pageNotice}
            </p>
          )}

          {/* 1. Hero card (full width) */}
          <JournalHero onOpenCreate={openCreate} />

          {/* 2. Stats cards */}
          <JournalStats stats={stats} />

          {/* 3. Two columns */}
          <div className="cols">
            <div className="col-main">
              {/* Filters */}
              <JournalFilters
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                selectedMood={selectedMood}
                onMoodSelect={setSelectedMood}
                selectedTag={selectedTag}
                onTagSelect={setSelectedTag}
                availableTags={availableTags}
              />

              {/* Timeline */}
              <JournalTimeline
                year={yearMonth[0]}
                month={yearMonth[1]}
                groupedByDate={groupedByDate}
                hasTotalEntries={entries.length > 0}
                loading={loading}
                error={pageError}
                onRetry={() => void load()}
                onOpenCreate={openCreate}
                onResetFilters={handleResetFilters}
                onOpenDetail={(entry, target) => void openDetail(entry, target)}
                hasMore={hasMore}
                loadingMore={loadingMore}
                onLoadMore={() => void load(cursor)}
              />
            </div>

            <aside className="side">
              {/* Calendar */}
              <JournalCalendar
                year={yearMonth[0]}
                month={yearMonth[1]}
                calendarData={calendarData}
                selectedDay={selectedDay}
                onSelectDay={setSelectedDay}
                onPrevMonth={() => shiftMonth(-1)}
                onNextMonth={() => shiftMonth(1)}
              />

              {/* Mood distribution */}
              <MoodDistribution
                month={yearMonth[1]}
                moodCounts={stats.moodCounts}
                totalInMonth={stats.totalInMonth}
              />
            </aside>
          </div>
        </div>
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
            className={`journal-dialog ${
              mode === 'create' || mode === 'edit'
                ? 'journal-dialog-editor'
                : ''
            }`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="journal-dialog-title"
            aria-busy={working || detailLoading}
            tabIndex={-1}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault()
                if (!working && (mode === 'create' || mode === 'edit')) {
                  void (mode === 'create' ? create() : revise())
                }
              }
            }}
          >
            <header className="journal-dialog-header">
              <div className="journal-dialog-header-left">
                <div className="journal-dialog-header-topline">
                  <span className="journal-dialog-kicker">
                    Nhật ký riêng tư
                  </span>
                  <div className="journal-privacy-badge">
                    <Lock size={12} aria-hidden="true" />
                    <span>Chỉ mình bạn xem được</span>
                  </div>
                </div>
                <h2 id="journal-dialog-title" className="journal-dialog-title">
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
                type="button"
                className="journal-dialog-close-btn"
                onClick={requestClose}
                disabled={working}
                aria-label="Đóng"
              >
                <X size={18} aria-hidden="true" />
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
              <div className="journal-editor-form">
                <div className="journal-editor-body">
                  {/* Cột trái: Chọn cảm xúc, Thời điểm ghi, Thẻ */}
                  <div className="journal-col-left">
                    {/* 1. Chọn cảm xúc (bắt buộc) */}
                    <fieldset
                      className="journal-mood-fieldset"
                      aria-describedby={
                        fieldErrors.mood ? 'journal-mood-error' : undefined
                      }
                      role="radiogroup"
                      aria-label="Bạn đang cảm thấy thế nào?"
                    >
                      <legend className="journal-field-title">
                        Bạn đang cảm thấy thế nào?{' '}
                        <span className="journal-required">*</span>
                      </legend>
                      <div className="journal-mood-grid">
                        {JOURNAL_MOODS.map((option, index) => {
                          const isSelected = mood === option.value
                          const MoodIcon = MOOD_ICONS[option.value]
                          return (
                            <label
                              key={option.value}
                              className={`journal-mood-card mood-${option.value.toLowerCase()} ${
                                isSelected ? 'selected' : ''
                              }`}
                            >
                              <input
                                ref={index === 0 ? firstMoodRef : undefined}
                                type="radio"
                                name="journal-mood"
                                value={option.value}
                                checked={isSelected}
                                aria-checked={isSelected}
                                onChange={() => {
                                  updateMood(option.value)
                                  setFieldErrors((current) => ({
                                    ...current,
                                    mood: undefined,
                                  }))
                                }}
                              />
                              <span
                                className="journal-mood-icon"
                                aria-hidden="true"
                              >
                                <MoodIcon size={22} strokeWidth={1.8} />
                              </span>
                              <strong className="journal-mood-name">
                                {option.label}
                              </strong>
                            </label>
                          )
                        })}
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

                    {/* 2. Thời điểm ghi */}
                    {mode === 'create' && (
                      <div className="journal-time-field">
                        <div className="journal-field-header-row">
                          <label
                            htmlFor="journal-occurred-at"
                            className="journal-field-title"
                          >
                            Thời điểm ghi
                          </label>
                          <button
                            type="button"
                            className="journal-btn-set-now"
                            onClick={() => {
                              const nowFormatted = formatJournalLocalDateTime(
                                new Date(),
                              )
                              setOccurredAt(nowFormatted)
                              setFieldErrors((current) => ({
                                ...current,
                                occurredAt: undefined,
                              }))
                            }}
                            title="Đặt lại về thời điểm hiện tại"
                          >
                            <Clock size={12} aria-hidden="true" />
                            <span>Bây giờ</span>
                          </button>
                        </div>
                        <input
                          id="journal-occurred-at"
                          ref={occurredAtRef}
                          aria-label="Thời điểm ghi"
                          type="datetime-local"
                          value={occurredAt}
                          max={formatJournalLocalDateTime(new Date())}
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
                          className="journal-input-time"
                        />
                        {fieldErrors.occurredAt && (
                          <small
                            id="journal-occurred-error"
                            className="journal-field-error"
                          >
                            {fieldErrors.occurredAt}
                          </small>
                        )}
                      </div>
                    )}

                    {/* 3. Thẻ */}
                    <div className="journal-tags-section">
                      <div className="journal-field-header-row">
                        <label
                          htmlFor="journal-tags-input"
                          className="journal-field-title"
                        >
                          Thẻ do bạn đặt
                        </label>
                        <span className="journal-tags-count">
                          {tagsOf(tagText).length}/20 thẻ
                        </span>
                      </div>

                      {/* Chip gợi ý có icon */}
                      <div className="journal-preset-chips">
                        {PRESET_TAGS.map((preset) => {
                          const TagIcon = preset.icon
                          const currentTags = tagsOf(tagText)
                          const isPresetActive = currentTags.some(
                            (t) =>
                              t.toLowerCase() === preset.label.toLowerCase(),
                          )
                          return (
                            <button
                              type="button"
                              key={preset.id}
                              className={`journal-preset-chip ${
                                isPresetActive ? 'active' : ''
                              }`}
                              onClick={() => togglePresetTag(preset.label)}
                              aria-pressed={isPresetActive}
                            >
                              <TagIcon size={12} aria-hidden="true" />
                              <span>{preset.label}</span>
                            </button>
                          )
                        })}
                      </div>

                      {/* Danh sách thẻ đang chọn có nút xóa */}
                      {tagsOf(tagText).length > 0 && (
                        <div className="journal-selected-tags">
                          {tagsOf(tagText).map((tag) => (
                            <span key={tag} className="journal-selected-pill">
                              <span>#{tag}</span>
                              <button
                                type="button"
                                className="journal-tag-remove-btn"
                                onClick={() => removeTag(tag)}
                                aria-label={`Xóa thẻ ${tag}`}
                              >
                                <X size={11} aria-hidden="true" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Ô nhập thẻ */}
                      <input
                        id="journal-tags-input"
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
                        placeholder="Nhập thêm thẻ, ví dụ: thư giãn, đi dạo"
                        className="journal-input-tags"
                      />
                      <small
                        id="journal-tags-help"
                        className="journal-tags-help"
                      >
                        Phân cách bằng dấu phẩy hoặc Enter, tối đa 20 thẻ.
                      </small>
                      {fieldErrors.tags && (
                        <small
                          id="journal-tags-error"
                          className="journal-field-error"
                        >
                          {fieldErrors.tags}
                        </small>
                      )}
                    </div>
                  </div>

                  {/* Cột phải: gợi ý viết, ô nội dung, thanh đếm ký tự */}
                  <div className="journal-col-right">
                    {/* Banner hỗ trợ nhẹ nhàng khi chọn tâm trạng Không tốt hoặc Rất tệ */}
                    {(mood === 'LOW' || mood === 'VERY_LOW') && (
                      <div className="journal-support-banner" role="status">
                        <div
                          className="journal-support-banner-icon"
                          aria-hidden="true"
                        >
                          <HeartHandshake size={18} />
                        </div>
                        <p className="journal-support-banner-text">
                          Có những ngày cảm xúc trở nên nặng nề hơn bình thường.
                          Bạn không cần phải chịu đựng một mình — bạn luôn có
                          thể{' '}
                          <Link
                            href="/specialists"
                            className="journal-support-banner-link"
                          >
                            kết nối với chuyên gia
                          </Link>{' '}
                          để được lắng nghe và đồng hành.
                        </p>
                      </div>
                    )}

                    {/* Khối gợi ý viết */}
                    <section
                      className="journal-prompts-section"
                      aria-labelledby="journal-prompts-title"
                    >
                      <div className="journal-prompts-header">
                        <div>
                          <span className="journal-prompts-kicker">
                            Gợi ý viết
                          </span>
                          <h3 id="journal-prompts-title">
                            {moodCategory === 'positive'
                              ? 'Ghi lại những điều tích cực hôm nay'
                              : moodCategory === 'low'
                                ? 'Dành vài phút vỗ về cảm xúc của mình'
                                : 'Nếu bạn chưa biết bắt đầu từ đâu'}
                          </h3>
                        </div>
                        <button
                          type="button"
                          className="journal-btn-rotate-prompts"
                          onClick={handleRotatePrompts}
                          aria-label="Đổi gợi ý khác"
                        >
                          <RotateCw size={13} aria-hidden="true" />
                          <span>Gợi ý khác</span>
                        </button>
                      </div>
                      <div className="journal-prompt-options">
                        {currentDisplayedPrompts.map((prompt) => (
                          <button
                            type="button"
                            key={prompt}
                            className="journal-prompt-chip"
                            onClick={() => handleInsertPrompt(prompt)}
                            title="Chèn gợi ý này vào nội dung"
                          >
                            <span>{prompt}</span>
                          </button>
                        ))}
                      </div>
                    </section>

                    {/* Ô nội dung tự giãn */}
                    <div className="journal-content-section">
                      <div className="journal-field-header-row">
                        <label
                          htmlFor="journal-content-textarea"
                          className="journal-field-title"
                        >
                          Nội dung <span className="journal-required">*</span>
                        </label>
                      </div>
                      <textarea
                        id="journal-content-textarea"
                        ref={textAreaRef}
                        aria-label="Nội dung"
                        aria-invalid={Boolean(fieldErrors.text)}
                        aria-describedby={
                          fieldErrors.text ? 'journal-text-error' : undefined
                        }
                        data-dialog-initial-focus
                        value={text}
                        maxLength={12_000}
                        placeholder={
                          currentDisplayedPrompts[0] ||
                          JOURNAL_PROMPTS[promptIndex]
                        }
                        onChange={(event) => {
                          setText(event.target.value)
                          setFieldErrors((current) => ({
                            ...current,
                            text: undefined,
                          }))
                        }}
                        className="journal-content-textarea"
                      />

                      {/* Thanh tiến độ mảnh & đếm ký tự */}
                      <div className="journal-textarea-footer">
                        <div className="journal-char-progress-track">
                          <div
                            className={`journal-char-progress-bar ${
                              text.length > 11_000 ? 'near-limit' : ''
                            }`}
                            style={{
                              width: `${Math.min(
                                100,
                                (text.length / 12_000) * 100,
                              )}%`,
                            }}
                          />
                        </div>
                        <div className="journal-field-meta">
                          {fieldErrors.text ? (
                            <small
                              id="journal-text-error"
                              className="journal-field-error"
                            >
                              {fieldErrors.text}
                            </small>
                          ) : (
                            <span />
                          )}
                          <small className="journal-char-count">
                            {new Intl.NumberFormat('vi-VN').format(text.length)}{' '}
                            / 12.000 ký tự
                          </small>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer cố định */}
                <footer className="journal-editor-footer">
                  <div className="journal-footer-meta">
                    <p className="journal-draft-state" role="status">
                      {working
                        ? 'Đang lưu thay đổi an toàn…'
                        : dirty
                          ? 'Có thay đổi chưa lưu. Bản nháp chỉ được giữ trên màn hình này.'
                          : 'Chưa có thay đổi mới.'}
                    </p>
                    <span className="journal-shortcut-hint">
                      Nhấn <kbd>Ctrl</kbd> + <kbd>Enter</kbd> để lưu
                    </span>
                  </div>
                  <div className="journal-footer-actions">
                    <button
                      type="button"
                      className="journal-btn-cancel"
                      onClick={requestClose}
                      disabled={working}
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      className="journal-btn-save"
                      onClick={() =>
                        void (mode === 'create' ? create() : revise())
                      }
                      disabled={working}
                      data-ready={Boolean(mood && text.trim().length > 0)}
                    >
                      {working ? 'Đang lưu…' : 'Lưu nhật ký'}
                    </button>
                  </div>
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
    </div>
  )
}
