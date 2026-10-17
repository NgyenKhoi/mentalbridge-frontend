'use client'

import { useEffect, useRef, useState } from 'react'
import { ApiError } from '@/lib/api/api-error'
import type { PlanChangeRequest } from '@/features/support-plan/api/support-plan-contract'
import {
  createPlanChangeRequest,
  decidePlanChangeRequest,
  getPlanChangeRequest,
} from '@/features/support-plan/api/browser-plan-change-request'
import styles from './SessionSummaryPanel.module.css'

const statusLabels: Record<PlanChangeRequest['status'], string> = {
  READY_FOR_REVIEW: 'Đang chờ bạn quyết định',
  ACCEPTED: 'Đã chấp nhận và cập nhật kế hoạch',
  REJECTED: 'Đã từ chối',
}

const reasonLabels: Record<PlanChangeRequest['proposalReasonCode'], string> = {
  POST_CONSULTATION_CONTINUITY: 'Tiếp nối nội dung sau buổi tư vấn',
  TRY_ALTERNATIVE_RESOURCE: 'Thử một tài nguyên phù hợp khác',
  ADDRESS_REPORTED_BARRIER: 'Hỗ trợ trở ngại đã trao đổi',
}

export function PlanChangeRequestCard({
  proposalId,
  viewer,
}: {
  proposalId: string
  viewer: 'USER' | 'SPECIALIST'
}) {
  const [request, setRequest] = useState<PlanChangeRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const createKey = useRef(`plan-change-create:${crypto.randomUUID()}`)
  const decisionKeys = useRef({
    ACCEPT: `plan-change-accept:${crypto.randomUUID()}`,
    REJECT: `plan-change-reject:${crypto.randomUUID()}`,
  })

  useEffect(() => {
    let active = true
    void getPlanChangeRequest(proposalId, viewer)
      .then((value) => {
        if (active) setRequest(value)
      })
      .catch((caught) => {
        if (active && !(caught instanceof ApiError && caught.status === 404)) {
          setError('Chưa thể tải trạng thái đề xuất. Vui lòng thử lại.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [proposalId, viewer])

  const review = async () => {
    setPending(true)
    setError('')
    try {
      setRequest(await createPlanChangeRequest(proposalId, createKey.current))
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 409
          ? caught.message
          : 'Đề xuất chưa thể được kiểm tra lúc này. Vui lòng thử lại.',
      )
    } finally {
      setPending(false)
    }
  }

  const decide = async (decision: 'ACCEPT' | 'REJECT') => {
    if (!request) return
    setPending(true)
    setError('')
    try {
      setRequest(
        await decidePlanChangeRequest(
          request,
          decision,
          decisionKeys.current[decision],
        ),
      )
    } catch (caught) {
      setError(
        caught instanceof ApiError && [409, 412].includes(caught.status ?? 0)
          ? 'Đề xuất hoặc kế hoạch đã thay đổi. Vui lòng tải lại trước khi quyết định.'
          : 'Chưa thể lưu quyết định. Vui lòng thử lại.',
      )
    } finally {
      setPending(false)
    }
  }

  if (loading) return <small>Đang kiểm tra trạng thái đề xuất…</small>

  if (!request) {
    return (
      <div className={styles.planChange}>
        <strong>Đề xuất thay đổi kế hoạch hỗ trợ</strong>
        <p>
          {viewer === 'USER'
            ? 'MentalBridge sẽ kiểm tra lại điều kiện hiện tại trước khi bạn quyết định.'
            : 'Đang chờ người dùng mở và xem đề xuất.'}
        </p>
        {viewer === 'USER' && (
          <button
            type="button"
            disabled={pending}
            onClick={() => void review()}
          >
            {pending ? 'Đang kiểm tra…' : 'Xem đề xuất thay đổi'}
          </button>
        )}
        {error && <small className={styles.planChangeError}>{error}</small>}
      </div>
    )
  }

  return (
    <div className={styles.planChange} data-status={request.status}>
      <div className={styles.planChangeHeading}>
        <strong>Đề xuất thay đổi kế hoạch hỗ trợ</strong>
        <span>{statusLabels[request.status]}</span>
      </div>
      <p>{reasonLabels[request.proposalReasonCode]}</p>
      <div className={styles.resourceComparison}>
        <div>
          <small>Hiện tại</small>
          <strong>
            {request.currentResource?.title ?? 'Chưa có tài nguyên'}
          </strong>
        </div>
        <span aria-hidden="true">→</span>
        <div>
          <small>Được đề xuất</small>
          <strong>{request.proposedResource.title}</strong>
        </div>
      </div>
      {viewer === 'USER' && request.status === 'READY_FOR_REVIEW' && (
        <div className={styles.planChangeActions}>
          <button
            type="button"
            className={styles.secondaryAction}
            disabled={pending}
            onClick={() => void decide('REJECT')}
          >
            Từ chối
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => void decide('ACCEPT')}
          >
            {pending ? 'Đang lưu…' : 'Chấp nhận thay đổi'}
          </button>
        </div>
      )}
      {error && <small className={styles.planChangeError}>{error}</small>}
    </div>
  )
}
