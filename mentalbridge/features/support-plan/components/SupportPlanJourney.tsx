'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { ApiError } from '@/lib/api/api-error'
import {
  activateSupportPlan,
  changeSupportPlanStatus,
  getCurrentSupportPlan,
  getCurrentSupportPlanDraft,
  proposeSupportPlanDraft,
  replaceSupportPlanChoices,
} from '../api/browser-support-plan'
import type {
  ReplaceSupportPlanChoicesRequest,
  SupportPlan,
} from '../api/support-plan-contract'
import SupportPlanCard from './SupportPlanCard'

import './support-plan.css'

type EmptyReason = 'NONE' | 'FREE' | 'STALE' | 'DEPENDENCY'
type Busy = 'SAVING' | 'ACTIVATING' | 'LIFECYCLE' | null

function stateFor(error: unknown): { reason: EmptyReason; message: string } {
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
          'Chưa thể kiểm tra đầy đủ quyền gói hoặc tài nguyên đã duyệt. Không có thay đổi chưa hoàn chỉnh nào được áp dụng.',
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

function mutationMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'SUPPORT_PLAN_ENTITLEMENT_REQUIRED') {
      return 'Gói hiện tại không còn đủ điều kiện. SupportPlan chưa được kích hoạt.'
    }
    if (
      error.code === 'RESOURCE_VERSION_STALE' ||
      error.code === 'SUPPORT_EVALUATION_STALE'
    ) {
      return 'Kết quả đánh giá hoặc phiên bản nội dung đã thay đổi. Hãy tải lại trước khi tiếp tục.'
    }
    if (error.code === 'SUPPORT_PLAN_INVALID_CHOICE') {
      return 'Lựa chọn này không còn nằm trong danh sách đã được duyệt.'
    }
    if (
      error.code === 'SUPPORT_PLAN_VERSION_MISMATCH' ||
      error.code === 'SUPPORT_PLAN_NOT_DRAFT' ||
      error.code === 'SUPPORT_PLAN_CURRENT_EXISTS'
    ) {
      return 'SupportPlan đã thay đổi ở nơi khác. Trạng thái mới nhất đang được tải lại.'
    }
    if (error.code === 'RESOURCE_ELIGIBILITY_UNAVAILABLE') {
      return 'Chưa thể kiểm tra lại tài nguyên. Không có thay đổi nào được áp dụng.'
    }
  }
  return 'Chưa thể hoàn tất thao tác. Không có thay đổi nào được áp dụng.'
}

async function readAuthoritativePlan(): Promise<SupportPlan> {
  try {
    return await getCurrentSupportPlan()
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return await getCurrentSupportPlanDraft()
    }
    throw error
  }
}

export default function SupportPlanJourney() {
  const [plan, setPlan] = useState<SupportPlan>()
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState<Busy>(null)
  const [reason, setReason] = useState<EmptyReason>('NONE')
  const [message, setMessage] = useState('')
  const [commandMessage, setCommandMessage] = useState('')
  const [recoveryVersion, setRecoveryVersion] = useState(0)
  const creationKey = useRef<string | undefined>(undefined)
  const activationKey = useRef<string | undefined>(undefined)

  const load = async () => {
    setLoading(true)
    setMessage('')
    try {
      setPlan(await readAuthoritativePlan())
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

  const recover = async () => {
    try {
      setPlan(await readAuthoritativePlan())
      setRecoveryVersion((current) => current + 1)
    } catch {
      // Keep the last complete plan visible with the stable command error.
    }
  }

  const saveChoices = async (request: ReplaceSupportPlanChoicesRequest) => {
    if (!plan || plan.status !== 'DRAFT') return
    setBusy('SAVING')
    setCommandMessage('')
    try {
      setPlan(
        await replaceSupportPlanChoices(
          plan.supportPlanId,
          plan.version,
          request,
        ),
      )
      setCommandMessage('Đã lưu lựa chọn đã được Care kiểm tra.')
    } catch (error) {
      setCommandMessage(mutationMessage(error))
      await recover()
    } finally {
      setBusy(null)
    }
  }

  const activate = async () => {
    if (!plan || plan.status !== 'DRAFT') return
    setBusy('ACTIVATING')
    setCommandMessage('')
    activationKey.current ??= crypto.randomUUID()
    try {
      await activateSupportPlan(
        plan.supportPlanId,
        plan.version,
        activationKey.current,
      )
      setPlan(await getCurrentSupportPlan())
      activationKey.current = undefined
    } catch (error) {
      setCommandMessage(mutationMessage(error))
      await recover()
    } finally {
      setBusy(null)
    }
  }

  const changeStatus = async (
    status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'DISCARDED',
  ) => {
    if (!plan) return
    setBusy('LIFECYCLE')
    setCommandMessage('')
    try {
      setPlan(
        await changeSupportPlanStatus(plan.supportPlanId, plan.version, status),
      )
    } catch (error) {
      setCommandMessage(mutationMessage(error))
      await recover()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="support-plan-page">
      <header className="support-plan-page-header">
        <span>Plus & Premium · Dữ liệu bền vững</span>
        <h1>SupportPlan của bạn</h1>
        <p>
          Chọn trong các nội dung Care đã duyệt và chủ động kích hoạt kế hoạch.
          Care kiểm tra lại mọi bằng chứng ngay trước khi áp dụng.
        </p>
      </header>

      {loading && (
        <div className="support-plan-state" role="status">
          <span className="support-plan-loader" aria-hidden="true" />
          <p>Đang tải SupportPlan hiện tại…</p>
        </div>
      )}

      {!loading && plan && (
        <SupportPlanCard
          key={`${plan.supportPlanId}:${plan.version}:${recoveryVersion}`}
          plan={plan}
          busy={busy}
          message={commandMessage}
          onSaveChoices={saveChoices}
          onActivate={activate}
          onStatusChange={changeStatus}
        />
      )}

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
                  : 'Chưa có SupportPlan'}
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
