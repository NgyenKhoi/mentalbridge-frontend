import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '../../app/globals.css'
import '../../app/(dashboard)/dashboard.css'
import '../../app/(dashboard)/dashboard-shell.css'
import '../../app/(dashboard)/dashboard-page.css'

import emotionStyles from '@/features/emotion-check-in/DailyEmotionCheckIn.module.css'
import phqStyles from '@/features/assessment/components/LatestPhq9Result.module.css'
import progressStyles from '@/features/emotion-check-in/EmotionProgress.module.css'

function DashboardPreview() {
  return (
    <div style={{ padding: '2rem', background: '#f4f6f3', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
        <section
          className="ref-panel"
          aria-label="Bảng tổng quan cảm xúc và sàng lọc"
        >
          {/* CỘT 1: CẢM XÚC HÔM NAY */}
          <div className="ref-panel-col ref-panel-checkin">
            <section className={emotionStyles.card}>
              <header className={emotionStyles.header}>
                <h2 className={emotionStyles.title}>Cảm xúc hôm nay</h2>
                <p className={emotionStyles.subtitle}>
                  Tự chọn cảm xúc phù hợp nhất với bạn
                </p>
              </header>

              <div className={emotionStyles.form}>
                <div className={emotionStyles.emotions}>
                  <div className={emotionStyles.emotionLabel}>
                    <span className={emotionStyles.emotionIcon}>😄</span>
                    <span className={emotionStyles.emotionText}>Rất tốt</span>
                  </div>
                  <div className={emotionStyles.emotionLabel}>
                    <span className={emotionStyles.emotionIcon}>😊</span>
                    <span className={emotionStyles.emotionText}>Tốt</span>
                  </div>
                  <div className={emotionStyles.emotionLabel}>
                    <span className={emotionStyles.emotionIcon}>😌</span>
                    <span className={emotionStyles.emotionText}>
                      Bình thường
                    </span>
                  </div>
                  <div
                    className={`${emotionStyles.emotionLabel} ${emotionStyles.selected}`}
                  >
                    <span className={emotionStyles.emotionIcon}>🥱</span>
                    <span className={emotionStyles.emotionText}>Không tốt</span>
                  </div>
                  <div className={emotionStyles.emotionLabel}>
                    <span className={emotionStyles.emotionIcon}>😟</span>
                    <span className={emotionStyles.emotionText}>
                      Rất không tốt
                    </span>
                  </div>
                </div>

                <div className={emotionStyles.intensity}>
                  <h3 className={emotionStyles.intensityTitle}>
                    Mức độ cảm nhận
                  </h3>
                  <div className={emotionStyles.intensityRow}>
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <div
                        key={lvl}
                        className={`${emotionStyles.intensityBtn} ${
                          lvl === 2 ? emotionStyles.intensitySelected : ''
                        }`}
                      >
                        {lvl}
                      </div>
                    ))}
                  </div>
                </div>

                <div className={emotionStyles.actions}>
                  <button type="button" className={emotionStyles.saveBtn}>
                    Cập nhật ghi nhận
                  </button>
                  <a href="/journal" className={emotionStyles.journalLink}>
                    Viết thêm →
                  </a>
                </div>

                <div className={emotionStyles.divider} />

                <div className={emotionStyles.feedback}>
                  <div className={emotionStyles.statusRow}>
                    <span className={emotionStyles.checkIcon}>✓</span>
                    <span>Đã tải ghi nhận tự báo cáo hôm nay.</span>
                  </div>
                </div>

                <div className={emotionStyles.influenceSection}>
                  <h4 className={emotionStyles.influenceTitle}>
                    Điều gì đang ảnh hưởng đến bạn?{' '}
                    <span className={emotionStyles.optionalTag}>
                      (tùy chọn)
                    </span>
                  </h4>
                  <div className={emotionStyles.chipList}>
                    {[
                      'Giấc ngủ',
                      'Công việc',
                      'Học tập',
                      'Gia đình',
                      'Bạn bè',
                      'Sức khỏe',
                      'Khác',
                    ].map((chip, idx) => (
                      <div
                        key={chip}
                        className={`${emotionStyles.chip} ${
                          idx === 0 || idx === 1
                            ? emotionStyles.chipSelected
                            : ''
                        }`}
                      >
                        {chip}
                      </div>
                    ))}
                  </div>
                </div>

                <div className={emotionStyles.comparisonSection}>
                  <h4 className={emotionStyles.comparisonTitle}>
                    Hôm qua và hôm nay
                  </h4>
                  <div className={emotionStyles.comparisonBoxes}>
                    <div className={emotionStyles.boxYesterday}>
                      <span className={emotionStyles.boxDate}>29/09</span>
                      <span className={emotionStyles.boxMood}>😄 Rất tốt</span>
                      <span className={emotionStyles.boxIntensity}>
                        Cường độ 4/5
                      </span>
                    </div>
                    <span className={emotionStyles.boxArrow}>→</span>
                    <div className={emotionStyles.boxToday}>
                      <span className={emotionStyles.boxTodayDate}>
                        Hôm nay
                      </span>
                      <span className={emotionStyles.boxTodayMood}>
                        🥱 Không tốt
                      </span>
                      <span className={emotionStyles.boxTodayIntensity}>
                        Cường độ 2/5
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* CỘT 2: KẾT QUẢ SÀNG LỌC (CẢ PHQ-9 VÀ GAD-7) */}
          <div className="ref-panel-col ref-panel-result">
            <section className={phqStyles.card}>
              <header className={phqStyles.header}>
                <h2 className={phqStyles.title}>Kết quả sàng lọc</h2>
                <p className={phqStyles.subtitle}>Lần gần nhất · 28/9/2026</p>
              </header>

              {/* KHỐI 1: PHQ-9 */}
              <section className={phqStyles.instrumentSection}>
                <div className={phqStyles.subHeader}>
                  <span className={phqStyles.scoreLabel}>PHQ-9 · TRẦM CẢM</span>
                  <a href="/assessments" className={phqStyles.miniLink}>
                    Xem lại →
                  </a>
                </div>

                <div className={phqStyles.scoreSection}>
                  <div className={phqStyles.scoreRow}>
                    <strong className={phqStyles.scoreValue}>13</strong>
                    <span className={phqStyles.scoreUnit}>điểm</span>
                  </div>
                  <p className={phqStyles.levelRow}>
                    Mức sàng lọc: <strong>Trung bình</strong>
                  </p>
                </div>

                <div className={phqStyles.barContainer}>
                  <div
                    className={phqStyles.markerWrapper}
                    style={{ left: '48%' }}
                  >
                    <span className={phqStyles.markerText} data-score="13" />
                    <span className={phqStyles.markerArrow}>▼</span>
                  </div>
                  <div className={phqStyles.segments}>
                    <div className={phqStyles.seg1} />
                    <div className={phqStyles.seg2} />
                    <div className={phqStyles.seg3} />
                    <div className={phqStyles.seg4} />
                    <div className={phqStyles.seg5} />
                  </div>
                  <div className={phqStyles.barLabels}>
                    <span>0 Tối thiểu</span>
                    <span>27 Nặng</span>
                  </div>
                </div>

                <p className={phqStyles.scaleNote}>
                  Thang 0 đến 27. Đánh giá mức độ trầm cảm trong 14 ngày qua.
                </p>
              </section>

              {/* GẠCH PHÂN CÁCH */}
              <div className={phqStyles.sectionDivider} />

              {/* KHỐI 2: GAD-7 */}
              <section className={phqStyles.instrumentSection}>
                <div className={phqStyles.subHeader}>
                  <span className={phqStyles.scoreLabel}>GAD-7 · LO ÂU</span>
                  <a href="/assessments/gad7" className={phqStyles.miniLink}>
                    Làm lại →
                  </a>
                </div>

                <div className={phqStyles.scoreSection}>
                  <div className={phqStyles.scoreRow}>
                    <strong className={phqStyles.scoreValue}>10</strong>
                    <span className={phqStyles.scoreUnit}>điểm</span>
                  </div>
                  <p className={phqStyles.levelRow}>
                    Mức sàng lọc: <strong>Trung bình</strong>
                  </p>
                </div>

                <div className={phqStyles.barContainer}>
                  <div
                    className={phqStyles.markerWrapper}
                    style={{ left: '47%' }}
                  >
                    <span className={phqStyles.markerText} data-score="10" />
                    <span className={phqStyles.markerArrow}>▼</span>
                  </div>
                  <div className={phqStyles.segments}>
                    <div className={phqStyles.seg1} />
                    <div className={phqStyles.seg2} />
                    <div className={phqStyles.seg3} />
                    <div className={phqStyles.seg4} />
                    <div className={phqStyles.seg5} />
                  </div>
                  <div className={phqStyles.barLabels}>
                    <span>0 Tối thiểu</span>
                    <span>21 Nặng</span>
                  </div>
                </div>

                <p className={phqStyles.scaleNote}>
                  Thang 0 đến 21. Đánh giá mức độ lo âu trong 14 ngày qua.
                </p>
              </section>

              {/* NÚT XEM LỊCH SỬ */}
              <div className={phqStyles.ctaRow}>
                <a href="/assessments" className={phqStyles.ctaBtn}>
                  Xem các lần sàng lọc →
                </a>
              </div>

              <p className={phqStyles.disclaimer}>
                Kết quả sàng lọc không phải chẩn đoán.
              </p>
            </section>
          </div>

          {/* CỘT 3: NHÌN LẠI CẢM XÚC */}
          <div className="ref-panel-col ref-panel-progress">
            <section className={progressStyles.card}>
              <header className={progressStyles.heading}>
                <div>
                  <h2 className={progressStyles.title}>Nhìn lại cảm xúc</h2>
                  <p className={progressStyles.subtitle}>
                    Các con số chỉ phản ánh những ngày bạn đã tự ghi nhận.
                  </p>
                </div>
                <span className={progressStyles.clockBadge}>↻</span>
              </header>

              <div className={progressStyles.topSection}>
                <div className={progressStyles.progressRingWrapper}>
                  <div style={{ textAlign: 'center' }}>
                    <strong
                      style={{ fontSize: '16px', color: 'var(--teal-deep)' }}
                    >
                      4/7
                    </strong>
                    <div style={{ fontSize: '10px', color: 'var(--ink-soft)' }}>
                      ngày
                    </div>
                  </div>
                </div>
                <div className={progressStyles.streakList}>
                  <div className={progressStyles.streakItem}>
                    <span>Chuỗi hiện tại</span>
                    <strong>4 ngày</strong>
                  </div>
                  <div className={progressStyles.streakItem}>
                    <span>Chuỗi dài nhất</span>
                    <strong>4 ngày</strong>
                  </div>
                </div>
              </div>

              <div
                style={{
                  padding: '12px',
                  background: '#fbfcfb',
                  borderRadius: '14px',
                  border: '1px solid var(--line)',
                  textAlign: 'center',
                }}
              >
                <span style={{ fontSize: '13px', color: 'var(--ink-soft)' }}>
                  Lịch theo dõi cảm xúc tháng 9
                </span>
              </div>
            </section>
          </div>
        </section>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DashboardPreview />
  </StrictMode>,
)
