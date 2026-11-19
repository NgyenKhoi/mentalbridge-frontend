'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  readSummaryDraft,
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

export function SessionNotesPanel({
  appointmentId,
}: {
  appointmentId: string
}) {
  const [values, setValues] = useState<Values>(empty)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)
  const edited = useRef(false)
  const bodyId = useId()

  useEffect(() => {
    const draft = readSummaryDraft(appointmentId)
    if (!draft) return
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
    if (!edited.current) return
    const save = () => writeSummaryDraft(appointmentId, values)
    const timer = setTimeout(() => {
      const ok = save()
      setFailed(!ok)
      if (ok) setSavedAt(Date.now())
    }, SAVE_DELAY_MS)
    // A closing window must not lose the last keystrokes.
    window.addEventListener('pagehide', save)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('pagehide', save)
    }
  }, [appointmentId, values])

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
        Ghi chú phiên
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      <div id={bodyId} className={styles.body} data-open={open}>
        <p className={styles.notice}>
          Ghi chú được lưu tạm trên máy này cho tới khi bạn xuất bản tổng kết.
        </p>
        {FIELDS.map((field) => {
          const text = values[field.name]
          const count =
            'max' in field
              ? `${text.length}/${field.max}`
              : `${lineCount(text)}/${field.lines} mục`
          const over = 'lines' in field && lineCount(text) > field.lines
          return (
            <label className={styles.field} key={field.name}>
              <span className={styles.labelLine}>
                {field.label}
                <small data-over={over}>{count}</small>
              </span>
              {'hint' in field && (
                <small className={styles.hint}>{field.hint}</small>
              )}
              <textarea
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
            </label>
          )
        })}
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
      </div>
    </aside>
  )
}
