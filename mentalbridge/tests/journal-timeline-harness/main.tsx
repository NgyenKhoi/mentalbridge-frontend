import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import Link from 'next/link'

import '../../app/globals.css'
import '../../app/(dashboard)/dashboard.css'
import '../../app/(dashboard)/dashboard-shell.css'
import '../../app/(dashboard)/journal/journal.css'

import type {
  JournalMood,
  JournalSummary,
} from '@/lib/journal/journal-contract'
import { JournalHero } from '../../app/(dashboard)/journal/components/JournalHero'
import { JournalStats } from '../../app/(dashboard)/journal/components/JournalStats'
import { JournalFilters } from '../../app/(dashboard)/journal/components/JournalFilters'
import { JournalTimeline } from '../../app/(dashboard)/journal/components/JournalTimeline'
import { JournalCalendar } from '../../app/(dashboard)/journal/components/JournalCalendar'
import { MoodDistribution } from '../../app/(dashboard)/journal/components/MoodDistribution'
import { useJournalTimeline } from '../../app/(dashboard)/journal/hooks/useJournalTimeline'

const MOCK_ENTRIES: JournalSummary[] = [
  {
    id: '1',
    occurredAt: '2026-09-30T22:06:00',
    createdAt: '2026-09-30T22:06:00',
    updatedAt: '2026-09-30T22:06:00',
    ownerAccountId: 'user1',
    currentRevision: 1,
    deleted: false,
    mood: 'OKAY',
    tags: ['Công việc'],
    content: {
      preview:
        'Điều gì đang ở lại trong tâm trí bạn lúc này?\nDạo này mình suy nghĩ khá nhiều về mục tiêu công việc và định hướng sắp tới. Mọi thứ diễn ra khá nhanh khiến đôi lúc mình thấy hơi choáng. Mình muốn chậm lại một chút để sắp xếp ưu tiên trước khi quyết định.',
      byteLength: 200,
    },
  },
  {
    id: '2',
    occurredAt: '2026-09-30T08:15:00',
    createdAt: '2026-09-30T08:15:00',
    updatedAt: '2026-09-30T08:15:00',
    ownerAccountId: 'user1',
    currentRevision: 1,
    deleted: false,
    mood: 'GOOD',
    tags: ['Sức khỏe'],
    content: {
      preview:
        'Sáng nay dậy sớm đi bộ quanh hồ, không khí rất dễ chịu. Mình thấy đầu óc nhẹ hơn hẳn.',
      byteLength: 90,
    },
  },
  {
    id: '3',
    occurredAt: '2026-09-29T21:40:00',
    createdAt: '2026-09-29T21:40:00',
    updatedAt: '2026-09-29T21:40:00',
    ownerAccountId: 'user1',
    currentRevision: 1,
    deleted: false,
    mood: 'GOOD',
    tags: ['Gia đình'],
    content: {
      preview: 'Gọi điện cho bạn cũ, nói chuyện rất thoải mái.',
      byteLength: 50,
    },
  },
  {
    id: '4',
    occurredAt: '2026-09-27T23:10:00',
    createdAt: '2026-09-27T23:10:00',
    updatedAt: '2026-09-27T23:10:00',
    ownerAccountId: 'user1',
    currentRevision: 1,
    deleted: false,
    mood: 'LOW',
    tags: ['Giấc ngủ'],
    content: {
      preview: 'Ngủ không ngon, sáng dậy vẫn thấy nặng đầu.',
      byteLength: 45,
    },
  },
  {
    id: '5',
    occurredAt: '2026-09-25T01:24:00',
    createdAt: '2026-09-25T01:24:00',
    updatedAt: '2026-09-25T01:24:00',
    ownerAccountId: 'user1',
    currentRevision: 1,
    deleted: false,
    mood: 'LOW',
    tags: ['Công việc'],
    content: {
      preview: 'Tôi đang rất mệt mỏi về công việc.',
      byteLength: 35,
    },
  },
  {
    id: '6',
    occurredAt: '2026-09-24T20:30:00',
    createdAt: '2026-09-24T20:30:00',
    updatedAt: '2026-09-24T20:30:00',
    ownerAccountId: 'user1',
    currentRevision: 1,
    deleted: false,
    mood: 'GOOD',
    tags: ['Học tập'],
    content: {
      preview: 'Học xong một chương mới, thấy có tiến bộ.',
      byteLength: 42,
    },
  },
  {
    id: '7',
    occurredAt: '2026-09-22T20:05:00',
    createdAt: '2026-09-22T20:05:00',
    updatedAt: '2026-09-22T20:05:00',
    ownerAccountId: 'user1',
    currentRevision: 1,
    deleted: false,
    mood: 'OKAY',
    tags: ['Công việc'],
    content: {
      preview: 'Một ngày bình thường, không có gì đặc biệt.',
      byteLength: 44,
    },
  },
  {
    id: '8',
    occurredAt: '2026-09-19T22:45:00',
    createdAt: '2026-09-19T22:45:00',
    updatedAt: '2026-09-19T22:45:00',
    ownerAccountId: 'user1',
    currentRevision: 1,
    deleted: false,
    mood: 'VERY_LOW',
    tags: ['Công việc'],
    content: {
      preview: 'Áp lực dồn dập, mình thấy quá tải và chỉ muốn nghỉ ngơi.',
      byteLength: 55,
    },
  },
  {
    id: '9',
    occurredAt: '2026-09-15T19:20:00',
    createdAt: '2026-09-15T19:20:00',
    updatedAt: '2026-09-15T19:20:00',
    ownerAccountId: 'user1',
    currentRevision: 1,
    deleted: false,
    mood: 'GREAT',
    tags: ['Gia đình'],
    content: {
      preview: 'Buổi tối cùng gia đình, mình thấy thật bình yên.',
      byteLength: 48,
    },
  },
  {
    id: '10',
    occurredAt: '2026-08-30T19:00:00',
    createdAt: '2026-08-30T19:00:00',
    updatedAt: '2026-08-30T19:00:00',
    ownerAccountId: 'user1',
    currentRevision: 1,
    deleted: false,
    mood: 'GOOD',
    tags: ['Các mối quan hệ'],
    content: {
      preview: 'Cuối tuần ở nhà, thấy nhẹ nhõm.',
      byteLength: 32,
    },
  },
] as unknown as JournalSummary[]

function JournalTimelineHarness() {
  const [entries] = useState<JournalSummary[]>(MOCK_ENTRIES)
  const [yearMonth, setYearMonth] = useState<[number, number]>([2026, 8]) // Sept 2026
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

  return (
    <div className="ref-shell">
      <aside className="ref-sidebar">
        <div className="ref-brand">
          <Link href="/" aria-label="MentalBridge">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 2C7 2 3 5 3 9.5c0 3 2 5 4 6.2V21l3-1.6c.7.1 1.3.2 2 .2 5 0 9-3 9-7.6S17 2 12 2Z" />
            </svg>
          </Link>
          <div>
            <b>MentalBridge</b>
            <span>Health Tech</span>
          </div>
        </div>
        <nav aria-label="Điều hướng chính">
          <section>
            <h2>Tổng quan</h2>
            <a href="/dashboard">
              <span>Tổng quan</span>
            </a>
            <a href="/journal" className="active">
              <span>Nhật ký</span>
            </a>
            <a href="/assessments">
              <span>Bài sàng lọc</span>
            </a>
          </section>
        </nav>
      </aside>
      <div className="ref-main">
        <header className="ref-topbar">
          <div className="ref-context">
            <span>Không gian của bạn</span>
            <strong>Nhật ký</strong>
          </div>
          <label>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="search"
              placeholder="Tìm kiếm chuyên gia, nhật ký..."
              readOnly
            />
            <kbd>⌘ K</kbd>
          </label>
          <div className="ref-top-actions">
            <div className="ref-avatar">ND</div>
          </div>
        </header>
        <main className="ref-content ref-content-page">
          <div className="journal-live">
            <div className="journal-page-content">
              <div className="journal-wrap">
                <JournalHero onOpenCreate={() => alert('Viết nhật ký')} />
                <JournalStats stats={stats} />

                <div className="cols">
                  <div className="col-main">
                    <JournalFilters
                      searchQuery={searchQuery}
                      onSearchChange={setSearchQuery}
                      selectedMood={selectedMood}
                      onMoodSelect={setSelectedMood}
                      selectedTag={selectedTag}
                      onTagSelect={setSelectedTag}
                      availableTags={availableTags}
                    />

                    <JournalTimeline
                      year={yearMonth[0]}
                      month={yearMonth[1]}
                      groupedByDate={groupedByDate}
                      hasTotalEntries={entries.length > 0}
                      loading={false}
                      onRetry={() => {}}
                      onOpenCreate={() => {}}
                      onResetFilters={handleResetFilters}
                      onOpenDetail={(e) => alert('Xem chi tiết: ' + e.id)}
                    />
                  </div>

                  <aside className="side">
                    <JournalCalendar
                      year={yearMonth[0]}
                      month={yearMonth[1]}
                      calendarData={calendarData}
                      selectedDay={selectedDay}
                      onSelectDay={setSelectedDay}
                      onPrevMonth={() => shiftMonth(-1)}
                      onNextMonth={() => shiftMonth(1)}
                    />

                    <MoodDistribution
                      month={yearMonth[1]}
                      moodCounts={stats.moodCounts}
                      totalInMonth={stats.totalInMonth}
                    />
                  </aside>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

const container = document.getElementById('root')
if (container) {
  const root = createRoot(container)
  root.render(
    <StrictMode>
      <JournalTimelineHarness />
    </StrictMode>,
  )
}
