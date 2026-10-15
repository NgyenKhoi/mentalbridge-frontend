'use client'

import { useEffect, useId, useRef, useState } from 'react'
import {
  ArrowRight,
  CircleHelp,
  LockKeyhole,
  Navigation,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react'

import { lockBodyScroll } from '@/lib/dom/body-scroll-lock'
import type {
  ContextualCompanionRequest,
  ContextualCompanionSnapshot,
} from './support-plan-contextual-companion'
import type { SupportPlanCompanionSurface } from './support-plan-companion-state'

const FOCUSABLE_SELECTOR =
  'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

export type SupportPlanGuidedContext = Readonly<{
  supportPlanId: string
  action?: Readonly<{
    actionId: string
    title: string
    requestSurface?: 'TODAY' | 'PLAN'
  }>
  reviewAvailable?: boolean
}>

export type SupportPlanGuidedNavigationTarget = Readonly<{
  surface: SupportPlanCompanionSurface
  actionId?: string
}>

type GuidedTurn = Readonly<{
  intent:
    | 'EXPLAIN_ACTION'
    | 'SUGGEST_NEXT_STEP'
    | 'EXPLAIN_REVIEW_OPTION'
    | 'NAVIGATE'
  question: string
  answer: string
  source: 'AI' | 'PLAN' | 'NAVIGATION'
  fallback?: boolean
}>

const questions = {
  explain: 'Vì sao hoạt động này có trong kế hoạch?',
  next: 'Tôi nên bắt đầu từ đâu?',
  review: 'Vì sao lần xem lại này gợi ý thay đổi?',
  adjust: 'Chỉ tôi nơi có thể điều chỉnh',
} as const

function sourceLabel(turn: GuidedTurn) {
  if (turn.source === 'AI')
    return turn.fallback
      ? 'Phản hồi dự phòng, không thay đổi kế hoạch'
      : 'AI diễn đạt từ dữ liệu kế hoạch đã duyệt'
  if (turn.source === 'PLAN') return 'Thông tin từ kế hoạch hiện tại'
  return 'Hướng dẫn điều hướng trong Kế hoạch Hỗ trợ'
}

export default function SupportPlanCompanionPanel({
  surface,
  context,
  snapshot,
  muted,
  modal,
  requestPending,
  onRequest,
  onNavigate,
  onClose,
}: Readonly<{
  surface: SupportPlanCompanionSurface
  context: SupportPlanGuidedContext
  snapshot?: ContextualCompanionSnapshot
  muted: boolean
  modal: boolean
  requestPending?: boolean
  onRequest?: (request: ContextualCompanionRequest) => void
  onNavigate: (target: SupportPlanGuidedNavigationTarget) => void
  onClose: () => void
}>) {
  const generatedId = useId().replace(/:/g, '')
  const panelRef = useRef<HTMLElement>(null)
  const explanationTargetId = `companion-panel-explain-${generatedId}`
  const [turn, setTurn] = useState<GuidedTurn>()
  const [requestedExplanation, setRequestedExplanation] = useState(false)

  useEffect(() => {
    if (!modal || !panelRef.current) return

    const panel = panelRef.current
    const releaseScrollLock = lockBodyScroll(panel.ownerDocument)
    const addedInert: HTMLElement[] = []
    const page = panel.closest<HTMLElement>('.support-plan-page')
    let branch: HTMLElement | null = panel.closest<HTMLElement>(
      '.support-plan-companion',
    )

    while (branch?.parentElement && page?.contains(branch)) {
      const parent: HTMLElement = branch.parentElement
      for (const sibling of Array.from(parent.children)) {
        if (
          sibling !== branch &&
          sibling instanceof HTMLElement &&
          !sibling.hasAttribute('inert')
        ) {
          sibling.setAttribute('inert', '')
          addedInert.push(sibling)
        }
      }
      if (parent === page) break
      branch = parent
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const controls = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => element.tabIndex >= 0)
      const first = controls[0]
      const last = controls.at(-1)
      if (!first || !last) {
        event.preventDefault()
        panel.focus()
      } else if (
        event.shiftKey &&
        (document.activeElement === first ||
          !panel.contains(document.activeElement))
      ) {
        event.preventDefault()
        last.focus()
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !panel.contains(document.activeElement))
      ) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      releaseScrollLock()
      addedInert.forEach((element) => element.removeAttribute('inert'))
    }
  }, [modal, onClose])

  const explanation =
    requestedExplanation && snapshot?.targetId === explanationTargetId
      ? snapshot
      : undefined

  const requestExplanation = () => {
    const action = context.action
    if (!action?.requestSurface || !onRequest || requestPending) return
    setTurn(undefined)
    setRequestedExplanation(true)
    onRequest({
      targetId: explanationTargetId,
      supportPlanId: context.supportPlanId,
      actionId: action.actionId,
      actionTitle: action.title,
      surface: action.requestSurface,
    })
  }

  const suggestNext = () => {
    const action = context.action
    setRequestedExplanation(false)
    setTurn({
      intent: 'SUGGEST_NEXT_STEP',
      question: questions.next,
      answer: action
        ? `Hoạt động đang có sẵn trong ngữ cảnh này là “${action.title}”. Bạn có thể mở phần Hôm nay để tự chọn thời điểm phù hợp; thứ tự hiển thị không phải là đánh giá lâm sàng.`
        : 'Kế hoạch hiện chưa cung cấp hoạt động đủ điều kiện để gợi ý. Bạn có thể mở phần Hôm nay để xem dữ liệu mới nhất.',
      source: 'PLAN',
    })
  }

  const explainReview = () => {
    setRequestedExplanation(false)
    setTurn({
      intent: 'EXPLAIN_REVIEW_OPTION',
      question: questions.review,
      answer:
        'Một phương án xem lại đang có trong mục Điều chỉnh. Hãy mở phần so sánh tại đó để xem lý do và tự xác nhận; Bạn đồng hành không chọn hoặc áp dụng thay đổi thay bạn.',
      source: 'PLAN',
    })
  }

  const showAdjust = () => {
    setRequestedExplanation(false)
    setTurn({
      intent: 'NAVIGATE',
      question: questions.adjust,
      answer:
        surface === 'adjust'
          ? 'Bạn đang ở mục Điều chỉnh. Các nút xác nhận tại đây mới là thao tác có thể thay đổi kế hoạch.'
          : 'Mở mục Điều chỉnh để xem các lựa chọn. Việc điều hướng không tự lưu hoặc thay đổi kế hoạch.',
      source: 'NAVIGATION',
    })
  }

  const response =
    explanation?.status !== 'loading' && explanation?.message
      ? {
          intent: 'EXPLAIN_ACTION' as const,
          question: questions.explain,
          answer: explanation.message,
          source: 'AI' as const,
          fallback: explanation.status === 'fallback',
        }
      : turn

  return (
    <section
      ref={panelRef}
      className="support-plan-guided-panel"
      role="dialog"
      aria-modal={modal}
      aria-labelledby={`companion-panel-title-${generatedId}`}
      tabIndex={-1}
    >
      <div className="support-plan-guided-handle" aria-hidden="true" />
      <header className="support-plan-guided-header">
        <div>
          <span className="support-plan-guided-kicker">
            <Sparkles size={15} aria-hidden="true" />
            AI khi bạn yêu cầu
          </span>
          <h2 id={`companion-panel-title-${generatedId}`}>Bạn đồng hành</h2>
        </div>
        <button
          type="button"
          className="support-plan-guided-close"
          aria-label="Đóng hướng dẫn Bạn đồng hành"
          autoFocus
          onClick={onClose}
        >
          <X size={20} aria-hidden="true" />
        </button>
      </header>

      <div className="support-plan-guided-boundary">
        <ShieldCheck size={18} aria-hidden="true" />
        <p>
          Bạn đồng hành chỉ giải thích và chỉ đường. Kế hoạch chỉ thay đổi khi
          bạn dùng thao tác xác nhận trong Kế hoạch Hỗ trợ.
        </p>
      </div>

      {context.action && (
        <p className="support-plan-guided-context">
          <span>Đang xem hoạt động</span>
          <strong>{context.action.title}</strong>
        </p>
      )}

      <div className="support-plan-guided-starters">
        <p>Câu hỏi có sẵn</p>
        {context.action?.requestSurface && onRequest && (
          <button
            id={explanationTargetId}
            type="button"
            aria-busy={explanation?.status === 'loading'}
            disabled={requestPending}
            onClick={requestExplanation}
          >
            <CircleHelp size={18} aria-hidden="true" />
            <span>{questions.explain}</span>
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        )}
        <button type="button" onClick={suggestNext}>
          <Navigation size={18} aria-hidden="true" />
          <span>{questions.next}</span>
          <ArrowRight size={17} aria-hidden="true" />
        </button>
        {context.reviewAvailable && (
          <button type="button" onClick={explainReview}>
            <CircleHelp size={18} aria-hidden="true" />
            <span>{questions.review}</span>
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        )}
        <button type="button" onClick={showAdjust}>
          <SlidersHorizontal size={18} aria-hidden="true" />
          <span>{questions.adjust}</span>
          <ArrowRight size={17} aria-hidden="true" />
        </button>
      </div>

      {explanation?.status === 'loading' && (
        <div className="support-plan-guided-loading" aria-busy="true">
          Đang chuẩn bị lời giải thích theo hoạt động…
        </div>
      )}

      {response && (
        <div
          className="support-plan-guided-response"
          data-source={response.source.toLowerCase()}
          {...(muted ? {} : { role: 'status', 'aria-live': 'polite' })}
        >
          <p className="support-plan-guided-question">{response.question}</p>
          <small>{sourceLabel(response)}</small>
          <p>{response.answer}</p>
          <div className="support-plan-guided-actions">
            {context.action && (
              <button
                type="button"
                className="is-primary"
                onClick={() =>
                  onNavigate({
                    surface:
                      context.action?.requestSurface === 'PLAN'
                        ? 'plan'
                        : 'today',
                    actionId: context.action?.actionId,
                  })
                }
              >
                Mở hoạt động này
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate({ surface: 'adjust' })}
            >
              Đến mục Điều chỉnh
            </button>
          </div>
        </div>
      )}

      <p className="support-plan-guided-privacy">
        <LockKeyhole size={16} aria-hidden="true" />
        Nội dung hướng dẫn chỉ được giữ trong bộ nhớ của trang này và được xóa
        khi bạn tải lại hoặc rời Kế hoạch Hỗ trợ.
      </p>
    </section>
  )
}
