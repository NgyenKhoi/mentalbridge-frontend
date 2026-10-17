'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowUpRight,
  BellRing,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  HeartHandshake,
  LayoutDashboard,
  ListFilter,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react'

import { browserApiClient } from '@/lib/api/browser-client'
import type {
  FollowUpLane,
  FollowUpPreviewBoard,
  FollowUpPreviewItem,
  FollowUpPopupKind,
  FollowUpPreviewResponse,
} from '../api/follow-up-preview-contract'
import SpecialistContinuityManager from './SpecialistContinuityManager'
import SpecialistFollowUpModal from './SpecialistFollowUpModal'
import styles from './SpecialistFollowUpWorkspace.module.css'

type ViewMode = 'board' | 'timeline' | 'priority'

const lanes: { id: FollowUpLane; title: string; description: string }[] = [
  { id: 'attention', title: 'Cần xem lại', description: 'Bước cần chú ý trước phiên tới' },
  { id: 'inProgress', title: 'Đang tiếp nối', description: 'Hoạt động giữa các phiên' },
  { id: 'ready', title: 'Sẵn sàng cho phiên mới', description: 'Thông tin đã có để chuẩn bị' },
]

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value))
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(value))
}

function FollowUpCard({
  item,
  onSelect,
}: {
  item: FollowUpPreviewItem
  onSelect: (item: FollowUpPreviewItem, kind: FollowUpPopupKind) => void
}) {
  const percent = item.progress
    ? Math.round((item.progress.completed / item.progress.total) * 100)
    : null

  return (
    <article className={`${styles.card} ${styles[item.lane]}`}>
      <div className={styles.cardTop}>
        <span className={styles.avatar} aria-hidden="true">{item.initials}</span>
        <div className={styles.identity}>
          <strong title={item.name}>{item.name}</strong>
          <small title={item.context}>{item.context}</small>
        </div>
        <span className={styles.badge}>{item.badge}</span>
      </div>

      {item.progress && percent !== null ? (
        <div className={styles.progressBlock}>
          <div>
            <span>{item.progress.completed}/{item.progress.total} {item.progress.label.toLowerCase()}</span>
            <strong>{percent}%</strong>
          </div>
          <div className={styles.progressTrack} aria-label={`${item.progress.label}: ${percent}%`} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${percent}%` }} />
          </div>
        </div>
      ) : (
        <p className={styles.cardHeadline}>{item.lane === 'attention' ? <BellRing aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}{item.headline}</p>
      )}

      <div className={styles.cardMeta}>
        <CalendarDays aria-hidden="true" />
        <span>{item.nextAt ? formatShortDate(item.nextAt) : 'Chưa có lịch tiếp theo'}</span>
        {item.lastAt && <small>Phiên trước: {formatDay(item.lastAt)}</small>}
      </div>

      <div className={styles.cardActions}>
        {item.actions.map((action) => <button key={action.kind} type="button" data-appointment-ui className={action.primary ? styles.cardAction : styles.cardActionSecondary} onClick={() => onSelect(item, action.kind)} aria-label={`${action.label} của ${item.name}`}>
          {action.label} <ArrowUpRight aria-hidden="true" />
        </button>)}
      </div>
    </article>
  )
}

function PreviewBoard({ board }: { board: FollowUpPreviewBoard }) {
  const router = useRouter()
  const [view, setView] = useState<ViewMode>('board')
  const [selected, setSelected] = useState<{ item: FollowUpPreviewItem; kind: FollowUpPopupKind } | null>(null)
  const select = (item: FollowUpPreviewItem, kind: FollowUpPopupKind) => {
    if (kind === 'chat') {
      setSelected(null)
      router.push(item.chatAppointmentId
        ? `/specialist/messages?appointmentId=${encodeURIComponent(item.chatAppointmentId)}`
        : '/specialist/messages')
      return
    }
    setSelected({ item, kind })
  }
  const grouped = useMemo(() => ({
    attention: board.items.filter((item) => item.lane === 'attention'),
    inProgress: board.items.filter((item) => item.lane === 'inProgress'),
    ready: board.items.filter((item) => item.lane === 'ready'),
  }), [board.items])
  const progressItems = board.items.filter((item) => item.progress)
  const averageProgress = progressItems.length
    ? Math.round(progressItems.reduce((sum, item) => sum + (item.progress ? (item.progress.completed / item.progress.total) * 100 : 0), 0) / progressItems.length)
    : 0
  const timeline = [...board.items].sort((left, right) =>
    (left.nextAt ?? left.lastAt ?? '').localeCompare(right.nextAt ?? right.lastAt ?? ''),
  )

  return (
    <section className={styles.page} aria-labelledby="follow-up-title">
      <header className={styles.pageHeader}>
        <div className={styles.intro}>
          <span className={styles.eyebrow}><span aria-hidden="true" /> Bản xem trước · Dữ liệu minh họa</span>
          <h1 id="follow-up-title">Theo dõi sau phiên &amp; lộ trình chăm sóc</h1>
          <p>Xem những bước đã thống nhất, tiến độ giữa các phiên và lịch hẹn sắp tới ở cùng một nơi.</p>
        </div>
        <div className={styles.viewSwitch} aria-label="Cách xem theo dõi">
          <button type="button" data-appointment-ui aria-pressed={view === 'board'} onClick={() => setView('board')}><LayoutDashboard aria-hidden="true" /> Bảng lộ trình</button>
          <button type="button" data-appointment-ui aria-pressed={view === 'timeline'} onClick={() => setView('timeline')}><TrendingUp aria-hidden="true" /> Dòng thời gian</button>
          <button type="button" data-appointment-ui aria-pressed={view === 'priority'} onClick={() => setView('priority')}><ListFilter aria-hidden="true" /> Cần xem lại <span>{grouped.attention.length}</span></button>
        </div>
      </header>

      <div className={styles.stats} aria-label="Tổng quan bản xem trước">
        <div className={styles.stat}><span className={styles.statIconAttention}><BellRing aria-hidden="true" /></span><div><strong>{grouped.attention.length}</strong><small>Cần xem lại</small></div></div>
        <div className={styles.stat}><span className={styles.statIconProgress}><TrendingUp aria-hidden="true" /></span><div><strong>{grouped.inProgress.length}</strong><small>Đang tiếp nối</small></div></div>
        <div className={styles.stat}><span className={styles.statIconReady}><CheckCircle2 aria-hidden="true" /></span><div><strong>{grouped.ready.length}</strong><small>Sẵn sàng phiên mới</small></div></div>
        <div className={styles.stat}><span className={styles.statIconAverage}><ClipboardCheck aria-hidden="true" /></span><div><strong>{averageProgress}%</strong><small>Hoạt động đã hoàn tất</small></div></div>
      </div>

      {view === 'board' ? (
        <div className={styles.board}>
          {lanes.map((lane) => (
            <section key={lane.id} className={`${styles.lane} ${styles[lane.id]}`} aria-labelledby={`follow-up-${lane.id}`}>
              <header className={styles.laneHeader}>
                <div><h2 id={`follow-up-${lane.id}`}><span aria-hidden="true" />{lane.title}</h2><p>{lane.description}</p></div>
                <span className={styles.laneCount}>{grouped[lane.id].length} khách hàng</span>
              </header>
              <div className={styles.laneItems}>{grouped[lane.id].map((item) => <FollowUpCard key={item.id} item={item} onSelect={select} />)}</div>
            </section>
          ))}
        </div>
      ) : view === 'timeline' ? (
        <section className={styles.listPanel} aria-label="Dòng thời gian theo dõi">
          <h2>Dòng thời gian sắp tới</h2>
          <div className={styles.timelineList}>
            {timeline.map((item) => <button key={item.id} type="button" data-appointment-ui onClick={() => select(item, item.actions[0]?.kind ?? 'summary')}><span className={styles.timelineDate}><Clock3 aria-hidden="true" />{item.nextAt ? formatShortDate(item.nextAt) : 'Chưa lên lịch'}</span><span className={styles.timelineName}><strong>{item.name}</strong><small>{item.headline}</small></span><span className={styles.timelineLane}>{lanes.find((lane) => lane.id === item.lane)?.title}</span><ArrowUpRight aria-hidden="true" /></button>)}
          </div>
        </section>
      ) : (
        <section className={styles.priorityPanel} aria-labelledby="priority-title">
          <div><h2 id="priority-title">Cần xem lại trước phiên tới</h2><p>Những bước chưa được cập nhật trong bản xem trước.</p></div>
          <div className={styles.priorityGrid}>{grouped.attention.map((item) => <FollowUpCard key={item.id} item={item} onSelect={select} />)}</div>
        </section>
      )}

      <footer className={styles.principle}>
        <span className={styles.principleIcon}><HeartHandshake aria-hidden="true" /></span>
        <div><strong>Tiếp nối chăm sóc theo từng bước nhỏ</strong><p>Theo dõi điều đã thống nhất, những cập nhật được chia sẻ và buổi hẹn tiếp theo.</p></div>
        <span className={styles.principleTag}><ShieldCheck aria-hidden="true" /> Dữ liệu minh họa</span>
      </footer>

      <SpecialistFollowUpModal selection={selected} onClose={() => setSelected(null)} onSelect={select} />
    </section>
  )
}

function PreviewLoading() {
  return (
    <section className={styles.page} aria-labelledby="follow-up-loading-title">
      <header className={styles.pageHeader}>
        <div className={styles.intro}>
          <span className={styles.eyebrow}><span aria-hidden="true" /> Bản xem trước · Dữ liệu minh họa</span>
          <h1 id="follow-up-loading-title">Theo dõi sau phiên &amp; lộ trình chăm sóc</h1>
          <p>Xem những bước đã thống nhất, tiến độ giữa các phiên và lịch hẹn sắp tới ở cùng một nơi.</p>
        </div>
      </header>
      <div className={styles.stats} aria-hidden="true">{[0, 1, 2, 3].map((item) => <div key={item} className={styles.statSkeleton} />)}</div>
      <div className={styles.board} aria-hidden="true">{[0, 1, 2].map((item) => <div key={item} className={styles.laneSkeleton}><span /><span /><span /></div>)}</div>
      <p className={styles.loading} role="status">Đang mở trang theo dõi sau phiên…</p>
    </section>
  )
}

export default function SpecialistFollowUpWorkspace() {
  const [preview, setPreview] = useState<FollowUpPreviewResponse | null>(null)

  useEffect(() => {
    let active = true
    void browserApiClient.get<FollowUpPreviewResponse>('/care/specialist/follow-up-preview')
      .then((response) => { if (active) setPreview(response.data) })
      .catch(() => { if (active) setPreview({ enabled: false }) })
    return () => { active = false }
  }, [])

  if (preview === null) return <PreviewLoading />
  if (!preview.enabled) return <SpecialistContinuityManager />
  return <PreviewBoard board={preview.board} />
}
