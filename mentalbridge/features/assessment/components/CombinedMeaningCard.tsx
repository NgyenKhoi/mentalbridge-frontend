'use client'

import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  HeartHandshake,
  History,
  Info,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'

import { Disclosure } from '@/components/ui/Disclosure'
import type {
  CombinedScreeningMeaning,
  ScreeningLevel,
} from '@/features/assessment/api/care-contract'

import './combined-meaning-card.css'

const levelLabels: Record<ScreeningLevel, string> = {
  MINIMAL: 'Tối thiểu',
  MILD: 'Nhẹ',
  MODERATE: 'Trung bình',
  MODERATELY_SEVERE: 'Khá nặng',
  SEVERE: 'Nặng',
}

type ScoreBand = Readonly<{
  level: ScreeningLevel
  label: string
  range: string
}>

const phq9Bands: readonly ScoreBand[] = [
  { level: 'MINIMAL', label: 'Tối thiểu', range: '0–4' },
  { level: 'MILD', label: 'Nhẹ', range: '5–9' },
  { level: 'MODERATE', label: 'Trung bình', range: '10–14' },
  { level: 'MODERATELY_SEVERE', label: 'Khá nặng', range: '15–19' },
  { level: 'SEVERE', label: 'Nặng', range: '20–27' },
]

const gad7Bands: readonly ScoreBand[] = [
  { level: 'MINIMAL', label: 'Tối thiểu', range: '0–4' },
  { level: 'MILD', label: 'Nhẹ', range: '5–9' },
  { level: 'MODERATE', label: 'Trung bình', range: '10–14' },
  { level: 'SEVERE', label: 'Nặng', range: '15–21' },
]

function levelClassName(level: ScreeningLevel) {
  return `level-${level.toLowerCase().replaceAll('_', '-')}`
}

function EvidenceCard({
  evidence,
}: Readonly<{
  evidence: CombinedScreeningMeaning['evidence'][number]
}>) {
  const isPhq9 = evidence.instrument === 'PHQ9'
  const maximum = isPhq9 ? 27 : 21
  const instrumentLabel = isPhq9 ? 'PHQ-9' : 'GAD-7'
  const bands = isPhq9 ? phq9Bands : gad7Bands
  return (
    <section
      className={`combined-meaning-score ${levelClassName(evidence.screeningLevel)}`}
      aria-labelledby={`combined-${evidence.instrument}-title`}
    >
      <header>
        <div>
          <span>{isPhq9 ? 'Tâm trạng' : 'Lo âu'}</span>
          <h3 id={`combined-${evidence.instrument}-title`}>
            {isPhq9 ? 'PHQ-9' : 'GAD-7'}
          </h3>
        </div>
        <span className="combined-meaning-level">
          <span className="combined-meaning-level-dot" aria-hidden="true" />
          {levelLabels[evidence.screeningLevel]}
        </span>
      </header>
      <p className="combined-meaning-score-value">
        <strong>{evidence.totalScore}</strong>
        <span>/{maximum} điểm</span>
      </p>
      <progress
        className="combined-meaning-native-progress"
        value={evidence.totalScore}
        max={maximum}
        aria-label={`${instrumentLabel}: ${evidence.totalScore} trên ${maximum} điểm, mức ${levelLabels[evidence.screeningLevel]}`}
      />
      <div
        className={`combined-meaning-scale segments-${bands.length}`}
        aria-hidden="true"
      >
        <div className="combined-meaning-scale-bars">
          {bands.map((band) => (
            <span
              className={
                band.level === evidence.screeningLevel ? 'is-active' : undefined
              }
              data-level={band.level}
              key={band.level}
            />
          ))}
        </div>
        <div className="combined-meaning-scale-labels">
          {bands.map((band) => (
            <span
              className={
                band.level === evidence.screeningLevel ? 'is-active' : undefined
              }
              key={band.level}
            >
              <strong>{band.label}</strong>
              <small>{band.range}</small>
            </span>
          ))}
        </div>
      </div>
      <small>Phản ánh câu trả lời trong 14 ngày trước lần sàng lọc.</small>
    </section>
  )
}

function RecommendedAction({
  meaning,
  historical,
}: Readonly<{
  meaning: CombinedScreeningMeaning
  historical: boolean
}>) {
  if (meaning.presentationPriority === 'SAFETY') {
    return (
      <section
        className="combined-meaning-action safety"
        aria-labelledby="combined-meaning-title"
      >
        <span className="combined-meaning-action-icon">
          <ShieldCheck aria-hidden="true" />
        </span>
        <div>
          <span>Ưu tiên an toàn ngay lúc này</span>
          <h1 id="combined-meaning-title">
            Xem hướng dẫn an toàn và tìm hỗ trợ trực tiếp
          </h1>
          <p>{meaning.safetyGuidance}</p>
          <Link
            className="combined-meaning-primary"
            href="/safety-directory?trigger=positive-item-9"
          >
            Xem hỗ trợ trong khu vực <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </section>
    )
  }

  const professional = meaning.presentationPriority === 'PROFESSIONAL_SUPPORT'
  return (
    <section className="combined-meaning-action">
      <span className="combined-meaning-action-icon">
        {professional ? (
          <HeartHandshake aria-hidden="true" />
        ) : (
          <Sparkles aria-hidden="true" />
        )}
      </span>
      <div>
        <span>
          {historical ? 'Gợi ý của lần đánh giá này' : 'Bước tiếp theo'}
        </span>
        <h2>
          {professional
            ? 'Trao đổi với chuyên gia khi bạn sẵn sàng'
            : 'Bắt đầu bằng một hoạt động nhỏ phù hợp với bạn'}
        </h2>
        <p>{meaning.nextStep.text}</p>
        <small>{meaning.nextStep.boundary}</small>
        <div className="combined-meaning-action-links">
          {professional ? (
            <Link className="combined-meaning-primary" href="/specialists">
              {historical ? 'Tìm chuyên gia hiện tại' : 'Xem chuyên gia'}{' '}
              <ArrowRight aria-hidden="true" />
            </Link>
          ) : historical && meaning.supportGuideId ? (
            <Link
              className="combined-meaning-primary"
              href={`/support-guides/${meaning.supportGuideId}?from=screening-history`}
            >
              Xem gợi ý đã lưu <ArrowRight aria-hidden="true" />
            </Link>
          ) : !historical ? (
            <Link className="combined-meaning-primary" href="/support-guides">
              Xem gợi ý hỗ trợ <ArrowRight aria-hidden="true" />
            </Link>
          ) : null}
          <Link className="combined-meaning-secondary" href="/resources">
            <BookOpen aria-hidden="true" />{' '}
            {historical ? 'Xem tài nguyên hiện tại' : 'Xem tài nguyên'}
          </Link>
        </div>
      </div>
    </section>
  )
}

export function CombinedMeaningCard({
  meaning,
  historical = false,
  onRestart,
  restarting = false,
}: Readonly<{
  meaning: CombinedScreeningMeaning
  historical?: boolean
  onRestart?: () => void
  restarting?: boolean
}>) {
  const occurredAt = meaning.episodeCompletedAt ?? meaning.evaluatedAt
  const isSafety = meaning.presentationPriority === 'SAFETY'
  const purposeLabel =
    meaning.episodePurpose === 'REASSESSMENT'
      ? 'Đánh giá lại'
      : meaning.episodePurpose === 'INITIAL_CHECK'
        ? 'Kiểm tra ban đầu'
        : 'Kết quả sàng lọc'

  return (
    <article
      className={`combined-meaning-card priority-${meaning.presentationPriority.toLowerCase()}`}
      aria-labelledby="combined-meaning-title"
    >
      {isSafety && (
        <RecommendedAction meaning={meaning} historical={historical} />
      )}

      <header className="combined-meaning-header">
        <div>
          <span className="combined-meaning-kicker">
            <Check aria-hidden="true" />
            {historical ? 'Kết quả trước đây' : 'Kết quả sàng lọc đã lưu'}
          </span>
          {isSafety ? (
            <h2>Kết quả của hai bài sàng lọc</h2>
          ) : (
            <h1 id="combined-meaning-title">{meaning.baseMeaning.text}</h1>
          )}
        </div>
        <div className="combined-meaning-context">
          <span>{purposeLabel}</span>
          <time dateTime={occurredAt}>
            <CalendarDays aria-hidden="true" />
            {new Date(occurredAt).toLocaleString('vi-VN')}
          </time>
        </div>
      </header>

      <div className="combined-meaning-scores" aria-label="Hai kết quả riêng">
        {meaning.evidence.map((item) => (
          <EvidenceCard evidence={item} key={item.assessmentId} />
        ))}
      </div>

      {!isSafety && (
        <RecommendedAction meaning={meaning} historical={historical} />
      )}

      {historical && !meaning.supportGuideId && (
        <aside className="combined-meaning-guide-status" role="note">
          <Info aria-hidden="true" />
          <p>
            <strong>Lần đánh giá này chưa có gợi ý đã lưu.</strong> Các liên kết
            hỗ trợ trên màn hình mở nội dung hiện tại; MentalBridge không tạo
            lại hoặc thay đổi nội dung lịch sử.
          </p>
        </aside>
      )}

      {meaning.presentationPriority !== 'SAFETY' && (
        <aside className="combined-meaning-reassurance">
          <ShieldCheck aria-hidden="true" />
          <p>
            <strong>Nếu bạn không yên tâm về tình trạng của mình,</strong> bạn
            có thể chủ động trao đổi với một chuyên gia tâm lý. Kết quả này
            không tự đặt lịch hoặc chia sẻ dữ liệu của bạn.
          </p>
          <Link href="/specialists">Tìm chuyên gia</Link>
        </aside>
      )}

      <div className="combined-meaning-disclosures">
        <Disclosure
          summaryLabel={
            isSafety ? 'Điều cần biết về kết quả này' : 'Vì sao có gợi ý này?'
          }
          summary={
            <span>
              <Info aria-hidden="true" />{' '}
              {isSafety
                ? 'Điều cần biết về kết quả này'
                : 'Vì sao có gợi ý này?'}
            </span>
          }
        >
          {!isSafety && <p>{meaning.baseMeaning.rationale}</p>}
          <p>{meaning.disclaimer}</p>
        </Disclosure>
        <Disclosure
          summaryLabel="Thông tin kỹ thuật và nguồn dữ liệu"
          summary={
            <span>
              <History aria-hidden="true" /> Thông tin kỹ thuật và nguồn dữ liệu
            </span>
          }
        >
          <dl className="combined-meaning-provenance">
            <div>
              <dt>Chính sách nguồn</dt>
              <dd>{meaning.sourcePolicyVersion}</dd>
            </div>
            <div>
              <dt>Phiên bản diễn giải</dt>
              <dd>{meaning.contentVersion}</dd>
            </div>
          </dl>
        </Disclosure>
      </div>

      <footer className="combined-meaning-footer">
        {historical ? (
          <Link className="combined-meaning-back" href="/assessments">
            <ArrowLeft aria-hidden="true" /> Quay lại lịch sử sàng lọc
          </Link>
        ) : (
          <Link className="combined-meaning-back" href="/assessments">
            <History aria-hidden="true" /> Xem lịch sử sàng lọc
          </Link>
        )}
        {historical &&
          meaning.supportGuideId &&
          ['PROFESSIONAL_SUPPORT', 'SAFETY'].includes(
            meaning.presentationPriority,
          ) && (
            <Link
              className={
                meaning.presentationPriority === 'SAFETY'
                  ? 'combined-meaning-secondary'
                  : 'combined-meaning-primary'
              }
              href={`/support-guides/${meaning.supportGuideId}?from=screening-history`}
            >
              {meaning.presentationPriority === 'SAFETY'
                ? 'Xem gợi ý an toàn đã lưu'
                : 'Xem gợi ý của lần này'}{' '}
              <ArrowRight aria-hidden="true" />
            </Link>
          )}
        {!historical && onRestart && (
          <button
            className="combined-meaning-secondary"
            type="button"
            onClick={onRestart}
            disabled={restarting}
            aria-busy={restarting}
          >
            <RotateCcw aria-hidden="true" />
            {restarting ? 'Đang chuẩn bị…' : 'Làm lại bài sàng lọc'}
          </button>
        )}
      </footer>
    </article>
  )
}
