'use client'

import Link from 'next/link'
import type { MouseEvent } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CirclePlay,
  HeartHandshake,
  Info,
  Leaf,
  NotebookPen,
  ShieldCheck,
  Wind,
} from 'lucide-react'

import type {
  CombinedScreeningMeaning,
  ScreeningLevel,
} from '@/features/assessment/api/care-contract'
import type { SupportGuide } from '../api/support-guide-contract'
import { guideReturnQuery, type GuideContinuation } from './guided-continuation'

const levelLabels: Record<ScreeningLevel, string> = {
  MINIMAL: 'Tối thiểu',
  MILD: 'Nhẹ',
  MODERATE: 'Trung bình',
  MODERATELY_SEVERE: 'Khá nặng',
  SEVERE: 'Nặng',
}

const emptyResourceCopy: Record<
  Exclude<
    SupportGuide['resourceResolution']['status'],
    'AVAILABLE' | 'PARTIAL'
  >,
  string
> = {
  EMPTY: 'Gợi ý này không có bài tập nào được lưu kèm.',
  STALE:
    'Các bài tập phù hợp đã được cập nhật trước khi gợi ý này được lưu, nên chưa có bài nào đi kèm.',
  UNAVAILABLE:
    'Khi lưu gợi ý này, MentalBridge chưa kiểm tra được bài tập phù hợp, nên chưa có bài nào đi kèm.',
}

export type SupportGuideScore = Readonly<{
  totalScore: number
  screeningLevel: ScreeningLevel
  submittedAt?: string
}>
export type SupportGuideScorePair = Readonly<{
  phq9: SupportGuideScore
  gad7: SupportGuideScore
}>

const categoryIcons: Record<string, typeof BookOpen> = {
  BREATHING: Wind,
  MEDITATION: Leaf,
  JOURNALING: NotebookPen,
  VIDEO: CirclePlay,
}

function levelClass(level: ScreeningLevel | undefined) {
  return `level-${level?.toLowerCase().replaceAll('_', '-') ?? 'unavailable'}`
}

type GuidePriority = 'SAFETY' | 'PROFESSIONAL' | 'SELF_GUIDED' | 'UNKNOWN'

function knownLevel(value: string | undefined): ScreeningLevel | undefined {
  return value === 'MINIMAL' ||
    value === 'MILD' ||
    value === 'MODERATE' ||
    value === 'MODERATELY_SEVERE' ||
    value === 'SEVERE'
    ? value
    : undefined
}

function guideDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

function guidePriority(
  guide: SupportGuide,
  meaning: CombinedScreeningMeaning | null | undefined,
  continuation: GuideContinuation | null | undefined,
): GuidePriority {
  if (guide.safety.status === 'POSITIVE_SAFETY_SCREEN') return 'SAFETY'
  if (continuation?.professional) return 'PROFESSIONAL'
  if (meaning?.presentationPriority === 'PROFESSIONAL_SUPPORT')
    return 'PROFESSIONAL'
  if (continuation || meaning?.presentationPriority === 'SELF_GUIDED')
    return 'SELF_GUIDED'
  return 'UNKNOWN'
}

function ScoreCard({
  instrument,
  evidence,
  score,
}: Readonly<{
  instrument: 'PHQ9' | 'GAD7'
  evidence: SupportGuide['provenance']['assessmentResults'][number] | undefined
  score: SupportGuideScore | undefined
}>) {
  const phq9 = instrument === 'PHQ9'
  const level = knownLevel(score?.screeningLevel ?? evidence?.screeningLevel)
  return (
    <section className={`support-guide-score ${levelClass(level)}`}>
      <div>
        <h3>Bài sàng lọc {phq9 ? 'PHQ-9' : 'GAD-7'}</h3>
        <p>{phq9 ? 'Dấu hiệu trầm cảm' : 'Dấu hiệu lo âu'}</p>
      </div>
      <div className="support-guide-score-result">
        <strong>{score ? `${score.totalScore}/${phq9 ? 27 : 21}` : '—'}</strong>
        <span className="support-guide-level">
          {level
            ? `Mức ${levelLabels[level].toLowerCase()}`
            : 'Không đủ dữ liệu điểm'}
        </span>
      </div>
    </section>
  )
}

function ResourceList({
  guide,
  historical,
  resultEvaluationId,
}: Readonly<{
  guide: SupportGuide
  historical: boolean
  resultEvaluationId?: string
}>) {
  return (
    <ol>
      {guide.resources.map((resource) => {
        const Icon = categoryIcons[resource.category] ?? BookOpen
        return (
          <li key={`${resource.resourceId}:${resource.contentVersion}`}>
            <div className="support-guide-resource-top">
              <span className="support-guide-resource-icon" aria-hidden="true">
                <Icon />
              </span>
              <span className="support-guide-resource-domain">
                {resource.domain === 'DEPRESSIVE_SYMPTOMS'
                  ? 'Tâm trạng'
                  : 'Lo âu'}
              </span>
            </div>
            <div className="support-guide-resource-copy">
              <h3
                id={`guide-resource-${guide.supportGuideId}-${resource.resourceId}`}
              >
                {resource.title}
              </h3>
              <p>{resource.summary}</p>
            </div>
            <a
              className="support-guide-resource-link"
              aria-describedby={`guide-resource-${guide.supportGuideId}-${resource.resourceId}`}
              href={
                resource.externalUrl ??
                `/resources/${resource.resourceId}?contentVersion=${encodeURIComponent(resource.contentVersion)}&${guideReturnQuery(guide, { historical, resultEvaluationId })}`
              }
              target={resource.externalUrl ? '_blank' : undefined}
              rel={resource.externalUrl ? 'noreferrer' : undefined}
            >
              {resource.externalUrl ? 'Mở tài nguyên' : 'Xem bài tập'}
              <ArrowRight aria-hidden="true" />
            </a>
          </li>
        )
      })}
    </ol>
  )
}

function revealResources(event: MouseEvent<HTMLAnchorElement>) {
  const target = document.getElementById('support-guide-resources')
  const modified =
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  if (!target || modified) return
  event.preventDefault()
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  target.scrollIntoView({
    behavior: reduce ? 'auto' : 'smooth',
    block: 'start',
  })
  target.focus({ preventScroll: true })
  target.animate?.(
    reduce
      ? [{ opacity: 0.9 }, { opacity: 0 }]
      : [
          { opacity: 0.9, transform: 'scale(1)' },
          { opacity: 0, transform: 'scale(1.012)' },
        ],
    {
      duration: 1400,
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      pseudoElement: '::after',
    },
  )
  window.history.replaceState(null, '', '#support-guide-resources')
}

export default function SupportGuideCard({
  guide,
  historical = false,
  scorePair,
  meaning,
  resultEvaluationId,
  headingLevel = 'h2',
  showOpenLink = true,
  continuation,
}: {
  guide: SupportGuide
  historical?: boolean
  scorePair?: SupportGuideScorePair | null
  meaning?: CombinedScreeningMeaning | null
  resultEvaluationId?: string
  headingLevel?: 'h1' | 'h2'
  showOpenLink?: boolean
  continuation?: GuideContinuation | null
}) {
  const priority = guidePriority(guide, meaning, continuation)
  const safetyPositive = priority === 'SAFETY'
  const professional = priority === 'PROFESSIONAL'
  const SafetyHeading = headingLevel
  const AnswerHeading = safetyPositive
    ? headingLevel === 'h1'
      ? 'h2'
      : 'h3'
    : headingLevel
  const phq9Evidence = guide.provenance.assessmentResults.find(
    (result) => result.instrument === 'PHQ9',
  )
  const gad7Evidence = guide.provenance.assessmentResults.find(
    (result) => result.instrument === 'GAD7',
  )
  const answerTitle = safetyPositive
    ? historical
      ? 'Lần sàng lọc này đã ưu tiên thông tin an toàn'
      : 'Ưu tiên hàng đầu là kết nối hỗ trợ an toàn ngay'
    : (meaning?.baseMeaning.text ??
      (professional
        ? 'Bạn nên trao đổi với chuyên gia tâm lý'
        : priority === 'SELF_GUIDED'
          ? 'Bắt đầu từ những bước nhỏ, vừa sức với bạn'
          : 'Gợi ý hỗ trợ đã lưu cho lần sàng lọc này'))
  const answerText = safetyPositive
    ? (meaning?.baseMeaning.text ?? guide.explanation.text)
    : (meaning?.baseMeaning.rationale ?? guide.explanation.text)
  const explanationInDisclosure = answerText !== guide.explanation.text
  const specialistsHref = historical
    ? '/specialists'
    : `/specialists?${guideReturnQuery(guide)}`
  const hasResources = guide.resources.length > 0
  const resourcesTitle = professional
    ? 'Trong lúc chờ trao đổi với chuyên gia'
    : 'Việc bạn có thể thử'

  const resourceBody = hasResources ? (
    <>
      <ResourceList
        guide={guide}
        historical={historical}
        resultEvaluationId={resultEvaluationId}
      />
      {guide.resourceResolution.status === 'PARTIAL' && (
        <p className="support-guide-resource-note">
          Một số bài tập chưa sẵn sàng khi gợi ý này được lưu nên không có ở
          đây.
        </p>
      )}
    </>
  ) : (
    <div className="support-guide-resource-empty">
      <Info aria-hidden="true" />
      <p>
        {
          emptyResourceCopy[
            guide.resourceResolution.status === 'AVAILABLE' ||
            guide.resourceResolution.status === 'PARTIAL'
              ? 'EMPTY'
              : guide.resourceResolution.status
          ]
        }
      </p>
      {!historical && !safetyPositive && (
        <Link href="/resources">Xem thư viện tài nguyên chung</Link>
      )}
    </div>
  )

  return (
    <article
      className={`support-guide-card${historical ? ' is-historical' : ''}`}
      aria-labelledby={`guide-${guide.supportGuideId}`}
      data-priority={priority.toLowerCase()}
    >
      {historical && (
        <>
          <div className="support-guide-back-row">
            <Link
              href={
                resultEvaluationId
                  ? `/assessments/results/${resultEvaluationId}`
                  : '/assessments'
              }
            >
              <ArrowLeft aria-hidden="true" />{' '}
              {resultEvaluationId
                ? 'Quay lại Kết quả trước đây'
                : 'Quay lại Lịch sử sàng lọc'}
            </Link>
          </div>
          <aside className="support-guide-history-notice">
            <Info aria-hidden="true" />
            <p>
              Gợi ý này được lưu ngày {guideDate(guide.generatedAt)} và có thể
              không còn đúng với cảm nhận hiện tại của bạn.
            </p>
          </aside>
        </>
      )}
      {safetyPositive && (
        <section
          className="support-guide-safety-priority"
          aria-labelledby={`guide-safety-${guide.supportGuideId}`}
        >
          <span className="support-guide-safety-icon">
            <ShieldCheck aria-hidden="true" />
          </span>
          <div>
            <SafetyHeading id={`guide-safety-${guide.supportGuideId}`}>
              {historical
                ? 'Nếu lúc này bạn không cảm thấy an toàn, hãy tìm hỗ trợ trực tiếp'
                : 'Xem hướng dẫn an toàn và tìm hỗ trợ trực tiếp'}
            </SafetyHeading>
            <p>{guide.safety.guidance}</p>
            <Link
              href={
                historical
                  ? '/safety-directory'
                  : '/safety-directory?trigger=positive-item-9'
              }
            >
              Xem hỗ trợ trong khu vực <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </section>
      )}
      <section
        className="support-guide-answer"
        data-purpose="hero-guide-answer"
      >
        <div className="support-guide-answer-copy">
          <AnswerHeading id={`guide-${guide.supportGuideId}`}>
            {answerTitle}
          </AnswerHeading>
          <ul className="support-guide-answer-bands" aria-label="Mức độ đã lưu">
            {[phq9Evidence, gad7Evidence].map((result) => {
              const level = knownLevel(result?.screeningLevel)
              return (
                result &&
                level && (
                  <li key={result.instrument} className={levelClass(level)}>
                    {result.instrument === 'PHQ9' ? 'Tâm trạng' : 'Lo âu'} ·{' '}
                    <strong>Mức {levelLabels[level].toLowerCase()}</strong>
                  </li>
                )
              )
            })}
          </ul>
          <p>{answerText}</p>
          <div className="support-guide-answer-actions">
            {continuation !== undefined
              ? continuation &&
                (continuation.href.startsWith('#') ? (
                  <a
                    className="support-guide-primary"
                    href={continuation.href}
                    onClick={revealResources}
                  >
                    {continuation.label} <ArrowRight aria-hidden="true" />
                  </a>
                ) : (
                  <Link
                    className="support-guide-primary"
                    href={continuation.href}
                  >
                    {continuation.label} <ArrowRight aria-hidden="true" />
                  </Link>
                ))
              : professional && (
                  <Link
                    className="support-guide-primary"
                    href={specialistsHref}
                  >
                    <HeartHandshake aria-hidden="true" /> Tìm chuyên gia phù hợp
                  </Link>
                )}
            {professional && (
              <p className="support-guide-answer-note">
                Bạn chỉ xem danh sách chuyên gia. Chưa có lịch hẹn nào được đặt
                và không có dữ liệu nào được chia sẻ.
              </p>
            )}
          </div>
        </div>
      </section>
      <section
        className="support-guide-resources"
        id="support-guide-resources"
        tabIndex={-1}
        aria-labelledby={`guide-resources-${guide.supportGuideId}`}
      >
        {safetyPositive ? (
          <details className="support-guide-resources-deferred">
            <summary>
              <span id={`guide-resources-${guide.supportGuideId}`}>
                Bài tập đã lưu cùng gợi ý này
              </span>
            </summary>
            {resourceBody}
          </details>
        ) : (
          <>
            <header>
              <h2 id={`guide-resources-${guide.supportGuideId}`}>
                {resourcesTitle}
              </h2>
              {professional && hasResources && (
                <p>Các bài này không thay thế việc trao đổi với chuyên gia.</p>
              )}
            </header>
            {resourceBody}
          </>
        )}
        {(priority === 'SELF_GUIDED' || priority === 'UNKNOWN') && (
          <aside className="support-guide-professional-fallback">
            <p>
              Muốn được giải thích rõ hơn về kết quả? Bạn có thể trao đổi với
              chuyên gia.
            </p>
            <Link href={specialistsHref}>
              Tìm chuyên gia <ArrowRight aria-hidden="true" />
            </Link>
          </aside>
        )}
      </section>
      <section
        className="support-guide-linked-results"
        aria-labelledby={`guide-results-${guide.supportGuideId}`}
      >
        <header>
          <h2 id={`guide-results-${guide.supportGuideId}`}>
            Kết quả sàng lọc dùng cho gợi ý này
          </h2>
        </header>
        <div className="support-guide-score-grid">
          <ScoreCard
            instrument="PHQ9"
            evidence={phq9Evidence}
            score={scorePair?.phq9}
          />
          <ScoreCard
            instrument="GAD7"
            evidence={gad7Evidence}
            score={scorePair?.gad7}
          />
        </div>
        {explanationInDisclosure && (
          <details className="support-guide-disclosures">
            <summary>Về gợi ý này</summary>
            <p>{guide.explanation.text}</p>
          </details>
        )}
      </section>
      {(historical || showOpenLink) && (
        <footer className="support-guide-footer">
          {historical ? (
            <Link href="/assessments">
              <ArrowLeft aria-hidden="true" /> Quay lại lịch sử sàng lọc
            </Link>
          ) : (
            <Link href={`/support-guides/${guide.supportGuideId}`}>
              Mở lại hướng dẫn này <ArrowRight aria-hidden="true" />
            </Link>
          )}
        </footer>
      )}
    </article>
  )
}
