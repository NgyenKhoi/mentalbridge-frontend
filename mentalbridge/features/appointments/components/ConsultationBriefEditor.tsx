'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError } from '@/lib/api/api-error'
import { useFeedback } from '@/components/ui/FeedbackProvider'
import type {
  ConsultationBrief,
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

  const apply = useCallback((value: ConsultationBrief) => {
    setBrief(value)
    setSituation(value.currentSituation)
    setGoals(value.userGoals.join('\n'))
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
        else if (available.items[0])
          setEvaluationId(available.items[0].supportEvaluationId)
      })
      .catch((caught: unknown) => active && setError(message(caught)))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [appointmentId, apply])

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
              onChange={(event) => setSituation(event.target.value)}
              disabled={busy || brief?.sharingStatus === 'ACTIVE'}
            />
          </label>
          <label>
            Bối cảnh sàng lọc
            <select
              value={evaluationId}
              onChange={(event) => setEvaluationId(event.target.value)}
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
              onChange={(event) => setGoals(event.target.value)}
              disabled={busy || brief?.sharingStatus === 'ACTIVE'}
            />
          </label>
          <p className={styles.privacy}>
            Không bao gồm nhật ký thô, câu trả lời sàng lọc, chat, ghi chú riêng
            hay chẩn đoán.
          </p>
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
