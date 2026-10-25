'use client'

import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CircleCheck,
  FileText,
  History,
  Info,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react'
import type { ReactNode } from 'react'

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
const levelRanges: Record<ScreeningLevel, string> = {
  MINIMAL: '0–4',
  MILD: '5–9',
  MODERATE: '10–14',
  MODERATELY_SEVERE: '15–19',
  SEVERE: '20–27',
}
const completedAtFormat = new Intl.DateTimeFormat('vi-VN', {
  hour: '2-digit',
  minute: '2-digit',
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
})

// Plain-language band first (design rule 7); the instrument name and raw score live in the score details.
function SeverityBand({
  evidence,
  heading: BandHeading,
}: Readonly<{
  evidence: CombinedScreeningMeaning['evidence'][number]
  heading: 'h2' | 'h3'
}>) {
  const isPhq9 = evidence.instrument === 'PHQ9'
  const maximum = isPhq9 ? 27 : 21
  const activeBand =
    evidence.screeningLevel === 'MINIMAL'
      ? 0
      : evidence.screeningLevel === 'MILD'
        ? 1
        : evidence.screeningLevel === 'MODERATE'
          ? 2
          : 3
  // The final visual group spans two PHQ-9 bands. The exact classification
  // remains in the badge and expanded score details, from Care.
  const bands = [
    ['Tối thiểu', '0–4'],
    ['Nhẹ', '5–9'],
    ['Trung bình', '10–14'],
    [isPhq9 ? 'Khá nặng – Nặng' : 'Nặng', `15–${maximum}`],
  ]
  return (
    <section
      className={`combined-meaning-score level-${evidence.screeningLevel.toLowerCase().replaceAll('_', '-')}`}
      aria-labelledby={`combined-${evidence.instrument}-title`}
    >
      <header>
        <BandHeading id={`combined-${evidence.instrument}-title`}>
          {isPhq9 ? 'Dấu hiệu trầm cảm' : 'Dấu hiệu lo âu'}
        </BandHeading>
        <div className="combined-meaning-level">
          <span className="combined-meaning-level-dot" aria-hidden="true" />
          Mức {levelLabels[evidence.screeningLevel].toLowerCase()}
        </div>
      </header>
      <div className="combined-meaning-scale">
        <div className="combined-meaning-scale-bars" aria-hidden="true">
          {bands.map(([label], index) => (
            <span
              className={index === activeBand ? 'is-active' : undefined}
              key={label}
            />
          ))}
        </div>
        <ol className="combined-meaning-scale-labels" aria-label="Các mức">
          {bands.map(([label, range], index) => (
            <li
              className={index === activeBand ? 'is-active' : undefined}
              aria-current={index === activeBand ? 'true' : undefined}
              key={label}
            >
              {label} <small>({range})</small>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export function CombinedMeaningCard({
  meaning,
  historical = false,
  headingLevel = 'h1',
  showHistoryNavigation = true,
  onRestart,
  restarting = false,
  afterActions,
}: Readonly<{
  meaning: CombinedScreeningMeaning
  historical?: boolean
  headingLevel?: 'h1' | 'h2'
  showHistoryNavigation?: boolean
  onRestart?: () => void
  restarting?: boolean
  /** Rendered right under the actions, for example a restart confirmation. */
  afterActions?: ReactNode
}>) {
  const Heading = headingLevel
  const occurredAt = meaning.episodeCompletedAt ?? meaning.evaluatedAt
  const isSafety = meaning.presentationPriority === 'SAFETY'
  const SubHeading = isSafety || headingLevel === 'h2' ? 'h3' : 'h2'
  const professional = meaning.presentationPriority === 'PROFESSIONAL_SUPPORT'
  const urgentProfessional = meaning.evidence.some(
    (item) =>
      item.screeningLevel === 'MODERATELY_SEVERE' ||
      item.screeningLevel === 'SEVERE',
  )
  const purposeLabel =
    meaning.episodePurpose === 'REASSESSMENT'
      ? 'Đánh giá lại'
      : meaning.episodePurpose === 'INITIAL_CHECK'
        ? 'Kiểm tra ban đầu'
        : 'Kết quả sàng lọc'
  // A current reassessment continues only to its own saved Guide, never the initial-check one.
  const continuesToGuide =
    !historical &&
    (meaning.episodePurpose === 'INITIAL_CHECK' || !!meaning.supportGuideId)
  const currentGuideHref = meaning.supportGuideId
    ? `/support-guides/${meaning.supportGuideId}`
    : '/support-guides'
  const guideHref = meaning.supportGuideId
    ? `/support-guides/${meaning.supportGuideId}?from=screening-history&resultEvaluationId=${meaning.supportEvaluationId}`
    : undefined

  return (
    <article
      data-page-motion="off"
      className={`combined-meaning priority-${meaning.presentationPriority.toLowerCase()}`}
      aria-labelledby="combined-meaning-title"
    >
      {historical && showHistoryNavigation && (
        <div className="combined-meaning-history-bar">
          <Link href="/assessments">
            <ArrowLeft aria-hidden="true" />
            Quay lại lịch sử sàng lọc
          </Link>
        </div>
      )}

      {isSafety && (
        <section
          className="combined-meaning-safety"
          aria-labelledby="combined-safety-title"
        >
          <div className="combined-meaning-safety-icon">
            <ShieldCheck aria-hidden="true" />
          </div>
          <div>
            <Heading id="combined-safety-title">
              {historical
                ? 'Thông tin an toàn của lần sàng lọc này'
                : 'Xem hướng dẫn an toàn và tìm hỗ trợ trực tiếp'}
            </Heading>
            {historical && (
              <p>
                Hướng dẫn dưới đây gắn với câu trả lời của lần sàng lọc đã lưu,
                không khẳng định tình trạng hiện tại của bạn.
              </p>
            )}
            <p>{meaning.safetyGuidance}</p>
            <p>
              MentalBridge không cung cấp ứng cứu khẩn cấp, không giám sát 24/7
              và không tự động liên hệ người khác.
            </p>
            <Link
              className="combined-meaning-primary"
              href={
                historical
                  ? '/safety-directory'
                  : '/safety-directory?trigger=positive-item-9'
              }
            >
              {historical
                ? 'Nếu bạn cần hỗ trợ ngay'
                : 'Xem hỗ trợ trong khu vực'}{' '}
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </section>
      )}

      <section className="combined-meaning-summary">
        {historical && (
          <p className="combined-meaning-context">
            <span>
              <CalendarDays aria-hidden="true" />
              <span>{purposeLabel}</span>
              <span aria-hidden="true">·</span>
              <time dateTime={occurredAt}>
                {completedAtFormat.format(new Date(occurredAt))}
              </time>
            </span>
          </p>
        )}
        {!historical && (
          <p className="combined-meaning-context combined-meaning-done">
            <span>
              <CircleCheck aria-hidden="true" />
              Đã lưu kết quả {purposeLabel.toLowerCase()}
            </span>
          </p>
        )}
        {!guideHref && !continuesToGuide && (
          <aside className="combined-meaning-guide-status" role="note">
            <Info aria-hidden="true" />
            <p>
              <strong>Lần sàng lọc này chưa có gợi ý đã lưu.</strong> Bạn có thể
              xem các lựa chọn hỗ trợ hiện tại bên dưới.
            </p>
          </aside>
        )}
        {isSafety ? (
          <h2 id="combined-meaning-title" className="combined-meaning-title">
            {historical
              ? 'Kết quả đã lưu của lần sàng lọc này'
              : 'Kết quả hai bài sàng lọc của bạn'}
          </h2>
        ) : (
          <Heading
            id="combined-meaning-title"
            className="combined-meaning-title"
          >
            {meaning.baseMeaning.text}
          </Heading>
        )}
        <div className="combined-meaning-result">
          <div
            className="combined-meaning-scores"
            role="group"
            aria-label="Hai kết quả riêng"
          >
            {meaning.evidence.map((item) => (
              <SeverityBand
                evidence={item}
                heading={SubHeading}
                key={item.assessmentId}
              />
            ))}
          </div>
          <p className="combined-meaning-disclaimer">
            <Info aria-hidden="true" />
            {historical
              ? 'Phản ánh câu trả lời trong 14 ngày trước thời điểm làm bài, không phải chẩn đoán y khoa.'
              : 'Dựa trên câu trả lời trong 14 ngày qua, không phải chẩn đoán y khoa.'}
          </p>
        </div>
        {!isSafety && (
          <div className="combined-meaning-next">
            {professional && (
              <SubHeading className="combined-meaning-next-title">
                {urgentProfessional
                  ? 'Nên sớm trao đổi với chuyên gia'
                  : 'Trao đổi với chuyên gia khi bạn sẵn sàng'}
              </SubHeading>
            )}
            <p>{meaning.nextStep.text}</p>
          </div>
        )}
        <div className="combined-meaning-actions">
          {continuesToGuide && (
            <Link
              className={
                isSafety
                  ? 'combined-meaning-secondary'
                  : 'combined-meaning-primary'
              }
              href={currentGuideHref}
            >
              Tiếp tục xem gợi ý hỗ trợ <ArrowRight aria-hidden="true" />
            </Link>
          )}
          {!isSafety && professional && (
            <Link
              className={
                continuesToGuide
                  ? 'combined-meaning-secondary'
                  : 'combined-meaning-primary'
              }
              href="/specialists"
            >
              {historical ? 'Tìm chuyên gia hiện tại' : 'Xem chuyên gia'}{' '}
              <ArrowRight aria-hidden="true" />
            </Link>
          )}
          {historical && guideHref && (
            <Link
              className={
                professional || isSafety
                  ? 'combined-meaning-secondary'
                  : 'combined-meaning-primary'
              }
              href={guideHref}
            >
              {isSafety ? 'Xem gợi ý an toàn đã lưu' : 'Xem gợi ý đã lưu'}{' '}
              <ArrowRight aria-hidden="true" />
            </Link>
          )}
          {!guideHref && !isSafety && !continuesToGuide && (
            <Link
              className={
                professional
                  ? 'combined-meaning-secondary'
                  : 'combined-meaning-primary'
              }
              href="/resources"
            >
              <BookOpen aria-hidden="true" />
              Xem tài nguyên hiện tại
            </Link>
          )}
        </div>
        {!historical && (
          <div className="combined-meaning-utility">
            <Link className="combined-meaning-quiet" href="/assessments">
              <History aria-hidden="true" />
              Xem lịch sử sàng lọc
            </Link>
            {onRestart && (
              <button
                className="combined-meaning-quiet"
                type="button"
                onClick={onRestart}
                disabled={restarting}
                aria-busy={restarting}
                aria-expanded={Boolean(afterActions)}
              >
                <RotateCcw aria-hidden="true" />
                {restarting ? 'Đang chuẩn bị…' : 'Làm lại bài sàng lọc'}
              </button>
            )}
          </div>
        )}
        {afterActions}
        <div className="combined-meaning-disclosures">
          <Disclosure
            summaryLabel={
              isSafety ? 'Điều cần biết về kết quả này' : 'Vì sao có gợi ý này?'
            }
            summary={
              <span>
                <Info aria-hidden="true" />
                {isSafety
                  ? 'Điều cần biết về kết quả này'
                  : 'Vì sao có gợi ý này?'}
              </span>
            }
          >
            {!isSafety && <p>{meaning.baseMeaning.rationale}</p>}
            <p>{meaning.nextStep.boundary}</p>
          </Disclosure>
          <Disclosure
            summaryLabel="Xem chi tiết điểm số và giới hạn công cụ"
            summary={
              <span>
                <FileText aria-hidden="true" />
                Xem chi tiết điểm số và giới hạn công cụ
              </span>
            }
          >
            <div className="combined-meaning-detail-scores">
              {meaning.evidence.map((item) => (
                <div key={item.assessmentId}>
                  <strong>
                    {item.instrument === 'PHQ9' ? 'PHQ-9' : 'GAD-7'}
                  </strong>
                  <span>
                    {item.totalScore}/{item.instrument === 'PHQ9' ? 27 : 21}{' '}
                    điểm · {levelLabels[item.screeningLevel]}
                  </span>
                  <p>
                    {item.instrument === 'GAD7' &&
                    item.screeningLevel === 'SEVERE'
                      ? '15–21'
                      : levelRanges[item.screeningLevel]}{' '}
                    điểm
                  </p>
                </div>
              ))}
            </div>
            <p>{meaning.disclaimer}</p>
          </Disclosure>
        </div>
      </section>
      {!isSafety && !professional && (
        <aside className="combined-meaning-reassurance">
          <ShieldCheck aria-hidden="true" />
          <p>
            Nếu bạn không yên tâm về tình trạng của mình, bạn có thể chủ động
            trao đổi với chuyên gia tâm lý.
          </p>
          <Link href="/specialists">
            Tìm chuyên gia <ArrowRight aria-hidden="true" />
          </Link>
        </aside>
      )}
    </article>
  )
}
