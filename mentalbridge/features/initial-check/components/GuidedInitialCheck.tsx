'use client'

import Link from 'next/link'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'

import { useFeedback } from '@/components/ui/FeedbackProvider'
import {
  createInitialCheckEvaluation,
  getInitialCheckState,
  resetInitialCheck,
} from '@/features/assessment/api/browser-care'
import AssessmentFlow from '@/features/assessment/components/AssessmentFlow'
import { CombinedMeaningCard } from '@/features/assessment/components/CombinedMeaningCard'
import type { InitialCheckState } from '@/features/initial-check/api/initial-check-contract'
import { ApiError } from '@/lib/api/api-error'

import './guided-initial-check.css'

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
  purpose,
}: {
  phase: 'PROFILE_REQUIRED' | 'CONSENT_REQUIRED'
  purpose: 'INITIAL_CHECK' | 'REASSESSMENT'
}) {
  const needsProfile = phase === 'PROFILE_REQUIRED'
  const returnTo =
    purpose === 'REASSESSMENT'
      ? '/initial-check?purpose=reassessment'
      : '/initial-check'
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
        href={`/profile?returnTo=${encodeURIComponent(returnTo)}`}
      >
        {needsProfile
          ? 'Tạo hồ sơ và tiếp tục'
          : 'Xem quyền riêng tư và tiếp tục'}
      </Link>
    </section>
  )
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
  const result = useRef<HTMLDivElement>(null)
  const restartConfirmation = useRef<HTMLDivElement>(null)
  const wasConfirming = useRef(false)

  useEffect(() => {
    if (confirmingRestart) restartConfirmation.current?.focus()
    // Keeping the result unmounts the confirmation; hand focus back to the redo button.
    else if (wasConfirming.current)
      result.current
        ?.querySelector<HTMLButtonElement>('button[aria-expanded]')
        ?.focus()
    wasConfirming.current = confirmingRestart
  }, [confirmingRestart])

  // The meaning, bands and next step come from Care's saved combined meaning, the same card History opens.
  return (
    <div className="initial-check-result" ref={result} data-page-motion="off">
      <CombinedMeaningCard
        meaning={state.combinedMeaning}
        onRestart={onRequestRestart}
        restarting={restarting}
        afterActions={
          confirmingRestart && (
            <div
              ref={restartConfirmation}
              className="initial-check-restart-confirm"
              role="group"
              aria-label="Xác nhận bắt đầu lượt mới"
              aria-describedby="initial-check-restart-question"
              tabIndex={-1}
            >
              <div id="initial-check-restart-question">
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
          )
        }
      />
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
        <ReadinessStep phase={state.phase} purpose={purpose} />
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
