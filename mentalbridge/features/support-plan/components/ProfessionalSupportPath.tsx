'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

import { appointmentBrowserClient } from '@/features/appointments/api/browser-client'
import type { Appointment } from '@/lib/consultation/consultation-validation'
import { getSupportPlanActions } from '../api/browser-support-plan'
import type { PlanAction } from '../api/support-plan-contract'
import SupportPlanContextualCompanion from './SupportPlanContextualCompanion'
import type {
  ContextualCompanionRequest,
  ContextualCompanionSnapshot,
} from './support-plan-contextual-companion'

const appointmentStatus: Record<Appointment['status'], string> = {
  REQUESTED: 'Yêu cầu đặt lịch đang chờ chuyên gia xác nhận.',
  CONFIRMED: 'Lịch hẹn đã được chuyên gia xác nhận.',
  IN_PROGRESS: 'Buổi tư vấn đang diễn ra.',
  SESSION_ENDED: 'Buổi tư vấn đã kết thúc và đang được ghi nhận.',
  COMPLETED: 'Buổi tư vấn đã hoàn tất.',
  REJECTED: 'Yêu cầu trước đó không được xác nhận. Bạn có thể chọn lịch khác.',
  EXPIRED: 'Yêu cầu trước đó đã hết hạn. Bạn có thể chọn lịch khác.',
  CANCELLED: 'Lịch hẹn đã được hủy. Bạn có thể chọn lịch khác khi sẵn sàng.',
}

function newestAppointment(items: Appointment[], actionId: string) {
  return items
    .filter((item) => item.originatingPlanActionId === actionId)
    .sort(
      (left, right) =>
        Date.parse(right.requestedAt) - Date.parse(left.requestedAt),
    )[0]
}

export default function ProfessionalSupportPath({
  professionalSupportRequired,
  supportPlanId,
  companionSnapshot,
  companionRequestPending = false,
  onCompanionRequest,
  onCompanionDismiss,
  companionDisabled = false,
}: Readonly<{
  professionalSupportRequired: boolean
  supportPlanId: string
  companionSnapshot?: ContextualCompanionSnapshot
  companionRequestPending?: boolean
  onCompanionRequest?: (request: ContextualCompanionRequest) => void
  onCompanionDismiss?: () => void
  companionDisabled?: boolean
}>) {
  const [action, setAction] = useState<PlanAction | null>(null)
  const [appointment, setAppointment] = useState<Appointment | null>(null)
  const [loading, setLoading] = useState(false)
  const [projectionUnavailable, setProjectionUnavailable] = useState(false)
  const [appointmentUnavailable, setAppointmentUnavailable] = useState(false)
  const actionRef = useRef<PlanAction | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const model = await getSupportPlanActions(supportPlanId)
      const professional = model.focuses
        .flatMap((focus) => focus.actions)
        .find(
          (candidate) =>
            candidate.actionType === 'PROFESSIONAL_SUPPORT' &&
            candidate.pathRole === 'PRIMARY' &&
            candidate.status !== 'ENDED',
        )
      if (!professional) {
        actionRef.current = null
        setAction(null)
        setAppointment(null)
        setProjectionUnavailable(false)
        setAppointmentUnavailable(false)
        return
      }
      const actionChanged =
        actionRef.current?.actionId !== professional.actionId
      actionRef.current = professional
      setAction(professional)
      setProjectionUnavailable(false)
      if (actionChanged) setAppointment(null)
      try {
        const appointments = await appointmentBrowserClient.list(
          professional.actionId,
        )
        setAppointment(
          newestAppointment(appointments.items, professional.actionId) ?? null,
        )
        setAppointmentUnavailable(false)
      } catch {
        setAppointmentUnavailable(true)
      }
    } catch {
      setProjectionUnavailable(true)
    } finally {
      setLoading(false)
    }
  }, [supportPlanId])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    const refresh = () => void load()
    window.addEventListener('focus', refresh)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [load])

  if (!action && !(professionalSupportRequired && projectionUnavailable)) {
    return null
  }

  if (!action) {
    const headingId = `professional-path-${supportPlanId}`
    return (
      <section
        className="support-plan-professional-path"
        aria-labelledby={headingId}
      >
        <div className="support-plan-professional-path-heading">
          <span>Hướng hỗ trợ chính</span>
          <strong>Ưu tiên kết nối chuyên gia</strong>
        </div>
        <h3 id={headingId}>Chưa thể tải chi tiết hướng hỗ trợ</h3>
        <p role="status">
          Các nội dung bổ trợ vẫn có thể xem, nhưng không thay thế việc kết nối
          chuyên gia. Hãy thử tải lại để tiếp tục từ hướng hỗ trợ đã được xác
          nhận cho kế hoạch này.
        </p>
        <div className="support-plan-professional-path-actions">
          <button
            className="btn btn-outline"
            disabled={loading}
            type="button"
            onClick={() => void load()}
          >
            {loading ? 'Đang tải lại…' : 'Thử tải lại hướng hỗ trợ'}
          </button>
        </div>
      </section>
    )
  }

  return (
    <section
      className="support-plan-professional-path"
      aria-labelledby={`professional-path-${action.actionId}`}
    >
      <div className="support-plan-professional-path-heading">
        <span>Hướng hỗ trợ chính</span>
        <strong>Ưu tiên kết nối chuyên gia</strong>
      </div>
      <h3 id={`professional-path-${action.actionId}`}>
        {action.presentation.title}
      </h3>
      {action.presentation.summary && <p>{action.presentation.summary}</p>}
      {projectionUnavailable && (
        <p className="support-plan-path-update-state" role="status">
          Chưa thể cập nhật hướng hỗ trợ. Thông tin bên dưới là lần tải đã xác
          nhận gần nhất.
        </p>
      )}
      {appointment && (
        <p className="support-plan-appointment-state" role="status">
          <strong>Trạng thái lịch hẹn:</strong>{' '}
          {appointmentStatus[appointment.status]}
        </p>
      )}
      {appointmentUnavailable && (
        <p className="support-plan-path-update-state" role="status">
          Chưa thể cập nhật trạng thái lịch hẹn. MentalBridge không tự suy đoán
          trạng thái khi dữ liệu này chưa khả dụng.
        </p>
      )}
      <div className="support-plan-professional-path-actions">
        {onCompanionRequest && onCompanionDismiss && (
          <SupportPlanContextualCompanion
            supportPlanId={supportPlanId}
            actionId={action.actionId}
            actionTitle={action.presentation.title}
            surface="PLAN"
            disabled={companionDisabled}
            requestPending={companionRequestPending}
            snapshot={companionSnapshot}
            onRequest={onCompanionRequest}
            onDismiss={onCompanionDismiss}
          />
        )}
        <Link
          className="btn btn-primary"
          href={`/specialists?planActionId=${encodeURIComponent(action.actionId)}`}
        >
          Xem chuyên gia và lịch trống
        </Link>
        <small>
          Bạn tự chọn chuyên gia và xác nhận từng yêu cầu. Kế hoạch không tự đặt
          lịch hoặc chia sẻ dữ liệu.
        </small>
        {(projectionUnavailable || appointmentUnavailable) && (
          <button
            className="btn btn-outline"
            disabled={loading}
            type="button"
            onClick={() => void load()}
          >
            {loading ? 'Đang cập nhật…' : 'Thử cập nhật lại'}
          </button>
        )}
      </div>
    </section>
  )
}
