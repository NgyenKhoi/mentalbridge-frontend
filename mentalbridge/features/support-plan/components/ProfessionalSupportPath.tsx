'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { appointmentBrowserClient } from '@/features/appointments/api/browser-client'
import type { Appointment } from '@/lib/consultation/consultation-validation'
import { getSupportPlanActions } from '../api/browser-support-plan'
import type { PlanAction } from '../api/support-plan-contract'

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
  supportPlanId,
}: Readonly<{ supportPlanId: string }>) {
  const [action, setAction] = useState<PlanAction | null>(null)
  const [appointment, setAppointment] = useState<Appointment | null>(null)

  const load = useCallback(async () => {
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
        setAction(null)
        setAppointment(null)
        return
      }
      setAction(professional)
      try {
        const appointments = await appointmentBrowserClient.list()
        setAppointment(
          newestAppointment(appointments.items, professional.actionId) ?? null,
        )
      } catch {
        setAppointment(null)
      }
    } catch {
      setAction(null)
      setAppointment(null)
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

  if (!action) return null

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
      {appointment && (
        <p className="support-plan-appointment-state" role="status">
          <strong>Trạng thái lịch hẹn:</strong>{' '}
          {appointmentStatus[appointment.status]}
        </p>
      )}
      <div className="support-plan-professional-path-actions">
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
      </div>
    </section>
  )
}
