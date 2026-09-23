'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import ResourcesList from '@/components/ResourcesList'
import { Disclosure } from '@/components/ui/Disclosure'
import { Skeleton } from '@/components/ui/Skeleton'
import { ApiError } from '@/lib/api/api-error'
import type {
  AssessmentResult,
  Instrument,
  PrivacyDisclosure,
  Questionnaire,
  ScreeningLevel,
} from '@/features/assessment/api/care-contract'
import {
  assessmentErrorMessage,
  clearAnonymousAssessmentSession,
  createAssessmentIdempotencyKey,
  getCurrentQuestionnaire,
  getQuestionnaireDefinition,
  getPrivacyDisclosure,
  getCurrentConsents,
  recordPrivacyDecision,
  isMissingCurrentAssessment,
  reopenAssessment,
  startAnonymousAssessmentSession,
  submitAssessment,
  submitInitialCheckAssessment,
  type AssessmentMode,
  type AssessmentView,
} from '@/features/assessment/api/browser-care'

import './assessment-flow.css'

const levelLabels: Record<ScreeningLevel, string> = {
  MINIMAL: 'Tối thiểu',
  MILD: 'Nhẹ',
  MODERATE: 'Trung bình',
  MODERATELY_SEVERE: 'Khá nặng',
  SEVERE: 'Nặng',
}

const instrumentLabels: Readonly<
  Record<Instrument, { shortName: string; resultTitle: string }>
> = {
  PHQ9: { shortName: 'PHQ-9', resultTitle: 'Kết quả sàng lọc PHQ-9' },
  GAD7: { shortName: 'GAD-7', resultTitle: 'Kết quả sàng lọc GAD-7' },
}

function ResultPanel({
  assessment,
  questionnaire,
  mode,
  onRestart,
}: {
  assessment: AssessmentView
  questionnaire: Questionnaire
  mode: AssessmentMode
  onRestart: () => void
}) {
  const result: AssessmentResult = assessment.result
  const positive = result.safetyStatus === 'POSITIVE_SAFETY_SCREEN'
  const safetyApplicable = result.safetyStatus !== 'NOT_APPLICABLE'
  const maximumScore = Math.max(
    ...questionnaire.scoreBands.map((band) => band.maximumScore),
  )
  const instrumentLabel = instrumentLabels[assessment.instrument]

  return (
    <section className="care-result" aria-labelledby="care-result-title">
      <header>
        <span className="eyebrow">Kết quả sàng lọc của bạn</span>
        <h1 id="care-result-title">{instrumentLabel.resultTitle}</h1>
        <p>Kết quả được tính từ những câu trả lời bạn vừa cung cấp.</p>
      </header>

      <div className="care-result-grid">
        <article className="care-score-card">
          <span>Mức sàng lọc</span>
          <strong>{levelLabels[result.screeningLevel]}</strong>
          <div>
            <b>{result.totalScore}</b>
            <small>/ {maximumScore} điểm</small>
          </div>
        </article>

        <article
          className={`care-safety-card ${!safetyApplicable ? 'not-applicable' : positive ? 'positive' : 'negative'}`}
        >
          <span>Trạng thái mục an toàn</span>
          <strong>
            {!safetyApplicable
              ? 'Không áp dụng cho bộ câu hỏi này'
              : positive
                ? 'Có câu trả lời cần bạn lưu ý'
                : 'Không có câu trả lời cần thêm hướng dẫn an toàn'}
          </strong>
          <p>
            {!safetyApplicable
              ? `${instrumentLabel.shortName} không thực hiện mục sàng lọc an toàn riêng.`
              : positive
                ? 'Bạn có thể xem các tài nguyên hỗ trợ phù hợp ở bên dưới.'
                : 'Bạn vẫn có thể xem các tài nguyên chăm sóc sức khỏe tinh thần ở bên dưới.'}
          </p>
          {positive && (
            <Link
              href="/safety-directory?trigger=positive-item-9"
              className="btn btn-primary care-safety-directory-link"
            >
              Xem hỗ trợ trong khu vực đã chọn
            </Link>
          )}
        </article>
      </div>

      <aside className="care-result-disclaimer">
        <span aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5" />
            <path d="M12 8h.01" />
          </svg>
        </span>
        <div>
          <strong>Kết quả sàng lọc không phải là chẩn đoán</strong>
          <p>
            Đây là kết quả sàng lọc triệu chứng, không phải chẩn đoán y khoa.
            MentalBridge không cung cấp dịch vụ ứng cứu khẩn cấp, không giám sát
            con người 24/7 và không tự động liên hệ bên thứ ba.
          </p>
        </div>
      </aside>

      <Disclosure className="care-provenance" summary="Thông tin kỹ thuật">
        <dl>
          <div>
            <dt>Bộ câu hỏi</dt>
            <dd>{assessment.questionnaireVersion}</dd>
          </div>
          <div>
            <dt>Cách tính điểm</dt>
            <dd>{result.scoringVersion}</dd>
          </div>
          <div>
            <dt>Quy tắc an toàn</dt>
            <dd>{result.safetyPolicyVersion ?? 'Không áp dụng'}</dd>
          </div>
        </dl>
      </Disclosure>

      <Disclosure
        className="care-provenance care-definition-history"
        summary="Nội dung và thang điểm của bài này"
      >
        <p>
          Nội dung dưới đây được lưu cùng kết quả để bạn có thể xem lại đúng bài
          đã thực hiện.
        </p>
        <ol>
          {questionnaire.questions.map((question) => (
            <li key={question.questionId}>{question.prompt}</li>
          ))}
        </ol>
        <ul>
          {questionnaire.scoreBands.map((band) => (
            <li key={band.screeningLevel}>
              {band.minimumScore}–{band.maximumScore}:{' '}
              {levelLabels[band.screeningLevel]}
            </li>
          ))}
        </ul>
      </Disclosure>

      {mode === 'anonymous' && (
        <aside className="care-anonymous-note">
          <div>
            <strong>Kết quả ẩn danh chỉ tồn tại trong phiên hiện tại</strong>
            <p>
              Đăng ký không tự động gắn kết quả này vào tài khoản. Lịch sử sàng
              lọc chỉ dành cho người dùng đã đăng nhập.
            </p>
          </div>
          <Link href="/register" className="btn btn-outline">
            Tạo tài khoản
          </Link>
        </aside>
      )}

      <ResourcesList limit={6} className="care-result-resources" />

      <div className="care-result-actions">
        <Link href="/safety-directory" className="btn btn-outline">
          Tôi cần hỗ trợ ngay
        </Link>
        <button className="btn btn-primary" type="button" onClick={onRestart}>
          Làm bài mới
        </button>
        <Link
          href={mode === 'anonymous' ? '/' : '/assessments'}
          className="btn btn-ghost"
        >
          Quay lại
        </Link>
        <Link href="/resources" className="btn btn-outline">
          Xem tài nguyên đã rà soát
        </Link>
      </div>
    </section>
  )
}

async function initializeCare(mode: AssessmentMode, instrument: Instrument) {
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const [currentQuestionnaire, currentDisclosure, currentConsents] =
        await Promise.all([
          getCurrentQuestionnaire(instrument),
          getPrivacyDisclosure(),
          mode === 'authenticated'
            ? getCurrentConsents()
            : Promise.resolve(null),
        ])
      return { currentQuestionnaire, currentDisclosure, currentConsents }
    } catch (cause) {
      lastError = cause
      if (
        !(cause instanceof ApiError) ||
        (cause.status !== undefined && cause.status < 500) ||
        attempt === 2
      ) {
        throw cause
      }
      await new Promise((resolve) =>
        window.setTimeout(resolve, 150 * (attempt + 1)),
      )
    }
  }
  throw lastError
}

export default function AssessmentFlow({
  mode,
  instrument,
  initialAssessmentId,
  workflow = 'standalone',
  onCompleted,
  returnHref,
  completionLabel = 'Xem kết quả',
  completionPendingLabel = 'Đang gửi…',
}: {
  mode: AssessmentMode
  instrument: Instrument
  initialAssessmentId?: string
  workflow?: 'standalone' | 'initial-check'
  onCompleted?: () => void
  returnHref?: string
  completionLabel?: string
  completionPendingLabel?: string
}) {
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null)
  const [assessment, setAssessment] = useState<AssessmentView | null>(null)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [disclosure, setDisclosure] = useState<PrivacyDisclosure | null>(null)
  const [disclosureAcknowledged, setDisclosureAcknowledged] = useState(false)
  const [privacyGranted, setPrivacyGranted] = useState(false)
  const idempotencyKey = useRef(createAssessmentIdempotencyKey())

  const initialize = useCallback(
    async (reopenExisting = true) => {
      setLoading(true)
      setError(null)

      try {
        if (reopenExisting && workflow === 'standalone') {
          try {
            const current = await reopenAssessment(mode, initialAssessmentId)
            if (current.instrument === instrument) {
              const historicalDefinition = await getQuestionnaireDefinition(
                current.questionnaireDefinitionId,
              )
              if (
                historicalDefinition.definitionId !==
                  current.questionnaireDefinitionId ||
                historicalDefinition.instrument !== current.instrument ||
                historicalDefinition.version !== current.questionnaireVersion ||
                historicalDefinition.scoringVersion !==
                  current.result.scoringVersion
              ) {
                throw new Error('Assessment definition provenance mismatch')
              }
              setQuestionnaire(historicalDefinition)
              setAssessment(current)
              return
            }
            if (initialAssessmentId) {
              throw new Error('Assessment instrument does not match route')
            }
          } catch (currentError) {
            if (!isMissingCurrentAssessment(currentError)) throw currentError
          }
        }

        const { currentQuestionnaire, currentDisclosure, currentConsents } =
          await initializeCare(mode, instrument)
        if (mode === 'anonymous') await startAnonymousAssessmentSession()
        setQuestionnaire(currentQuestionnaire)
        setDisclosure(currentDisclosure)
        setPrivacyGranted(
          currentConsents?.decisions.some(
            (decision) =>
              decision.policyVersion === currentDisclosure.version &&
              decision.granted,
          ) ?? false,
        )
      } catch (initializationError) {
        setError(assessmentErrorMessage(initializationError))
      } finally {
        setLoading(false)
      }
    },
    [initialAssessmentId, instrument, mode, workflow],
  )

  useEffect(() => {
    const timer = window.setTimeout(() => void initialize(), 0)
    return () => window.clearTimeout(timer)
  }, [initialize])

  const questions = useMemo(
    () => questionnaire?.questions ?? [],
    [questionnaire],
  )
  const currentQuestion = questions[step]
  const answeredCount = useMemo(
    () =>
      questions.filter((question) => answers[question.questionId] !== undefined)
        .length,
    [answers, questions],
  )

  const restart = async () => {
    if (mode === 'anonymous') {
      await clearAnonymousAssessmentSession().catch(() => undefined)
    }
    idempotencyKey.current = createAssessmentIdempotencyKey()
    setAssessment(null)
    setQuestionnaire(null)
    setAnswers({})
    setStep(0)
    setDisclosureAcknowledged(false)
    if (initialAssessmentId)
      window.history.replaceState(
        null,
        '',
        `/assessment/${instrument.toLowerCase()}`,
      )
    await initialize(false)
  }

  const submit = async () => {
    if (
      !questionnaire ||
      !disclosure ||
      !disclosureAcknowledged ||
      answeredCount !== questions.length
    )
      return
    setSubmitting(true)
    setError(null)

    try {
      if (mode === 'authenticated' && !privacyGranted) {
        await recordPrivacyDecision(true, disclosure.version)
        setPrivacyGranted(true)
      }
      const submission = {
        questionnaireDefinitionId: questionnaire.definitionId,
        privacyPolicyVersion: disclosure.version,
        privacyDisclosureAcknowledged: true as const,
        answers: questions.map((question) => ({
          questionId: question.questionId,
          value: answers[question.questionId],
        })),
      }
      const completed =
        workflow === 'initial-check'
          ? await submitInitialCheckAssessment(
              instrument,
              submission,
              idempotencyKey.current,
            )
          : await submitAssessment(mode, submission, idempotencyKey.current)
      if (onCompleted) {
        onCompleted()
        return
      }
      setAssessment(completed)
    } catch (submissionError) {
      setError(assessmentErrorMessage(submissionError))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <section
        className="care-assessment-state care-assessment-loading"
        role="status"
        aria-live="polite"
      >
        <div className="care-assessment-skeleton" aria-hidden="true">
          <Skeleton width="34%" height={14} />
          <Skeleton width="72%" height={44} />
          <Skeleton width="88%" height={18} />
          <Skeleton width="100%" height={132} />
        </div>
        <h1 className="sr-only">Đang chuẩn bị bài sàng lọc</h1>
        <p className="sr-only">
          MentalBridge đang chuẩn bị nội dung phù hợp cho bạn.
        </p>
      </section>
    )
  }

  if (assessment) {
    return (
      <ResultPanel
        assessment={assessment}
        questionnaire={questionnaire!}
        mode={mode}
        onRestart={() => void restart()}
      />
    )
  }

  if (!questionnaire || !currentQuestion) {
    return (
      <section className="care-assessment-state unavailable" role="alert">
        <span aria-hidden="true">!</span>
        <h1>Bài sàng lọc hiện chưa khả dụng</h1>
        <p>{error ?? 'Hiện chưa có bộ câu hỏi phù hợp.'}</p>
        <div>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => void initialize()}
          >
            Thử lại
          </button>
          <Link
            href={returnHref ?? (mode === 'anonymous' ? '/' : '/assessments')}
            className="btn btn-ghost"
          >
            Quay lại
          </Link>
        </div>
      </section>
    )
  }

  const selectedValue = answers[currentQuestion.questionId]
  const isLast = step === questions.length - 1

  return (
    <section
      className="care-questionnaire"
      aria-labelledby="care-questionnaire-title"
    >
      <header>
        <span className="eyebrow">
          {mode === 'anonymous' ? 'Sàng lọc ẩn danh' : 'Sàng lọc cá nhân'}
        </span>
        <h1 id="care-questionnaire-title">{questionnaire.title}</h1>
        <p>
          Hãy chọn câu trả lời đúng với trải nghiệm trong{' '}
          {questionnaire.referencePeriodDays} ngày gần đây.
        </p>
      </header>

      <div className="care-progress-copy">
        <span>
          Câu {step + 1} / {questions.length}
        </span>
        <span>{answeredCount} câu đã trả lời</span>
      </div>
      <div
        className="care-progress"
        role="progressbar"
        aria-label="Tiến độ bài sàng lọc"
        aria-valuemin={1}
        aria-valuemax={questions.length}
        aria-valuenow={step + 1}
      >
        <i style={{ width: `${((step + 1) / questions.length) * 100}%` }} />
      </div>

      <fieldset className="care-question">
        <legend>
          <small>Câu {currentQuestion.itemNumber}</small>
          {currentQuestion.prompt}
        </legend>
        <div className="care-options">
          {questionnaire.responseOptions.map((option) => (
            <label
              key={option.value}
              className={selectedValue === option.value ? 'selected' : ''}
            >
              <input
                type="radio"
                name={`question-${currentQuestion.questionId}`}
                value={option.value}
                checked={selectedValue === option.value}
                onChange={() =>
                  setAnswers((current) => ({
                    ...current,
                    [currentQuestion.questionId]: option.value,
                  }))
                }
              />
              <i aria-hidden="true" />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {isLast && disclosure && (
        <aside className="care-disclosure">
          <strong>{disclosure.title}</strong>
          <p>{disclosure.content}</p>
          <label>
            <input
              type="checkbox"
              checked={disclosureAcknowledged}
              onChange={(event) =>
                setDisclosureAcknowledged(event.target.checked)
              }
            />
            <span>
              Tôi đã đọc và xác nhận: tôi đồng ý cho MentalBridge xử lý dữ liệu
              sàng lọc theo nội dung trên.
            </span>
          </label>
        </aside>
      )}

      {error && (
        <p className="care-submit-error" role="alert">
          {error}
        </p>
      )}

      <footer className="care-question-actions">
        <button
          className="btn btn-ghost"
          type="button"
          disabled={step === 0 || submitting}
          onClick={() => setStep((current) => current - 1)}
        >
          ← Câu trước
        </button>
        {isLast ? (
          <button
            className="btn btn-primary"
            type="button"
            disabled={
              answeredCount !== questions.length ||
              !disclosureAcknowledged ||
              submitting
            }
            onClick={() => void submit()}
          >
            {submitting ? completionPendingLabel : completionLabel}
          </button>
        ) : (
          <button
            className="btn btn-primary"
            type="button"
            disabled={selectedValue === undefined}
            onClick={() => setStep((current) => current + 1)}
          >
            Câu tiếp theo →
          </button>
        )}
      </footer>
    </section>
  )
}
