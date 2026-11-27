/* eslint-disable @next/next/no-html-link-for-pages -- Standalone Vite preview has no Next router. */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowRight, ClipboardCheck, Sun } from 'lucide-react'
import { MoodFace } from '@/features/emotion-check-in/MoodFace'
import {
  emotionOrder,
  emotionPresentation,
} from '@/lib/emotion-check-in/presentation'
import { HomeGreeting } from '@/features/home/HomeGreeting'
import { homeFirstUseFixture } from '@/features/home/testing/home-next-step-fixture'
import checkInStyles from '@/features/emotion-check-in/DailyEmotionCheckIn.module.css'
import emotionStyles from '@/features/home/HomeEmotionSection.module.css'
import resourceStyles from '@/features/home/HomeSecondarySections.module.css'

import '../../app/globals.css'
import '../../app/(dashboard)/dashboard.css'
import '../../app/(dashboard)/dashboard-shell.css'
import '../../app/(dashboard)/dashboard-page.css'

const home = homeFirstUseFixture()
const previewResources = [
  {
    title: 'Thở chậm 4–6 khi thấy căng thẳng',
    path: 'M36 14a22 22 0 1 0 0 44 22 22 0 0 0 0-44zM36 24a12 12 0 1 0 0 24 12 12 0 0 0 0-24z',
  },
  {
    title: 'Hiểu về lo âu: khi cơ thể báo động nhầm',
    path: 'M14 22c8-4 16-4 22 2 6-6 14-6 22-2v30c-8-4-16-4-22 2-6-6-14-6-22-2zM36 24v30',
  },
  {
    title: 'Thư giãn cơ trước khi ngủ',
    path: 'M20 40v-6a16 16 0 0 1 32 0v6M16 40h8v14h-8zM48 40h8v14h-8z',
  },
]

/** Static layout preview; real-route captures cover data, saving and navigation. */
function DashboardPreview() {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <main className="home-hub" data-home-motion="on">
        <div className="home-eyebrow" role="note">
          Bản xem bố cục tĩnh · Nội dung minh họa, không phải dữ liệu tài khoản.
        </div>
        <HomeGreeting home={home} safety={false} />
        <div className="home-primary-slot" data-page-motion="off">
          <section className="home-next-step" aria-label="Bước tiếp theo">
            <ol className="home-trail" aria-label="Hành trình của bạn">
              {['Kiểm tra ban đầu', 'Hướng dẫn', 'Kế hoạch (nếu phù hợp)'].map(
                (label, index) => (
                  <li
                    key={label}
                    className={`home-trail-step home-trail-${index === 0 ? 'current' : 'upcoming'}`}
                    aria-current={index === 0 ? 'step' : undefined}
                  >
                    {index > 0 && (
                      <div
                        className="home-trail-connector"
                        aria-hidden="true"
                      />
                    )}
                    <div className="home-trail-node" aria-hidden="true">
                      {index === 0 && <div />}
                    </div>
                    <div>{label}</div>
                  </li>
                ),
              )}
            </ol>
            <div className="home-band-row">
              <div className="home-art" aria-hidden="true">
                <ClipboardCheck size={54} strokeWidth={1.3} />
              </div>
              <div className="home-band-copy">
                <div className="home-eyebrow">Kiểm tra ban đầu</div>
                <h2 className="home-title">Hiểu rõ hơn về 14 ngày gần đây</h2>
                <div className="home-description">
                  16 câu hỏi ngắn, khoảng 5 phút. Bạn có thể dừng và quay lại
                  sau.
                </div>
              </div>
              <div className="home-band-actions">
                <a className="home-primary" href="/initial-check">
                  Bắt đầu kiểm tra ban đầu
                  <ArrowRight size={18} aria-hidden="true" />
                </a>
              </div>
            </div>
          </section>
        </div>

        <section className={emotionStyles.section} aria-label="Cảm xúc">
          <div className={emotionStyles.checkIn}>
            <div className={checkInStyles.card}>
              <div className={checkInStyles.header}>
                <h2 className={checkInStyles.title}>Cảm xúc hôm nay</h2>
                <div className={checkInStyles.subtitle}>
                  Chọn cảm xúc gần nhất với bạn lúc này
                </div>
              </div>
              <div
                className={checkInStyles.emotions}
                role="group"
                aria-label="Cảm xúc hôm nay (bản xem tĩnh)"
              >
                {emotionOrder.map((emotion) => (
                  <div className={checkInStyles.emotionLabel} key={emotion}>
                    <MoodFace emotion={emotion} />
                    <div>{emotionPresentation[emotion].label}</div>
                  </div>
                ))}
              </div>
              <div className={checkInStyles.actions}>
                <button type="button" disabled>
                  Lưu ghi nhận
                </button>
              </div>
              <div className={checkInStyles.idleHint}>
                Chọn xong sẽ hiện mức độ và ghi chú (không bắt buộc)
              </div>
            </div>
          </div>
          <section
            className={emotionStyles.week}
            aria-labelledby="preview-week-heading"
          >
            <div className={emotionStyles.heading}>
              <h2 id="preview-week-heading">Tuần này của bạn</h2>
              <a href="/nhin-lai">Xem tiến độ →</a>
            </div>
            <ol
              className={emotionStyles.days}
              aria-label="Cảm xúc 7 ngày gần đây"
            >
              {['T5', 'T6', 'T7', 'CN', 'T2', 'T3', 'Nay'].map((day, index) => (
                <li
                  key={day}
                  className={index === 6 ? emotionStyles.today : ''}
                >
                  <div
                    className={`${emotionStyles.circle} ${emotionStyles.empty}`}
                    aria-label="Chưa ghi nhận"
                  />
                  <div className={emotionStyles.dayLabel}>{day}</div>
                </li>
              ))}
            </ol>
            <div className={emotionStyles.note}>
              <Sun size={18} aria-hidden="true" />
              <div>
                Hôm qua chưa có ghi nhận. Ngày trống chỉ là ngày chưa ghi.
              </div>
            </div>
          </section>
        </section>

        <div className="home-secondary-row" data-page-motion="off">
          <section
            className={resourceStyles.section}
            aria-labelledby="preview-resources-heading"
          >
            <div className={resourceStyles.headingRow}>
              <h2 id="preview-resources-heading">Từ thư viện MentalBridge</h2>
              <a href="/resources">Tất cả tài nguyên →</a>
            </div>
            <div className={resourceStyles.resourceGrid}>
              {previewResources.map((resource, index) => (
                <a
                  href="/resources"
                  className={resourceStyles.resource}
                  key={resource.title}
                >
                  <div
                    className={`${resourceStyles.art} ${resourceStyles[`art${index}`]}`}
                  >
                    <div className={resourceStyles.tag}>
                      Từ thư viện · minh họa
                    </div>
                    <svg
                      width="72"
                      height="72"
                      viewBox="0 0 72 72"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d={resource.path} />
                    </svg>
                  </div>
                  <div className={resourceStyles.resourceBody}>
                    <h3>{resource.title}</h3>
                    <div className={resourceStyles.resourceAction}>
                      Mở thư viện →
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </section>
          <section
            className={resourceStyles.section}
            aria-labelledby="preview-appointment-heading"
          >
            <div className={resourceStyles.headingRow}>
              <h2 id="preview-appointment-heading">Buổi hẹn sắp tới</h2>
              <a href="/appointments">Tất cả →</a>
            </div>
            <div className={resourceStyles.localState}>
              <div>Chưa có buổi hẹn nào sắp tới.</div>
              <a href="/specialists" className={resourceStyles.quietAction}>
                Tìm chuyên gia →
              </a>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

const root = document.getElementById('root')
if (!root) throw new Error('Dashboard preview root is missing')

createRoot(root).render(
  <StrictMode>
    <DashboardPreview />
  </StrictMode>,
)
