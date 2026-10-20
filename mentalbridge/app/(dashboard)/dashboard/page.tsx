'use client'
import { Suspense, useState } from 'react'
import Link from 'next/link'
import LatestPhq9Result from '@/features/assessment/components/LatestPhq9Result'
import { PlanEmotionCheckIn } from '@/features/emotion-check-in/PlanEmotionCheckIn'
import { EmotionProgress } from '@/features/emotion-check-in/EmotionProgress'
import TodayPlanReminder from '@/features/support-plan/components/TodayPlanReminder'
import '../dashboard-page.css'

const SmallIcon = ({ type }: { type: 'note' | 'check' | 'user' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {type === 'note' ? (
      <>
        <path d="M6 3h9l3 3v15H6V3Z" />
        <path d="M9 9h6M9 13h6M9 17h3" />
      </>
    ) : type === 'check' ? (
      <path d="m5 13 4 4L19 7" />
    ) : (
      <>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3.5 20c1-3.5 3.3-5.3 5.5-5.3S14 16.5 15 20" />
      </>
    )}
  </svg>
)

export default function DashboardPage() {
  const [emotionRefresh, setEmotionRefresh] = useState(0)
  return (
    <div className="ref-dashboard">
      <section className="ref-hero">
        <div>
          <p>
            <i />
            Không gian chăm sóc tinh thần của bạn
          </p>
          <h1>Chào bạn</h1>
          <span>Hôm nay bạn cảm thấy thế nào?</span>
        </div>
        <div className="ref-streak">
          <b>
            Bắt đầu hôm nay<small>Mỗi ghi chép là một bước nhìn lại</small>
          </b>
        </div>
      </section>
      <section
        className="ref-initial-check"
        aria-labelledby="initial-check-cta-title"
      >
        <div>
          <span>Kiểm tra ban đầu</span>
          <h2 id="initial-check-cta-title">Hiểu rõ hơn về 14 ngày gần đây</h2>
          <p>
            Hoàn thành PHQ-9 rồi GAD-7 trong một hành trình có hướng dẫn để nhận
            kết quả và bước hỗ trợ phù hợp.
          </p>
        </div>
        <Link href="/initial-check">
          Bắt đầu kiểm tra ban đầu <strong aria-hidden="true">→</strong>
        </Link>
      </section>
      <section className="ref-panel">
        <div className="ref-panel-col ref-panel-mood">
          <Suspense fallback={<p role="status">Đang tải cảm xúc hôm nay…</p>}>
            <PlanEmotionCheckIn
              onPersisted={() => setEmotionRefresh((value) => value + 1)}
            />
          </Suspense>
        </div>
        <div className="ref-panel-col ref-panel-result" data-page-motion="off">
          <header className="ref-col-header">
            <h2>Kết quả sàng lọc</h2>
          </header>
          <LatestPhq9Result />
        </div>
        <div className="ref-panel-col ref-panel-progress">
          <EmotionProgress refreshKey={emotionRefresh} />
        </div>
      </section>
      <section className="ref-today">
        <article className="ref-card ref-appointment">
          <header>
            <h2>Lịch hẹn</h2>
            <Link href="/appointments">Xem tất cả →</Link>
          </header>
          <div>
            <p>
              <strong>Xem lịch hẹn của bạn</strong>
              <span>Mở trang lịch hẹn để xem thông tin mới nhất.</span>
            </p>
          </div>
          <footer>Thông tin lịch hẹn không được tạo mẫu trên trang này.</footer>
        </article>
        <TodayPlanReminder />
      </section>
      <section className="ref-quick">
        <header>
          <h2>Hành động nhanh</h2>
          <span>Những việc bạn có thể làm ngay</span>
        </header>
        <div>
          <Link href="/journal" className="primary">
            <i>
              <SmallIcon type="note" />
            </i>
            <p>
              <b>Viết nhật ký</b>
              <span>Ghi lại cảm xúc và suy nghĩ hôm nay</span>
            </p>
            <strong>→</strong>
          </Link>
          <Link href="/assessments">
            <i>
              <SmallIcon type="check" />
            </i>
            <p>
              <b>Làm bài sàng lọc</b>
              <span>
                Nhìn lại trải nghiệm 14 ngày gần đây với PHQ-9 hoặc GAD-7
              </span>
            </p>
          </Link>
          <Link href="/specialists">
            <i className="amber">
              <SmallIcon type="user" />
            </i>
            <p>
              <b>Tìm chuyên gia</b>
              <span>Xem chuyên gia theo lĩnh vực bạn quan tâm</span>
            </p>
          </Link>
        </div>
      </section>
      <section className="ref-journal-streak">
        <div className="ref-streak-left">
          <div className="ref-streak-icon" aria-hidden="true">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </div>
          <div className="ref-streak-text">
            <h3>Dành một phút nhìn lại hôm nay</h3>
            <p>Viết điều bạn đang cảm nhận theo cách riêng của mình.</p>
          </div>
        </div>
        <Link href="/journal" className="ref-streak-btn">
          <span>Viết nhật ký</span>
          <span className="ref-streak-btn-arrow" aria-hidden="true">
            →
          </span>
        </Link>
      </section>
    </div>
  )
}
