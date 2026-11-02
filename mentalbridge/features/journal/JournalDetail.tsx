'use client'

import { useEffect, useRef } from 'react'
import { BookOpen, Clock3, PencilLine, Trash2 } from 'lucide-react'
import type { JournalEntry } from '@/lib/journal/journal-contract'
import { journalMood } from '@/features/journal/authoring'
import { JournalReflection } from './reflection/JournalReflection'
import styles from './JournalDetail.module.css'

export function JournalDetail({
  entry,
  onEdit,
  onDelete,
}: Readonly<{
  entry: JournalEntry
  onEdit: () => void
  onDelete: () => void
}>) {
  const root = useRef<HTMLDivElement>(null)
  const mood = journalMood(entry.mood)
  const date = new Date(entry.occurredAt)
  const paragraphs = entry.content.text.split(/\n\s*\n/).filter(Boolean)
  const wordCount = entry.content.text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length

  useEffect(() => {
    let disposed = false
    let revert: (() => void) | undefined
    void import('gsap').then(({ gsap }) => {
      if (disposed || !root.current) return
      const media = gsap.matchMedia()
      media.add(
        '(prefers-reduced-motion: no-preference)',
        () => {
          const targets = root.current?.querySelectorAll('[data-detail-reveal]')
          if (targets?.length)
            gsap.fromTo(
              targets,
              { opacity: 0, y: 14 },
              {
                opacity: 1,
                y: 0,
                duration: 0.48,
                stagger: 0.065,
                ease: 'power2.out',
                clearProps: 'opacity,transform',
              },
            )
        },
        root.current,
      )
      revert = () => media.revert()
    })
    return () => {
      disposed = true
      revert?.()
    }
  }, [entry.id])

  return (
    <div className={styles.detail} ref={root}>
      <div className={styles.workspace}>
        <article
          className={styles.reading}
          aria-label="Nội dung nhật ký"
          tabIndex={0}
        >
          <div className={styles.readingHeading} data-detail-reveal>
            <div className={styles.eyebrow}>
              <BookOpen size={15} aria-hidden="true" /> Trang viết của bạn
            </div>
            <h3>
              {new Intl.DateTimeFormat('vi-VN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }).format(date)}
            </h3>
            <div className={styles.metadata}>
              <time dateTime={entry.occurredAt}>
                <Clock3 size={14} aria-hidden="true" />
                {new Intl.DateTimeFormat('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(date)}
              </time>
              <span>{wordCount} từ</span>
              {mood && (
                <span className={styles.mood}>
                  <span aria-hidden="true">{mood.emoji}</span> {mood.label}
                </span>
              )}
            </div>
          </div>
          <div className={styles.prose} data-detail-reveal>
            {paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
          {entry.tags.length > 0 && (
            <div
              className={styles.tags}
              aria-label="Thẻ nhật ký"
              data-detail-reveal
            >
              {entry.tags.map((tag) => (
                <span key={tag}>#{tag}</span>
              ))}
            </div>
          )}
          <div className={styles.endMark} aria-hidden="true">
            ✧
          </div>
        </article>
        <aside
          className={styles.insights}
          aria-label="Nhìn lại cùng AI"
          tabIndex={0}
          data-detail-reveal
        >
          <JournalReflection
            key={`${entry.id}:${entry.currentRevision}`}
            entry={entry}
          />
        </aside>
      </div>
      <footer className={styles.footer}>
        <span className={styles.footerNote}>
          Một khoảng riêng để lắng nghe mình.
        </span>
        <div className={styles.actions}>
          <button type="button" className={styles.delete} onClick={onDelete}>
            <Trash2 size={16} aria-hidden="true" /> Xóa
          </button>
          <button type="button" className={styles.edit} onClick={onEdit}>
            <PencilLine size={16} aria-hidden="true" /> Chỉnh sửa
          </button>
        </div>
      </footer>
    </div>
  )
}
