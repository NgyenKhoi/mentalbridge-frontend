'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import ResourcesList from '@/components/ResourcesList'
import type {
  AssessmentResult,
  PrivacyDisclosure,
  Questionnaire,
  ScreeningLevel,
} from '@/features/assessment/api/care-contract'
import {
  assessmentErrorMessage,
  clearAnonymousAssessmentSession,
  createAssessmentIdempotencyKey,
  getCurrentPhq9,
  getPrivacyDisclosure,
  getCurrentConsents,
  recordPrivacyDecision,
  isMissingCurrentAssessment,
  reopenAssessment,
  startAnonymousAssessmentSession,
  submitAssessment,
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

function ResultPanel({
  assessment,
  mode,
  onRestart,
}: {
  assessment: AssessmentView
  mode: AssessmentMode
  onRestart: () => void
}) {
  const result: AssessmentResult = assessment.result
  const positive = result.safetyStatus === 'POSITIVE_SAFETY_SCREEN'

  return (
    <section className="care-result" aria-labelledby="care-result-title">
      <header>
        <span className="eyebrow">Kết quả do Care xác định</span>
        <h1 id="care-result-title">Kết quả sàng lọc PHQ-9</h1>
        <p>
          Kết quả được tính và lưu bởi Care service theo đúng phiên bản bộ câu
          hỏi đã làm.
        </p>
      </header>

      <div className="care-result-grid">
        <article className="care-score-card">
          <span>Mức sàng lọc</span>
          <strong>{levelLabels[result.screeningLevel]}</strong>
          <div>
            <b>{result.totalScore}</b>
            <small>/ 27 điểm</small>
          </div>
        </article>

        <article
          className={`care-safety-card ${positive ? 'positive' : 'negative'}`}
        >
          <span>Trạng thái mục an toàn</span>
          <strong>
            {positive
              ? 'Dương tính theo quy tắc sàng lọc'
              : 'Âm tính theo quy tắc sàng lọc'}
          </strong>
          <p>
            {positive
              ? 'Nội dung hướng dẫn an toàn đã được phê duyệt hiện chưa khả dụng trong contract này.'
              : 'Không có nội dung hỗ trợ bổ sung đã được phê duyệt trong contract hiện tại.'}
          </p>
        </article>
      </div>

      <aside className="care-result-disclaimer">
        <span aria-hidden="true">i</span>
        <div>
          <strong>Kết quả sàng lọc không phải là chẩn đoán</strong>
          <p>
            Đây là kết quả sàng lọc triệu chứng, không phải chẩn đoán y khoa.
            MentalBridge không cung cấp dịch vụ ứng cứu khẩn cấp, không giám sát
            con người 24/7 và không tự động liên hệ bên thứ ba.
          </p>
        </div>
      </aside>

      <details className="care-provenance">
        <summary>Thông tin phiên bản</summary>
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
            <dd>{result.safetyPolicyVersion}</dd>
          </div>
        </dl>
      </details>

      {mode === 'anonymous' && (
        <aside className="care-anonymous-note">
          <div>
            <strong>Kết quả ẩn danh chỉ tồn tại trong phiên hiện tại</strong>
            <p>
              Đăng ký không tự động gắn kết quả này vào tài khoản. Các tính năng
              cá nhân hóa và lịch sử chỉ dành cho người dùng đã đăng nhập.
            </p>
          </div>
          <Link href="/register" className="btn btn-outline">
            Tạo tài khoản
          </Link>
        </aside>
      )}

      <ResourcesList limit={6} className="care-result-resources" />

      <div className="care-result-actions">
        <button className="btn btn-primary" type="button" onClick={onRestart}>
          Làm bài mới
        </button>
        <Link
          href={mode === 'anonymous' ? '/' : '/assessments'}
          className="btn btn-ghost"
        >
          Quay lại
        </Link>
      </div>
    </section>
  )
}

export default function AssessmentFlow({
  mode,
  initialAssessmentId,
}: {
  mode: AssessmentMode
  initialAssessmentId?: string
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
        if (reopenExisting) {
          try {
            const current = await reopenAssessment(mode, initialAssessmentId)
            setAssessment(current)
            return
          } catch (currentError) {
            if (!isMissingCurrentAssessment(currentError)) throw currentError
          }
        }

        const [currentQuestionnaire, currentDisclosure, currentConsents] =
          await Promise.all([
            getCurrentPhq9(),
            getPrivacyDisclosure(),
            mode === 'authenticated'
              ? getCurrentConsents()
              : Promise.resolve(null),
          ])
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
    [initialAssessmentId, mode],
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
      window.history.replaceState(null, '', '/assessment/phq9')
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
      const completed = await submitAssessment(
        mode,
        {
          questionnaireDefinitionId: questionnaire.definitionId,
          privacyPolicyVersion: disclosure.version,
          privacyDisclosureAcknowledged: true,
          answers: questions.map((question) => ({
            questionId: question.questionId,
            value: answers[question.questionId],
          })),
        },
        idempotencyKey.current,
      )
      setAssessment(completed)
    } catch (submissionError) {
      setError(assessmentErrorMessage(submissionError))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <section className="care-assessment-state" aria-live="polite">
        <span className="care-loader" aria-hidden="true" />
        <h1>Đang chuẩn bị bài sàng lọc</h1>
        <p>MentalBridge đang kiểm tra phiên bản đã được Care công bố.</p>
      </section>
    )
  }

  if (assessment) {
    return (
      <ResultPanel
        assessment={assessment}
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
        <p>{error ?? 'Care chưa cung cấp bộ câu hỏi phù hợp.'}</p>
        <div>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => void initialize()}
          >
            Thử lại
          </button>
          <Link
            href={mode === 'anonymous' ? '/' : '/assessments'}
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
      <div className="care-progress" aria-hidden="true">
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
              Tôi đã đọc và xác nhận thông báo xử lý dữ liệu phiên bản{' '}
              {disclosure.version}.
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
            {submitting ? 'Đang gửi…' : 'Gửi cho Care chấm điểm'}
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

      <p className="care-contract-note">
        Trình duyệt chỉ gửi mã câu hỏi và lựa chọn 0–3. Điểm số, mức sàng lọc và
        trạng thái an toàn đều do Care service xác định.
      </p>
    </section>
  )
}
