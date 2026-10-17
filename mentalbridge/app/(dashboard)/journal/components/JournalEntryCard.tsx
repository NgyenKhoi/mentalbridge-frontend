'use client'

import React, { useState } from 'react'
import type { JournalSummary } from '@/lib/journal/journal-contract'
import { MOOD_DEFINITIONS } from '../types'
import { toTimeStr } from '../hooks/useJournalTimeline'

interface JournalEntryCardProps {
  entry: JournalSummary
  onOpenDetail: (entry: JournalSummary, target: HTMLElement) => void
}

export function JournalEntryCard({
  entry,
  onOpenDetail,
}: JournalEntryCardProps) {
  const [isOpen, setIsOpen] = useState(false)

  const moodMeta = entry.mood
    ? MOOD_DEFINITIONS[entry.mood]
    : MOOD_DEFINITIONS.OKAY
  const entryDate = new Date(entry.occurredAt)
  const timeStr = toTimeStr(entryDate)
  const text = entry.content.preview || ''

  // Check if first line looks like a prompt question
  const lines = text.split('\n')
  const hasPromptQuestion = lines.length > 1 && lines[0].trim().endsWith('?')
  const promptQuestion = hasPromptQuestion ? lines[0].trim() : null
  const bodyText = hasPromptQuestion ? lines.slice(1).join('\n').trim() : text

  // Hide "Đọc tiếp" if content is short and doesn't get clipped
  const isShort = text.length <= 130 && lines.length <= 2

  return (
    <article
      className={`card it ${isOpen ? 'open' : ''}`}
      style={{ '--c': moodMeta.color } as React.CSSProperties}
    >
      <div className="meta">
        <span className="entry-time">{timeStr}</span>
        <span className="mood">
          <i style={{ backgroundColor: moodMeta.color }} aria-hidden="true" />
          <span>{moodMeta.label}</span>
        </span>
      </div>

      <div className="tx">
        {promptQuestion && <p className="prompt-question">{promptQuestion}</p>}
        <p className="entry-body">
          {bodyText.split('\n').map((line, idx) => (
            <React.Fragment key={idx}>
              {line}
              {idx < bodyText.split('\n').length - 1 && <br />}
            </React.Fragment>
          ))}
        </p>
      </div>

      <div className="foot">
        <div className="tags-row">
          {entry.tags.map((tag) => (
            <span key={tag} className="tag">
              #{tag}
            </span>
          ))}
        </div>
        <div className="entry-actions">
          {!isShort && (
            <button
              type="button"
              className="more"
              onClick={() => setIsOpen((prev) => !prev)}
              aria-expanded={isOpen}
            >
              {isOpen ? 'Thu gọn' : 'Đọc tiếp'}
            </button>
          )}
          <button
            type="button"
            className="detail-btn"
            onClick={(e) => onOpenDetail(entry, e.currentTarget)}
          >
            Xem chi tiết
          </button>
        </div>
      </div>
    </article>
  )
}
