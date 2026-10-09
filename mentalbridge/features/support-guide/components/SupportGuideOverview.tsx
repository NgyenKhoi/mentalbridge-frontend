'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  HeartHandshake,
  LoaderCircle,
  Phone,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  getInitialCheckState,
  reopenAssessment,
} from '@/features/assessment/api/browser-care'
import type {
  Assessment,
  ScreeningLevel,
  SupportEvaluation,
} from '@/features/assessment/api/care-contract'
import type { InitialCheckState } from '@/features/initial-check/api/initial-check-contract'
import { ApiError } from '@/lib/api/api-error'
import {
  generateSupportGuide,
  getSupportGuideHistory,
} from '../api/browser-support-guide'
import type { SupportGuide } from '../api/support-guide-contract'
import styles from './support-guide-overview.module.css'

type Score = Pick<
  Assessment,
  'assessmentId' | 'instrument' | 'submittedAt' | 'result'
>
type ScorePair = { phq9: Score; gad7: Score }

const levelLabels: Record<ScreeningLevel, string> = {
  MINIMAL: 'Tối thiểu',
  MILD: 'Nhẹ',
  MODERATE: 'Trung bình',
  MODERATELY_SEVERE: 'Khá nặng',
  SEVERE: 'Nặng',
}

function levelLabel(value: string | undefined) {
  switch (value) {
    case 'MINIMAL':
      return levelLabels.MINIMAL
    case 'MILD':
      return levelLabels.MILD
    case 'MODERATE':
      return levelLabels.MODERATE
    case 'MODERATELY_SEVERE':
      return levelLabels.MODERATELY_SEVERE
    case 'SEVERE':
      return levelLabels.SEVERE
    default:
      return value ?? 'Chưa có kết quả'
  }
}

const resourceMessages: Record<
  SupportGuide['resourceResolution']['status'],
  string
> = {
  AVAILABLE:
    'Các tài nguyên bên dưới đã được kiểm tra theo đúng phiên bản kết quả.',
  PARTIAL: 'Một số tài nguyên phù hợp đang tạm thời không khả dụng.',
  EMPTY: 'Hiện chưa có tài nguyên đã duyệt phù hợp với kết quả này.',
  STALE:
    'Phiên bản tài nguyên đã thay đổi nên MentalBridge không hiển thị gợi ý cũ.',
  UNAVAILABLE:
    'Không thể kiểm tra tài nguyên lúc này. Hướng dẫn an toàn vẫn luôn khả dụng.',
}

const tierLabels: Record<SupportEvaluation['supportTier'], string> = {
  SELF_GUIDED_SUPPORT: 'Tự chăm sóc theo nhịp riêng',
  PROFESSIONAL_SUPPORT_RECOMMENDED: 'Nên trao đổi với chuyên gia',
  SAFETY_FOLLOW_UP_RECOMMENDED: 'Ưu tiên thông tin an toàn',
}

function guideDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

function matchingEvaluation(
  state: InitialCheckState | null,
  guide: SupportGuide,
) {
  return state?.phase === 'COMPLETED' &&
    state.evaluation.supportEvaluationId === guide.supportEvaluationId
    ? state.evaluation
    : null
}

async function loadGuideScores(guide: SupportGuide): Promise<ScorePair | null> {
  const phq9Evidence = guide.provenance.assessmentResults.find(
    (result) => result.instrument === 'PHQ9',
  )
  const gad7Evidence = guide.provenance.assessmentResults.find(
    (result) => result.instrument === 'GAD7',
  )
  if (!phq9Evidence || !gad7Evidence) return null

  try {
    const [phq9, gad7] = await Promise.all([
      reopenAssessment('authenticated', phq9Evidence.assessmentId),
      reopenAssessment('authenticated', gad7Evidence.assessmentId),
    ])
    if (
      phq9.assessmentId !== phq9Evidence.assessmentId ||
      phq9.instrument !== 'PHQ9' ||
      phq9.result.screeningLevel !== phq9Evidence.screeningLevel ||
      gad7.assessmentId !== gad7Evidence.assessmentId ||
      gad7.instrument !== 'GAD7' ||
      gad7.result.screeningLevel !== gad7Evidence.screeningLevel
    )
      return null
    return { phq9, gad7 }
  } catch {
    return null
  }
}

function ScoreRow({
  label,
  score,
  maximum,
  level,
}: {
  label: string
  score: number | null
  maximum: number
  level: string
}) {
  return (
    <div className={styles.scoreRow}>
      <div className={styles.scoreTop}>
        <strong>{label}</strong>
        <span>
          {score === null ? (
            level
          ) : (
            <>
              {score} / {maximum} <b>{level}</b>
            </>
          )}
        </span>
      </div>
      <div className={styles.scoreTrack} aria-hidden="true">
        {score !== null && (
          <span
            className={styles.scoreFill}
            style={{ width: `${Math.min(100, (score / maximum) * 100)}%` }}
          />
        )}
      </div>
    </div>
  )
}

export default function SupportGuideOverview() {
  const router = useRouter()
  const [guide, setGuide] = useState<SupportGuide | null>(null)
  const [history, setHistory] = useState<SupportGuide[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [scores, setScores] = useState<ScorePair | null>(null)
  const [initialCheck, setInitialCheck] = useState<InitialCheckState | null>(
    null,
  )
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const generationKey = useRef<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [historyResult, checkResult] = await Promise.allSettled([
      getSupportGuideHistory(),
      getInitialCheckState(),
    ])
    if (checkResult.status === 'fulfilled') setInitialCheck(checkResult.value)
    if (historyResult.status === 'rejected') {
      setError('Chưa thể tải gợi ý hỗ trợ. Vui lòng thử lại.')
      setLoading(false)
      return
    }
    const latest = historyResult.value.items[0] ?? null
    setHistory(historyResult.value.items)
    setCursor(historyResult.value.nextCursor ?? null)
    setHasMore(historyResult.value.hasMore)
    setGuide(latest)
    setScores(latest ? await loadGuideScores(latest) : null)
    setLoading(false)
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeout)
  }, [load])

  const create = async () => {
    if (generating) return
    setGenerating(true)
    setError(null)
    const startedAt = Date.now()
    try {
      const currentCheck = await getInitialCheckState()
      setInitialCheck(currentCheck)
      if (currentCheck.phase !== 'COMPLETED') {
        router.push('/assessments')
        return
      }
      generationKey.current ??= crypto.randomUUID()
      const created = await generateSupportGuide(generationKey.current)
      const nextScores = await loadGuideScores(created)
      const remaining = 1100 - (Date.now() - startedAt)
      if (remaining > 0)
        await new Promise<void>((resolve) =>
          window.setTimeout(resolve, remaining),
        )
      setGuide(created)
      setHistory((current) => [
        created,
        ...current.filter(
          (item) => item.supportGuideId !== created.supportGuideId,
        ),
      ])
      setScores(nextScores)
      generationKey.current = null
    } catch (cause) {
      if (
        cause instanceof ApiError &&
        cause.code === 'INITIAL_CHECK_INCOMPLETE'
      ) {
        router.push('/assessments')
        return
      }
      setError('Chưa thể tạo gợi ý hỗ trợ. Vui lòng thử lại.')
    } finally {
      setGenerating(false)
    }
  }

  const loadMoreHistory = async () => {
    if (!cursor || historyLoading) return
    setHistoryLoading(true)
    try {
      const next = await getSupportGuideHistory(cursor)
      setHistory((current) => [
        ...current,
        ...next.items.filter(
          (item) =>
            !current.some(
              (existing) => existing.supportGuideId === item.supportGuideId,
            ),
        ),
      ])
      setCursor(next.nextCursor ?? null)
      setHasMore(next.hasMore)
    } catch {
      setError('Chưa thể tải thêm lịch sử gợi ý. Vui lòng thử lại.')
    } finally {
      setHistoryLoading(false)
    }
  }

  const evaluation = guide ? matchingEvaluation(initialCheck, guide) : null
  const hasNewCheck =
    guide &&
    initialCheck?.phase === 'COMPLETED' &&
    initialCheck.evaluation.supportEvaluationId !== guide.supportEvaluationId
  const phq9Evidence = guide?.provenance.assessmentResults.find(
    (result) => result.instrument === 'PHQ9',
  )
  const gad7Evidence = guide?.provenance.assessmentResults.find(
    (result) => result.instrument === 'GAD7',
  )
  const recommended = guide?.resources.slice(0, 2) ?? []
  const priorityCards = guide
    ? [
        ...recommended.map((resource) => ({
          key: resource.resourceId,
          title: resource.title,
          summary: resource.summary,
          href:
            resource.externalUrl ??
            `/resources/${resource.resourceId}?contentVersion=${encodeURIComponent(resource.contentVersion)}`,
          label: 'Tài nguyên đã rà soát',
          action: 'Xem tài nguyên',
          external: Boolean(resource.externalUrl),
        })),
        ...(recommended.length < 2
          ? [
              {
                key: 'resources',
                title: 'Tài nguyên tự hỗ trợ',
                summary: 'Chọn một hoạt động phù hợp với nhịp của bạn.',
                href: '/resources',
                label: 'Khám phá thêm',
                action: 'Xem tài nguyên',
                external: false,
              },
            ]
          : []),
        ...(recommended.length === 0
          ? [
              {
                key: 'support-plan',
                title: 'Kế hoạch hỗ trợ',
                summary: 'Xem các bước hỗ trợ và chọn điều phù hợp để bắt đầu.',
                href: '/support-plan',
                label: 'Lối tắt chung',
                action: 'Xem kế hoạch',
                external: false,
              },
            ]
          : []),
        {
          key: 'specialists',
          title: 'Kết nối với Chuyên gia Tâm lý',
          summary: 'Chủ động tìm chuyên gia và lựa chọn lịch hẹn phù hợp.',
          href: '/specialists',
          label: 'Chủ động lựa chọn',
          action: 'Xem chuyên gia',
          external: false,
        },
      ]
    : []

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroMeta}>
            <span>
              <Sparkles size={14} aria-hidden="true" />{' '}
              {guide ? 'Sau sàng lọc' : 'Gợi ý hỗ trợ'}
            </span>
            {guide && <span>Cập nhật: {guideDate(guide.generatedAt)}</span>}
            {guide && (
              <span className={styles.heroStatus}>
                {evaluation
                  ? tierLabels[evaluation.supportTier]
                  : 'Gợi ý đã sẵn sàng'}
              </span>
            )}
          </div>
          <h1>Gợi ý hỗ trợ dành riêng cho bạn</h1>
          <p>
            {guide?.explanation.text ??
              'Xem các bước hỗ trợ dựa trên cặp kết quả PHQ-9 và GAD-7 trong Kiểm tra ban đầu, rồi chủ động chọn điều phù hợp với bạn.'}
          </p>
        </div>
        <div className={styles.heroActions}>
          {guide && !hasNewCheck ? (
            <Link className={styles.heroPrimary} href="/initial-check">
              <RefreshCw size={17} aria-hidden="true" /> Cập nhật sàng lọc mới
            </Link>
          ) : (
            <button
              className={styles.heroPrimary}
              type="button"
              disabled={generating || loading}
              onClick={() => void create()}
            >
              {generating ? (
                <LoaderCircle
                  className={styles.spinner}
                  size={17}
                  aria-hidden="true"
                />
              ) : (
                <Sparkles size={17} aria-hidden="true" />
              )}
              {generating
                ? 'Đang tạo gợi ý...'
                : 'Tạo gợi ý từ kiểm tra ban đầu'}
            </button>
          )}
          {guide && (
            <Link className={styles.heroSecondary} href="/assessments">
              Xem lại bài kiểm tra
              {scores ? ` ${guideDate(scores.gad7.submittedAt)}` : ''}
            </Link>
          )}
        </div>
      </header>

      {loading && (
        <div className={styles.state} role="status">
          Đang tải gợi ý hỗ trợ...
        </div>
      )}
      {generating && (
        <div className={styles.loading} role="status">
          <LoaderCircle
            className={styles.spinner}
            size={20}
            aria-hidden="true"
          />{' '}
          Đang tạo gợi ý...
        </div>
      )}
      {error && (
        <div className={styles.state} role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => void load()}>
            Thử lại
          </button>
        </div>
      )}

      {guide && !loading && !generating && (
        <>
          <section
            className={styles.priority}
            aria-labelledby="support-priority-title"
          >
            <div className={styles.sectionHeading}>
              <div>
                <small>Hành động bước đầu</small>
                <h2 id="support-priority-title">
                  Các bước ưu tiên dành cho bạn
                </h2>
              </div>
            </div>
            <div className={styles.priorityGrid}>
              {priorityCards.map((card) => (
                <article className={styles.actionCard} key={card.key}>
                  <span className={styles.actionIcon}>
                    {card.key === 'specialists' ? (
                      <HeartHandshake size={23} aria-hidden="true" />
                    ) : (
                      <BookOpen size={23} aria-hidden="true" />
                    )}
                  </span>
                  <span className={styles.actionTag}>{card.label}</span>
                  <h3>{card.title}</h3>
                  <p>{card.summary}</p>
                  <a
                    className={styles.actionLink}
                    href={card.href}
                    target={card.external ? '_blank' : undefined}
                    rel={card.external ? 'noreferrer' : undefined}
                  >
                    {card.action}
                    <ArrowRight size={16} aria-hidden="true" />
                  </a>
                </article>
              ))}
            </div>
          </section>

          <div className={styles.evaluationGrid}>
            <section
              className={styles.metricsCard}
              aria-labelledby="support-metrics-title"
            >
              <div className={styles.metricHeading}>
                <span className={styles.actionIcon}>
                  <Sparkles size={21} aria-hidden="true" />
                </span>
                <div>
                  <h2 id="support-metrics-title">Chỉ số sức khỏe cảm xúc</h2>
                  <small>Chuẩn lượng giá quốc tế</small>
                </div>
              </div>
              <ScoreRow
                label="PHQ-9"
                score={scores?.phq9.result.totalScore ?? null}
                maximum={27}
                level={levelLabel(phq9Evidence?.screeningLevel)}
              />
              <ScoreRow
                label="GAD-7"
                score={scores?.gad7.result.totalScore ?? null}
                maximum={21}
                level={levelLabel(gad7Evidence?.screeningLevel)}
              />
              <p className={styles.mainFinding}>
                <strong>Ghi nhận chính:</strong>{' '}
                {evaluation?.nextStep.text ?? guide.explanation.text}
              </p>
            </section>
            <div className={styles.sideStack}>
              <section
                className={styles.safetyCard}
                aria-labelledby="support-safety-title"
              >
                <div className={styles.metricHeading}>
                  <span className={styles.actionIcon}>
                    <ShieldCheck size={21} aria-hidden="true" />
                  </span>
                  <h2 id="support-safety-title">Ưu tiên thông tin an toàn</h2>
                </div>
                <p>{guide.safety.guidance}</p>
                <a className={styles.safetyLink} href="tel:19005999">
                  <Phone size={16} aria-hidden="true" /> Gọi ngay 1900-5999
                </a>
              </section>
              <section
                className={styles.choiceCard}
                aria-labelledby="support-choice-title"
              >
                <div className={styles.metricHeading}>
                  <span className={styles.actionIcon}>
                    <CheckCircle2 size={21} aria-hidden="true" />
                  </span>
                  <h2 id="support-choice-title">Bạn toàn quyền lựa chọn</h2>
                </div>
                <p>
                  {evaluation?.disclaimer ??
                    'Bạn chủ động lựa chọn. An toàn không phụ thuộc gói dịch vụ hoặc AI.'}
                </p>
              </section>
            </div>
          </div>

          <section
            className={styles.resourcesPanel}
            aria-labelledby="support-resources-title"
          >
            <div className={styles.sectionHeading}>
              <div>
                <small>Đã xác minh chuyên môn</small>
                <h2 id="support-resources-title">
                  Tài nguyên tự hỗ trợ đã sẵn sàng
                </h2>
                <p>{resourceMessages[guide.resourceResolution.status]}</p>
              </div>
              <Link href="/resources">
                Xem tất cả <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
            {guide.resources.length > 0 && (
              <div className={styles.resourceGrid}>
                {guide.resources.map((resource) => (
                  <article
                    className={styles.resourceCard}
                    key={`${resource.resourceId}:${resource.contentVersion}`}
                  >
                    <span className={styles.actionIcon}>
                      <BookOpen size={19} aria-hidden="true" />
                    </span>
                    <h3>{resource.title}</h3>
                    <p>{resource.summary}</p>
                    <a
                      className={styles.resourceLink}
                      href={
                        resource.externalUrl ??
                        `/resources/${resource.resourceId}?contentVersion=${encodeURIComponent(resource.contentVersion)}`
                      }
                      target={resource.externalUrl ? '_blank' : undefined}
                      rel={resource.externalUrl ? 'noreferrer' : undefined}
                    >
                      Mở tài nguyên <ArrowRight size={16} aria-hidden="true" />
                    </a>
                  </article>
                ))}
              </div>
            )}
          </section>

          <footer className={styles.footer}>
            <span>
              <ShieldCheck size={15} aria-hidden="true" /> Tạo lúc{' '}
              {new Date(guide.generatedAt).toLocaleString('vi-VN')}
            </span>
            <Link
              className={styles.historyLink}
              href={`/support-guides/${guide.supportGuideId}`}
            >
              Mở lại hướng dẫn này
            </Link>
            <details className={styles.history}>
              <summary>Lịch sử gợi ý hỗ trợ</summary>
              <ul>
                {history.map((item) => (
                  <li key={item.supportGuideId}>
                    <Link href={`/support-guides/${item.supportGuideId}`}>
                      Gợi ý ngày {guideDate(item.generatedAt)}
                    </Link>
                  </li>
                ))}
              </ul>
              {hasMore && (
                <button
                  type="button"
                  disabled={historyLoading}
                  onClick={() => void loadMoreHistory()}
                >
                  {historyLoading ? 'Đang tải...' : 'Tải thêm lịch sử'}
                </button>
              )}
            </details>
          </footer>
        </>
      )}
    </div>
  )
}
