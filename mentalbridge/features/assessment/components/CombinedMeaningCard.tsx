'use client'

import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  FileText,
  History,
  Info,
  RotateCcw,
  ShieldCheck,
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
const levelRanges: Record<ScreeningLevel, string> = {
  MINIMAL: '0–4',
  MILD: '5–9',
  MODERATE: '10–14',
  MODERATELY_SEVERE: '15–19',
  SEVERE: '20–27',
}

function EvidenceCard({
  evidence,
}: Readonly<{ evidence: CombinedScreeningMeaning['evidence'][number] }>) {
  const isPhq9 = evidence.instrument === 'PHQ9'
  const maximum = isPhq9 ? 27 : 21
  const instrumentLabel = isPhq9 ? 'PHQ-9' : 'GAD-7'
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
        <div className="combined-meaning-instrument">
          <h3 id={`combined-${evidence.instrument}-title`}>
            {instrumentLabel}
          </h3>
          <span>{isPhq9 ? 'Dấu hiệu trầm cảm' : 'Dấu hiệu lo âu'}</span>
        </div>
        <span className="combined-meaning-level">
          <span className="combined-meaning-level-dot" aria-hidden="true" />
          Mức {levelLabels[evidence.screeningLevel].toLowerCase()}
        </span>
      </header>
      <div className="combined-meaning-score-body">
        <p className="combined-meaning-score-value">
          <strong>{evidence.totalScore}</strong>
          <span>/{maximum} điểm</span>
        </p>
        <p className="combined-meaning-score-description">
          {instrumentLabel} ghi nhận mức{' '}
          {levelLabels[evidence.screeningLevel].toLowerCase()} trong 14 ngày
          trước lần sàng lọc này.
        </p>
      </div>
      <progress
        className="combined-meaning-native-progress"
        value={evidence.totalScore}
        max={maximum}
        aria-label={`${instrumentLabel}: ${evidence.totalScore} trên ${maximum} điểm, mức ${levelLabels[evidence.screeningLevel]}`}
      />
      <div className="combined-meaning-scale" aria-hidden="true">
        <div className="combined-meaning-scale-bars">
          {bands.map(([label], index) => (
            <span
              className={index === activeBand ? 'is-active' : undefined}
              key={label}
            />
          ))}
        </div>
        <div className="combined-meaning-scale-labels">
          {bands.map(([label, range], index) => (
            <span
              className={index === activeBand ? 'is-active' : undefined}
              key={label}
            >
              {label} <small>({range})</small>
            </span>
          ))}
        </div>
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
}: Readonly<{
  meaning: CombinedScreeningMeaning
  historical?: boolean
  headingLevel?: 'h1' | 'h2'
  showHistoryNavigation?: boolean
  onRestart?: () => void
  restarting?: boolean
}>) {
  const Heading = headingLevel
  const occurredAt = meaning.episodeCompletedAt ?? meaning.evaluatedAt
  const isSafety = meaning.presentationPriority === 'SAFETY'
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
  const guideHref = meaning.supportGuideId
    ? `/support-guides/${meaning.supportGuideId}?from=screening-history&resultEvaluationId=${meaning.supportEvaluationId}`
    : undefined

  return (
    <article
      className={`combined-meaning-card priority-${meaning.presentationPriority.toLowerCase()}`}
      aria-labelledby="combined-meaning-title"
    >
      {historical && showHistoryNavigation && (
        <div className="combined-meaning-history-bar">
          <Link href="/assessments">
            <ArrowLeft aria-hidden="true" />
            Quay lại lịch sử sàng lọc
          </Link>
          <span>Bản ghi lưu trữ · Chỉ đọc</span>
        </div>
      )}

      {isSafety && (
        <section
          className="combined-meaning-safety"
          aria-labelledby="combined-safety-title"
        >
          <span className="combined-meaning-safety-icon">
            <ShieldCheck aria-hidden="true" />
          </span>
          <div>
            <span className="combined-meaning-kicker">
              Ưu tiên an toàn ngay lúc này
            </span>
            <Heading id="combined-safety-title">
              Xem hướng dẫn an toàn và tìm hỗ trợ trực tiếp
            </Heading>
            <p>{meaning.safetyGuidance}</p>
            <Link
              className="combined-meaning-primary"
              href="/safety-directory?trigger=positive-item-9"
            >
              Xem hỗ trợ trong khu vực <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </section>
      )}

      <div className="combined-meaning-scores" aria-label="Hai kết quả riêng">
        {meaning.evidence.map((item) => (
          <EvidenceCard evidence={item} key={item.assessmentId} />
        ))}
      </div>

      <section className="combined-meaning-summary">
        {historical && (
          <div className="combined-meaning-context">
            <div>
              <span className="combined-meaning-archive-label">
                Bản ghi lưu trữ
              </span>
              <time dateTime={occurredAt}>
                <CalendarDays aria-hidden="true" />
                {new Date(occurredAt).toLocaleString('vi-VN')}
              </time>
              <span>{purposeLabel}</span>
            </div>
            <span>
              <Check aria-hidden="true" />
              {guideHref ? 'Có gợi ý đã lưu' : 'Kết quả đã lưu'}
            </span>
          </div>
        )}
        {!guideHref && (
          <aside className="combined-meaning-guide-status" role="note">
            <Info aria-hidden="true" />
            <p>
              <strong>Lần đánh giá này chưa có gợi ý đã lưu.</strong> Bạn có thể
              xem các lựa chọn hỗ trợ hiện tại bên dưới.
            </p>
          </aside>
        )}
        <header className="combined-meaning-header">
          <span className="combined-meaning-kicker">
            <Check aria-hidden="true" />
            {isSafety
              ? 'Kết quả của hai bài sàng lọc'
              : 'Ý nghĩa kết quả tổng hợp'}
          </span>
          {isSafety ? (
            <h2 id="combined-meaning-title">
              Kết quả đã lưu của lần sàng lọc này
            </h2>
          ) : (
            <Heading id="combined-meaning-title">
              {meaning.baseMeaning.text}
            </Heading>
          )}
          {!isSafety && <p>{meaning.nextStep.text}</p>}
          <p className="combined-meaning-disclaimer">
            <Info aria-hidden="true" />
            {historical
              ? 'Phản ánh câu trả lời trong 14 ngày trước thời điểm làm bài, không phải chẩn đoán y khoa.'
              : 'Dựa trên câu trả lời trong 14 ngày qua, không phải chẩn đoán y khoa.'}
          </p>
        </header>
        {!isSafety && professional && (
          <h2 className="combined-meaning-next-title">
            {urgentProfessional
              ? 'Nên sớm trao đổi với chuyên gia'
              : 'Trao đổi với chuyên gia khi bạn sẵn sàng'}
          </h2>
        )}
        <div className="combined-meaning-actions">
          {!isSafety && professional && (
            <Link className="combined-meaning-primary" href="/specialists">
              {historical ? 'Tìm chuyên gia hiện tại' : 'Xem chuyên gia'}{' '}
              <ArrowRight aria-hidden="true" />
            </Link>
          )}
          {guideHref && (
            <Link
              className={
                professional || isSafety
                  ? 'combined-meaning-secondary'
                  : 'combined-meaning-primary'
              }
              href={guideHref}
            >
              {isSafety
                ? 'Xem gợi ý an toàn đã lưu'
                : historical
                  ? 'Xem gợi ý đã lưu'
                  : 'Xem gợi ý hỗ trợ'}{' '}
              <ArrowRight aria-hidden="true" />
            </Link>
          )}
          {!guideHref && !isSafety && (
            <Link className="combined-meaning-secondary" href="/resources">
              <BookOpen aria-hidden="true" />
              Xem tài nguyên hiện tại
            </Link>
          )}
          {!historical && (
            <Link className="combined-meaning-secondary" href="/assessments">
              <History aria-hidden="true" />
              Xem lịch sử sàng lọc
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
        </div>
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
            <Disclosure
              summary="Thông tin kỹ thuật"
              summaryLabel="Thông tin kỹ thuật và nguồn dữ liệu"
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
          </Disclosure>
        </div>
      </section>
      {!isSafety && (
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
