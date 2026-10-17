'use client'

import Link from 'next/link'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'

import { useFeedback } from '@/components/ui/FeedbackProvider'
import type {
  ScreeningLevel,
  SupportEvaluation,
} from '@/features/assessment/api/care-contract'
import {
  createInitialCheckEvaluation,
  getInitialCheckState,
  resetInitialCheck,
} from '@/features/assessment/api/browser-care'
import AssessmentFlow from '@/features/assessment/components/AssessmentFlow'
import type { InitialCheckState } from '@/features/initial-check/api/initial-check-contract'
import { ApiError } from '@/lib/api/api-error'

import './guided-initial-check.css'

const screeningLabels: Record<ScreeningLevel, string> = {
  MINIMAL: 'Tối thiểu',
  MILD: 'Nhẹ',
  MODERATE: 'Trung bình',
  MODERATELY_SEVERE: 'Khá nặng',
  SEVERE: 'Nặng',
}

type JourneyIconName =
  | 'check'
  | 'clipboard'
  | 'shield'
  | 'route'
  | 'spark'
  | 'arrow'
  | 'info'
  | 'refresh'
  | 'history'
  | 'alert'

function JourneyIcon({ name }: { name: JourneyIconName }) {
  const paths: Record<JourneyIconName, ReactNode> = {
    check: <path d="m5 12 4 4L19 6" />,
    clipboard: (
      <>
        <path d="M9 5h6" />
        <path d="M9 9h6M9 13h4" />
        <path d="M7 3h10a2 2 0 0 1 2 2v14H5V5a2 2 0 0 1 2-2Z" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3 5 6v5c0 4.6 2.8 7.7 7 10 4.2-2.3 7-5.4 7-10V6l-7-3Z" />
        <path d="M12 8v5M12 16h.01" />
      </>
    ),
    route: (
      <>
        <circle cx="6" cy="6" r="2" />
        <circle cx="18" cy="18" r="2" />
        <path d="M8 6h4a3 3 0 0 1 3 3v6a3 3 0 0 0 3 3" />
      </>
    ),
    spark: (
      <>
        <path d="m12 3 1.3 4.2L17 9l-3.7 1.8L12 15l-1.3-4.2L7 9l3.7-1.8L12 3Z" />
        <path d="m18.5 13 .7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3Z" />
      </>
    ),
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 8h.01" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 7v5h-5" />
        <path d="M18.3 16a8 8 0 1 1 .8-7.5L20 12" />
      </>
    ),
    history: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path d="M3 4v4h4M12 7v5l3 2" />
      </>
    ),
    alert: (
      <>
        <path d="M12 4 3.8 19h16.4L12 4Z" />
        <path d="M12 9v4M12 16h.01" />
      </>
    ),
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.'
    }
    if (error.code === 'SUPPORT_EVIDENCE_INCOMPATIBLE') {
      return 'Hai kết quả đã lưu không còn tương thích để tạo hướng hỗ trợ. Bạn có thể bắt đầu một lượt kiểm tra mới.'
    }
    if (error.status === 429) {
      return 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng chờ một lúc rồi thử lại.'
    }
    if (
      [
        'CARE_TIMEOUT',
        'CARE_UNAVAILABLE',
        'REQUEST_TIMEOUT',
        'NETWORK_ERROR',
      ].includes(error.code)
    ) {
      return 'Dịch vụ tạm thời chưa sẵn sàng. Các bài đã hoàn thành vẫn được giữ lại; bạn có thể thử tiếp tục.'
    }
  }
  return 'Không thể tải hành trình kiểm tra lúc này. Các bài đã hoàn thành không bị xóa.'
}

function JourneyProgress({ phase }: { phase: InitialCheckState['phase'] }) {
  const active =
    phase === 'PHQ9'
      ? 1
      : phase === 'GAD7'
        ? 2
        : phase === 'EVALUATION_PENDING' || phase === 'COMPLETED'
          ? 3
          : 0

  const steps = ['Sẵn sàng', 'PHQ-9', 'GAD-7', 'Kết quả đã lưu']

  return (
    <nav
      className="initial-check-progress"
      aria-label="Tiến trình kiểm tra ban đầu"
    >
      <ol>
        {steps.map((label, index) => {
          const isCompleted =
            index < active || (phase === 'COMPLETED' && index === 3)
          const isActive = index === active && phase !== 'COMPLETED'
          return (
            <li
              key={label}
              className={isCompleted ? 'completed' : isActive ? 'active' : ''}
              aria-current={
                isActive || (phase === 'COMPLETED' && index === 3)
                  ? 'step'
                  : undefined
              }
            >
              <span className="initial-check-step-marker">
                {isCompleted ? <JourneyIcon name="check" /> : index + 1}
              </span>
              <span className="initial-check-step-label">{label}</span>
            </li>
          )
        })}
      </ol>
      <p className="initial-check-progress-summary" aria-live="polite">
        Bước {active + 1} trên 4
      </p>
    </nav>
  )
}

function ReadinessStep({
  phase,
}: {
  phase: 'PROFILE_REQUIRED' | 'CONSENT_REQUIRED'
}) {
  const needsProfile = phase === 'PROFILE_REQUIRED'
  return (
    <section
      className="initial-check-readiness"
      aria-labelledby="readiness-title"
    >
      <span className="initial-check-readiness-icon">
        <JourneyIcon name="clipboard" />
      </span>
      <span className="initial-check-kicker">Bước chuẩn bị</span>
      <h1 id="readiness-title" tabIndex={-1}>
        {needsProfile ? 'Hoàn thiện hồ sơ cơ bản' : 'Xác nhận quyền riêng tư'}
      </h1>
      <p>
        {needsProfile
          ? 'Bạn cần một hồ sơ để lưu các kết quả vào đúng tài khoản của mình.'
          : 'Bạn cần đọc và đồng ý với thông báo xử lý dữ liệu hiện hành trước khi làm bài.'}
      </p>
      <p className="initial-check-privacy-note">
        Hành trình không yêu cầu nhật ký, lịch sử tâm trạng hay nội dung tự do.
      </p>
      <Link
        className="btn btn-primary"
        href="/profile?returnTo=%2Finitial-check"
      >
        {needsProfile
          ? 'Tạo hồ sơ và tiếp tục'
          : 'Xem quyền riêng tư và tiếp tục'}
      </Link>
    </section>
  )
}

function SafetyBlock({ evaluation }: { evaluation: SupportEvaluation }) {
  const phq9 = evaluation.evidence.find((item) => item.instrument === 'PHQ9')!
  const positive = phq9.safetyStatus === 'POSITIVE_SAFETY_SCREEN'
  return (
    <section
      className={`initial-check-safety ${positive ? 'positive' : ''}`}
      aria-labelledby="initial-check-safety-title"
    >
      <header className="initial-check-section-header">
        <div className="initial-check-section-title">
          <span className="initial-check-section-icon">
            <JourneyIcon name="shield" />
          </span>
          <div>
            <span>Thông tin an toàn</span>
            <h2 id="initial-check-safety-title">
              {positive
                ? 'Ưu tiên xem hướng dẫn an toàn'
                : 'Không có câu trả lời cần thêm hướng dẫn an toàn'}
            </h2>
          </div>
        </div>
        <span className="initial-check-priority-badge">
          {positive ? 'Cần ưu tiên' : 'Đã kiểm tra'}
        </span>
      </header>
      <p>
        {evaluation.safetyGuidance ??
          'Câu trả lời PHQ-9 không kích hoạt hướng dẫn bổ sung. Điều này không phải là đánh giá toàn diện về nguy cơ hoặc lời khẳng định rằng bạn đang an toàn.'}
      </p>
      <p>
        MentalBridge không cung cấp ứng cứu khẩn cấp, không giám sát 24/7 và
        không tự động liên hệ người khác.
      </p>
      {positive && (
        <Link
          className="btn btn-primary"
          href="/safety-directory?trigger=positive-item-9"
        >
          Xem hỗ trợ trong khu vực đã chọn
        </Link>
      )}
    </section>
  )
}

function DonutScore({
  score,
  max,
  color,
  bgColor = '#edf2f7',
}: {
  score: number
  max: number
  color: string
  bgColor?: string
}) {
  const size = 72
  const strokeWidth = 5.5
  const center = size / 2
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clampedScore = Math.min(Math.max(score, 0), max)
  const offset = circumference - (clampedScore / max) * circumference

  return (
    <div className="donut-score-wrap" aria-hidden="true">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="donut-score-svg"
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={bgColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference.toFixed(2)}
          strokeDashoffset={offset.toFixed(2)}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="donut-score-label">
        <span className="donut-score-val">{score}</span>
        <span className="donut-score-max">/{max}</span>
      </div>
    </div>
  )
}

function getPhq9CardData(score: number, level: ScreeningLevel) {
  if (level === 'MINIMAL' || score <= 4) {
    return {
      title: '✓ Khí sắc tích cực & Ổn định',
      desc: 'Tâm trạng thư thái, năng lượng tích cực và giấc ngủ duy trì đều đặn. Tiếp tục giữ nếp sinh hoạt lành mạnh.',
      levelLabel: 'Mức độ tối thiểu',
      badgeClass: 'green',
      statusText: 'Đã ghi nhận',
      statusClass: 'green',
      donutColor: '#10b981',
      bgClass: 'theme-green',
    }
  }
  if (level === 'MILD' || score <= 9) {
    return {
      title: '✓ Thể chất ổn định',
      desc: 'Nhịp năng lượng và giấc ngủ duy trì tốt. Tiếp tục giữ nếp sinh hoạt điều độ hàng ngày.',
      levelLabel: 'Mức độ nhẹ',
      badgeClass: 'green',
      statusText: 'Đã ghi nhận',
      statusClass: 'green',
      donutColor: '#10b981',
      bgClass: 'theme-green',
    }
  }
  if (level === 'MODERATE' || score <= 14) {
    return {
      title: 'ⓘ Khí sắc có dấu hiệu chùng xuống',
      desc: 'Bạn có thể đang cảm thấy mệt mỏi hoặc giảm hứng thú. Hãy lắng nghe cơ thể và cho phép bản thân nghỉ ngơi.',
      levelLabel: 'Mức độ trung bình',
      badgeClass: 'amber',
      statusText: 'Cần lưu tâm',
      statusClass: 'amber',
      donutColor: '#f59e0b',
      bgClass: 'theme-amber',
    }
  }
  return {
    title: '⚠ Cần được chăm sóc & nâng đỡ',
    desc: 'Khí sắc và năng lượng đang chịu nhiều áp lực. Bạn rất xứng đáng nhận được sự hỗ trợ và đồng hành chuyên môn.',
    levelLabel: screeningLabels[level]
      ? `Mức độ ${screeningLabels[level].toLowerCase()}`
      : 'Mức độ nặng',
    badgeClass: 'red',
    statusText: 'Cần lưu ý',
    statusClass: 'red',
    donutColor: '#ef4444',
    bgClass: 'theme-red',
  }
}

function getGad7CardData(score: number, level: ScreeningLevel) {
  if (level === 'MINIMAL' || score <= 4) {
    return {
      title: '✓ Thư thái & Cân bằng',
      desc: 'Tâm trí an yên, ít bị ảnh hưởng bởi những lo âu hàng ngày. Hãy duy trì sự thảnh thơi này.',
      levelLabel: 'Mức độ tối thiểu',
      badgeClass: 'green',
      statusText: 'Đã ghi nhận',
      statusClass: 'green',
      donutColor: '#10b981',
      bgClass: 'theme-green',
    }
  }
  if (level === 'MILD' || score <= 9) {
    return {
      title: 'ⓘ Lo âu nhẹ thoáng qua',
      desc: 'Một vài khoảnh khắc căng thẳng xuất hiện nhưng vẫn nằm trong tầm kiểm soát. Thở sâu và thư giãn khi cần.',
      levelLabel: 'Mức độ nhẹ',
      badgeClass: 'green',
      statusText: 'Đã ghi nhận',
      statusClass: 'green',
      donutColor: '#10b981',
      bgClass: 'theme-green',
    }
  }
  if (level === 'MODERATE' || score <= 14) {
    return {
      title: 'ⓘ Tâm trí chịu nhiều tải',
      desc: 'Những suy nghĩ dồn dập khiến bạn mỏi mệt. Đã đến lúc dành cho mình một khoảng nghỉ ngơi dịu lành.',
      levelLabel: 'Mức độ trung bình',
      badgeClass: 'orange',
      statusText: 'Cần lưu tâm',
      statusClass: 'orange',
      donutColor: '#ea580c',
      bgClass: 'theme-orange',
    }
  }
  return {
    title: '⚠ Căng thẳng & Lo âu mức cao',
    desc: 'Cảm giác lo âu liên tục có thể gây kiệt sức và căng thẳng cơ thể. Hãy kết nối với chuyên gia để được nâng đỡ.',
    levelLabel: screeningLabels[level]
      ? `Mức độ ${screeningLabels[level].toLowerCase()}`
      : 'Mức độ nặng',
    badgeClass: 'red',
    statusText: 'Cần hỗ trợ',
    statusClass: 'red',
    donutColor: '#ef4444',
    bgClass: 'theme-red',
  }
}

function UnifiedResult({
  state,
  onRestart,
  onRequestRestart,
  onCancelRestart,
  restarting,
  confirmingRestart,
}: {
  state: Extract<InitialCheckState, { phase: 'COMPLETED' }>
  onRestart: () => void
  onRequestRestart: () => void
  onCancelRestart: () => void
  restarting: boolean
  confirmingRestart: boolean
}) {
  const { phq9, gad7, evaluation } = state
  const restartConfirmation = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (confirmingRestart) restartConfirmation.current?.focus()
  }, [confirmingRestart])

  const phq9Data = getPhq9CardData(
    phq9.result.totalScore,
    phq9.result.screeningLevel,
  )
  const gad7Data = getGad7CardData(
    gad7.result.totalScore,
    gad7.result.screeningLevel,
  )
  const phq9Evidence = evaluation.evidence.find(
    (item) => item.instrument === 'PHQ9',
  )
  const hasPositiveSafety =
    phq9Evidence?.safetyStatus === 'POSITIVE_SAFETY_SCREEN'

  return (
    <div className="initial-check-result">
      {/* 1. Hero Header Card */}
      <header className="initial-check-result-hero-zen">
        <div className="initial-check-hero-copy">
          <div className="initial-check-hero-eyebrow">
            <span className="initial-check-hero-dot" />
            <span>KHÔNG GIAN NHÌN LẠI BẢN THÂN</span>
          </div>
          <h1 tabIndex={-1}>Lắng nghe nhịp điệu tâm trí của bạn</h1>
          <p>
            Ghi nhận khách quan trong 14 ngày qua để cùng bạn tìm lại sự an yên
            và cân bằng nội tại.
          </p>
        </div>
        <div className="initial-check-hero-seal" aria-hidden="true">
          <div className="initial-check-seal-inner">
            <svg
              className="initial-check-seal-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path
                d="M12 3c-1.5 3-4 6-4 9a4 4 0 0 0 8 0c0-3-2.5-6-4-9Z"
                fill="currentColor"
                fillOpacity="0.15"
              />
              <path d="M12 12c-2.5-2-6-2.5-8-.5 0 3 2.5 5.5 6 6" />
              <path d="M12 12c2.5-2 6-2.5 8-.5 0 3-2.5 5.5-6 6" />
              <path d="M12 16v5" />
            </svg>
            <span className="initial-check-seal-arc">KHOẢNG THỞ</span>
            <span className="initial-check-seal-title">Bình an</span>
          </div>
        </div>
      </header>

      {/* Safety block if item 9 triggered */}
      {hasPositiveSafety && <SafetyBlock evaluation={evaluation} />}

      {/* 2. Score Cards (PHQ-9 & GAD-7) */}
      <article className={`initial-check-score-card ${phq9Data.bgClass}`}>
        <div className="initial-check-card-header">
          <div>
            <span className="initial-check-card-eyebrow">CHỈ SỐ PHQ-9</span>
            <h2>Khí sắc &amp; Thể chất</h2>
          </div>
          <DonutScore
            score={phq9.result.totalScore}
            max={27}
            color={phq9Data.donutColor}
          />
        </div>

        <div className={`initial-check-status-box ${phq9Data.bgClass}`}>
          <div className="initial-check-status-title">{phq9Data.title}</div>
          <p className="initial-check-status-desc">{phq9Data.desc}</p>
        </div>

        <div>
          <span className={`initial-check-level-pill ${phq9Data.badgeClass}`}>
            <span className="initial-check-pill-dot" />
            {phq9Data.levelLabel}
          </span>
        </div>

        <footer className="initial-check-card-footer">
          <span className="initial-check-card-time">
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            14 ngày vừa qua
          </span>
          <span
            className={`initial-check-card-status-text ${phq9Data.statusClass}`}
          >
            {phq9Data.statusText}
          </span>
        </footer>
      </article>

      <article className={`initial-check-score-card ${gad7Data.bgClass}`}>
        <div className="initial-check-card-header">
          <div>
            <span className="initial-check-card-eyebrow">CHỈ SỐ GAD-7</span>
            <h2>Căng thẳng &amp; Lo âu</h2>
          </div>
          <DonutScore
            score={gad7.result.totalScore}
            max={21}
            color={gad7Data.donutColor}
          />
        </div>

        <div className={`initial-check-status-box ${gad7Data.bgClass}`}>
          <div className="initial-check-status-title">{gad7Data.title}</div>
          <p className="initial-check-status-desc">{gad7Data.desc}</p>
        </div>

        <div>
          <span className={`initial-check-level-pill ${gad7Data.badgeClass}`}>
            <span className="initial-check-pill-dot" />
            {gad7Data.levelLabel}
          </span>
        </div>

        <footer className="initial-check-card-footer">
          <span className="initial-check-card-time">
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            14 ngày vừa qua
          </span>
          <span
            className={`initial-check-card-status-text ${gad7Data.statusClass}`}
          >
            {gad7Data.statusText}
          </span>
        </footer>
      </article>

      {/* 3. Companion Recommendation Banner */}
      <section
        className="initial-check-companion-banner"
        aria-label="Gợi ý đồng hành"
      >
        <div className="initial-check-companion-left">
          <div className="initial-check-companion-icon-box" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
            </svg>
          </div>
          <div className="initial-check-companion-text">
            <h2>Bạn không cần phải tự mình vượt qua tất cả</h2>
            <p>
              Một buổi trò chuyện ấm áp, lắng nghe không phán xét cùng chuyên
              gia tâm lý sẽ giúp xoa dịu những căng thẳng nội tại.
            </p>
          </div>
        </div>
        <div className="initial-check-companion-actions">
          <Link className="initial-check-btn-specialist" href="/specialists">
            Kết nối chuyên gia tâm lý →
          </Link>
          <Link className="initial-check-btn-mindfulness" href="/support-plan">
            Xem bài tập chánh niệm
          </Link>
        </div>
      </section>

      {/* 4. Curated Resources Section */}
      <section
        className="initial-check-curated-resources"
        aria-labelledby="curated-resources-title"
      >
        <div className="initial-check-curated-header">
          <div className="initial-check-curated-title-wrap">
            <svg
              className="initial-check-curated-spark-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07l14.14-14.14" />
              <circle cx="12" cy="12" r="3" fill="currentColor" />
            </svg>
            <h2 id="curated-resources-title">Tài nguyên nuôi dưỡng hôm nay</h2>
          </div>
          <span className="initial-check-curated-badge">
            TỰ CHỌN &amp; KHÔNG ÁP LỰC
          </span>
        </div>

        <div className="initial-check-curated-grid">
          <article className="initial-check-curated-card">
            <div className="initial-check-card-top">
              <span className="initial-check-time-pill pill-blue">3 PHÚT</span>
              <div
                className="initial-check-card-icon icon-blue"
                aria-hidden="true"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
                </svg>
              </div>
            </div>
            <h3>Ba phút nhận biết hiện tại</h3>
            <p>
              Bài tập neo tâm trí vào hơi thở ngắn, giúp hạ nhiệt những dòng suy
              nghĩ đang xáo trộn.
            </p>
            <Link href="/resources" className="initial-check-card-link">
              Bắt đầu thở →
            </Link>
          </article>

          <article className="initial-check-curated-card">
            <div className="initial-check-card-top">
              <span className="initial-check-time-pill pill-green">5 PHÚT</span>
              <div
                className="initial-check-card-icon icon-green"
                aria-hidden="true"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 22v-9" />
                  <path d="M9 15c0-4 3-7 7-7 0 4-3 7-7 7z" />
                  <path d="M15 11c0-3-2-5-5-5 0 3 2 5 5 5z" />
                </svg>
              </div>
            </div>
            <h3>Lên lịch hoạt động nhỏ</h3>
            <p>
              Chọn một niềm vui giản đơn hôm nay để kích hoạt lại cảm giác hài
              lòng và kết nối.
            </p>
            <Link href="/support-plan" className="initial-check-card-link">
              Lên kế hoạch →
            </Link>
          </article>

          <article className="initial-check-curated-card">
            <div className="initial-check-card-top">
              <span className="initial-check-time-pill pill-amber">9 PHÚT</span>
              <div
                className="initial-check-card-icon icon-amber"
                aria-hidden="true"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M11 5L6 9H2v6h4l5 4V5z" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </svg>
              </div>
            </div>
            <h3>Thư giãn cơ tiến triển</h3>
            <p>
              Giải tỏa căng cơ tích tụ từ vai, cổ đến các chi, trả lại trạng
              thái thả lỏng tự nhiên.
            </p>
            <Link href="/resources" className="initial-check-card-link">
              Nghe hướng dẫn →
            </Link>
          </article>
        </div>
      </section>

      {/* 5. Medical Privacy & Security Banner */}
      <aside
        className="initial-check-privacy-footer"
        aria-label="Cam kết bảo mật & Y tế"
      >
        <div className="initial-check-privacy-left">
          <div className="initial-check-privacy-shield" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <div>
            <strong>Bảo mật chuẩn y tế &amp; Riêng tư tuyệt đối</strong>
            <p>
              Dữ liệu bài sàng lọc chỉ dùng để gợi ý hành trình chăm sóc cá
              nhân, không chia sẻ với bên thứ ba.
            </p>
          </div>
        </div>
        <div className="initial-check-privacy-badge">
          Sàng lọc hỗ trợ • Không thay thế chẩn đoán bác sĩ
        </div>
      </aside>

      {/* 6. Discreet Utility Footer (Restart / History) */}
      <div className="initial-check-zen-footer-actions">
        {confirmingRestart ? (
          <div
            ref={restartConfirmation}
            className="initial-check-restart-confirm"
            role="group"
            aria-label="Xác nhận bắt đầu lượt mới"
            tabIndex={-1}
          >
            <div>
              <strong>Bắt đầu lại từ PHQ-9?</strong>
              <p>Các kết quả đã lưu vẫn có trong lịch sử sàng lọc của bạn.</p>
            </div>
            <div className="initial-check-restart-btns">
              <button
                className="btn btn-ghost"
                type="button"
                onClick={onCancelRestart}
                disabled={restarting}
              >
                Giữ kết quả này
              </button>
              <button
                className="btn btn-primary"
                type="button"
                onClick={onRestart}
                disabled={restarting}
              >
                {restarting ? 'Đang chuẩn bị…' : 'Xác nhận lượt mới'}
              </button>
            </div>
          </div>
        ) : (
          <div className="initial-check-footer-links">
            <button
              type="button"
              className="initial-check-subtle-btn"
              onClick={onRequestRestart}
            >
              <JourneyIcon name="refresh" />
              Bắt đầu lượt kiểm tra mới
            </button>
            <span className="initial-check-footer-dot">•</span>
            <Link href="/assessments" className="initial-check-subtle-link">
              <JourneyIcon name="history" />
              Xem lịch sử sàng lọc
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default function GuidedInitialCheck({
  purpose = 'INITIAL_CHECK',
}: {
  purpose?: 'INITIAL_CHECK' | 'REASSESSMENT'
}) {
  const { showActionToast } = useFeedback()
  const [state, setState] = useState<InitialCheckState | null>(null)
  const [loading, setLoading] = useState(true)
  const [evaluating, setEvaluating] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [confirmingRestart, setConfirmingRestart] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const activeRequest = useRef(0)

  const load = useCallback(async () => {
    const requestId = ++activeRequest.current
    setLoading(true)
    setError(null)
    try {
      let nextState = await getInitialCheckState(purpose)
      if (requestId !== activeRequest.current) return
      setState(nextState)
      setLoading(false)

      if (nextState.phase === 'EVALUATION_PENDING') {
        setEvaluating(true)
        try {
          await createInitialCheckEvaluation(purpose)
          nextState = await getInitialCheckState(purpose)
          if (requestId !== activeRequest.current) return
          setState(nextState)
        } finally {
          if (requestId === activeRequest.current) setEvaluating(false)
        }
      }
    } catch (cause) {
      if (requestId !== activeRequest.current) return
      setError(errorMessage(cause))
      setLoading(false)
      setEvaluating(false)
    }
  }, [purpose])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => {
      window.clearTimeout(timer)
      activeRequest.current += 1
    }
  }, [load])

  const restart = async () => {
    setRestarting(true)
    setError(null)
    try {
      setState(await resetInitialCheck(purpose))
      setConfirmingRestart(false)
      showActionToast({
        title: 'Đã bắt đầu lượt kiểm tra mới',
        tone: 'success',
      })
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setRestarting(false)
    }
  }

  if (loading && !state) {
    return (
      <section
        className="initial-check-runtime-state"
        aria-live="polite"
        aria-busy="true"
      >
        <span className="care-loader" aria-hidden="true" />
        <h1>Đang xác định bước tiếp theo</h1>
        <p>MentalBridge đang kiểm tra hồ sơ và các bước đã hoàn thành.</p>
      </section>
    )
  }

  if (error) {
    return (
      <section className="initial-check-runtime-state error" role="alert">
        <span aria-hidden="true">
          <JourneyIcon name="alert" />
        </span>
        <h1>Chưa thể tiếp tục</h1>
        <p>{error}</p>
        <div>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => void load()}
          >
            Thử lại
          </button>
          <Link className="btn btn-ghost" href="/dashboard">
            Về bảng điều khiển
          </Link>
        </div>
      </section>
    )
  }

  if (!state) return null

  return (
    <div className="initial-check-flow">
      <JourneyProgress phase={state.phase} />
      {(state.phase === 'PROFILE_REQUIRED' ||
        state.phase === 'CONSENT_REQUIRED') && (
        <ReadinessStep phase={state.phase} />
      )}
      {state.phase === 'PHQ9' && (
        <AssessmentFlow
          mode="authenticated"
          instrument="PHQ9"
          workflow="initial-check"
          screeningPurpose={purpose}
          returnHref="/dashboard"
          completionLabel="Lưu PHQ-9 và bắt đầu GAD-7"
          completionPendingLabel="Đang lưu PHQ-9…"
          onCompleted={() => void load()}
        />
      )}
      {state.phase === 'GAD7' && (
        <div className="initial-check-assessment-step">
          <aside role="status">
            <strong>PHQ-9 đã được lưu</strong>
            <p>Bây giờ hãy hoàn thành GAD-7 để tạo kết quả hỗ trợ tổng thể.</p>
          </aside>
          <AssessmentFlow
            mode="authenticated"
            instrument="GAD7"
            workflow="initial-check"
            screeningPurpose={purpose}
            returnHref="/dashboard"
            onCompleted={() => void load()}
          />
        </div>
      )}
      {state.phase === 'EVALUATION_PENDING' && (
        <section
          className="initial-check-runtime-state"
          aria-live="polite"
          aria-busy={evaluating}
        >
          <span className="care-loader" aria-hidden="true" />
          <h1>Đang tổng hợp kết quả đã lưu</h1>
          <p>
            PHQ-9 và GAD-7 đã hoàn thành. Vui lòng giữ trang này mở trong giây
            lát.
          </p>
        </section>
      )}
      {state.phase === 'COMPLETED' && (
        <UnifiedResult
          state={state}
          onRestart={() => void restart()}
          onRequestRestart={() => setConfirmingRestart(true)}
          onCancelRestart={() => setConfirmingRestart(false)}
          restarting={restarting}
          confirmingRestart={confirmingRestart}
        />
      )}
    </div>
  )
}
