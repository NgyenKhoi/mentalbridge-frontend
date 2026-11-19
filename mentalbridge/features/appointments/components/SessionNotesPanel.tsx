'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { ChevronDown, Trash2 } from 'lucide-react'
import { useFeedback } from '@/components/ui/FeedbackProvider'
import {
  clearSummaryDraft,
  hasSummaryDraft,
  readSummaryDraft,
  summaryDraftKey,
  writeSummaryDraft,
} from '../model/session-summary-draft'
import styles from './SessionNotesPanel.module.css'

const SAVE_DELAY_MS = 600
const FIELDS = [
  {
    name: 'topics',
    label: 'Nội dung đã trao đổi',
    hint: 'Mỗi dòng một mục, tối đa 8 mục',
    rows: 3,
    lines: 8,
  },
  {
    name: 'progress',
    label: 'Điều đã ghi nhận trong phiên',
    rows: 3,
    max: 1000,
  },
  { name: 'note', label: 'Lời nhắn cho người dùng', rows: 3, max: 1000 },
  {
    name: 'steps',
    label: 'Các bước đã thống nhất',
    hint: 'Mỗi dòng một bước, tối đa 8 bước',
    rows: 3,
    lines: 8,
  },
] as const
type Values = Record<(typeof FIELDS)[number]['name'], string>
const empty: Values = { topics: '', progress: '', note: '', steps: '' }

const lineCount = (text: string) =>
  text.split('\n').filter((line) => line.trim()).length
const hasText = (values: Values) =>
  Object.values(values).some((value) => value.trim())

export function SessionNotesPanel({
  appointmentId,
}: {
  appointmentId: string
}) {
  const { confirm } = useFeedback()
  const [values, setValues] = useState<Values>(empty)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)
  const edited = useRef(false)
  // True while this panel's own draft is in storage. If the entry vanishes while
  // it is true, the summary was published (or the notes deleted) elsewhere.
  const stored = useRef(false)
  const bodyId = useId()
  const fieldId = useId()

  const reset = useCallback(() => {
    edited.current = false
    stored.current = false
    setValues(empty)
    setSavedAt(null)
    setFailed(false)
  }, [])

  useEffect(() => {
    const draft = readSummaryDraft(appointmentId)
    if (!draft) return
    stored.current = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage exists only after mount
    setValues({
      topics: draft.topics,
      progress: draft.progress,
      note: draft.note,
      steps: draft.steps,
    })
    setSavedAt(draft.savedAt)
  }, [appointmentId])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (
        stored.current &&
        (event.key === null || event.key === summaryDraftKey(appointmentId)) &&
        !hasSummaryDraft(appointmentId)
      )
        reset()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [appointmentId, reset])

  useEffect(() => {
    if (!edited.current) return
    // Never recreate a draft that publishing (or "Xóa ghi chú") removed.
    const save = () => {
      if (stored.current && !hasSummaryDraft(appointmentId)) {
        reset()
        return false
      }
      const ok = writeSummaryDraft(appointmentId, values)
      if (ok) stored.current = hasText(values)
      return ok
    }
    const timer = setTimeout(() => {
      const ok = save()
      if (!edited.current) return
      setFailed(!ok)
      if (ok) setSavedAt(Date.now())
    }, SAVE_DELAY_MS)
    // A closing window must not lose the last keystrokes.
    window.addEventListener('pagehide', save)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('pagehide', save)
    }
  }, [appointmentId, values, reset])

  async function deleteNotes() {
    const accepted = await confirm({
      title: 'Xóa ghi chú phiên?',
      description:
        'Ghi chú lưu tạm trên máy này sẽ bị xóa và không thể khôi phục.',
      confirmLabel: 'Xóa ghi chú',
      cancelLabel: 'Giữ lại',
      tone: 'danger',
    })
    if (!accepted) return
    clearSummaryDraft(appointmentId)
    reset()
  }

  const notes = hasText(values)

  return (
    <aside className={styles.notes} aria-label="Ghi chú phiên">
      <h2 className={styles.title}>Ghi chú phiên</h2>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((value) => !value)}
      >
        <span>
          Ghi chú phiên
          {notes && <small className={styles.present}>Đang có ghi chú</small>}
        </span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      <div id={bodyId} className={styles.body} data-open={open}>
        <p className={styles.notice}>
          Ghi chú được lưu tạm trên máy này cho tới khi bạn xuất bản tổng kết
          hoặc tối đa 48 giờ. Người khác dùng chung trình duyệt này có thể đọc
          được.
        </p>
        {FIELDS.map((field) => {
          const text = values[field.name]
          const count =
            'max' in field
              ? `${text.length}/${field.max}`
              : `${lineCount(text)}/${field.lines} mục`
          const over = 'lines' in field && lineCount(text) > field.lines
          const id = `${fieldId}-${field.name}`
          return (
            <div className={styles.field} key={field.name}>
              <div className={styles.labelLine}>
                <label htmlFor={id}>{field.label}</label>
                <small id={`${id}-count`} aria-live="off" data-over={over}>
                  {count}
                </small>
              </div>
              {'hint' in field && (
                <small id={`${id}-hint`} className={styles.hint}>
                  {field.hint}
                </small>
              )}
              <textarea
                id={id}
                aria-describedby={
                  'hint' in field ? `${id}-hint ${id}-count` : `${id}-count`
                }
                value={text}
                rows={field.rows}
                maxLength={'max' in field ? field.max : undefined}
                onChange={(event) => {
                  edited.current = true
                  setValues((current) => ({
                    ...current,
                    [field.name]: event.target.value,
                  }))
                }}
              />
            </div>
          )
        })}
        <div className={styles.footer}>
          <p
            className={styles.status}
            role="status"
            data-failed={failed || undefined}
          >
            {failed
              ? 'Chưa lưu tạm được trên máy này. Hãy sao chép ghi chú trước khi đóng cửa sổ.'
              : savedAt
                ? `Đã lưu tạm lúc ${new Intl.DateTimeFormat('vi-VN', {
                    timeZone: 'Asia/Ho_Chi_Minh',
                    hour: '2-digit',
                    minute: '2-digit',
                  }).format(new Date(savedAt))}`
                : ''}
          </p>
          <button
            type="button"
            className={styles.delete}
            disabled={!notes}
            onClick={() => void deleteNotes()}
          >
            <Trash2 size={16} aria-hidden="true" />
            Xóa ghi chú
          </button>
        </div>
      </div>
    </aside>
  )
}
