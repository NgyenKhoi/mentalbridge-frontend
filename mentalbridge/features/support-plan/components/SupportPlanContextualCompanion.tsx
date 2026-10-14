'use client'

import { useId } from 'react'
import { HelpCircle, LoaderCircle, X } from 'lucide-react'

import type {
  ContextualCompanionRequest,
  ContextualCompanionSnapshot,
} from './support-plan-contextual-companion'
import { useSupportPlanCompanionMuted } from './SupportPlanCompanionShell'

export default function SupportPlanContextualCompanion({
  supportPlanId,
  actionId,
  actionTitle,
  surface,
  disabled = false,
  snapshot,
  onRequest,
  onDismiss,
}: Readonly<{
  supportPlanId: string
  actionId: string
  actionTitle: string
  surface: 'TODAY' | 'PLAN'
  disabled?: boolean
  snapshot?: ContextualCompanionSnapshot
  onRequest: (request: ContextualCompanionRequest) => void
  onDismiss: () => void
}>) {
  const generatedId = useId()
  const targetId = `companion-trigger-${generatedId.replace(/:/g, '')}`
  const active = snapshot?.targetId === targetId
  const muted = useSupportPlanCompanionMuted()

  return (
    <span className="support-plan-contextual-anchor">
      <button
        id={targetId}
        type="button"
        className="support-plan-contextual-trigger"
        aria-label={`Nhờ bạn đồng hành giải thích: ${actionTitle}`}
        aria-expanded={active}
        aria-busy={active && snapshot.status === 'loading'}
        disabled={disabled || (active && snapshot.status === 'loading')}
        onClick={() =>
          onRequest({
            targetId,
            supportPlanId,
            actionId,
            actionTitle,
            surface,
          })
        }
      >
        {active && snapshot.status === 'loading' ? (
          <LoaderCircle size={17} aria-hidden="true" />
        ) : (
          <HelpCircle size={17} aria-hidden="true" />
        )}
        <span>Giải thích</span>
      </button>
      {active && (
        <span
          className="support-plan-contextual-bubble"
          data-status={snapshot.status}
          {...(snapshot.status === 'loading' || muted
            ? {}
            : { role: 'status', 'aria-live': 'polite' })}
        >
          <span className="support-plan-contextual-bubble-heading">
            <strong>
              {snapshot.status === 'loading'
                ? 'Đang chuẩn bị lời giải thích…'
                : 'Bạn đồng hành giải thích'}
            </strong>
            <button
              type="button"
              aria-label="Đóng lời giải thích"
              onClick={() => {
                onDismiss()
                document.getElementById(targetId)?.focus()
              }}
            >
              <X size={17} aria-hidden="true" />
            </button>
          </span>
          {snapshot.status !== 'loading' && <span>{snapshot.message}</span>}
          {snapshot.status !== 'loading' && (
            <small>
              {snapshot.status === 'ready'
                ? 'Nội dung do AI diễn đạt từ thông tin kế hoạch đã duyệt.'
                : 'Phản hồi dự phòng; hoạt động gốc vẫn giữ nguyên.'}
            </small>
          )}
        </span>
      )}
    </span>
  )
}
