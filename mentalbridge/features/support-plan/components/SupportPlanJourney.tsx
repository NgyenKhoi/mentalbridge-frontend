'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { ApiError } from '@/lib/api/api-error'
import {
  getCurrentSupportPlanDraft,
  proposeSupportPlanDraft,
} from '../api/browser-support-plan'
import type { SupportPlanDraft } from '../api/support-plan-contract'
import SupportPlanCard from './SupportPlanCard'

import './support-plan.css'

type EmptyReason = 'NONE' | 'FREE' | 'STALE' | 'DEPENDENCY'

function stateFor(error: unknown): {
  reason: EmptyReason
  message: string
} {
  if (error instanceof ApiError) {
    if (error.status === 404) return { reason: 'NONE', message: '' }
    if (error.code === 'SUPPORT_PLAN_ENTITLEMENT_REQUIRED') {
      return {
        reason: 'FREE',
        message:
          'SupportPlan theo dõi dài hạn dành cho gói Plus và Premium. Hướng dẫn hỗ trợ một lần vẫn có sẵn cho gói Free.',
      }
    }
    if (
      error.code === 'SUPPORT_EVALUATION_STALE' ||
      error.code === 'INITIAL_CHECK_INCOMPLETE'
    ) {
      return {
        reason: 'STALE',
        message:
          'Kết quả Kiểm tra ban đầu hiện không còn phù hợp để tạo bản nháp. Hãy hoàn thành lại PHQ-9 và GAD-7.',
      }
    }
    if (
      error.code === 'ENTITLEMENT_UNAVAILABLE' ||
      error.code === 'RESOURCE_ELIGIBILITY_UNAVAILABLE' ||
      error.code === 'RESOURCE_VERSION_STALE' ||
      error.code === 'SUPPORT_PLAN_CORE_UNAVAILABLE'
    ) {
      return {
        reason: 'DEPENDENCY',
        message:
          'Chưa thể kiểm tra đầy đủ quyền gói hoặc tài nguyên đã duyệt. Không có bản nháp chưa hoàn chỉnh nào được tạo.',
      }
    }
    if (error.status === 401) {
      return {
        reason: 'DEPENDENCY',
        message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
      }
    }
  }
  return {
    reason: 'DEPENDENCY',
    message: 'Chưa thể tải SupportPlan lúc này. Vui lòng thử lại.',
  }
}

export default function SupportPlanJourney() {
  const [plan, setPlan] = useState<SupportPlanDraft>()
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [reason, setReason] = useState<EmptyReason>('NONE')
  const [message, setMessage] = useState('')
  const creationKey = useRef<string | undefined>(undefined)

  const load = async () => {
    setLoading(true)
    setMessage('')
    try {
      setPlan(await getCurrentSupportPlanDraft())
      setReason('NONE')
    } catch (error) {
      const state = stateFor(error)
      setPlan(undefined)
      setReason(state.reason)
      setMessage(state.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [])

  const create = async () => {
    setCreating(true)
    setMessage('')
    creationKey.current ??= crypto.randomUUID()
    try {
      setPlan(await proposeSupportPlanDraft(creationKey.current))
      setReason('NONE')
      creationKey.current = undefined
    } catch (error) {
      const state = stateFor(error)
      setReason(state.reason)
      setMessage(state.message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="support-plan-page">
      <header className="support-plan-page-header">
        <span>Plus & Premium · Dữ liệu bền vững</span>
        <h1>SupportPlan của bạn</h1>
        <p>
          Xem bản nháp do Care tạo từ đúng phiên bản Kiểm tra ban đầu và tài
          nguyên đã duyệt. AI không chọn nội dung hoặc thay đổi kế hoạch này.
        </p>
      </header>

      {loading && (
        <div className="support-plan-state" role="status">
          <span className="support-plan-loader" aria-hidden="true" />
          <p>Đang tải bản nháp SupportPlan…</p>
        </div>
      )}

      {!loading && plan && <SupportPlanCard plan={plan} />}

      {!loading && !plan && (
        <section
          className={`support-plan-state ${message ? 'notice' : ''}`}
          aria-live="polite"
        >
          <div className="support-plan-state-mark" aria-hidden="true">
            {reason === 'FREE' ? 'F' : reason === 'STALE' ? '↻' : '＋'}
          </div>
          <h2>
            {reason === 'FREE'
              ? 'SupportPlan chưa thuộc gói hiện tại'
              : reason === 'STALE'
                ? 'Cần một Kiểm tra ban đầu mới'
                : reason === 'DEPENDENCY'
                  ? 'Chưa thể tạo bản nháp'
                  : 'Chưa có bản nháp SupportPlan'}
          </h2>
          <p>
            {message ||
              'Nếu bạn đang dùng Plus hoặc Premium, MentalBridge có thể tạo một bản nháp giới hạn từ kết quả Kiểm tra ban đầu hiện tại.'}
          </p>
          <div className="support-plan-state-actions">
            {reason === 'FREE' ? (
              <Link className="btn btn-primary" href="/support-guides">
                Mở Hướng dẫn hỗ trợ
              </Link>
            ) : reason === 'STALE' ? (
              <Link className="btn btn-primary" href="/initial-check">
                Làm lại Kiểm tra ban đầu
              </Link>
            ) : (
              <button
                className="btn btn-primary"
                type="button"
                disabled={creating}
                onClick={() => void create()}
              >
                {creating ? 'Đang tạo bản nháp…' : 'Tạo bản nháp SupportPlan'}
              </button>
            )}
            {reason === 'DEPENDENCY' && (
              <button
                className="btn btn-ghost"
                type="button"
                disabled={creating}
                onClick={() => void load()}
              >
                Tải lại
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
