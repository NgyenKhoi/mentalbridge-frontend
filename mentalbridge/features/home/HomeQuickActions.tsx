'use client'

import {
  ArrowRight,
  BookOpen,
  ClipboardCheck,
  NotebookPen,
  Users,
  UserRound,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState, type CSSProperties } from 'react'
import type { HomeNextStep } from '@/features/assessment/api/care-contract'
import { homeJournalPrompt } from './journal-prompts'

export function HomeQuickActions({
  home,
}: Readonly<{ home: HomeNextStep | null }>) {
  const [prompt, setPrompt] = useState('')
  useEffect(() => {
    const timer = window.setTimeout(
      () => setPrompt(homeJournalPrompt(new Date())),
      0,
    )
    return () => window.clearTimeout(timer)
  }, [])
  const completedAt = home?.journey.episodeCompletedAt
  const tiles = [
    {
      label: 'Kiểm tra ban đầu',
      hint: completedAt
        ? `Lần gần nhất: ${new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'long' }).format(new Date(completedAt))}`
        : 'Hiểu rõ 14 ngày gần đây',
      href: '/initial-check',
      Icon: ClipboardCheck,
      tone: 'sage',
    },
    {
      label: 'Tìm chuyên gia',
      hint: 'Theo lĩnh vực bạn quan tâm',
      href: '/specialists',
      Icon: UserRound,
      tone: 'amber',
    },
    {
      label: 'Cộng đồng',
      hint: 'Chia sẻ và lắng nghe',
      href: '/community',
      Icon: Users,
      tone: 'blue',
    },
    {
      label: 'Tài nguyên',
      hint: 'Bài đọc và bài tập đã duyệt',
      href: '/resources',
      Icon: BookOpen,
      tone: 'clay',
    },
  ]
  return (
    <section className="home-explore" aria-labelledby="home-quick-heading">
      <h2 id="home-quick-heading">Hành động nhanh</h2>
      <nav
        className="home-quick-grid"
        aria-label="Hành động nhanh"
        data-page-motion="off"
      >
        <Link
          href="/journal"
          className="home-quick-tile home-journal-tile home-data-rise"
          style={{ '--home-delay': '240ms' } as CSSProperties}
        >
          <svg
            className="home-journal-sprig"
            width="160"
            height="160"
            viewBox="0 0 160 160"
            fill="none"
            aria-hidden="true"
          >
            <g
              stroke="var(--primary-foreground)"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M30 150 C70 120 100 80 130 20" />
              <path d="M70 118 C58 96 64 80 82 72 C88 92 84 108 70 118Z" />
              <path d="M100 86 C114 68 132 64 146 72 C134 88 118 94 100 86Z" />
            </g>
          </svg>
          <div className="home-tile-icon">
            <NotebookPen size={20} aria-hidden="true" />
          </div>
          <div className="home-journal-copy">
            <div className="home-journal-title">Viết nhật ký</div>
            <div className="home-journal-hint">Gợi ý viết hôm nay</div>
            <div className="home-journal-prompt">
              {prompt ? `“${prompt}”` : 'Dành vài dòng cho chính mình.'}
            </div>
          </div>
          <div className="home-journal-action">
            Bắt đầu viết{' '}
            <ArrowRight className="home-arrow" size={18} aria-hidden="true" />
          </div>
        </Link>
        {tiles.map(({ label, hint, href, Icon, tone }, index) => (
          <Link
            key={href}
            href={href}
            className={`home-quick-tile home-data-rise home-tile-${tone}`}
            style={{ '--home-delay': `${300 + index * 40}ms` } as CSSProperties}
          >
            <div className="home-tile-icon">
              <Icon size={20} aria-hidden="true" />
            </div>
            <div>
              <div className="home-tile-title">{label}</div>
              <div className="home-tile-hint">{hint}</div>
            </div>
            <ArrowRight className="home-tile-go" size={18} aria-hidden="true" />
          </Link>
        ))}
      </nav>
    </section>
  )
}
