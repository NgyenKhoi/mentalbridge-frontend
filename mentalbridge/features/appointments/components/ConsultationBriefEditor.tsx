'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError } from '@/lib/api/api-error'
import { useFeedback } from '@/components/ui/FeedbackProvider'
import type { AiProcessingDisclosure } from '@/features/assessment/api/care-contract'
import {
  parseAiProcessingDisclosure,
  parseConsentCollection,
} from '@/lib/care/care-validation'
import type {
  ConsultationBrief,
  ConsultationBriefAiDraftJob,
  ConsultationBriefScreeningContextChoice,
} from '../api/consultation-brief-contract'
import { consultationBriefBrowserClient } from '../api/consultation-brief-browser-client'
import styles from './ConsultationBriefPanel.module.css'

const level: Record<string, string> = {
  MINIMAL: 'tối thiểu',
  MILD: 'nhẹ',
  MODERATE: 'trung bình',
  MODERATELY_SEVERE: 'khá cao',
  SEVERE: 'cao',
}

function choiceLabel(choice: ConsultationBriefScreeningContextChoice) {
  const parts = choice.screeningContext.map(
    (item) =>
      `${item.instrument}: ${level[item.screeningLevel] ?? item.screeningLevel}`,
  )
  return `${new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(choice.evaluatedAt))} · ${parts.join(' · ')}`
}

function message(error: unknown) {
  if (!(error instanceof ApiError))
    return 'Không thể cập nhật tóm tắt. Vui lòng thử lại.'
  const values: Record<string, string> = {
    CONSULTATION_BRIEF_VERSION_MISMATCH:
      'Tóm tắt vừa thay đổi. Hãy tải lại trước khi tiếp tục.',
    CONSULTATION_BRIEF_APPOINTMENT_NOT_CONFIRMED:
      'Chỉ có thể chuẩn bị tóm tắt cho lịch đã được xác nhận.',
    CONSULTATION_BRIEF_APPOINTMENT_ALREADY_STARTED:
      'Chỉ có thể chuẩn bị và phê duyệt tóm tắt trước khi lịch hẹn bắt đầu.',
    SUPPORT_EVALUATION_NOT_FOUND:
      'Bối cảnh sàng lọc đã chọn không còn khả dụng.',
    APPOINTMENT_CONTEXT_UNAVAILABLE:
      'Chưa thể xác minh lịch hẹn. Vui lòng thử lại sau.',
  }
  return values[error.code] ?? 'Không thể cập nhật tóm tắt lúc này.'
}

export function ConsultationBriefEditor({
  appointmentId,
}: Readonly<{ appointmentId: string }>) {
  const { confirm, showActionToast } = useFeedback()
  const [brief, setBrief] = useState<ConsultationBrief | null>(null)
  const [choices, setChoices] = useState<
    ConsultationBriefScreeningContextChoice[]
  >([])
  const [situation, setSituation] = useState('')
  const [goals, setGoals] = useState('')
  const [evaluationId, setEvaluationId] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [aiJob, setAiJob] = useState<ConsultationBriefAiDraftJob | null>(null)
  const [aiError, setAiError] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [consentState, setConsentState] = useState<
    'loading' | 'granted' | 'missing' | 'error'
  >('loading')
  const [disclosure, setDisclosure] = useState<AiProcessingDisclosure | null>(
    null,
  )
  const [accepted, setAccepted] = useState(false)
  const visibleDraftRef = useRef({
    situation: '',
    goals: '',
    evaluationId: '',
  })

  const storageKey = `mentalbridge:consultation-brief-ai:${appointmentId}`

  const loadConsent = useCallback(async () => {
    setConsentState('loading')
    try {
      const [consentsResponse, disclosureResponse] = await Promise.all([
        fetch('/api/care/consents', { cache: 'no-store' }),
        fetch('/api/care/ai-processing-disclosure', { cache: 'no-store' }),
      ])
      const [consentsValue, disclosureValue] = await Promise.all([
        consentsResponse.json().catch(() => null),
        disclosureResponse.json().catch(() => null),
      ])
      const consents = consentsResponse.ok
        ? parseConsentCollection(consentsValue)
        : null
      const currentDisclosure = disclosureResponse.ok
        ? parseAiProcessingDisclosure(disclosureValue)
        : null
      if (!consents || !currentDisclosure)
        throw new Error('invalid consent response')
      setDisclosure(currentDisclosure)
      const decision = consents.decisions.find(
        (item) => item.consentType === 'AI_PROCESSING',
      )
      setConsentState(
        decision?.granted === true &&
          decision.policyVersion === currentDisclosure.version
          ? 'granted'
          : 'missing',
      )
    } catch {
      setConsentState('error')
    }
  }, [])

  const apply = useCallback((value: ConsultationBrief) => {
    const nextGoals = value.userGoals.join('\n')
    visibleDraftRef.current = {
      situation: value.currentSituation,
      goals: nextGoals,
      evaluationId: value.supportEvaluationId,
    }
    setBrief(value)
    setSituation(value.currentSituation)
    setGoals(nextGoals)
    setEvaluationId(value.supportEvaluationId)
  }, [])

  useEffect(() => {
    let active = true
    Promise.all([
      consultationBriefBrowserClient.screeningContexts(),
      consultationBriefBrowserClient
        .get(appointmentId)
        .catch((caught: unknown) => {
          if (caught instanceof ApiError && caught.status === 404) return null
          throw caught
        }),
    ])
      .then(([available, current]) => {
        if (!active) return
        setChoices(available.items)
        if (current) apply(current)
        else if (available.items[0]) {
          visibleDraftRef.current.evaluationId =
            available.items[0].supportEvaluationId
          setEvaluationId(available.items[0].supportEvaluationId)
        }
      })
      .catch((caught: unknown) => active && setError(message(caught)))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [appointmentId, apply])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadConsent(), 0)
    return () => window.clearTimeout(timer)
  }, [loadConsent])

  const acceptAiJob = useCallback(
    (job: ConsultationBriefAiDraftJob, source: ConsultationBrief) => {
      setAiJob(job)
      if (job.status === 'RUNNING') return
      window.localStorage.removeItem(storageKey)
      if (job.status === 'FAILED') {
        setAiError(
          job.terminalReason === 'SOURCE_CHANGED'
            ? 'Bản nháp đã thay đổi. Gợi ý AI cũ không được áp dụng.'
            : 'AI chưa thể tạo gợi ý. Bạn vẫn có thể tiếp tục chỉnh sửa thủ công.',
        )
        return
      }
      const visible = visibleDraftRef.current
      const visibleGoals = visible.goals
        .split('\n')
        .map((value) => value.trim())
        .filter(Boolean)
      if (
        job.appointmentId !== appointmentId ||
        job.consultationBriefId !== source.id ||
        job.consultationBriefVersion !== source.version ||
        job.supportEvaluationId !== source.supportEvaluationId ||
        visible.situation.trim() !== source.currentSituation ||
        visible.evaluationId !== source.supportEvaluationId ||
        visibleGoals.length !== source.userGoals.length ||
        visibleGoals.some((goal, index) => goal !== source.userGoals[index]) ||
        !job.currentSituation ||
        !job.userGoals
      ) {
        setAiError('Nguồn của gợi ý không còn khớp với bản nháp hiện tại.')
        return
      }
      visibleDraftRef.current.situation = job.currentSituation
      visibleDraftRef.current.goals = job.userGoals.join('\n')
      setSituation(job.currentSituation)
      setGoals(visibleDraftRef.current.goals)
      setAiError('')
    },
    [appointmentId, storageKey],
  )

  useEffect(() => {
    if (!brief || brief.status !== 'DRAFT') return
    const jobId = window.localStorage.getItem(storageKey)
    if (!jobId) return
    consultationBriefBrowserClient
      .aiDraftJob(appointmentId, jobId)
      .then((job) => acceptAiJob(job, brief))
      .catch(() => window.localStorage.removeItem(storageKey))
  }, [acceptAiJob, appointmentId, brief, storageKey])

  useEffect(() => {
    if (!brief || aiJob?.status !== 'RUNNING') return
    const timer = window.setTimeout(() => {
      consultationBriefBrowserClient
        .aiDraftJob(appointmentId, aiJob.jobId)
        .then((job) => acceptAiJob(job, brief))
        .catch(() =>
          setAiError(
            'Chưa thể tải trạng thái AI. Bạn vẫn có thể chỉnh sửa thủ công.',
          ),
        )
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [acceptAiJob, aiJob, appointmentId, brief])

  async function recordConsent() {
    if (!disclosure || !accepted) return false
    const response = await fetch('/api/care/consent-decisions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({
        consentType: 'AI_PROCESSING',
        policyVersion: disclosure.version,
        granted: true,
      }),
    })
    const value = await response.json().catch(() => null)
    const parsed = response.ok
      ? parseConsentCollection({ decisions: [value] })
      : null
    if (!parsed) return false
    setConsentState('granted')
    setAccepted(false)
    return true
  }

  async function requestAiDraft(withConsent = false) {
    if (!brief || brief.status !== 'DRAFT' || !exactDraftIsSaved) return
    setAiBusy(true)
    setAiError('')
    try {
      if (withConsent && !(await recordConsent())) {
        setAiError(
          'Không thể lưu đồng ý AI. Bạn vẫn có thể chỉnh sửa thủ công.',
        )
        return
      }
      const job = await consultationBriefBrowserClient.requestAiDraft(
        appointmentId,
        brief.version,
      )
      window.localStorage.setItem(storageKey, job.jobId)
      acceptAiJob(job, brief)
    } catch (caught) {
      setAiError(
        caught instanceof ApiError &&
          caught.code === 'AI_PROCESSING_CONSENT_REQUIRED'
          ? 'Bạn cần đồng ý với chính sách AI hiện tại trước khi tạo gợi ý.'
          : 'AI chưa thể tạo gợi ý. Bạn vẫn có thể tiếp tục chỉnh sửa thủ công.',
      )
      if (
        caught instanceof ApiError &&
        caught.code === 'AI_PROCESSING_CONSENT_REQUIRED'
      )
        void loadConsent()
    } finally {
      setAiBusy(false)
    }
  }

  const parsedGoals = useMemo(
    () =>
      goals
        .split('\n')
        .map((value) => value.trim())
        .filter(Boolean),
    [goals],
  )
  const valid =
    situation.trim().length > 0 &&
    situation.length <= 1000 &&
    evaluationId &&
    parsedGoals.length >= 1 &&
    parsedGoals.length <= 5 &&
    parsedGoals.every((goal) => goal.length <= 200)
  const exactDraftIsSaved =
    brief !== null &&
    situation.trim() === brief.currentSituation &&
    evaluationId === brief.supportEvaluationId &&
    parsedGoals.length === brief.userGoals.length &&
    parsedGoals.every((goal, index) => goal === brief.userGoals[index])

  async function save() {
    if (!valid) return
    setBusy(true)
    setError('')
    try {
      apply(
        await consultationBriefBrowserClient.save(
          appointmentId,
          {
            currentSituation: situation.trim(),
            supportEvaluationId: evaluationId,
            userGoals: parsedGoals,
          },
          brief?.version,
        ),
      )
      showActionToast({
        title: 'Đã lưu bản nháp',
        description: 'Bạn có thể xem lại trước khi phê duyệt chia sẻ.',
        tone: 'success',
      })
    } catch (caught) {
      setError(message(caught))
    } finally {
      setBusy(false)
    }
  }

  async function action(value: 'approve' | 'revoke') {
    if (!brief) return
    if (value === 'approve') {
      const accepted = await confirm({
        title: 'Phê duyệt bản tóm tắt này?',
        description:
          'Chuyên gia được giao lịch chỉ đọc đúng phiên bản này trong khung thời gian của lịch hẹn. Nhật ký, câu trả lời sàng lọc, chat và ghi chú riêng không được chia sẻ.',
        confirmLabel: 'Phê duyệt chia sẻ',
      })
      if (!accepted) return
    }
    setBusy(true)
    setError('')
    try {
      apply(
        await consultationBriefBrowserClient.action(
          appointmentId,
          value,
          brief.version,
        ),
      )
      showActionToast({
        title:
          value === 'approve'
            ? 'Đã phê duyệt chia sẻ'
            : 'Đã thu hồi quyền truy cập',
        description:
          value === 'approve'
            ? 'Chuyên gia chỉ thấy bản chụp đã phê duyệt.'
            : 'Các lượt đọc trong tương lai đã bị chặn.',
        tone: 'success',
      })
    } catch (caught) {
      setError(message(caught))
    } finally {
      setBusy(false)
    }
  }

  if (loading)
    return <p className={styles.state}>Đang tải tóm tắt trước buổi tư vấn…</p>

  return (
    <section className={styles.panel} aria-label="Tóm tắt trước buổi tư vấn">
      <div className={styles.heading}>
        <div>
          <h4>Tóm tắt trước buổi tư vấn</h4>
          <p>
            Chỉ chia sẻ tình hình hiện tại, bối cảnh sàng lọc và mục tiêu bạn
            phê duyệt.
          </p>
        </div>
        {brief && (
          <span data-status={brief.sharingStatus}>
            {brief.sharingStatus === 'ACTIVE'
              ? 'Đang chia sẻ'
              : brief.sharingStatus === 'REVOKED'
                ? 'Đã thu hồi'
                : 'Bản nháp'}
          </span>
        )}
      </div>
      {choices.length === 0 && !brief ? (
        <p className={styles.notice}>
          Bạn cần hoàn thành cặp sàng lọc PHQ-9 và GAD-7 trước khi tạo tóm tắt.
        </p>
      ) : (
        <div className={styles.form}>
          <label>
            Tình hình hiện tại
            <textarea
              value={situation}
              maxLength={1000}
              rows={4}
              onChange={(event) => {
                visibleDraftRef.current.situation = event.target.value
                setSituation(event.target.value)
              }}
              disabled={busy || brief?.sharingStatus === 'ACTIVE'}
            />
          </label>
          <label>
            Bối cảnh sàng lọc
            <select
              value={evaluationId}
              onChange={(event) => {
                visibleDraftRef.current.evaluationId = event.target.value
                setEvaluationId(event.target.value)
              }}
              disabled={busy || brief?.sharingStatus === 'ACTIVE'}
            >
              {choices.map((choice) => (
                <option
                  key={choice.supportEvaluationId}
                  value={choice.supportEvaluationId}
                >
                  {choiceLabel(choice)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Mục tiêu trao đổi <small>Mỗi dòng là một mục tiêu, tối đa 5.</small>
            <textarea
              value={goals}
              rows={3}
              onChange={(event) => {
                visibleDraftRef.current.goals = event.target.value
                setGoals(event.target.value)
              }}
              disabled={busy || brief?.sharingStatus === 'ACTIVE'}
            />
          </label>
          <p className={styles.privacy}>
            Không bao gồm nhật ký thô, câu trả lời sàng lọc, chat, ghi chú riêng
            hay chẩn đoán.
          </p>
          {brief?.status === 'DRAFT' &&
            (exactDraftIsSaved || aiJob !== null) && (
              <div className={styles.aiPanel}>
                <strong>Gợi ý AI tùy chọn</strong>
                <p>
                  AI chỉ dùng bản nháp đã lưu và mức sàng lọc tối giản. Gợi ý
                  không được tự động lưu, phê duyệt hay chia sẻ.
                </p>
                {exactDraftIsSaved &&
                  consentState === 'missing' &&
                  disclosure && (
                    <>
                      <p>{disclosure.content}</p>
                      <label className={styles.aiConsent}>
                        <input
                          type="checkbox"
                          checked={accepted}
                          onChange={(event) =>
                            setAccepted(event.target.checked)
                          }
                        />
                        Tôi đồng ý để AI tạo gợi ý cho bản tóm tắt đã lưu này.
                      </label>
                    </>
                  )}
                {exactDraftIsSaved && consentState === 'error' && (
                  <button type="button" onClick={() => void loadConsent()}>
                    Tải lại trạng thái đồng ý AI
                  </button>
                )}
                {exactDraftIsSaved &&
                  (consentState === 'granted' ||
                    consentState === 'missing') && (
                    <button
                      type="button"
                      disabled={
                        aiBusy ||
                        aiJob?.status === 'RUNNING' ||
                        (consentState === 'missing' && !accepted)
                      }
                      onClick={() =>
                        void requestAiDraft(consentState === 'missing')
                      }
                    >
                      {aiBusy || aiJob?.status === 'RUNNING'
                        ? 'AI đang tạo gợi ý…'
                        : 'Gợi ý bản nháp với AI'}
                    </button>
                  )}
                {aiJob?.status === 'SUCCEEDED' && (
                  <>
                    <p className={styles.aiNotice} role="status">
                      Gợi ý của AI — hãy xem lại và chỉnh sửa trước khi lưu.
                    </p>
                    <details>
                      <summary>Thông tin nguồn và mô hình</summary>
                      <small>
                        Phiên bản bản nháp {aiJob.consultationBriefVersion} ·
                        Nguồn {aiJob.sourceSetVersion} · Nhà cung cấp{' '}
                        {aiJob.provider} · Mô hình {aiJob.model} · Prompt{' '}
                        {aiJob.promptVersion}
                      </small>
                    </details>
                  </>
                )}
                {aiError && <p role="alert">{aiError}</p>}
              </div>
            )}
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          {brief?.status === 'DRAFT' && !exactDraftIsSaved && (
            <p className={styles.notice} role="status">
              Hãy lưu thay đổi để phê duyệt đúng nội dung đang hiển thị.
            </p>
          )}
          <div className={styles.actions}>
            {brief?.sharingStatus !== 'ACTIVE' && (
              <button
                type="button"
                onClick={() => void save()}
                disabled={busy || !valid}
              >
                {busy ? 'Đang lưu…' : 'Lưu bản nháp'}
              </button>
            )}
            {brief && brief.sharingStatus !== 'ACTIVE' && (
              <button
                type="button"
                className={styles.primary}
                onClick={() => void action('approve')}
                disabled={
                  busy || brief.status !== 'DRAFT' || !exactDraftIsSaved
                }
              >
                Phê duyệt chia sẻ
              </button>
            )}
            {brief?.sharingStatus === 'ACTIVE' && (
              <button
                type="button"
                className={styles.danger}
                onClick={() => void action('revoke')}
                disabled={busy}
              >
                Thu hồi quyền truy cập
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
