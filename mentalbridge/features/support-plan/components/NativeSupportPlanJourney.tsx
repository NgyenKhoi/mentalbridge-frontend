'use client'

import Link from 'next/link'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import {
  BookOpen,
  CalendarDays,
  Check,
  LockKeyhole,
  Smile,
  SlidersHorizontal,
} from 'lucide-react'
import { useFeedback } from '@/components/ui/FeedbackProvider'
import { Disclosure } from '@/components/ui/Disclosure'
import { ApiError } from '@/lib/api/api-error'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import { EmotionProgress } from '@/features/emotion-check-in/EmotionProgress'
import { getCurrentReassessmentSummary } from '@/features/assessment/api/browser-care'
import {
  activateNativeSupportPlan,
  changeNativeActionOccurrenceState,
  changeNativeSupportPlanStatus,
  getCurrentNativeSupportPlanDraft,
  getCurrentSupportPlanActions,
  getNativeSupportPlanEvaluationSource,
  getSupportPlanActionHistory,
  getSupportPlanActionModel,
  getSupportPlanActionOccurrences,
  proposeNativeSupportPlanDraft,
  reconcileEmotionCheckInOccurrence,
  reconcileJournalOccurrence,
  replaceWithNativeSupportPlan,
  reviewNativeSupportPlanReplacement,
} from '../api/browser-support-plan-actions'
import {
  changeSupportPlanStatus,
  replaceSupportPlanActionSchedule,
  requestSupportPlanActionCompanionExplanation,
} from '../api/browser-support-plan'
import type {
  ActionOccurrence,
  EmotionCheckInOccurrenceReconciliation,
  NativeSupportPlanReplacementReview,
  SupportPlanActionHistory,
  SupportPlanV3,
  UpdateActionScheduleRequest,
} from '../api/support-plan-contract'
import { emotionPlanHref, type EmotionPlanOrigin } from '../emotion-plan-origin'
import { journalPlanHref, type JournalPlanOrigin } from '../journal-plan-origin'
import ProfessionalSupportPath from './ProfessionalSupportPath'
import SupportPlanCompanionShell from './SupportPlanCompanionShell'
import SupportPlanContextualCompanion from './SupportPlanContextualCompanion'
import type {
  ContextualCompanionRequest,
  ContextualCompanionSnapshot,
} from './support-plan-contextual-companion'
import SupportPlanDescription from './SupportPlanDescription'
import SupportPlanFooter from './SupportPlanFooter'
import SupportPlanPersonalization from './SupportPlanPersonalization'
import SupportPlanScheduleEditor from './SupportPlanScheduleEditor'
import SupportPlanSidebarCards from './SupportPlanSidebarCards'
import styles from './NativeSupportPlanJourney.module.css'
import './support-plan.css'

type Tab = 'today' | 'plan' | 'progress' | 'adjust'
const tabs: ReadonlyArray<{ id: Tab; label: string }> = [
  { id: 'today', label: 'Hôm nay' },
  { id: 'plan', label: 'Kế hoạch' },
  { id: 'progress', label: 'Tiến triển' },
  { id: 'adjust', label: 'Điều chỉnh' },
]
const statusLabels = {
  DRAFT: 'Chưa bắt đầu',
  ACTIVE: 'Đang thực hiện',
  PAUSED: 'Tạm dừng',
  COMPLETED: 'Đã khép lại',
  SUPERSEDED: 'Đã thay thế',
  DISCARDED: 'Đã bỏ bản nháp',
} as const
const occurrenceLabels = {
  SCHEDULED: 'Chưa ghi nhận hoàn thành',
  OVERDUE: 'Có thể thực hiện khi phù hợp',
  COMPLETED: 'Đã ghi nhận hoàn thành',
  SKIPPED: 'Đã bỏ qua',
  CANCELLED: 'Đã hủy',
} as const

function localToday(timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}
function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401)
      return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại để tiếp tục.'
    if (
      error.status === 403 ||
      error.code === 'SUPPORT_PLAN_ENTITLEMENT_REQUIRED'
    )
      return 'Gói hiện tại chưa cho phép thao tác này. Kế hoạch của bạn chưa bị thay đổi.'
    if (error.status === 412)
      return 'Kế hoạch vừa thay đổi ở nơi khác. Tải lại trước khi thử tiếp; các chỉnh sửa khác vẫn được giữ.'
    if (
      error.code === 'INITIAL_CHECK_INCOMPLETE' ||
      error.code === 'REASSESSMENT_INCOMPLETE' ||
      error.code === 'SCREENING_EPISODE_NOT_FOUND'
    )
      return 'Hãy hoàn tất PHQ-9 và GAD-7 trong cùng lượt sàng lọc trước khi xem phương án mới.'
    if (error.status === 409)
      return 'Chưa thể áp dụng thao tác với trạng thái hiện tại. Hãy tải lại để xem điều gì đã thay đổi.'
    if (error.status === 404)
      return 'Chưa có thông tin cần thiết cho thao tác này. Hãy hoàn tất đánh giá lại trước khi xem phương án thay thế.'
  }
  return 'Chưa thể hoàn tất thao tác. Thông tin đã ghi nhận và các chỉnh sửa của bạn vẫn được giữ. Hãy thử lại.'
}
function cadence(action: SupportPlanV3['focuses'][number]['actions'][number]) {
  const schedule = action.schedules.find((item) => item.status !== 'ENDED')
  if (!schedule) return 'Chưa lên lịch · thực hiện khi phù hợp'
  const rhythm =
    schedule.recurrenceType === 'DAILY'
      ? 'Mỗi ngày'
      : schedule.recurrenceType === 'WEEKLY'
        ? 'Theo tuần'
        : 'Một lần'
  return `${rhythm} · ${schedule.localTime.slice(0, 5)} · ${schedule.estimatedDurationMinutes ?? 5} phút`
}
async function optionalPlan(request: Promise<SupportPlanV3>) {
  try {
    return await request
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return undefined
    throw error
  }
}

export default function NativeSupportPlanJourney({
  initialCurrent,
  initialDraft,
  initialHistory,
  origin,
  journalOrigin,
  invalidJournalOrigin,
  onBackToLegacy,
}: Readonly<{
  initialCurrent?: SupportPlanV3
  initialDraft?: SupportPlanV3
  initialHistory?: SupportPlanActionHistory
  origin?: EmotionPlanOrigin
  journalOrigin?: JournalPlanOrigin
  invalidJournalOrigin?: boolean
  onBackToLegacy?: () => void
}>) {
  const { confirm } = useFeedback()
  const [current, setCurrent] = useState(initialCurrent)
  const [draft, setDraft] = useState(initialDraft)
  const [tab, setTab] = useState<Tab>(
    initialCurrent?.representationMode === 'NATIVE_V3'
      ? 'today'
      : initialDraft
        ? 'plan'
        : initialHistory?.items.length
          ? 'progress'
          : 'adjust',
  )
  const [message, setMessage] = useState('')
  const [entitlementRequired, setEntitlementRequired] = useState(false)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [scheduleDirty, setScheduleDirty] = useState(false)
  const [personalizationDirty, setPersonalizationDirty] = useState(false)
  const [contextualCompanion, setContextualCompanion] =
    useState<ContextualCompanionSnapshot>()
  const companionSequence = useRef(0)
  const companionInFlight = useRef(false)
  const [companionRequestPending, setCompanionRequestPending] = useState(false)
  const dirty = scheduleDirty || personalizationDirty
  const [history, setHistory] = useState<SupportPlanActionHistory | undefined>(
    initialHistory,
  )
  const [historyError, setHistoryError] = useState('')
  const [review, setReview] = useState<NativeSupportPlanReplacementReview>()
  const [occurrences, setOccurrences] = useState<ActionOccurrence[]>([])
  const [occurrenceError, setOccurrenceError] = useState('')
  const [loadingOccurrences, setLoadingOccurrences] = useState(false)
  const [rowBusy, setRowBusy] = useState<Record<string, boolean>>({})
  const rowLocks = useRef(new Set<string>())
  const occurrenceRequest = useRef(0)
  const [rowMessages, setRowMessages] = useState<Record<string, string>>({})
  const [sourceStates, setSourceStates] = useState<
    Record<string, EmotionCheckInOccurrenceReconciliation['sourceState']>
  >({})
  const proposalKey = useRef<string | undefined>(undefined)
  const activationKey = useRef<string | undefined>(undefined)
  const replacementKey = useRef<string | undefined>(undefined)
  const plan =
    draft?.representationMode === 'NATIVE_V3'
      ? draft
      : current?.representationMode === 'NATIVE_V3'
        ? current
        : undefined
  const nativeCurrent =
    current?.representationMode === 'NATIVE_V3' ? current : undefined
  const timezone =
    nativeCurrent?.focuses
      .flatMap((focus) => focus.actions)
      .flatMap((action) => action.schedules)
      .find((schedule) => schedule.status !== 'ENDED')?.timezone ??
    Intl.DateTimeFormat().resolvedOptions().timeZone ??
    'Asia/Ho_Chi_Minh'
  const [day, setDay] = useState(
    () => journalOrigin?.localDate ?? origin?.localDate ?? localToday(timezone),
  )
  const availableTabs =
    current || draft ? tabs : tabs.filter((item) => item.id !== 'today')
  const activeActions =
    nativeCurrent?.focuses.flatMap((focus) => focus.actions) ?? []
  const dateLabel = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00Z`))
  const shortDateLabel = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00Z`))

  const requestCompanionExplanation = useCallback(
    async (request: ContextualCompanionRequest) => {
      if (
        dirty ||
        companionInFlight.current ||
        !['TODAY', 'PLAN'].includes(request.surface)
      )
        return
      companionInFlight.current = true
      setCompanionRequestPending(true)
      const requestId = ++companionSequence.current
      setContextualCompanion({ ...request, requestId, status: 'loading' })
      try {
        const response = await requestSupportPlanActionCompanionExplanation(
          request.supportPlanId,
          request.actionId,
          request.surface,
        )
        if (companionSequence.current !== requestId) return
        setContextualCompanion({
          ...request,
          requestId,
          status: response.delivery === 'TEMPLATE' ? 'fallback' : 'ready',
          message: response.text,
        })
      } catch {
        if (companionSequence.current !== requestId) return
        setContextualCompanion({
          ...request,
          requestId,
          status: 'fallback',
          message:
            'Chưa thể tải lời giải thích lúc này. Bạn vẫn có thể tiếp tục hoạt động hoặc thử lại khi phù hợp.',
        })
      } finally {
        companionInFlight.current = false
        setCompanionRequestPending(false)
      }
    },
    [dirty],
  )

  const clearCompanionExplanation = useCallback(() => {
    companionSequence.current += 1
    setContextualCompanion(undefined)
  }, [])

  const dismissCompanionExplanation = useCallback(() => {
    const targetId = contextualCompanion?.targetId
    clearCompanionExplanation()
    if (targetId)
      window.requestAnimationFrame(() =>
        document.getElementById(targetId)?.focus(),
      )
  }, [clearCompanionExplanation, contextualCompanion?.targetId])

  useEffect(() => {
    if (!dirty || !contextualCompanion) return
    const frame = window.requestAnimationFrame(clearCompanionExplanation)
    return () => window.cancelAnimationFrame(frame)
  }, [clearCompanionExplanation, dirty, contextualCompanion])

  const reloadPlans = useCallback(async () => {
    const [nextCurrent, nextDraft] = await Promise.all([
      optionalPlan(getCurrentSupportPlanActions()),
      optionalPlan(getCurrentNativeSupportPlanDraft()),
    ])
    setCurrent(nextCurrent)
    setDraft(nextDraft)
    setReview(undefined)
    return true
  }, [])
  const loadOccurrences = useCallback(async () => {
    const requestId = ++occurrenceRequest.current
    if (!nativeCurrent) {
      setOccurrences([])
      return
    }
    setLoadingOccurrences(true)
    setOccurrenceError('')
    try {
      const result = await getSupportPlanActionOccurrences(day, day)
      if (
        result.supportPlanId !== nativeCurrent.supportPlanId ||
        result.representationMode !== 'NATIVE_V3'
      )
        throw new Error('Changed plan')
      if (requestId === occurrenceRequest.current)
        setOccurrences(result.occurrences)
    } catch {
      if (requestId === occurrenceRequest.current)
        setOccurrenceError(
          'Chưa thể tải các hoạt động ngày này. Thông tin đang hiển thị chưa được kiểm tra lại.',
        )
    } finally {
      if (requestId === occurrenceRequest.current) setLoadingOccurrences(false)
    }
  }, [day, nativeCurrent])
  const loadHistory = useCallback(async (cursor?: string) => {
    setHistoryError('')
    try {
      const page = await getSupportPlanActionHistory(cursor)
      setHistory((previous) =>
        cursor && previous
          ? { ...page, items: [...previous.items, ...page.items] }
          : page,
      )
    } catch {
      setHistoryError(
        'Chưa thể tải lịch sử. Bạn vẫn có thể sử dụng các phần khác của kế hoạch.',
      )
    }
  }, [])
  useEffect(() => {
    void loadOccurrences()
    return () => {
      occurrenceRequest.current += 1
    }
  }, [loadOccurrences])
  useEffect(() => {
    if (tab === 'progress') void loadHistory()
  }, [tab, loadHistory])
  useEffect(() => {
    const returned = journalOrigin ?? origin
    if (!returned || tab !== 'today') return
    const item = occurrences.find(
      (candidate) =>
        candidate.occurrenceId === returned.occurrenceId &&
        candidate.actionId === returned.actionId &&
        candidate.localDate === returned.localDate &&
        candidate.actionType ===
          (journalOrigin ? 'JOURNAL' : 'EMOTION_CHECK_IN'),
    )
    if (!item) return
    document.getElementById(`activity-${item.occurrenceId}`)?.focus()
  }, [origin, journalOrigin, occurrences, tab])
  useUnsavedChangesGuard(
    dirty,
    'Các lựa chọn và chỉnh sửa lịch chưa lưu sẽ không được giữ khi rời trang.',
  )

  async function changeTab(next: Tab) {
    if (next === tab) return true
    if (
      dirty &&
      !(await confirm({
        title: 'Rời phần đang chỉnh sửa?',
        description:
          'Các thay đổi lịch chưa lưu sẽ bị bỏ. Bạn có thể quay lại để lưu trước.',
        confirmLabel: 'Bỏ thay đổi và chuyển',
        cancelLabel: 'Ở lại',
      }))
    )
      return false
    setScheduleDirty(false)
    setPersonalizationDirty(false)
    clearCompanionExplanation()
    setTab(next)
    return true
  }
  function tabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next =
      event.key === 'ArrowRight'
        ? (index + 1) % availableTabs.length
        : event.key === 'ArrowLeft'
          ? (index + availableTabs.length - 1) % availableTabs.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? availableTabs.length - 1
              : undefined
    if (next === undefined) return
    event.preventDefault()
    void changeTab(availableTabs[next].id).then((changed) => {
      if (changed)
        document.getElementById(`tab-${availableTabs[next].id}`)?.focus()
    })
  }
  async function command(action: () => Promise<void>) {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setMessage('')
    setEntitlementRequired(false)
    try {
      await action()
    } catch (error) {
      setMessage(errorMessage(error))
      setEntitlementRequired(
        error instanceof ApiError &&
          error.code === 'SUPPORT_PLAN_ENTITLEMENT_REQUIRED',
      )
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }
  async function createDraft() {
    if (dirty) {
      setMessage(
        'Hãy lưu hoặc hoàn tác các lựa chọn đang chỉnh sửa trước khi xem phương án mới.',
      )
      return
    }
    await command(async () => {
      proposalKey.current ??= crypto.randomUUID()
      const source = await getNativeSupportPlanEvaluationSource(
        current ? 'REASSESSMENT' : 'INITIAL_CHECK',
      )
      const proposed = await proposeNativeSupportPlanDraft(
        source,
        proposalKey.current,
      )
      setDraft(proposed)
      setReview(undefined)
      setTab('plan')
      proposalKey.current = undefined
    })
  }
  async function activate() {
    if (!draft || dirty) return
    await command(async () => {
      activationKey.current ??= crypto.randomUUID()
      const activated = await activateNativeSupportPlan(
        draft.supportPlanId,
        draft.version,
        activationKey.current,
      )
      setCurrent(activated)
      setDraft(undefined)
      setTab('today')
      activationKey.current = undefined
    })
  }
  async function lifecycle(
    target: SupportPlanV3,
    status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'DISCARDED',
  ) {
    if (dirty) {
      setMessage(
        'Hãy lưu hoặc hoàn tác các chỉnh sửa lịch trước khi đổi trạng thái.',
      )
      return
    }
    const question =
      status === 'COMPLETED'
        ? 'Kết thúc kế hoạch?'
        : status === 'DISCARDED'
          ? 'Bỏ bản nháp này?'
          : status === 'PAUSED'
            ? 'Tạm dừng kế hoạch?'
            : 'Tiếp tục kế hoạch?'
    if (
      !(await confirm({
        title: question,
        description:
          status === 'COMPLETED'
            ? 'Kế hoạch chuyển vào lịch sử và không thể tiếp tục lại. Điều này không có nghĩa là bạn đã hồi phục.'
            : status === 'DISCARDED'
              ? 'Bản nháp sẽ được lưu vào lịch sử. Kế hoạch đang thực hiện vẫn giữ nguyên.'
              : 'Chỉ lịch hoạt động tương lai được thay đổi. Các thông tin đã ghi nhận vẫn được giữ.',
        confirmLabel: 'Xác nhận',
        cancelLabel: 'Quay lại',
      }))
    )
      return
    await command(async () => {
      if (target.representationMode === 'NATIVE_V3')
        await changeNativeSupportPlanStatus(
          target.supportPlanId,
          target.version,
          {
            status,
            ...(status === 'COMPLETED'
              ? { completionReason: 'USER_DECISION' as const }
              : {}),
          },
        )
      else
        await changeSupportPlanStatus(
          target.supportPlanId,
          target.version,
          status,
        )
      await reloadPlans()
      if (status === 'COMPLETED') setTab('progress')
    })
  }
  async function saveSchedule(
    actionId: string,
    request: UpdateActionScheduleRequest,
    key: string,
  ) {
    if (!plan) return
    const saved = await replaceSupportPlanActionSchedule(
      plan.supportPlanId,
      actionId,
      plan.version,
      request,
      key,
    )
    if (draft?.supportPlanId === saved.supportPlanId) setDraft(saved)
    else setCurrent(saved)
    setReview(undefined)
    activationKey.current = undefined
    replacementKey.current = undefined
  }
  async function reviewReplacement() {
    if (!draft || !current || dirty) return
    await command(async () => {
      const summary = await getCurrentReassessmentSummary()
      setReview(
        await reviewNativeSupportPlanReplacement(
          draft.supportPlanId,
          draft.version,
          {
            currentSupportPlanId: current.supportPlanId,
            currentVersion: current.version,
            reassessmentSummaryId: summary.summaryId,
          },
        ),
      )
    })
  }
  async function replaceCurrent() {
    if (
      !review ||
      !draft ||
      !current ||
      dirty ||
      review.outcome === 'CURRENT_PLAN_VALID_NO_BETTER_ALTERNATIVE'
    )
      return
    if (
      !(await confirm({
        title: 'Sử dụng phương án đã xem xét?',
        description:
          'Kế hoạch cũ sẽ chuyển vào lịch sử. Chỉ phương án mới được bắt đầu, không sửa lại lịch sử trước đó.',
        confirmLabel: 'Thay thế kế hoạch',
        cancelLabel: 'Quay lại',
      }))
    )
      return
    await command(async () => {
      replacementKey.current ??= crypto.randomUUID()
      const activated = await replaceWithNativeSupportPlan(
        draft.supportPlanId,
        draft.version,
        {
          currentSupportPlanId: current.supportPlanId,
          currentVersion: current.version,
          reassessmentSummaryId: review.reassessmentSummary.summaryId,
        },
        replacementKey.current,
      )
      setCurrent(activated)
      setDraft(undefined)
      setReview(undefined)
      setTab('today')
      replacementKey.current = undefined
    })
  }
  async function rowCommand(
    item: ActionOccurrence,
    state?: 'SCHEDULED' | 'COMPLETED' | 'SKIPPED',
    journalId?: string,
  ) {
    if (rowLocks.current.has(item.occurrenceId)) return
    rowLocks.current.add(item.occurrenceId)
    setRowBusy((values) => ({ ...values, [item.occurrenceId]: true }))
    setRowMessages((values) => ({ ...values, [item.occurrenceId]: '' }))
    try {
      if (state) {
        const result = await changeNativeActionOccurrenceState(
          item.occurrenceId,
          item.version,
          state,
        )
        if (
          result.occurrenceId !== item.occurrenceId ||
          result.actionId !== item.actionId ||
          result.localDate !== item.localDate
        )
          throw new Error('Wrong activity')
        setOccurrences((values) =>
          values.map((value) =>
            value.occurrenceId === item.occurrenceId ? result : value,
          ),
        )
      } else if (item.actionType === 'JOURNAL') {
        if (!journalId) throw new Error('Missing saved Journal candidate')
        const result = await reconcileJournalOccurrence(
          item.occurrenceId,
          journalId,
        )
        if (
          result.occurrenceId !== item.occurrenceId ||
          result.actionId !== item.actionId ||
          result.localDate !== item.localDate ||
          result.journalId !== journalId ||
          (result.completionEvidence &&
            (result.completionEvidence.kind !== 'JOURNAL_ENTRY' ||
              result.completionEvidence.ownerDomain !== 'JOURNAL_AI' ||
              result.completionEvidence.factId !== journalId))
        )
          throw new Error('Wrong Journal activity')
        setSourceStates((values) => ({
          ...values,
          [item.occurrenceId]: result.sourceState,
        }))
        setOccurrences((values) =>
          values.map((value) =>
            value.occurrenceId === item.occurrenceId
              ? {
                  ...value,
                  state: result.occurrenceState,
                  displayState: result.occurrenceState,
                  version: result.version,
                  completionEvidence: result.completionEvidence,
                  outcomeRecordedAt: result.completedAt,
                }
              : value,
          ),
        )
      } else {
        const result = await reconcileEmotionCheckInOccurrence(
          item.occurrenceId,
        )
        if (
          result.occurrenceId !== item.occurrenceId ||
          result.actionId !== item.actionId ||
          result.localDate !== item.localDate
        )
          throw new Error('Wrong activity')
        setSourceStates((values) => ({
          ...values,
          [item.occurrenceId]: result.sourceState,
        }))
        setOccurrences((values) =>
          values.map((value) =>
            value.occurrenceId === item.occurrenceId
              ? {
                  ...value,
                  state: result.occurrenceState,
                  displayState: result.occurrenceState,
                  version: result.version,
                  completionEvidence: result.completionEvidence,
                  outcomeRecordedAt: result.completedAt,
                }
              : value,
          ),
        )
      }
    } catch (error) {
      setRowMessages((values) => ({
        ...values,
        [item.occurrenceId]:
          item.actionType === 'JOURNAL' &&
          (!(error instanceof ApiError) || error.status === 503)
            ? 'Chưa thể kiểm tra bài nhật ký. Bài đã lưu và trạng thái hoạt động vẫn được giữ. Hãy thử kiểm tra lại.'
            : errorMessage(error),
      }))
    } finally {
      rowLocks.current.delete(item.occurrenceId)
      setRowBusy((values) => ({ ...values, [item.occurrenceId]: false }))
    }
  }

  const joined = occurrences.flatMap((item) => {
    const action = activeActions.find(
      (candidate) =>
        candidate.actionId === item.actionId &&
        candidate.actionType === item.actionType,
    )
    const schedule = action?.schedules.find(
      (candidate) =>
        candidate.scheduleId === item.scheduleId &&
        candidate.version === item.scheduleVersion,
    )
    return action && schedule ? [{ item, action, schedule }] : []
  })
  const originMatched =
    !origin ||
    joined.some(
      ({ item }) =>
        item.occurrenceId === origin.occurrenceId &&
        item.actionId === origin.actionId &&
        item.localDate === origin.localDate,
    )
  const journalOriginMatched =
    !journalOrigin ||
    joined.some(
      ({ item, action }) =>
        item.actionType === 'JOURNAL' &&
        item.occurrenceId === journalOrigin.occurrenceId &&
        item.actionId === journalOrigin.actionId &&
        item.localDate === journalOrigin.localDate &&
        action.source?.ownerDomain === 'JOURNAL_AI' &&
        action.source.sourceKind === 'JOURNAL_TEMPLATE' &&
        action.source.sourceId === 'short-reflection' &&
        action.source.sourceRevision === '1' &&
        action.source.sourcePolicyVersion === 'journal-writing-intent-v1',
    )

  return (
    <div className="support-plan-page mb-support-companion-page-layout">
      <header className="mb-support-workspace-header">
        <div className="mb-support-workspace-heading">
          <div>
            <p className="mb-support-workspace-eyebrow">
              <span aria-hidden="true" />
              Kế hoạch hỗ trợ
            </p>
            <h1>Hôm nay, mình đi một bước nhỏ</h1>
            <p className="mb-support-workspace-lead">
              Kế hoạch này gom những việc hữu ích vào đúng lúc, để bạn không
              phải tự nhớ mọi thứ.
            </p>
          </div>
          <div className="mb-support-workspace-context">
            <span className="mb-support-workspace-date">
              <CalendarDays size={17} aria-hidden="true" />
              {dateLabel}
            </span>
            {plan && (
              <button
                type="button"
                className="mb-support-workspace-adjust"
                onClick={() => void changeTab('adjust')}
              >
                <SlidersHorizontal size={17} aria-hidden="true" />
                Điều chỉnh kế hoạch
              </button>
            )}
          </div>
        </div>
        <nav
          className="mb-support-workspace-tabs"
          role="tablist"
          aria-label="Các chế độ của kế hoạch hỗ trợ"
        >
          {availableTabs.map((item) => {
            const index = availableTabs.findIndex(
              (candidate) => candidate.id === item.id,
            )
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`tab-${item.id}`}
                aria-controls={`panel-${item.id}`}
                aria-selected={tab === item.id}
                tabIndex={tab === item.id ? 0 : -1}
                className={tab === item.id ? 'is-active' : undefined}
                onClick={() => void changeTab(item.id)}
                onKeyDown={(event) => tabKey(event, index)}
              >
                {item.label}
              </button>
            )
          })}
        </nav>
      </header>
      <SupportPlanCompanionShell
        state={contextualCompanion?.status === 'loading' ? 'thinking' : 'idle'}
        surface={tab}
        contextual={contextualCompanion}
        onContextualDismiss={dismissCompanionExplanation}
      />
      {(invalidJournalOrigin ||
        (!journalOriginMatched && !loadingOccurrences)) && (
        <p className={styles.notice} role="status">
          Không tìm thấy hoạt động nhật ký đã mở trong kế hoạch hiện tại. Nhật
          ký của bạn không bị thay đổi.{' '}
          <Link className="btn btn-secondary" href="/journal">
            Về nhật ký
          </Link>
        </p>
      )}
      {message && (
        <div className="support-plan-state" role="alert">
          <p>{message}</p>
          {entitlementRequired && (
            <p>
              Kế hoạch hỗ trợ dài hạn dành cho Plus và Premium.{' '}
              <Link className="btn btn-primary" href="/support-guides">
                Xem gợi ý hỗ trợ
              </Link>
              <Link className="btn btn-secondary" href="/subscription">
                Xem các gói dịch vụ
              </Link>
            </p>
          )}
          <button
            className="btn btn-secondary"
            type="button"
            disabled={busy}
            onClick={() =>
              void command(async () => {
                await reloadPlans()
                await loadOccurrences()
              })
            }
          >
            Tải lại kế hoạch
          </button>
        </div>
      )}
      {onBackToLegacy &&
        current?.representationMode === 'V2_RESOURCE_ADAPTER' && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              if (!dirty) onBackToLegacy()
              else
                setMessage(
                  'Hãy lưu hoặc hoàn tác các chỉnh sửa trước khi quay lại.',
                )
            }}
          >
            Quay lại kế hoạch hiện tại
          </button>
        )}
      {tab === 'today' && (
        <article className="support-plan-card support-plan-card--schedule">
          <section
            id="panel-today"
            role="tabpanel"
            aria-labelledby="tab-today"
            className="support-plan-schedule is-compact-today"
          >
            <h2 className="support-plan-compact-title">Hoạt động của tôi</h2>
            <div className="support-plan-content-grid">
              <div className="support-plan-activities-col">
                <div className={`support-plan-col-header ${styles.dayHeader}`}>
                  <h3 className="support-plan-section-title">
                    Hoạt động ngày {shortDateLabel}
                  </h3>
                  <label className={styles.day}>
                    Chọn ngày
                    <input
                      type="date"
                      value={day}
                      onChange={(event) => {
                        if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) {
                          setOccurrences([])
                          setDay(event.target.value)
                          setSourceStates({})
                          setRowMessages({})
                        }
                      }}
                    />
                  </label>
                </div>
                {loadingOccurrences && <p role="status">Đang tải hoạt động…</p>}
                {occurrenceError && (
                  <p role="alert">
                    {occurrenceError}
                    <button
                      className="btn btn-secondary"
                      type="button"
                      onClick={() => void loadOccurrences()}
                    >
                      Thử tải lại hoạt động
                    </button>
                  </p>
                )}
                {!originMatched && !loadingOccurrences && (
                  <p role="status">
                    Không tìm thấy hoạt động đã mở trong kế hoạch hiện tại. Các
                    hoạt động khác chưa bị thay đổi.
                    <Link className="btn btn-secondary" href="/support-plan">
                      Về kế hoạch hiện tại
                    </Link>
                  </p>
                )}
                {!loadingOccurrences &&
                  joined.length !== occurrences.length && (
                    <p role="status">
                      Một số hoạt động chưa thể hiển thị đầy đủ. Hãy tải lại kế
                      hoạch trước khi tiếp tục.
                    </p>
                  )}
                {!loadingOccurrences &&
                  !occurrenceError &&
                  joined.length === 0 && (
                    <p>
                      Chưa có hoạt động nào được xếp lịch ngày này. Bạn có thể
                      xem hoặc điều chỉnh kế hoạch.
                    </p>
                  )}
                {joined.map(({ item, action, schedule }) => {
                  const emotion = action.actionType === 'EMOTION_CHECK_IN'
                  const journal = action.actionType === 'JOURNAL'
                  const supportedJournal =
                    journal &&
                    item.representationMode === 'NATIVE_V3' &&
                    action.representationMode === 'NATIVE_V3' &&
                    (item.state === 'COMPLETED' ||
                      action.actionVersion === item.actionVersion) &&
                    action.source?.ownerDomain === 'JOURNAL_AI' &&
                    action.source.sourceKind === 'JOURNAL_TEMPLATE' &&
                    action.source.sourceId === 'short-reflection' &&
                    action.source.sourceRevision === '1' &&
                    action.source.sourcePolicyVersion ===
                      'journal-writing-intent-v1'
                  const canAct =
                    nativeCurrent?.status === 'ACTIVE' &&
                    action.status === 'ACTIVE' &&
                    item.state !== 'CANCELLED'
                  const canWriteJournal =
                    canAct &&
                    !!nativeCurrent?.activatedAt &&
                    !!action.activatedAt
                  const pending = !!rowBusy[item.occurrenceId]
                  const sourceState = sourceStates[item.occurrenceId]
                  const returnedJournal =
                    journalOriginMatched &&
                    journalOrigin?.occurrenceId === item.occurrenceId &&
                    journalOrigin.actionId === item.actionId &&
                    journalOrigin.localDate === item.localDate
                  // Accepted history always wins over a new URL candidate.
                  const journalId =
                    item.state === 'COMPLETED'
                      ? item.completionEvidence?.kind === 'JOURNAL_ENTRY' &&
                        item.completionEvidence.ownerDomain === 'JOURNAL_AI'
                        ? item.completionEvidence.factId
                        : undefined
                      : returnedJournal
                        ? journalOrigin?.journalId
                        : undefined
                  let journalToday: string | undefined
                  if (supportedJournal) {
                    try {
                      journalToday = localToday(schedule.timezone)
                    } catch {
                      /* Invalid schedule timezone cannot enable a writing command. */
                    }
                  }
                  const writingToday = item.localDate === journalToday
                  const journalOriginForRow: JournalPlanOrigin = {
                    source: 'journal',
                    occurrenceId: item.occurrenceId,
                    actionId: item.actionId,
                    localDate: item.localDate,
                    ...(journalId ? { journalId } : {}),
                  }
                  const canCheckJournal =
                    supportedJournal &&
                    !!journalToday &&
                    !loadingOccurrences &&
                    !occurrenceError &&
                    !!journalId &&
                    (item.state === 'COMPLETED' ||
                      (canWriteJournal &&
                        item.state === 'SCHEDULED' &&
                        item.localDate <= journalToday))
                  return (
                    <article
                      key={item.occurrenceId}
                      className={`${styles.activity} ${emotion || journal ? styles.emotion : ''}`}
                      aria-labelledby={`activity-${item.occurrenceId}`}
                    >
                      <div className={styles.activityTop}>
                        {(emotion || journal) && (
                          <span className={styles.mark}>
                            {journal ? (
                              <BookOpen size={22} aria-hidden="true" />
                            ) : (
                              <Smile size={22} aria-hidden="true" />
                            )}
                          </span>
                        )}
                        <div>
                          <p className={styles.meta}>
                            {schedule.localTime.slice(0, 5)} ·{' '}
                            {schedule.estimatedDurationMinutes ?? 5} phút
                          </p>
                          <h3
                            id={`activity-${item.occurrenceId}`}
                            tabIndex={-1}
                          >
                            {action.presentation.title}
                          </h3>
                        </div>
                      </div>
                      <p className={styles.outcome} role="status">
                        {item.state === 'COMPLETED' && (
                          <Check size={18} aria-hidden="true" />
                        )}
                        {occurrenceLabels[item.displayState]}
                      </p>
                      {action.presentation.summary && (
                        <SupportPlanDescription
                          text={action.presentation.summary}
                        />
                      )}
                      {emotion && (
                        <ul className={styles.purpose}>
                          <li>Nhận biết điều bạn đang cảm nhận.</li>
                          <li>
                            Lưu cảm xúc rồi quay lại hoạt động này để kiểm tra
                            ghi nhận.
                          </li>
                        </ul>
                      )}
                      {journal && (
                        <p className={styles.privacy}>
                          <LockKeyhole size={17} aria-hidden="true" />
                          <span>
                            Nội dung nhật ký vẫn riêng tư. Kế hoạch chỉ ghi nhận
                            việc bạn đã lưu bài.
                          </span>
                        </p>
                      )}
                      {journal &&
                        returnedJournal &&
                        journalId &&
                        item.state !== 'COMPLETED' && (
                          <p className={styles.meta} role="status">
                            Bạn đã quay lại từ Nhật ký. Hoạt động chưa được xác
                            nhận hoàn thành.
                          </p>
                        )}
                      {journal &&
                        item.state === 'SCHEDULED' &&
                        !writingToday && (
                          <p className={styles.meta}>
                            Hoạt động này dành cho ngày {shortDateLabel}. Hãy
                            chọn hoạt động hôm nay để viết bài mới; đổi ngày
                            trong nhật ký không ghi nhận cho ngày khác.
                          </p>
                        )}
                      {journal &&
                        (!supportedJournal ||
                          (!canWriteJournal && item.state !== 'COMPLETED')) && (
                          <p className={styles.meta}>
                            Hoạt động hiện chưa cho phép viết từ kế hoạch. Bạn
                            vẫn có thể dùng Nhật ký riêng.
                          </p>
                        )}
                      <div className={styles.actions}>
                        {['RESOURCE', 'JOURNAL', 'EMOTION_CHECK_IN'].includes(
                          action.actionType,
                        ) && (
                          <SupportPlanContextualCompanion
                            supportPlanId={nativeCurrent?.supportPlanId ?? ''}
                            actionId={action.actionId}
                            actionTitle={action.presentation.title}
                            surface="TODAY"
                            disabled={dirty}
                            requestPending={companionRequestPending}
                            snapshot={contextualCompanion}
                            onRequest={(request) =>
                              void requestCompanionExplanation(request)
                            }
                            onDismiss={dismissCompanionExplanation}
                          />
                        )}
                        {supportedJournal &&
                          canWriteJournal &&
                          item.state === 'SCHEDULED' &&
                          writingToday &&
                          !loadingOccurrences &&
                          !occurrenceError &&
                          !journalId &&
                          (pending ? (
                            <button
                              type="button"
                              className="btn btn-primary"
                              disabled
                            >
                              Viết nhật ký
                            </button>
                          ) : (
                            <Link
                              className="btn btn-primary"
                              href={journalPlanHref(
                                journalOriginForRow,
                                '/journal',
                              )}
                            >
                              Viết nhật ký
                            </Link>
                          ))}
                        {supportedJournal &&
                          canWriteJournal &&
                          item.state === 'SCHEDULED' &&
                          writingToday &&
                          !loadingOccurrences &&
                          !occurrenceError &&
                          (sourceState === 'MISSING' ||
                            sourceState === 'DELETED') &&
                          (pending ? (
                            <button
                              type="button"
                              className="btn btn-secondary"
                              disabled
                            >
                              Viết bài mới
                            </button>
                          ) : (
                            <Link
                              className="btn btn-secondary"
                              href={journalPlanHref(
                                {
                                  source: 'journal',
                                  occurrenceId: item.occurrenceId,
                                  actionId: item.actionId,
                                  localDate: item.localDate,
                                },
                                '/journal',
                              )}
                            >
                              Viết bài mới
                            </Link>
                          ))}
                        {supportedJournal && journalId && (
                          <>
                            {pending ? (
                              <button
                                type="button"
                                className="btn btn-secondary"
                                disabled
                              >
                                Xem nhật ký
                              </button>
                            ) : (
                              <Link
                                className="btn btn-secondary"
                                href={journalPlanHref(
                                  journalOriginForRow,
                                  '/journal',
                                )}
                              >
                                Xem nhật ký
                              </Link>
                            )}
                            {canCheckJournal && (
                              <button
                                type="button"
                                className={
                                  item.state === 'COMPLETED'
                                    ? 'btn btn-secondary'
                                    : 'btn btn-primary'
                                }
                                disabled={pending}
                                onClick={() =>
                                  void rowCommand(item, undefined, journalId)
                                }
                              >
                                {pending
                                  ? 'Đang kiểm tra…'
                                  : rowMessages[item.occurrenceId]
                                    ? 'Thử kiểm tra lại'
                                    : 'Kiểm tra ghi nhận'}
                              </button>
                            )}
                          </>
                        )}
                        {emotion && canAct && item.state !== 'SKIPPED' && (
                          <>
                            <Link
                              className="btn btn-primary"
                              href={emotionPlanHref(
                                {
                                  occurrenceId: item.occurrenceId,
                                  actionId: item.actionId,
                                  localDate: item.localDate,
                                },
                                '/dashboard',
                              )}
                            >
                              Ghi nhận cảm xúc
                            </Link>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              disabled={pending}
                              onClick={() => void rowCommand(item)}
                            >
                              {pending ? 'Đang kiểm tra…' : 'Kiểm tra ghi nhận'}
                            </button>
                          </>
                        )}
                        {action.actionType === 'RESOURCE' &&
                          action.source?.ownerDomain === 'CONTENT' && (
                            <Link
                              className="btn btn-secondary"
                              href={`/resources/${encodeURIComponent(action.source.sourceId)}?${new URLSearchParams({ from: 'support-plan', contentVersion: action.source.sourceRevision ?? '' })}`}
                            >
                              Xem nội dung
                            </Link>
                          )}
                        {canAct &&
                          item.state === 'SCHEDULED' &&
                          !emotion &&
                          ['RESOURCE', 'ROUTINE_SELF_MANAGEMENT'].includes(
                            action.actionType,
                          ) && (
                            <button
                              type="button"
                              className="btn btn-secondary"
                              disabled={pending}
                              onClick={() => void rowCommand(item, 'COMPLETED')}
                            >
                              Ghi nhận đã thực hiện
                            </button>
                          )}
                        {canAct && item.state === 'SCHEDULED' && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={pending}
                            onClick={() => void rowCommand(item, 'SKIPPED')}
                          >
                            Bỏ qua hôm nay
                          </button>
                        )}
                        {canAct && item.state === 'SKIPPED' && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={pending}
                            onClick={() => void rowCommand(item, 'SCHEDULED')}
                          >
                            Mở lại hoạt động
                          </button>
                        )}
                      </div>
                      {emotion && (
                        <p className={styles.meta}>
                          Mở phần Cảm xúc hôm nay trên trang Tổng quan. Việc lưu
                          cảm xúc chưa tự xác nhận hoàn thành kế hoạch.
                        </p>
                      )}
                      {sourceState && (
                        <p role="status">
                          {journal
                            ? sourceState === 'RECORDED'
                              ? 'Đã tìm thấy bài nhật ký phù hợp cho hoạt động này.'
                              : sourceState === 'DELETED'
                                ? item.state === 'COMPLETED'
                                  ? 'Bài nhật ký gốc đã được xóa. Lần hoàn thành được chấp nhận trước đó vẫn được giữ.'
                                  : 'Bài nhật ký đã được xóa. Hoạt động chưa được ghi nhận hoàn thành.'
                                : item.state === 'COMPLETED'
                                  ? 'Hiện không còn tìm thấy bài nhật ký gốc. Lần hoàn thành đã được chấp nhận vẫn được giữ.'
                                  : 'Chưa tìm thấy bài nhật ký đã lưu. Hoạt động chưa được ghi nhận hoàn thành.'
                            : sourceState === 'RECORDED'
                              ? 'Đã tìm thấy ghi nhận cảm xúc phù hợp.'
                              : sourceState === 'DELETED'
                                ? item.state === 'COMPLETED'
                                  ? 'Ghi nhận cảm xúc gốc đã được xóa. Lần hoàn thành được chấp nhận trước đó vẫn được giữ.'
                                  : 'Ghi nhận cảm xúc ngày này đã được xóa. Hoạt động chưa được ghi nhận hoàn thành.'
                                : item.state === 'COMPLETED'
                                  ? 'Hiện không còn tìm thấy ghi nhận gốc. Lần hoàn thành đã được chấp nhận vẫn được giữ.'
                                  : 'Chưa có ghi nhận cảm xúc phù hợp cho hoạt động ngày này.'}
                        </p>
                      )}
                      {rowMessages[item.occurrenceId] && (
                        <div>
                          <p role="alert">{rowMessages[item.occurrenceId]}</p>
                          {journal && (
                            <button
                              type="button"
                              className="btn btn-secondary"
                              disabled={pending || busy}
                              onClick={() =>
                                void command(async () => {
                                  await reloadPlans()
                                  await loadOccurrences()
                                })
                              }
                            >
                              Tải lại hoạt động
                            </button>
                          )}
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
              <SupportPlanSidebarCards
                activityRhythm={joined.map(({ item, action, schedule }) => ({
                  id: item.occurrenceId,
                  title: action.presentation.title,
                  time: schedule.localTime.slice(0, 5),
                  state: occurrenceLabels[item.displayState],
                }))}
                planStatus={
                  nativeCurrent?.status === 'PAUSED' ? 'PAUSED' : 'ACTIVE'
                }
                onToggleStatus={
                  nativeCurrent && !busy
                    ? () =>
                        void lifecycle(
                          nativeCurrent,
                          nativeCurrent.status === 'ACTIVE'
                            ? 'PAUSED'
                            : 'ACTIVE',
                        )
                    : undefined
                }
                onEndPlan={
                  nativeCurrent && !busy
                    ? () => void lifecycle(nativeCurrent, 'COMPLETED')
                    : undefined
                }
                onSwitchToManageTab={() => void changeTab('adjust')}
              />
            </div>
          </section>
        </article>
      )}
      {tab === 'plan' && (
        <article className="support-plan-card">
          <section id="panel-plan" role="tabpanel" aria-labelledby="tab-plan">
            {plan ? (
              <>
                <header className="support-plan-card-header">
                  <div>
                    <span>
                      {draft
                        ? current
                          ? 'Phương án thay thế chưa bắt đầu'
                          : 'Kế hoạch chưa bắt đầu'
                        : 'Kế hoạch hiện tại'}
                    </span>
                    <h2>Một nhịp chăm sóc phù hợp</h2>
                  </div>
                  <span className="support-plan-status">
                    {statusLabels[plan.status]}
                  </span>
                </header>
                {current && draft && (
                  <p className={styles.notice}>
                    Kế hoạch hiện tại vẫn được giữ nguyên. Phương án dưới đây
                    chỉ được áp dụng sau khi bạn xem xét và xác nhận thay thế.
                  </p>
                )}
                <section
                  className={`support-plan-safety ${plan.safety.status === 'POSITIVE_SAFETY_SCREEN' ? 'attention' : ''}`}
                  aria-label="Hướng dẫn an toàn"
                >
                  <strong>
                    {plan.safety.status === 'POSITIVE_SAFETY_SCREEN'
                      ? 'Ưu tiên hướng dẫn an toàn'
                      : 'Nhắc nhở an toàn'}
                  </strong>
                  <p>{plan.safety.guidance}</p>
                </section>
                <ProfessionalSupportPath
                  supportPlanId={plan.supportPlanId}
                  professionalSupportRequired={plan.focuses.some((focus) =>
                    focus.actions.some(
                      (action) =>
                        action.actionType === 'PROFESSIONAL_SUPPORT' &&
                        action.pathRole === 'PRIMARY' &&
                        action.status !== 'ENDED',
                    ),
                  )}
                />
                {plan.focuses.map((focus) => (
                  <section key={focus.focusId} className={styles.focus}>
                    <h3>{focus.title}</h3>
                    {focus.rationale && (
                      <SupportPlanDescription text={focus.rationale} />
                    )}
                    <ul className={styles.actionList}>
                      {focus.actions.map((action) => (
                        <li key={action.actionId}>
                          <h4>{action.presentation.title}</h4>
                          <p className={styles.meta}>
                            {cadence(action)}
                            {action.actionType === 'EMOTION_CHECK_IN'
                              ? ' · Bạn có thể bỏ lịch khi chưa phù hợp'
                              : ''}
                          </p>
                          {action.presentation.summary && (
                            <SupportPlanDescription
                              text={action.presentation.summary}
                            />
                          )}
                          {action.actionType === 'EMOTION_CHECK_IN' && (
                            <p>
                              Ghi nhận điều bạn đang cảm nhận; không thay đổi
                              các hướng hỗ trợ khác.
                            </p>
                          )}
                          {[
                            'RESOURCE',
                            'JOURNAL',
                            'EMOTION_CHECK_IN',
                            'PROFESSIONAL_SUPPORT',
                          ].includes(action.actionType) && (
                            <SupportPlanContextualCompanion
                              supportPlanId={plan.supportPlanId}
                              actionId={action.actionId}
                              actionTitle={action.presentation.title}
                              surface="PLAN"
                              disabled={dirty}
                              requestPending={companionRequestPending}
                              snapshot={contextualCompanion}
                              onRequest={(request) =>
                                void requestCompanionExplanation(request)
                              }
                              onDismiss={dismissCompanionExplanation}
                            />
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
                {draft && (
                  <div className={styles.actions}>
                    {current ? (
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={busy || dirty}
                        onClick={() => void reviewReplacement()}
                      >
                        Xem xét phương án thay thế
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={busy || dirty}
                        onClick={() => void activate()}
                      >
                        {busy ? 'Đang bắt đầu…' : 'Bắt đầu kế hoạch'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={busy}
                      onClick={() => void changeTab('adjust')}
                    >
                      Xem và chỉnh lịch
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={busy}
                      onClick={() => void lifecycle(draft, 'DISCARDED')}
                    >
                      Bỏ bản nháp
                    </button>
                  </div>
                )}
                {review && (
                  <section
                    className={styles.notice}
                    aria-labelledby="native-review-title"
                  >
                    <h3 id="native-review-title">Xem xét thay thế</h3>
                    <p>
                      {review.outcome ===
                      'CURRENT_PLAN_VALID_ALTERNATIVES_AVAILABLE'
                        ? 'Có một phương án phù hợp khác. Đây không phải đánh giá rằng bạn đã tốt lên hay cần bỏ kế hoạch hiện tại.'
                        : review.outcome === 'CURRENT_PLAN_NOT_ADMISSIBLE'
                          ? 'Kế hoạch hiện tại không còn đáp ứng điều kiện mới nhất. Bạn có thể chọn phương án đã được kiểm tra; lịch sử cũ vẫn được giữ.'
                          : 'Phương án mới chưa thay đổi hoạt động đang có. Kế hoạch hiện tại vẫn được giữ nguyên.'}
                    </p>
                    <p>
                      Các phần sàng lọc, bối cảnh nhật ký, hoạt động và tự đánh
                      giá vẫn được xem riêng, không cộng thành một điểm.
                    </p>
                    <div
                      className={styles.comparison}
                      aria-label="So sánh hoạt động"
                    >
                      <section>
                        <h4>Kế hoạch hiện tại</h4>
                        <ul>
                          {review.currentPlan.focuses
                            .flatMap((focus) => focus.actions)
                            .map((action) => (
                              <li key={action.actionId}>
                                {action.presentation.title}
                              </li>
                            ))}
                        </ul>
                      </section>
                      <section>
                        <h4>Phương án mới</h4>
                        <ul>
                          {review.proposedPlan.focuses
                            .flatMap((focus) => focus.actions)
                            .map((action) => (
                              <li key={action.actionId}>
                                {action.presentation.title}
                              </li>
                            ))}
                        </ul>
                      </section>
                    </div>
                    <dl
                      className={styles.dimensions}
                      aria-label="Bốn phần đánh giá riêng biệt"
                    >
                      {(
                        [
                          [
                            'Sàng lọc',
                            review.reassessmentSummary.screening.state,
                          ],
                          [
                            'Bối cảnh nhật ký',
                            review.reassessmentSummary.journalContext.state,
                          ],
                          [
                            'Hoạt động trong kế hoạch',
                            review.reassessmentSummary.supportPlanEngagement
                              .state,
                          ],
                          [
                            'Trải nghiệm tự báo cáo',
                            review.reassessmentSummary.selfReportedExperience
                              ?.state ?? 'INSUFFICIENT_DATA',
                          ],
                        ] as const
                      ).map(([label, state]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>
                            {state === 'AVAILABLE'
                              ? 'Có dữ liệu'
                              : state === 'UNAVAILABLE'
                                ? 'Chưa thể truy cập'
                                : 'Chưa đủ dữ liệu'}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={
                        busy ||
                        dirty ||
                        review.outcome ===
                          'CURRENT_PLAN_VALID_NO_BETTER_ALTERNATIVE'
                      }
                      onClick={() => void replaceCurrent()}
                    >
                      Xác nhận thay thế kế hoạch
                    </button>
                  </section>
                )}
              </>
            ) : (
              <div className="support-plan-state">
                <h2>Bắt đầu từ lựa chọn của bạn</h2>
                <p>
                  Lưu sở thích, bao gồm ghi nhận cảm xúc nếu bạn muốn, rồi xem
                  các hoạt động và lịch được đề xuất.
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void changeTab('adjust')}
                >
                  Chọn nhịp phù hợp
                </button>
              </div>
            )}
          </section>
        </article>
      )}
      {tab === 'adjust' && (
        <section id="panel-adjust" role="tabpanel" aria-labelledby="tab-adjust">
          <SupportPlanPersonalization
            onDirtyChange={setPersonalizationDirty}
            onReviewPlan={() => void changeTab('plan')}
          />
          {draft?.representationMode === 'V2_RESOURCE_ADAPTER' && (
            <div className="support-plan-state">
              <h2>Bạn đang có một bản nháp trước đó</h2>
              <p>
                Muốn xem phương án có ghi nhận cảm xúc, hãy chủ động bỏ bản nháp
                này trước. Kế hoạch đang thực hiện không thay đổi.
              </p>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => void lifecycle(draft, 'DISCARDED')}
              >
                Bỏ bản nháp trước đó
              </button>
            </div>
          )}
          {!draft && (
            <div className="support-plan-state">
              {!current && (
                <p>
                  Kế hoạch hỗ trợ dài hạn dành cho Plus và Premium.{' '}
                  <Link href="/support-guides">
                    Gợi ý hỗ trợ sau sàng lọc vẫn có sẵn cho gói Miễn phí.
                  </Link>
                </p>
              )}
              <p>
                {current
                  ? 'Phương án mới cần kết quả đánh giá lại đã hoàn tất. Kế hoạch hiện tại không tự thay đổi.'
                  : 'Sau khi lưu lựa chọn, bạn có thể xem kế hoạch trước khi bắt đầu.'}
              </p>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => void createDraft()}
              >
                {busy ? 'Đang chuẩn bị…' : 'Xem kế hoạch được đề xuất'}
              </button>
              <Link className="btn btn-secondary" href="/initial-check">
                Mở bài sàng lọc
              </Link>
            </div>
          )}
          {plan && (
            <article className="support-plan-card">
              <h2>Điều chỉnh nhịp hoạt động</h2>
              <SupportPlanScheduleEditor
                plan={plan}
                onDirtyChange={setScheduleDirty}
                onSave={saveSchedule}
                onReload={async () => {
                  const refreshed = await getSupportPlanActionModel(
                    plan.supportPlanId,
                  )
                  if (draft?.supportPlanId === refreshed.supportPlanId)
                    setDraft(refreshed)
                  else setCurrent(refreshed)
                  setReview(undefined)
                  return true
                }}
              />
              {current && (
                <section className={styles.notice}>
                  <h3>Quản lý trạng thái kế hoạch</h3>
                  <p>
                    Chọn tạm dừng hoặc khép lại khi bạn cần. Những thông tin đã
                    ghi nhận vẫn được giữ.
                  </p>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={busy || dirty}
                      onClick={() =>
                        void lifecycle(
                          current,
                          current.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED',
                        )
                      }
                    >
                      {current.status === 'PAUSED'
                        ? 'Tiếp tục kế hoạch'
                        : 'Tạm dừng kế hoạch'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={busy || dirty}
                      onClick={() => void lifecycle(current, 'COMPLETED')}
                    >
                      Kết thúc kế hoạch
                    </button>
                  </div>
                </section>
              )}
            </article>
          )}
        </section>
      )}
      {tab === 'progress' && (
        <section
          id="panel-progress"
          role="tabpanel"
          aria-labelledby="tab-progress"
          className="mb-support-progress"
        >
          <div className="mb-support-progress-intro">
            <h2>Nhìn lại những gì bạn đã ghi nhận</h2>
            <p>
              Số ngày ghi nhận cảm xúc và hoạt động đã hoàn thành là hai thông
              tin riêng biệt.
            </p>
          </div>
          <EmotionProgress />
          <Disclosure summary="Lịch sử kế hoạch">
            <div className={styles.history}>
              {historyError && (
                <p role="alert">
                  {historyError}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => void loadHistory()}
                  >
                    Thử tải lại lịch sử
                  </button>
                </p>
              )}
              {!history && !historyError && (
                <p role="status">Đang tải lịch sử…</p>
              )}
              {history?.items.length === 0 && (
                <p>Chưa có kế hoạch đã khép lại.</p>
              )}
              {history?.items.map((item) => (
                <Disclosure
                  key={item.supportPlanId}
                  summary={`${statusLabels[item.status]} · ${new Intl.DateTimeFormat('vi-VN').format(new Date(item.updatedAt))}`}
                >
                  {item.focuses.map((focus) => (
                    <section key={focus.focusId}>
                      <h3>{focus.title}</h3>
                      <ul>
                        {focus.actions.map((action) => (
                          <li key={action.actionId}>
                            {action.presentation.title}
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </Disclosure>
              ))}
              {history?.hasMore && history.nextCursor && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() =>
                    void loadHistory(history.nextCursor ?? undefined)
                  }
                >
                  Xem thêm lịch sử
                </button>
              )}
            </div>
          </Disclosure>
        </section>
      )}
      <SupportPlanFooter updatedAt={current?.updatedAt ?? draft?.updatedAt} />
    </div>
  )
}
