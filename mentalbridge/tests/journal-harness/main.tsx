import { StrictMode, useState, useRef } from 'react'
import { createRoot } from 'react-dom/client'
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

import '../../app/globals.css'
import '../../app/(dashboard)/dashboard.css'
import '../../app/(dashboard)/dashboard-shell.css'
import '../../app/(dashboard)/journal/journal.css'

import type { JournalMood } from '@/lib/journal/journal-contract'
import {
  JOURNAL_MOODS,
  MOOD_PROMPTS,
  getMoodCategory,
} from '@/features/journal/authoring'

const MOOD_ICONS: Record<
  JournalMood,
  React.ComponentType<{ size?: number; className?: string }>
> = {
  GREAT: Laugh,
  GOOD: Smile,
  OKAY: Meh,
  LOW: Frown,
  VERY_LOW: CloudRain,
}

const PRESET_TAGS: Array<{
  label: string
  icon: React.ComponentType<{ size?: number }>
}> = [
  { label: 'Công việc', icon: Briefcase },
  { label: 'Gia đình', icon: Users },
  { label: 'Học tập', icon: GraduationCap },
  { label: 'Các mối quan hệ', icon: HeartHandshake },
  { label: 'Sức khỏe', icon: Activity },
  { label: 'Giấc ngủ', icon: Moon },
]

function JournalHarness() {
  const [isOpen, setIsOpen] = useState(true)
  const [mood, setMood] = useState<JournalMood>('LOW')
  const [occurredAt, setOccurredAt] = useState('2026-09-30T21:30')
  const [tagText, setTagText] = useState('hôm nay, cảm xúc')
  const [content, setContent] = useState(
    'Hôm nay mình cảm thấy hơi mệt mỏi và quá tải với công việc...',
  )
  const [promptGroupIndex, setPromptGroupIndex] = useState(0)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const parsedTags = tagText
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)

  const handleAddTag = (label: string) => {
    if (!parsedTags.includes(label) && parsedTags.length < 20) {
      const next = [...parsedTags, label].join(', ')
      setTagText(next)
    }
  }

  const handleRemoveTag = (indexToRemove: number) => {
    const next = parsedTags.filter((_, i) => i !== indexToRemove).join(', ')
    setTagText(next)
  }

  const moodCategory = getMoodCategory(mood)
  const currentPrompts = MOOD_PROMPTS[moodCategory]
  const displayedPrompts = currentPrompts.slice(
    promptGroupIndex * 3,
    promptGroupIndex * 3 + 3,
  )

  const handleInsertPrompt = (promptText: string) => {
    setContent((prev) =>
      prev ? `${prev}\n\n${promptText} ` : `${promptText} `,
    )
    setTimeout(() => {
      textareaRef.current?.focus()
    }, 10)
  }

  const handleRotatePrompts = () => {
    setPromptGroupIndex((prev) => (prev === 0 ? 1 : 0))
  }

  const isLowMood = mood === 'LOW' || mood === 'VERY_LOW'
  const charLimit = 12000
  const charProgress = Math.min(100, (content.length / charLimit) * 100)

  return (
    <div style={{ padding: '2rem', background: '#f6f7f6', minHeight: '100vh' }}>
      <button
        onClick={() => setIsOpen(true)}
        style={{
          padding: '10px 20px',
          background: 'var(--teal-deep, #1b4d3e)',
          color: '#fff',
          borderRadius: '8px',
          border: 'none',
          cursor: 'pointer',
          fontWeight: 600,
        }}
      >
        Mở popup &quot;Viết nhật ký&quot;
      </button>

      {isOpen && (
        <div className="journal-dialog-backdrop">
          <div
            className="journal-dialog journal-dialog-editor"
            role="dialog"
            aria-modal="true"
            aria-labelledby="journal-dialog-title"
          >
            {/* Header */}
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
                  Viết nhật ký
                </h2>
              </div>
              <button
                type="button"
                className="journal-dialog-close-btn"
                onClick={() => setIsOpen(false)}
                aria-label="Đóng"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            {/* 2-Column Body */}
            <div className="journal-editor-form">
              <div className="journal-editor-body">
                {/* Left Column (~380px) */}
                <div className="journal-col-left">
                  {/* Mood Selection */}
                  <fieldset className="journal-mood-fieldset" role="radiogroup">
                    <legend className="journal-field-title">
                      Bạn đang cảm thấy thế nào?{' '}
                      <span className="journal-required">*</span>
                    </legend>
                    <div className="journal-mood-grid">
                      {JOURNAL_MOODS.map((option) => {
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
                              type="radio"
                              name="journal-mood"
                              value={option.value}
                              checked={isSelected}
                              onChange={() => {
                                setMood(option.value)
                                setPromptGroupIndex(0)
                              }}
                              className="sr-only"
                            />
                            <MoodIcon size={26} className="journal-mood-icon" />
                            <span className="journal-mood-label">
                              {option.label}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </fieldset>

                  {/* Occurred At */}
                  <div className="journal-time-section">
                    <label
                      htmlFor="journal-harness-time"
                      className="journal-field-title"
                    >
                      Thời điểm ghi
                    </label>
                    <div className="journal-time-row">
                      <div className="journal-time-input-wrap">
                        <Clock
                          size={16}
                          className="journal-time-icon"
                          aria-hidden="true"
                        />
                        <input
                          id="journal-harness-time"
                          type="datetime-local"
                          value={occurredAt}
                          onChange={(e) => setOccurredAt(e.target.value)}
                          className="journal-time-input"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const now = new Date()
                          setOccurredAt(now.toISOString().slice(0, 16))
                        }}
                        className="journal-time-now-btn"
                      >
                        Bây giờ
                      </button>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="journal-tags-section">
                    <div className="journal-tags-header">
                      <label
                        htmlFor="journal-harness-tags"
                        className="journal-field-title"
                      >
                        Thẻ chủ đề
                      </label>
                      <span className="journal-tags-counter">
                        {parsedTags.length} / 20
                      </span>
                    </div>

                    <div
                      className="journal-preset-tags"
                      role="group"
                      aria-label="Gợi ý thẻ"
                    >
                      {PRESET_TAGS.map((preset) => {
                        const active = parsedTags.includes(preset.label)
                        const Icon = preset.icon
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            className={`journal-preset-chip ${active ? 'active' : ''}`}
                            onClick={() => handleAddTag(preset.label)}
                          >
                            <Icon size={13} aria-hidden="true" />
                            <span>{preset.label}</span>
                          </button>
                        )
                      })}
                    </div>

                    {parsedTags.length > 0 && (
                      <div className="journal-active-tags-pills">
                        {parsedTags.map((tag, idx) => (
                          <span key={tag} className="journal-tag-pill">
                            #{tag}
                            <button
                              type="button"
                              onClick={() => handleRemoveTag(idx)}
                              aria-label={`Xóa thẻ ${tag}`}
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    <input
                      id="journal-harness-tags"
                      type="text"
                      value={tagText}
                      onChange={(e) => setTagText(e.target.value)}
                      placeholder="Thêm thẻ khác (phân cách bằng dấu phẩy)..."
                      className="journal-tags-input"
                    />
                  </div>
                </div>

                {/* Right Column */}
                <div className="journal-col-right">
                  {/* Support Banner when Low */}
                  {isLowMood && (
                    <aside
                      className="journal-support-banner"
                      role="complementary"
                    >
                      <div className="journal-support-banner-content">
                        <HeartHandshake
                          size={20}
                          className="journal-support-banner-icon"
                        />
                        <div>
                          <strong>
                            Bạn không phải trải qua điều này một mình
                          </strong>
                          <p>
                            Nếu bạn đang cảm thấy quá tải, hãy kết nối với
                            chuyên gia tâm lý để được lắng nghe và đồng hành.
                          </p>
                        </div>
                      </div>
                      <a
                        href="/specialists"
                        className="journal-support-banner-btn"
                      >
                        Tìm chuyên gia →
                      </a>
                    </aside>
                  )}

                  {/* Writing Prompts */}
                  <div className="journal-prompts-card">
                    <div className="journal-prompts-header">
                      <div>
                        <span className="journal-prompts-kicker">
                          Gợi ý viết
                        </span>
                        <h3
                          className="journal-field-title"
                          style={{ margin: '2px 0 0' }}
                        >
                          Dành vài phút vỗ về cảm xúc của mình
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={handleRotatePrompts}
                        className="journal-btn-rotate-prompts"
                        title="Đổi 3 gợi ý khác"
                      >
                        <RotateCw size={13} />
                        <span>Gợi ý khác</span>
                      </button>
                    </div>
                    <div className="journal-prompt-options">
                      {displayedPrompts.map((p, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className="journal-prompt-chip"
                          onClick={() => handleInsertPrompt(p)}
                        >
                          <span>&quot;{p}&quot;</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Textarea Area */}
                  <div className="journal-content-wrap">
                    <textarea
                      ref={textareaRef}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Chia sẻ bất cứ điều gì bạn đang suy nghĩ hoặc trải qua..."
                      className="journal-content-textarea"
                    />
                    <div className="journal-char-indicator">
                      <div className="journal-char-progress-track">
                        <div
                          className="journal-char-progress-bar"
                          style={{ width: `${charProgress}%` }}
                        />
                      </div>
                      <span className="journal-char-count">
                        {content.length.toLocaleString('vi-VN')} / 12.000 ký tự
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fixed Footer */}
              <footer className="journal-editor-footer">
                <div className="journal-footer-meta">
                  <span className="journal-draft-state">
                    Bản nháp đã lưu tự động
                  </span>
                  <span className="journal-shortcut-hint">
                    Nhấn <kbd>Ctrl</kbd> + <kbd>Enter</kbd> để lưu nhanh
                  </span>
                </div>
                <div className="journal-footer-actions">
                  <button
                    type="button"
                    className="journal-btn-cancel"
                    onClick={() => setIsOpen(false)}
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    className="journal-btn-save"
                    data-ready="true"
                    onClick={() => alert('Đã lưu thành công!')}
                  >
                    Lưu nhật ký
                  </button>
                </div>
              </footer>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <JournalHarness />
  </StrictMode>,
)
