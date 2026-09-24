'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Skeleton } from '@/components/ui/Skeleton'
import { ApiError } from '@/lib/api/api-error'
import {
  activateSupportPlan,
  changeSupportPlanStatus,
  getCurrentSupportPlan,
  getCurrentSupportPlanDraft,
  getSupportPlanHistory,
  proposeSupportPlanDraft,
  replaceSupportPlanChoices,
} from '../api/browser-support-plan'
import type {
  ReplaceSupportPlanChoicesRequest,
  SupportPlan,
} from '../api/support-plan-contract'
import SupportPlanCard from './SupportPlanCard'
import SupportPlanHistory from './SupportPlanHistory'

import './support-plan.css'

type EmptyReason = 'NONE' | 'FREE' | 'STALE' | 'DEPENDENCY'
type Busy = 'SAVING' | 'ACTIVATING' | 'LIFECYCLE' | null

function EmptyStateIcon({ reason }: Readonly<{ reason: EmptyReason }>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {reason === 'FREE' ? (
        <>
          <rect x="5" y="10" width="14" height="10" rx="3" />
          <path d="M8 10V8a4 4 0 0 1 8 0v2" />
        </>
      ) : reason === 'STALE' ? (
        <>
          <path d="M20 7v5h-5" />
          <path d="M4 17v-5h5" />
          <path d="M6.1 8.1A7 7 0 0 1 18.5 7L20 9" />
          <path d="M17.9 15.9A7 7 0 0 1 5.5 17L4 15" />
        </>
      ) : reason === 'DEPENDENCY' ? (
        <>
          <path d="M5 5 19 19" />
          <path d="M7.2 7.3A5 5 0 0 0 6 17h9" />
          <path d="M10.2 4.3A7 7 0 0 1 19 11a4 4 0 0 1-.7 7.7" />
        </>
      ) : (
        <>
          <path d="M12 5v14M5 12h14" />
          <circle cx="12" cy="12" r="9" />
        </>
      )}
    </svg>
  )
}

function stateFor(error: unknown): { reason: EmptyReason; message: string } {
  if (error instanceof ApiError) {
    if (error.status === 404) return { reason: 'NONE', message: '' }
    if (error.code === 'SUPPORT_PLAN_ENTITLEMENT_REQUIRED') {
      return {
        reason: 'FREE',
        message:
          'Kế hoạch hỗ trợ dài hạn dành cho gói Plus và Premium. Gợi ý sau sàng lọc vẫn có sẵn cho gói Miễn phí.',
      }
    }
    if (
      error.code === 'SUPPORT_EVALUATION_STALE' ||
      error.code === 'INITIAL_CHECK_INCOMPLETE'
    ) {
      return {
        reason: 'STALE',
        message:
          'Lịch sử sàng lọc của bạn vẫn được giữ nguyên. Kế hoạch hỗ trợ cần một cặp PHQ-9 và GAD-7 hoàn tất trong cùng lượt Kiểm tra ban đầu.',
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
          'Chưa thể kiểm tra đầy đủ quyền lợi gói hoặc nội dung hỗ trợ. Không có thay đổi nào được áp dụng.',
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
    message: 'Chưa thể tải kế hoạch hỗ trợ lúc này. Vui lòng thử lại.',
  }
}

function mutationMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'SUPPORT_PLAN_ENTITLEMENT_REQUIRED') {
      return 'Gói hiện tại không còn đủ điều kiện. Kế hoạch chưa được bắt đầu.'
    }
    if (
      error.code === 'RESOURCE_VERSION_STALE' ||
      error.code === 'SUPPORT_EVALUATION_STALE'
    ) {
      return 'Kết quả sàng lọc hoặc nội dung hỗ trợ đã thay đổi. Hãy tải lại trước khi tiếp tục.'
    }
    if (error.code === 'SUPPORT_PLAN_INVALID_CHOICE') {
      return 'Lựa chọn này không còn nằm trong danh sách đã được duyệt.'
    }
    if (
      error.code === 'SUPPORT_PLAN_VERSION_MISMATCH' ||
      error.code === 'SUPPORT_PLAN_NOT_DRAFT' ||
      error.code === 'SUPPORT_PLAN_CURRENT_EXISTS'
    ) {
      return 'Kế hoạch đã thay đổi ở nơi khác. Trạng thái mới nhất đang được tải lại.'
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
  const [history, setHistory] = useState<SupportPlan[]>([])
  const [historyCursor, setHistoryCursor] = useState<string>()
  const [historyHasMore, setHistoryHasMore] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false)
  const [historyMessage, setHistoryMessage] = useState('')
  const creationKey = useRef<string | undefined>(undefined)
  const activationKey = useRef<string | undefined>(undefined)

  const load = useCallback(async () => {
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
  }, [])

  const loadHistory = useCallback(async (cursor?: string) => {
    const append = Boolean(cursor)
    if (append) setHistoryLoadingMore(true)
    else setHistoryLoading(true)
    setHistoryMessage('')
    try {
      const page = await getSupportPlanHistory(cursor)
      setHistory((current) =>
        append ? [...current, ...page.items] : page.items,
      )
      setHistoryCursor(page.nextCursor ?? undefined)
      setHistoryHasMore(page.hasMore)
    } catch {
      setHistoryMessage(
        'Chưa thể tải các kế hoạch trước đây. Kế hoạch hiện tại không bị thay đổi.',
      )
    } finally {
      setHistoryLoading(false)
      setHistoryLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load()
      void loadHistory()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [load, loadHistory])

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
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setPlan(undefined)
        setReason('NONE')
      }
      // On dependency failure, keep the last complete plan visible.
    }
    await loadHistory()
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
      setCommandMessage('Đã lưu lựa chọn của bạn.')
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
    completionReason?: 'USER_DECISION' | 'PLAN_NO_LONGER_FITS' | 'OTHER',
  ) => {
    if (!plan) return
    setBusy('LIFECYCLE')
    setCommandMessage('')
    try {
      await changeSupportPlanStatus(
        plan.supportPlanId,
        plan.version,
        status,
        completionReason,
      )
      await Promise.all([load(), loadHistory()])
    } catch (error) {
      const errorMessage = mutationMessage(error)
      setCommandMessage(errorMessage)
      setMessage(errorMessage)
      await recover()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="support-plan-page">
      <header className="support-plan-page-header">
        <span>Dành cho gói Plus & Premium</span>
        <h1>Kế hoạch hỗ trợ của bạn</h1>
        <p>
          Chọn nội dung bạn muốn thực hiện, lưu lựa chọn rồi bắt đầu kế hoạch
          khi đã sẵn sàng.
        </p>
      </header>

      {loading && (
        <div className="support-plan-state support-plan-loading" role="status">
          <span className="sr-only">Đang tải kế hoạch hỗ trợ hiện tại…</span>
          <Skeleton width="28%" height={14} />
          <Skeleton width="70%" height={42} />
          <Skeleton width="92%" height={18} />
          <Skeleton width="100%" height={154} />
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
            <EmptyStateIcon reason={reason} />
          </div>
          <h2>
            {reason === 'FREE'
              ? 'Kế hoạch hỗ trợ chưa thuộc gói hiện tại'
              : reason === 'STALE'
                ? 'Cần hoàn tất Kiểm tra ban đầu'
                : reason === 'DEPENDENCY'
                  ? 'Chưa thể tạo kế hoạch'
                  : 'Chưa có kế hoạch hỗ trợ'}
          </h2>
          <p>
            {message ||
              'Nếu bạn đang dùng Plus hoặc Premium, MentalBridge có thể tạo kế hoạch từ kết quả kiểm tra ban đầu gần nhất.'}
          </p>
          <div className="support-plan-state-actions">
            {reason === 'FREE' ? (
              <Link className="btn btn-primary" href="/support-guides">
                Xem gợi ý hỗ trợ
              </Link>
            ) : reason === 'STALE' ? (
              <Link className="btn btn-primary" href="/initial-check">
                Làm lại kiểm tra ban đầu
              </Link>
            ) : (
              <button
                className="btn btn-primary"
                type="button"
                disabled={creating}
                onClick={() => void create()}
              >
                {creating ? 'Đang tạo kế hoạch…' : 'Tạo kế hoạch hỗ trợ'}
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

      <SupportPlanHistory
        items={history}
        loading={historyLoading}
        loadingMore={historyLoadingMore}
        hasMore={historyHasMore}
        message={historyMessage}
        onRetry={() => void loadHistory()}
        onLoadMore={() => void loadHistory(historyCursor)}
      />
    </div>
  )
}
