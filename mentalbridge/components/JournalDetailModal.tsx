'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import './JournalDetailModal.css'

export type JournalEntry = {
  id: number
  date: string
  time: string
  mood: number
  content: string
  tags: string[]
  psychologyAnswers?: Record<string, string>
}

type JournalDetailModalProps = {
  isOpen: boolean
  onClose: () => void
  entry: JournalEntry | null
  onUpdate: (entry: JournalEntry) => void
  onDelete: (id: number) => void
}

const MOODS = [
  { emoji: '😊', label: 'Tuyệt vời', value: 5, tone: 'deep' },
  { emoji: '🙂', label: 'Tốt', value: 4, tone: 'teal' },
  { emoji: '😐', label: 'Bình thường', value: 3, tone: 'amber' },
  { emoji: '😔', label: 'Không tốt', value: 2, tone: 'terra' },
  { emoji: '😢', label: 'Rất tệ', value: 1, tone: 'lavender' },
]

const QUESTIONS = [
  { id: 'trigger', label: 'Điều gì đã khiến bạn cảm thấy như vậy?', placeholder: 'Một cuộc trò chuyện, sự kiện hoặc suy nghĩ...' },
  { id: 'physical', label: 'Cơ thể bạn phản ứng như thế nào?', placeholder: 'Căng ở vai, tim đập nhanh, mệt mỏi...' },
  { id: 'thought', label: 'Bạn đang nghĩ gì lúc này?', placeholder: 'Những suy nghĩ đang lặp lại trong đầu bạn...' },
  { id: 'need', label: 'Điều bạn cần lúc này là gì?', placeholder: 'Được lắng nghe, thời gian một mình, một cái ôm...' },
]

type ModalMode = 'view' | 'edit' | 'delete'

export default function JournalDetailModal({ isOpen, onClose, entry, onUpdate, onDelete }: JournalDetailModalProps) {
  const [mode, setMode] = useState<ModalMode>('view')
  const [draft, setDraft] = useState<JournalEntry | null>(entry)
  const [tagText, setTagText] = useState('')
  const [isWorking, setIsWorking] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return

    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || isWorking) return
      if (mode === 'view') onClose()
      else setMode('view')
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isOpen, isWorking, mode, onClose])

  if (!entry || !draft) return null

  const mood = MOODS.find(item => item.value === draft.mood) ?? MOODS[2]
  const formatDate = (dateValue: string) => new Date(`${dateValue}T12:00:00`).toLocaleDateString('vi-VN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const cancelEdit = () => {
    setDraft(entry)
    setTagText(entry.tags.join(', '))
    setError('')
    setMode('view')
  }

  const handleUpdate = async () => {
    if (!draft.content.trim()) {
      setError('Vui lòng nhập nội dung nhật ký.')
      return
    }

    setIsWorking(true)
    setError('')
    await new Promise(resolve => setTimeout(resolve, 700))
    const updatedEntry = {
      ...draft,
      content: draft.content.trim(),
      tags: tagText.split(',').map(tag => tag.trim().replace(/^#/, '')).filter(Boolean),
    }
    setDraft(updatedEntry)
    onUpdate(updatedEntry)
    setIsWorking(false)
    setMode('view')
  }

  const handleDelete = async () => {
    setIsWorking(true)
    await new Promise(resolve => setTimeout(resolve, 700))
    onDelete(entry.id)
    setIsWorking(false)
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div className="journal-detail-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => mode === 'view' && !isWorking && onClose()} />
          <motion.div className="journal-detail-shell">
            <motion.section className="journal-detail-modal" role="dialog" aria-modal="true" aria-labelledby="journal-detail-title" initial={{ opacity: 0, scale: 0.96, y: 22 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 22 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}>
              <AnimatePresence mode="wait" initial={false}>
                {mode === 'delete' ? (
                  <motion.div className="journal-delete-confirm" key="delete" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <span className="journal-danger-kicker">Xác nhận thao tác</span>
                    <div className="delete-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 6h18M8 6V4h8v2m3 0-1 15H6L5 6m5 4v7m4-7v7" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
                    <h2 id="journal-detail-title">Xóa nhật ký này?</h2>
                    <p>Nhật ký ngày <strong>{formatDate(entry.date)}</strong> sẽ bị xóa vĩnh viễn. Hành động này không thể hoàn tác.</p>
                    <div className="delete-actions"><button className="detail-btn detail-btn-secondary" onClick={() => setMode('view')} disabled={isWorking}>Giữ lại nhật ký</button><button className="detail-btn detail-btn-danger" onClick={handleDelete} disabled={isWorking}>{isWorking ? 'Đang xóa...' : 'Xóa vĩnh viễn'}</button></div>
                  </motion.div>
                ) : (
                  <motion.div key={mode} initial={{ opacity: 0, x: mode === 'edit' ? 16 : -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}>
                    <header className="journal-detail-header">
                      <div className="journal-detail-heading">
                        <span className="journal-detail-eyebrow">{mode === 'edit' ? 'Cập nhật nhật ký' : 'Chi tiết nhật ký'}</span>
                        <div className={`journal-detail-mood ${mood.tone}`}><span className="mood-emoji" aria-hidden="true">{mood.emoji}</span><div><h2 id="journal-detail-title">{mood.label}</h2><time>{formatDate(draft.date)} <span>·</span> {draft.time}</time></div></div>
                      </div>
                      <button className="journal-detail-close" onClick={mode === 'edit' ? cancelEdit : onClose} aria-label={mode === 'edit' ? 'Hủy chỉnh sửa' : 'Đóng'}>×</button>
                    </header>

                    {mode === 'view' ? (
                      <div className="journal-detail-content">
                        <section className="journal-detail-section journal-note-section"><span className="detail-section-number">01</span><div><h3>Ghi chú trong ngày</h3><p className="journal-detail-text">{draft.content}</p></div></section>
                        {draft.psychologyAnswers && Object.values(draft.psychologyAnswers).some(Boolean) && (
                          <section className="journal-detail-section"><span className="detail-section-number">02</span><div className="detail-section-body"><h3>Nhìn sâu hơn</h3><div className="psychology-answers">{QUESTIONS.filter(question => draft.psychologyAnswers?.[question.id]).map(question => <div key={question.id} className="psychology-answer-item"><strong>{question.label}</strong><p>{draft.psychologyAnswers?.[question.id]}</p></div>)}</div></div></section>
                        )}
                        {draft.tags.length > 0 && <div className="journal-tags">{draft.tags.map(tag => <span key={tag}>#{tag}</span>)}</div>}
                      </div>
                    ) : (
                      <div className="journal-edit-content">
                        <fieldset className="journal-edit-moods"><legend>Cảm xúc của bạn</legend><div>{MOODS.map(item => <button type="button" key={item.value} className={draft.mood === item.value ? 'selected' : ''} onClick={() => setDraft({ ...draft, mood: item.value })} aria-pressed={draft.mood === item.value}><span>{item.emoji}</span><small>{item.label}</small></button>)}</div></fieldset>
                        <label className="journal-edit-field"><span>Ghi chú</span><textarea value={draft.content} maxLength={1000} onChange={event => setDraft({ ...draft, content: event.target.value })} /><small>{draft.content.length}/1000</small></label>
                        {error && <p className="journal-edit-error" role="alert">{error}</p>}
                        <div className="journal-edit-reflection"><div><span aria-hidden="true">✦</span><div><h3>Khám phá sâu hơn</h3><p>Bạn có thể bỏ trống những câu chưa muốn trả lời.</p></div></div>{QUESTIONS.map(question => <label key={question.id}><span>{question.label}</span><textarea rows={2} placeholder={question.placeholder} value={draft.psychologyAnswers?.[question.id] ?? ''} onChange={event => setDraft({ ...draft, psychologyAnswers: { ...draft.psychologyAnswers, [question.id]: event.target.value } })} /></label>)}</div>
                        <label className="journal-edit-field journal-tag-field"><span>Chủ đề</span><input value={tagText} onChange={event => setTagText(event.target.value)} placeholder="work, exercise, sleep" /><small>Phân cách bằng dấu phẩy</small></label>
                      </div>
                    )}

                    <footer className="journal-detail-actions">
                      {mode === 'view' ? <><button className="detail-btn detail-btn-danger-text" onClick={() => setMode('delete')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 6h18M8 6V4h8v2m3 0-1 15H6L5 6m5 4v7m4-7v7" strokeLinecap="round" strokeLinejoin="round" /></svg>Xóa nhật ký</button><button className="detail-btn detail-btn-primary" onClick={() => setMode('edit')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m4 16-1 5 5-1L20 8l-4-4L4 16Z" strokeLinecap="round" strokeLinejoin="round" /><path d="m14 6 4 4" /></svg>Chỉnh sửa</button></> : <><button className="detail-btn detail-btn-secondary" onClick={cancelEdit} disabled={isWorking}>Hủy thay đổi</button><button className="detail-btn detail-btn-primary" onClick={handleUpdate} disabled={isWorking}>{isWorking ? 'Đang lưu...' : 'Lưu thay đổi'}</button></>}
                    </footer>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.section>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
