'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Skeleton } from '@/components/ui/Skeleton'
import { ApiError } from '@/lib/api/api-error'
import { getCurrentReassessmentSummary } from '@/features/assessment/api/browser-care'
import {
  activateSupportPlan,
  changeSupportPlanStatus,
  getCurrentSupportPlan,
  getCurrentSupportPlanDraft,
  getSupportPlanHistory,
  proposeSupportPlanDraft,
  replaceSupportPlan,
  replaceSupportPlanChoices,
  reviewSupportPlanReplacement,
} from '../api/browser-support-plan'
import type {
  ReplaceSupportPlanChoicesRequest,
  SupportPlan,
  SupportPlanReplacementReview,
} from '../api/support-plan-contract'
import SupportPlanCard from './SupportPlanCard'
import SupportPlanHistory from './SupportPlanHistory'
import SupportPlanReplacementReviewView from './SupportPlanReplacementReview'

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
    if (error.code === 'REASSESSMENT_INCOMPLETE') {
      return {
        reason: 'STALE',
        message:
          'Kế hoạch hiện tại vẫn được giữ nguyên. Hãy hoàn tất PHQ-9 và GAD-7 trong cùng lượt đánh giá lại trước khi tạo phương án thay thế.',
      }
    }
    if (
      error.code === 'SUPPORT_EVALUATION_STALE' ||
      error.code === 'INITIAL_CHECK_INCOMPLETE'
    ) {
      return {
        reason: 'STALE',
        message:
          'Kế hoạch hỗ trợ cần kết quả PHQ-9 và GAD-7 hợp lệ. Bạn chỉ cần hoàn tất bài còn thiếu hoặc làm bài mới nếu kết quả hiện tại không còn phù hợp.',
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
    if (error.code === 'REASSESSMENT_SUMMARY_STALE') {
      return 'Bản đánh giá lại đã cũ. Hãy hoàn tất đánh giá lại trước khi tiếp tục.'
    }
    if (error.code === 'REASSESSMENT_SCREENING_CONTEXT_MISMATCH') {
      return 'Bản tổng hợp và phương án thay thế không dùng cùng một lượt PHQ-9 và GAD-7. Kế hoạch hiện tại được giữ nguyên; hãy tạo lại phương án từ lượt đánh giá mới nhất.'
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
    if (error.code === 'SUPPORT_PLAN_REPLACEMENT_UNCHANGED') {
      return 'Phương án mới không thay đổi lựa chọn tài nguyên hiện tại. Kế hoạch hiện tại được giữ nguyên.'
    }
    if (error.status === 404) {
      return 'Chưa có bản tổng hợp đánh giá lại hiện hành. Hãy hoàn tất đánh giá lại trước khi xem phương án mới.'
    }
  }
  return 'Chưa thể hoàn tất thao tác. Không có thay đổi nào được áp dụng.'
}

async function optionalPlan(request: Promise<SupportPlan>) {
  try {
    return await request
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return undefined
    throw error
  }
}

export default function SupportPlanJourney() {
  const [plan, setPlan] = useState<SupportPlan>()
  const [currentPlan, setCurrentPlan] = useState<SupportPlan>()
  const [replacementDraft, setReplacementDraft] = useState<SupportPlan>()
  const [replacementReview, setReplacementReview] =
    useState<SupportPlanReplacementReview>()
  const [replacementLoading, setReplacementLoading] = useState(false)
  const [replacementMessage, setReplacementMessage] = useState('')
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
  const replacementKey = useRef<string | undefined>(undefined)

  const loadReplacementReview = useCallback(
    async (current: SupportPlan, draft: SupportPlan) => {
      setReplacementLoading(true)
      setReplacementMessage('')
      try {
        const summary = await getCurrentReassessmentSummary()
        const review = await reviewSupportPlanReplacement(
          draft.supportPlanId,
          draft.version,
          {
            currentSupportPlanId: current.supportPlanId,
            currentVersion: current.version,
            reassessmentSummaryId: summary.summaryId,
          },
        )
        setReplacementReview(review)
      } catch (error) {
        setReplacementReview(undefined)
        setReplacementMessage(mutationMessage(error))
      } finally {
        setReplacementLoading(false)
      }
    },
    [],
  )

  const load = useCallback(
    async (options?: {
      preserveOnError?: boolean
      messageAfterLoad?: string
    }) => {
      setLoading(true)
      if (!options?.messageAfterLoad) setMessage('')
      try {
        const [current, draft] = await Promise.all([
          optionalPlan(getCurrentSupportPlan()),
          optionalPlan(getCurrentSupportPlanDraft()),
        ])
        setCurrentPlan(current)
        setReplacementDraft(current ? draft : undefined)
        setPlan(current ?? draft)
        setReason('NONE')
        if (current && draft) await loadReplacementReview(current, draft)
        else setReplacementReview(undefined)
        if (options?.messageAfterLoad) setMessage(options.messageAfterLoad)
      } catch (error) {
        const state = stateFor(error)
        if (!options?.preserveOnError) {
          setPlan(undefined)
          setCurrentPlan(undefined)
          setReplacementDraft(undefined)
          setReplacementReview(undefined)
        }
        setReason(state.reason)
        setMessage(options?.messageAfterLoad ?? state.message)
      } finally {
        setLoading(false)
      }
    },
    [loadReplacementReview],
  )

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
      if (currentPlan) await getCurrentReassessmentSummary()
      const draft = await proposeSupportPlanDraft(
        creationKey.current,
        currentPlan ? 'REASSESSMENT' : 'INITIAL_CHECK',
      )
      if (currentPlan) {
        setReplacementDraft(draft)
        await loadReplacementReview(currentPlan, draft)
      } else {
        setPlan(draft)
      }
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

  const recover = async (messageAfterLoad?: string) => {
    await load({ preserveOnError: true, messageAfterLoad })
    setRecoveryVersion((current) => current + 1)
    await loadHistory()
  }

  const saveChoices = async (request: ReplaceSupportPlanChoicesRequest) => {
    const draft = currentPlan ? replacementDraft : plan
    if (!draft || draft.status !== 'DRAFT') return
    setBusy('SAVING')
    setCommandMessage('')
    try {
      const saved = await replaceSupportPlanChoices(
        draft.supportPlanId,
        draft.version,
        request,
      )
      if (currentPlan) {
        setReplacementDraft(saved)
        await loadReplacementReview(currentPlan, saved)
      } else {
        setPlan(saved)
      }
      setCommandMessage('Đã lưu lựa chọn của bạn.')
    } catch (error) {
      const errorMessage = mutationMessage(error)
      setCommandMessage(errorMessage)
      await recover(errorMessage)
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
      const errorMessage = mutationMessage(error)
      setCommandMessage(errorMessage)
      await recover(errorMessage)
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
      await recover(errorMessage)
    } finally {
      setBusy(null)
    }
  }

  const changeReplacementDraftStatus = async (
    status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'DISCARDED',
    completionReason?: 'USER_DECISION' | 'PLAN_NO_LONGER_FITS' | 'OTHER',
  ) => {
    if (!replacementDraft || status !== 'DISCARDED') return
    setBusy('LIFECYCLE')
    try {
      await changeSupportPlanStatus(
        replacementDraft.supportPlanId,
        replacementDraft.version,
        status,
        completionReason,
      )
      setReplacementDraft(undefined)
      setReplacementReview(undefined)
      await loadHistory()
    } catch (error) {
      setCommandMessage(mutationMessage(error))
      await load()
    } finally {
      setBusy(null)
    }
  }

  const confirmReplacement = async () => {
    if (!currentPlan || !replacementDraft || !replacementReview) return
    setReplacementLoading(true)
    setReplacementMessage('')
    replacementKey.current ??= crypto.randomUUID()
    try {
      const activated = await replaceSupportPlan(
        replacementDraft.supportPlanId,
        replacementDraft.version,
        {
          currentSupportPlanId: currentPlan.supportPlanId,
          currentVersion: currentPlan.version,
          reassessmentSummaryId:
            replacementReview.reassessmentSummary.summaryId,
        },
        replacementKey.current,
      )
      replacementKey.current = undefined
      setPlan(activated)
      setCurrentPlan(activated)
      setReplacementDraft(undefined)
      setReplacementReview(undefined)
      setReplacementMessage(
        'Đã thay thế kế hoạch. Kế hoạch trước được lưu trong lịch sử.',
      )
      await loadHistory()
    } catch (error) {
      const errorMessage = mutationMessage(error)
      await recover()
      setReplacementMessage(errorMessage)
    } finally {
      setReplacementLoading(false)
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
        <>
          <SupportPlanCard
            key={`${plan.supportPlanId}:${plan.version}:${recoveryVersion}`}
            plan={plan}
            busy={busy}
            message={commandMessage}
            onSaveChoices={saveChoices}
            onActivate={activate}
            onStatusChange={changeStatus}
          />
          {currentPlan && !replacementDraft && (
            <section className="support-plan-reassessment-callout">
              <div>
                <span>Sau đánh giá lại</span>
                <h2>Xem một phương án kế hoạch mới</h2>
                <p>
                  Kế hoạch hiện tại vẫn hoạt động trong khi hệ thống kiểm tra và
                  so sánh phương án mới.
                </p>
              </div>
              <button
                className="btn btn-outline"
                type="button"
                disabled={creating}
                onClick={() => void create()}
              >
                {creating ? 'Đang tạo phương án…' : 'Tạo phương án để xem lại'}
              </button>
              {message && <p role="status">{message}</p>}
            </section>
          )}
          {currentPlan && replacementDraft && (
            <>
              <SupportPlanCard
                key={`${replacementDraft.supportPlanId}:${replacementDraft.version}:${recoveryVersion}`}
                plan={replacementDraft}
                busy={busy}
                message={commandMessage}
                onSaveChoices={saveChoices}
                onActivate={activate}
                onStatusChange={changeReplacementDraftStatus}
                draftAction="REPLACEMENT"
              />
              {replacementLoading && !replacementReview && (
                <div className="support-plan-state" role="status">
                  Đang kiểm tra lại hai kế hoạch…
                </div>
              )}
              {replacementReview && (
                <SupportPlanReplacementReviewView
                  review={replacementReview}
                  busy={replacementLoading}
                  message={replacementMessage}
                  onConfirm={() => void confirmReplacement()}
                />
              )}
              {!replacementLoading &&
                !replacementReview &&
                replacementMessage && (
                  <section
                    className="support-plan-replacement-error"
                    role="alert"
                  >
                    <p>{replacementMessage}</p>
                    <Link className="btn btn-outline" href="/assessments">
                      Hoàn tất đánh giá lại
                    </Link>
                  </section>
                )}
            </>
          )}
        </>
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
                ? 'Cần hoàn tất bài sàng lọc'
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
              <Link className="btn btn-primary" href="/assessments">
                Xem các bài sàng lọc
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
