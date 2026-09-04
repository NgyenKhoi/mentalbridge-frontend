'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import JournalDetailModal, {
  type JournalEntry,
} from '../../../components/JournalDetailModal'
import './journal.css'

const MOODS = [
  { emoji: '😊', label: 'Tuyệt vời', value: 5, tone: 'deep' },
  { emoji: '🙂', label: 'Tốt', value: 4, tone: 'teal' },
  { emoji: '😐', label: 'Bình thường', value: 3, tone: 'amber' },
  { emoji: '😔', label: 'Không tốt', value: 2, tone: 'terra' },
  { emoji: '😢', label: 'Rất tệ', value: 1, tone: 'lavender' },
]

const PSYCHOLOGY_QUESTIONS = [
  {
    id: 'trigger',
    label: 'Điều gì đã khiến bạn cảm thấy như vậy?',
    placeholder:
      'Ví dụ: Một cuộc trò chuyện, một sự kiện, hoặc suy nghĩ nào đó...',
  },
  {
    id: 'physical',
    label: 'Cơ thể bạn phản ứng như thế nào?',
    placeholder: 'Ví dụ: Căng thẳng ở vai, tim đập nhanh, mệt mỏi...',
  },
  {
    id: 'thought',
    label: 'Bạn đang nghĩ gì lúc này?',
    placeholder: 'Chia sẻ những suy nghĩ đang lặp đi lặp lại trong đầu bạn...',
  },
  {
    id: 'need',
    label: 'Điều bạn cần lúc này là gì?',
    placeholder: 'Ví dụ: Được lắng nghe, thời gian một mình, một cái ôm...',
  },
]
const ENTRIES: JournalEntry[] = [
  {
    id: 1,
    date: '2026-08-13',
    time: '20:30',
    mood: 4,
    content:
      'Hôm nay làm việc hiệu quả, hoàn thành được 3 task quan trọng. Buổi tối đi bộ 30 phút, cảm thấy thoải mái hơn.',
    tags: ['work', 'exercise'],
    psychologyAnswers: {
      trigger: 'Hoàn thành những việc đã trì hoãn trong tuần.',
      physical: 'Vai nhẹ hơn, nhịp thở đều sau khi đi bộ.',
      need: 'Một buổi tối yên tĩnh để nghỉ ngơi.',
    },
  },
  {
    id: 2,
    date: '2026-08-12',
    time: '21:15',
    mood: 3,
    content:
      'Ngày bình thường, có chút áp lực deadline nhưng vẫn kiểm soát được. Ngủ trưa 20 phút giúp tỉnh táo hơn.',
    tags: ['work', 'sleep'],
  },
  {
    id: 3,
    date: '2026-08-11',
    time: '19:45',
    mood: 5,
    content:
      'Gặp bạn bè sau một thời gian dài, cười rất nhiều. Cảm giác được kết nối lại thật tuyệt vời!',
    tags: ['social', 'happy'],
  },
]
const topicCounts = [
  ['work', 8],
  ['exercise', 5],
  ['sleep', 4],
  ['social', 3],
  ['happy', 3],
]

export default function JournalPage() {
  const [entries, setEntries] = useState<JournalEntry[]>(ENTRIES)
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [selectedMood, setSelectedMood] = useState<number | null>(null)
  const [content, setContent] = useState('')
  const [psychologyAnswers, setPsychologyAnswers] = useState<
    Record<string, string>
  >({})
  const [isSaving, setIsSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (message: string) => {
    setToast(message)
    setTimeout(() => setToast(null), 3000)
  }

  const handleUpdateEntry = (updatedEntry: JournalEntry) => {
    setEntries((current) =>
      current.map((entry) =>
        entry.id === updatedEntry.id ? updatedEntry : entry,
      ),
    )
    setSelectedEntry(updatedEntry)
    showToast('Nhật ký đã được cập nhật.')
  }

  const handleDeleteEntry = (entryId: number) => {
    setEntries((current) => current.filter((entry) => entry.id !== entryId))
    setSelectedEntry(null)
    showToast('Nhật ký đã được xóa.')
  }

  useEffect(() => {
    if (!showModal) return

    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) setShowModal(false)
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', closeOnEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isSaving, showModal])

  const handleSave = async () => {
    if (!selectedMood) {
      setToast('Vui lòng chọn cảm xúc của bạn')
      setTimeout(() => setToast(null), 3000)
      return
    }
    if (!content.trim()) {
      setToast('Vui lòng viết ghi chú của bạn')
      setTimeout(() => setToast(null), 3000)
      return
    }

    setIsSaving(true)
    try {
      // TODO: Kết nối API backend
      // const response = await fetch('/api/journal', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     mood: selectedMood,
      //     content,
      //     psychologyAnswers,
      //     date: new Date().toISOString()
      //   })
      // })

      // Giả lập lưu thành công
      await new Promise((resolve) => setTimeout(resolve, 1000))

      setToast('✓ Nhật ký đã được lưu thành công!')
      setTimeout(() => {
        setShowModal(false)
        setSelectedMood(null)
        setContent('')
        setPsychologyAnswers({})
        setToast(null)
      }, 1500)
    } catch {
      setToast('Có lỗi xảy ra. Vui lòng thử lại.')
      setTimeout(() => setToast(null), 3000)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="journal-page">
      <header className="journal-hero">
        <div>
          <span className="journal-eyebrow">Nhật ký cá nhân</span>
          <h1>Nhật ký cảm xúc</h1>
          <p>Ghi lại hành trình của bạn mỗi ngày.</p>
        </div>
        <button className="journal-new" onClick={() => setShowModal(true)}>
          <span>+</span>Viết nhật ký
        </button>
      </header>

      {/* Modal Popup */}
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div
              className="journal-modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
            />
            <motion.div
              className="journal-modal-shell"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <div
                className="journal-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="journal-modal-title"
              >
                <div className="journal-modal-header">
                  <div>
                    <span className="journal-modal-eyebrow">
                      Check-in hôm nay
                    </span>
                    <h2 id="journal-modal-title">Bạn đang cảm thấy thế nào?</h2>
                  </div>
                  <button
                    className="journal-modal-close"
                    onClick={() => setShowModal(false)}
                    aria-label="Đóng"
                  >
                    ×
                  </button>
                </div>

                <div className="journal-modal-content">
                  <div className="journal-moods">
                    {MOODS.map((mood) => (
                      <button
                        key={mood.value}
                        className={`${mood.tone} ${selectedMood === mood.value ? 'selected' : ''}`}
                        onClick={() => setSelectedMood(mood.value)}
                      >
                        <span>{mood.emoji}</span>
                        <small>{mood.label}</small>
                      </button>
                    ))}
                  </div>

                  <label className="journal-field">
                    <span>Ghi chú của bạn</span>
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Viết về ngày của bạn..."
                      maxLength={1000}
                    />
                  </label>

                  <div className="journal-psychology-section">
                    <div className="journal-psychology-header">
                      <span className="journal-psychology-icon">💭</span>
                      <div>
                        <h3>Khám phá sâu hơn</h3>
                        <p>
                          Những câu hỏi này giúp bạn hiểu rõ hơn về cảm xúc của
                          mình
                        </p>
                      </div>
                    </div>

                    {PSYCHOLOGY_QUESTIONS.map((question) => (
                      <label key={question.id} className="journal-psych-field">
                        <span>{question.label}</span>
                        <textarea
                          value={psychologyAnswers[question.id] || ''}
                          onChange={(e) =>
                            setPsychologyAnswers((prev) => ({
                              ...prev,
                              [question.id]: e.target.value,
                            }))
                          }
                          placeholder={question.placeholder}
                          rows={2}
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="journal-modal-footer">
                  <span className="journal-char-count">
                    {content.length}/1000
                  </span>
                  <div className="journal-modal-actions">
                    <button
                      className="btn-ghost"
                      onClick={() => setShowModal(false)}
                      disabled={isSaving}
                    >
                      Hủy
                    </button>
                    <button
                      className="btn-primary"
                      onClick={handleSave}
                      disabled={isSaving}
                    >
                      {isSaving ? 'Đang lưu...' : 'Lưu nhật ký'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {selectedEntry && (
        <JournalDetailModal
          key={selectedEntry.id}
          isOpen
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
          onUpdate={handleUpdateEntry}
          onDelete={handleDeleteEntry}
        />
      )}

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className="journal-toast"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="journal-layout">
        <section className="journal-stream" aria-label="Các nhật ký gần đây">
          <div className="journal-section-head">
            <div>
              <span>Dòng thời gian</span>
              <h2>Những ngày gần đây</h2>
            </div>
            <span className="journal-period">Tháng 8</span>
          </div>
          <div className="journal-timeline">
            {entries.length === 0 && (
              <div className="journal-empty">
                <span aria-hidden="true">✦</span>
                <h3>Trang nhật ký đang chờ bạn</h3>
                <p>
                  Viết một dòng về cảm xúc hôm nay để bắt đầu lại dòng thời
                  gian.
                </p>
                <button onClick={() => setShowModal(true)}>
                  Viết nhật ký mới
                </button>
              </div>
            )}
            {entries.map((entry, index) => {
              const mood = MOODS.find((item) => item.value === entry.mood)!
              return (
                <motion.article
                  className="journal-entry"
                  key={entry.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08 }}
                >
                  <div className={`journal-node ${mood.tone}`}>
                    <span>{mood.emoji}</span>
                  </div>
                  <div
                    className="journal-entry-card"
                    role="button"
                    tabIndex={0}
                    aria-label={`Xem chi tiết nhật ký ${entry.date}`}
                    onClick={() => setSelectedEntry(entry)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSelectedEntry(entry)
                      }
                    }}
                  >
                    <header>
                      <div>
                        <h3>
                          {new Date(
                            `${entry.date}T12:00:00`,
                          ).toLocaleDateString('vi-VN', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </h3>
                        <p>
                          <span>◷</span>
                          {entry.time}
                        </p>
                      </div>
                      <span className={`journal-mood ${mood.tone}`}>
                        {mood.label}
                      </span>
                    </header>
                    <p className="journal-copy">{entry.content}</p>
                    <footer>
                      {entry.tags.map((tag) => (
                        <span key={tag}>#{tag}</span>
                      ))}
                      <span className="journal-view-cue">
                        Xem chi tiết <b>→</b>
                      </span>
                    </footer>
                  </div>
                </motion.article>
              )
            })}
          </div>
        </section>
        <aside className="journal-insights">
          <section className="journal-month">
            <span className="journal-orb" />
            <header>
              <span>Tổng quan</span>
              <h2>Tháng 8</h2>
            </header>
            <div>
              <article>
                <small>Số ngày ghi</small>
                <strong>
                  14<em>/31</em>
                </strong>
                <span>45% tháng này</span>
              </article>
              <article>
                <small>Cảm xúc nổi bật</small>
                <strong className="mood">
                  🙂 <em>Tốt</em>
                </strong>
                <span>Xu hướng tích cực</span>
              </article>
            </div>
            <div className="journal-progress">
              <i />
            </div>
          </section>
          <section className="journal-topics">
            <header>
              <span>Chủ đề</span>
              <h2>Thường xuất hiện</h2>
            </header>
            <div>
              {topicCounts.map(([topic, count], index) => (
                <span className={index === 0 ? 'active' : ''} key={topic}>
                  #{topic}
                  <b>{count}</b>
                </span>
              ))}
            </div>
          </section>
          <section className="journal-prompt">
            <span>✶</span>
            <div>
              <small>Gợi ý hôm nay</small>
              <p>Điều gì đã mang lại cho bạn một khoảnh khắc bình yên?</p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              aria-label="Viết theo gợi ý"
            >
              →
            </button>
          </section>
        </aside>
      </div>
    </div>
  )
}
