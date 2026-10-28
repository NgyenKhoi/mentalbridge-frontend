'use client'

import Link from 'next/link'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { useFeedback } from '@/components/ui/FeedbackProvider'
import { ApiError } from '@/lib/api/api-error'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import type { GuidedJourney } from '@/features/assessment/api/care-contract'
import { getCurrentReassessmentSummary } from '@/features/assessment/api/browser-care'
import { getGuidedJourney } from '@/features/support-guide/api/browser-support-guide'
import LockedPlanPreview from '@/features/support-plan-access/LockedPlanPreview'
import { rememberUpgradeIntent } from '@/features/support-plan-access/plan-access'
import { usePlanAccess } from '@/features/support-plan-access/use-plan-access'
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
  replaceNativeOccurrenceEngagement,
  replaceWithNativeSupportPlan,
  reviewNativeSupportPlanReplacement,
} from '../api/browser-support-plan-actions'
import {
  activateSupportPlan,
  changeSupportPlanOccurrenceState,
  changeSupportPlanStatus,
  getCurrentSupportPlanDraft,
  getSupportPlanOccurrences,
  getSupportPlanPersonalization,
  replaceSupportPlanActionSchedule,
  replaceSupportPlanChoices,
  replaceSupportPlanOccurrenceEngagement,
} from '../api/browser-support-plan'
import type {
  ActionOccurrence,
  AdaptiveReviewConfirmation,
  NativeSupportPlanReplacementReview,
  ReplaceSupportPlanChoicesRequest,
  SupportPlan,
  SupportPlanActionHistory,
  SupportPlanOccurrence,
  SupportPlanV3,
  UpdateActionScheduleRequest,
} from '../api/support-plan-contract'
import { dispatchMamSaved } from '@/features/mam/mam-saved'
import { useMamSuppress } from '@/features/mam/mam-suppression'
import { useMamPageTarget } from '@/features/mam/use-mam-target'
import SupportPlanCompanionShell from '../components/SupportPlanCompanionShell'
import type { SupportPlanGuidedNavigationTarget } from '../components/SupportPlanCompanionPanel'
import SupportPlanPersonalization from '../components/SupportPlanPersonalization'
import SupportPlanScheduleEditor from '../components/SupportPlanScheduleEditor'
import AdapterChoices from './AdapterChoices'
import AdjustPanel from './AdjustPanel'
import { autoProposalKey, shouldAutoPropose } from './auto-proposal'
import PlanHistory from './PlanHistory'
import PlanPanel from './PlanPanel'
import ProgressPanel from './ProgressPanel'
import {
  supportPlanStartAnswer,
  supportPlanTabAnswer,
  useMamActionExplain,
} from './mam-support-plan'
import ProposalPreview from './ProposalPreview'
import TodayPanel, { type Barrier, type Helpfulness } from './TodayPanel'
import { useCompanion } from './use-companion'
import {
  cycleLine,
  joinOccurrences,
  localDateIn,
  mergeOccurrences,
  msUntilNextLocalDay,
  occurrenceWindow,
  planActions,
  planTimezone,
  selectTodayFocus,
  summarizeProgress,
  type PlannedOccurrence,
} from './workspace-model'
import { WorkspaceLoading, WorkspaceMessage } from './WorkspaceStates'
import '../components/support-plan.css'
import './support-plan-workspace.css'

export type ReturnOrigin = Readonly<{
  kind: 'emotion' | 'journal' | 'resource'
  occurrenceId: string
  actionId: string
  localDate: string
  journalId?: string
}>

type Tab = 'today' | 'plan' | 'progress' | 'adjust'
const TABS: ReadonlyArray<{ id: Tab; label: string }> = [
  { id: 'today', label: 'Hôm nay' },
  { id: 'plan', label: 'Kế hoạch' },
  { id: 'progress', label: 'Tiến triển' },
  { id: 'adjust', label: 'Điều chỉnh' },
]

type Loaded = Readonly<{
  current?: SupportPlanV3
  draft?: SupportPlanV3
  history?: SupportPlanActionHistory
  journey: GuidedJourney | null
}>
type Proposal =
  | 'idle'
  | 'proposing'
  | 'free'
  | 'no-screening'
  | 'safety'
  | 'failed'
  | 'declined'

type ScreeningPurpose = 'INITIAL_CHECK' | 'REASSESSMENT'
type ProposalRequest = Readonly<{
  /** Revision-keyed replayable key (auto and regeneration) versus a retained fresh key. */
  deterministic: boolean
  preferReassessment: boolean
}>
type ProposalAttempt = Readonly<{
  id: string
  purpose: ScreeningPurpose
  key: string
}>

/** No reply (network or server failure): Care may have accepted the command. */
function uncertain(error: unknown) {
  return !(error instanceof ApiError) || !error.status || error.status >= 500
}

/** Only a missing or unfinished reassessment falls back; outages stay errors. */
async function evaluationSource(preferReassessment: boolean) {
  if (preferReassessment)
    try {
      return {
        purpose: 'REASSESSMENT' as ScreeningPurpose,
        id: await getNativeSupportPlanEvaluationSource('REASSESSMENT'),
      }
    } catch (error) {
      if (
        !(error instanceof ApiError) ||
        !(
          error.status === 404 ||
          ['REASSESSMENT_INCOMPLETE', 'SCREENING_EPISODE_NOT_FOUND'].includes(
            code(error),
          )
        )
      )
        throw error
    }
  return {
    purpose: 'INITIAL_CHECK' as ScreeningPurpose,
    id: await getNativeSupportPlanEvaluationSource('INITIAL_CHECK'),
  }
}

async function optionalPlan(request: Promise<SupportPlanV3>) {
  try {
    return await request
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return undefined
    throw error
  }
}

async function readWorkspace(): Promise<Loaded> {
  const [current, draft, journey] = await Promise.all([
    optionalPlan(getCurrentSupportPlanActions()),
    optionalPlan(getCurrentNativeSupportPlanDraft()),
    getGuidedJourney().catch(() => null),
  ])
  const history =
    !current && !draft ? await getSupportPlanActionHistory() : undefined
  return { current, draft, history, journey }
}

function code(error: unknown) {
  return error instanceof ApiError ? (error.code ?? '') : ''
}

function proposalFailure(error: unknown): Proposal {
  if (!(error instanceof ApiError)) return 'failed'
  // Only Care's paid-creation denial means FREE; any other 403 is a failure.
  if (error.code === 'SUPPORT_PLAN_ENTITLEMENT_REQUIRED') return 'free'
  if (code(error).includes('SAFETY')) return 'safety'
  if (
    error.status === 404 ||
    ['INITIAL_CHECK_INCOMPLETE', 'SCREENING_EPISODE_NOT_FOUND'].includes(
      code(error),
    )
  )
    return 'no-screening'
  return 'failed'
}

function errorMessage(error: unknown, proposing = false) {
  if (error instanceof ApiError) {
    if (error.status === 401)
      return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại để tiếp tục.'
    if (error.code === 'SUPPORT_PLAN_PERSONALIZATION_REVIEW_REQUIRED')
      return 'Bạn vừa đổi tùy chọn. Mở “Điều chỉnh theo ý bạn” và chọn “Xem bản đề xuất” để cập nhật trước khi bắt đầu.'
    if (error.status === 403) return 'Gói hiện tại chưa có kế hoạch theo ngày.'
    if (error.status === 412)
      return 'Kế hoạch vừa thay đổi ở nơi khác. Hãy tải lại rồi thử tiếp.'
    if (
      proposing &&
      ([
        'INITIAL_CHECK_INCOMPLETE',
        'REASSESSMENT_INCOMPLETE',
        'SCREENING_EPISODE_NOT_FOUND',
      ].includes(code(error)) ||
        error.status === 404)
    )
      return 'Hãy làm bài kiểm tra lại trước khi xem phương án mới.'
    if (error.status === 409)
      return 'Chưa thực hiện được vì kế hoạch đã thay đổi. Hãy tải lại để xem.'
  }
  return 'Chưa thực hiện được. Hãy thử lại sau giây lát.'
}

const lifecycleCopy = {
  PAUSED: {
    title: 'Tạm dừng kế hoạch?',
    description:
      'Những gì bạn đã ghi nhận vẫn được giữ. Ngày tạm dừng không tính vào 14 ngày.',
    confirmLabel: 'Tạm dừng',
  },
  ACTIVE: {
    title: 'Tiếp tục kế hoạch?',
    description: 'Hoạt động sẽ có lại trong lịch từ hôm nay.',
    confirmLabel: 'Tiếp tục',
  },
  COMPLETED: {
    title: 'Kết thúc kế hoạch?',
    description:
      'Kế hoạch chuyển vào lịch sử và không mở lại được. Kết thúc không có nghĩa là bạn đã hồi phục.',
    confirmLabel: 'Kết thúc',
  },
  DISCARDED: {
    title: 'Không dùng phương án này?',
    description:
      'Phương án được cất vào lịch sử. Kế hoạch đang dùng không đổi.',
    confirmLabel: 'Không dùng',
  },
} as const

// A first-time user has no plan in use, so the replacement wording would be untrue.
const discardFirstDraftCopy = {
  title: 'Không dùng kế hoạch này?',
  description:
    'Kế hoạch được cất vào lịch sử. Bạn có thể xem một đề xuất mới bất cứ lúc nào.',
  confirmLabel: 'Không dùng',
} as const

export default function SupportPlanWorkspace({
  returnOrigin,
  invalidOrigin = false,
  openReview: openReviewOnLoad = false,
  mamEnabled = false,
}: Readonly<{
  returnOrigin?: ReturnOrigin
  invalidOrigin?: boolean
  /** Returning from a reassessment the plan review asked for. */
  openReview?: boolean
  /** Server-resolved MAM_WEB_ENABLED: the global Mầm replaces the legacy Companion. */
  mamEnabled?: boolean
}>) {
  const { confirm } = useFeedback()
  const { access, retry: retryAccess } = usePlanAccess()
  const [loaded, setLoaded] = useState<Loaded>()
  const [loadFailed, setLoadFailed] = useState(false)
  const [proposal, setProposal] = useState<Proposal>('idle')
  const [tab, setTab] = useState<Tab>('today')
  const [message, setMessage] = useState('')
  // What the user can do next after a command error.
  const [messageStep, setMessageStep] = useState<'reload' | 'signin' | 'none'>(
    'reload',
  )
  const [starting, setStarting] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [occurrences, setOccurrences] = useState<ActionOccurrence[]>([])
  const [occurrencesLoading, setOccurrencesLoading] = useState(false)
  const [occurrencesFailed, setOccurrencesFailed] = useState(false)
  const [occurrencesReady, setOccurrencesReady] = useState(false)
  const occurrenceRequest = useRef(0)
  const [rowBusy, setRowBusy] = useState<Record<string, boolean>>({})
  const rowLocks = useRef(new Set<string>())
  const [rowMessages, setRowMessages] = useState<Record<string, string>>({})
  const [review, setReview] = useState<NativeSupportPlanReplacementReview>()
  const [scheduleDirty, setScheduleDirty] = useState(false)
  const [personalizationDirty, setPersonalizationDirty] = useState(false)
  const [updatingProposal, setUpdatingProposal] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const [reviewOpen, setReviewOpen] = useState(false)
  const proposalStarted = useRef(false)
  // The screening and key behind the current proposal survive retries and regeneration.
  const lastProposal = useRef<ProposalRequest>({
    deterministic: true,
    preferReassessment: false,
  })
  const proposalSource = useRef<ScreeningPurpose | undefined>(undefined)
  // The exact payload of a proposal whose reply never arrived; a retry replays it unchanged.
  const pendingProposal = useRef<ProposalAttempt | undefined>(undefined)
  const pendingReplacement = useRef<ProposalAttempt | undefined>(undefined)
  // Preferences changed while time edits were open: the draft is stale until regenerated.
  const [regenerationPending, setRegenerationPending] = useState(false)
  // v1 engagement rows let adapter plans rate and reopen without clobbering private notes.
  const [adapterEngagement, setAdapterEngagement] = useState<
    ReadonlyMap<string, SupportPlanOccurrence>
  >(new Map())
  const reconciled = useRef(false)
  const [staleOrigin, setStaleOrigin] = useState(false)
  const keys = useRef<{
    activation?: string
    replacement?: string
  }>({})
  // v1 slot choices of an older resource-based draft (Care accepts choices only on drafts).
  const [adapterDraft, setAdapterDraft] = useState<SupportPlan>()
  const [choicesDirty, setChoicesDirty] = useState(false)
  const dirty = scheduleDirty || personalizationDirty || choicesDirty
  const companion = useCompanion(dirty)
  const mamExplain = useMamActionExplain()
  useMamSuppress(mamEnabled && dirty)
  // A late save reply must not play feedback once this screen is gone.
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  useUnsavedChangesGuard(
    dirty,
    'Các thay đổi lịch hoặc tùy chọn chưa lưu sẽ không được giữ khi rời trang.',
  )

  const current = loaded?.current
  const draft = loaded?.draft
  const timezonePlan = current ?? draft
  const timezone = timezonePlan
    ? planTimezone(timezonePlan)
    : 'Asia/Ho_Chi_Minh'
  const [clock, setClock] = useState(() => Date.now())
  const today = localDateIn(timezone, new Date(clock))

  const reload = useCallback(async () => {
    const value = await readWorkspace()
    setLoaded(value)
    setLoadFailed(false)
    setReview(undefined)
    return value
  }, [])

  // Advance at the plan's local midnight and when a stale tab comes back.
  useEffect(() => {
    const tick = () => setClock(Date.now())
    const timer = window.setTimeout(tick, msUntilNextLocalDay(timezone))
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('focus', tick)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', tick)
      window.removeEventListener('focus', tick)
    }
  }, [timezone, clock])

  // A new local day re-reads the authoritative plan (day count, review due).
  const seenDay = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (!timezonePlan) return
    const previous = seenDay.current
    seenDay.current = today
    // A wake-up read can fail before the network returns; keep the loaded view.
    if (previous && previous !== today)
      void reload().catch(() => {
        setMessage('Chưa cập nhật được kế hoạch cho ngày mới.')
        setMessageStep('reload')
      })
  }, [reload, timezonePlan, today])

  useEffect(() => {
    let active = true
    void readWorkspace()
      .then((value) => {
        if (!active) return
        setLoaded(value)
        setTab(value.current ? 'today' : 'plan')
      })
      .catch(() => {
        if (active) setLoadFailed(true)
      })
    return () => {
      active = false
    }
  }, [])

  const loadOccurrences = useCallback(async () => {
    const requestId = ++occurrenceRequest.current
    if (!current) {
      setOccurrences([])
      return
    }
    setOccurrencesLoading(true)
    setOccurrencesFailed(false)
    try {
      const window = occurrenceWindow(current, today)
      const adapter = current.representationMode === 'V2_RESOURCE_ADAPTER'
      const [result, legacy] = await Promise.all([
        getSupportPlanActionOccurrences(window.from, window.through),
        // Adapter engagement lives only in the v1 read; without it rating stays hidden.
        adapter
          ? getSupportPlanOccurrences(window.from, window.through).catch(
              () => undefined,
            )
          : Promise.resolve(undefined),
      ])
      if (result.supportPlanId !== current.supportPlanId)
        throw new Error('Plan changed')
      if (requestId === occurrenceRequest.current) {
        const fetched = new Map(
          (legacy?.supportPlanId === current.supportPlanId
            ? legacy.occurrences
            : []
          ).map((item) => [item.occurrenceId, item]),
        )
        // The two reads are separate snapshots; only rows on which they agree may be written.
        const engagement = new Map<string, SupportPlanOccurrence>()
        const rows = result.occurrences.map((item) => {
          const row = fetched.get(item.occurrenceId)
          if (!row || row.version !== item.version || row.state !== item.state)
            return item
          engagement.set(item.occurrenceId, row)
          return { ...item, helpfulness: row.helpfulness }
        })
        setAdapterEngagement(engagement)
        setOccurrences((previous) => mergeOccurrences(previous, rows))
        setOccurrencesReady(true)
      }
    } catch {
      if (requestId === occurrenceRequest.current) setOccurrencesFailed(true)
    } finally {
      if (requestId === occurrenceRequest.current) setOccurrencesLoading(false)
    }
  }, [current, today])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadOccurrences(), 0)
    return () => {
      window.clearTimeout(timer)
      occurrenceRequest.current += 1
    }
  }, [loadOccurrences])

  const adapterDraftId =
    !current && draft?.representationMode === 'V2_RESOURCE_ADAPTER'
      ? draft.supportPlanId
      : undefined
  const draftVersion = draft?.version
  useEffect(() => {
    if (!adapterDraftId) return
    let active = true
    // Without this read the choices stay hidden; the draft itself still works.
    void getCurrentSupportPlanDraft()
      .then((value) => {
        if (active)
          setAdapterDraft(
            value.supportPlanId === adapterDraftId && value.status === 'DRAFT'
              ? value
              : undefined,
          )
      })
      .catch(() => {
        if (active) setAdapterDraft(undefined)
      })
    return () => {
      active = false
    }
  }, [adapterDraftId, draftVersion])

  async function command(action: () => Promise<void>, proposing = false) {
    if (busyRef.current) return false
    busyRef.current = true
    setBusy(true)
    setMessage('')
    try {
      await action()
      return true
    } catch (error) {
      setMessage(errorMessage(error, proposing))
      setMessageStep(
        error instanceof ApiError && error.status === 401
          ? 'signin'
          : error instanceof ApiError && error.status === 403
            ? 'none'
            : 'reload',
      )
      return false
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  /** Applies a propose reply; Care replays the original plan's current view, whatever its status. */
  const acceptProposal = useCallback(
    async (proposed: SupportPlanV3, purpose: ScreeningPurpose) => {
      proposalSource.current = purpose
      setRegenerationPending(false)
      if (proposed.status === 'DRAFT') {
        setLoaded((value) => value && { ...value, draft: proposed })
        return 'draft' as const
      }
      if (proposed.status === 'ACTIVE' || proposed.status === 'PAUSED') {
        await reload()
        return 'current' as const
      }
      setLoaded((value) => value && { ...value, draft: undefined })
      return 'closed' as const
    },
    [reload],
  )

  const propose = useCallback(
    async (request: ProposalRequest, retry = false) => {
      lastProposal.current = request
      if (!retry) pendingProposal.current = undefined
      setProposal('proposing')
      try {
        if (!pendingProposal.current) {
          const [source, personalization] = await Promise.all([
            evaluationSource(request.preferReassessment),
            getSupportPlanPersonalization(),
          ])
          pendingProposal.current = {
            ...source,
            key: request.deterministic
              ? autoProposalKey(source.id, personalization.value.revision)
              : crypto.randomUUID(),
          }
        }
        const attempt = pendingProposal.current
        const proposed = await proposeNativeSupportPlanDraft(
          attempt.id,
          attempt.key,
        )
        pendingProposal.current = undefined
        const outcome = await acceptProposal(proposed, attempt.purpose)
        setProposal(outcome === 'closed' ? 'declined' : 'idle')
        if (outcome !== 'closed') setTab(outcome === 'draft' ? 'plan' : 'today')
      } catch (error) {
        if (!uncertain(error)) pendingProposal.current = undefined
        setProposal(proposalFailure(error))
      }
    },
    [acceptProposal],
  )

  useEffect(() => {
    // Propose only with confirmed paid access: FREE never sees "preparing your plan".
    if (!loaded || proposalStarted.current || access.status !== 'paid') return
    if (
      !shouldAutoPropose({
        current: loaded.current,
        draft: loaded.draft,
        hadPlanBefore: (loaded.history?.items.length ?? 0) > 0,
        journey: loaded.journey,
      })
    )
      return
    proposalStarted.current = true
    const timer = window.setTimeout(
      () => void propose({ deterministic: true, preferReassessment: false }),
      0,
    )
    return () => window.clearTimeout(timer)
  }, [loaded, propose, access.status])

  // A command reply never moves a row back past a newer version already shown.
  function updateOccurrence(next: ActionOccurrence) {
    setOccurrences((values) =>
      values.map((value) =>
        value.occurrenceId === next.occurrenceId &&
        next.version >= value.version
          ? { ...value, ...next }
          : value,
      ),
    )
  }

  async function rowCommand(
    item: PlannedOccurrence,
    run: () => Promise<string | void>,
  ) {
    const id = item.occurrence.occurrenceId
    if (rowLocks.current.has(id)) return
    rowLocks.current.add(id)
    setRowBusy((values) => ({ ...values, [id]: true }))
    setRowMessages((values) => ({ ...values, [id]: '' }))
    try {
      const note = await run()
      if (note) setAnnouncement(note)
      // The pressed control often disappears with its row state; keep focus on the row.
      window.requestAnimationFrame(() => {
        const active = document.activeElement
        if (!active || active === document.body || !active.isConnected)
          document.getElementById(`activity-${id}`)?.focus()
      })
    } catch (error) {
      setRowMessages((values) => ({ ...values, [id]: errorMessage(error) }))
    } finally {
      rowLocks.current.delete(id)
      setRowBusy((values) => ({ ...values, [id]: false }))
    }
  }

  function changeState(
    item: PlannedOccurrence,
    state: 'SCHEDULED' | 'COMPLETED' | 'SKIPPED',
  ) {
    return rowCommand(item, async () => {
      const { occurrence } = item
      if (occurrence.representationMode === 'NATIVE_V3') {
        const result = await changeNativeActionOccurrenceState(
          occurrence.occurrenceId,
          occurrence.version,
          state,
        )
        if (result.occurrenceId !== occurrence.occurrenceId)
          throw new Error('Wrong activity')
        updateOccurrence(result)
      } else {
        const legacy = adapterEngagement.get(occurrence.occurrenceId)
        if (state === 'SCHEDULED') {
          if (legacy?.version !== occurrence.version)
            throw new Error('Engagement not loaded')
          await replaceSupportPlanOccurrenceEngagement(
            legacy.occurrenceId,
            legacy.version,
            // A scheduled row carries no outcome metadata (Care and BFF rule).
            {
              state,
              hidden: legacy.hidden,
              helpfulness: null,
              barrierCode: null,
              reflection: null,
              summaryReuseApproved: false,
            },
          )
        } else
          await changeSupportPlanOccurrenceState(
            occurrence.occurrenceId,
            occurrence.version,
            state,
          )
        await loadOccurrences()
      }
      // Care has confirmed the change; a failed or pending save never gets here.
      if (mamEnabled && mounted.current && state === 'COMPLETED')
        dispatchMamSaved()
      const title = item.action.presentation.title
      return state === 'COMPLETED'
        ? `Đã ghi nhận: ${title}.`
        : state === 'SKIPPED'
          ? `Đã để “${title}” sang hôm khác.`
          : `“${title}” đã có lại trong hôm nay.`
    })
  }

  /** Optional coded reason for a skipped native activity; reuse only when the user ticks it. */
  function skipReason(
    item: PlannedOccurrence,
    barrierCode: Barrier,
    reuse: boolean,
  ) {
    return rowCommand(item, async () => {
      const { occurrence } = item
      if (occurrence.representationMode !== 'NATIVE_V3')
        throw new Error('Native activity required')
      const result = await replaceNativeOccurrenceEngagement(
        occurrence.occurrenceId,
        occurrence.version,
        {
          state: 'SKIPPED',
          hidden: occurrence.hidden ?? false,
          helpfulness: null,
          barrierCode,
          reflection: occurrence.reflection ?? null,
          summaryReuseApproved:
            reuse || (occurrence.summaryReuseApproved ?? false),
        },
      )
      updateOccurrence(result)
      return 'Cảm ơn bạn. Câu trả lời này chỉ để bạn nhìn lại sau.'
    })
  }

  function rate(
    item: PlannedOccurrence,
    helpfulness: Helpfulness,
    reuse = false,
  ) {
    return rowCommand(item, async () => {
      const { occurrence } = item
      if (occurrence.representationMode === 'NATIVE_V3') {
        const result = await replaceNativeOccurrenceEngagement(
          occurrence.occurrenceId,
          occurrence.version,
          {
            state: 'COMPLETED',
            hidden: occurrence.hidden ?? false,
            helpfulness,
            barrierCode: null,
            reflection: occurrence.reflection ?? null,
            summaryReuseApproved:
              reuse || (occurrence.summaryReuseApproved ?? false),
          },
        )
        updateOccurrence(result)
      } else {
        const legacy = adapterEngagement.get(occurrence.occurrenceId)
        if (legacy?.version !== occurrence.version)
          throw new Error('Engagement not loaded')
        await replaceSupportPlanOccurrenceEngagement(
          legacy.occurrenceId,
          legacy.version,
          {
            state: 'COMPLETED',
            hidden: legacy.hidden,
            helpfulness,
            barrierCode: null,
            reflection: legacy.reflection,
            summaryReuseApproved: legacy.summaryReuseApproved,
          },
        )
        await loadOccurrences()
      }
      return 'Cảm ơn bạn. Lựa chọn này giúp bạn nhìn lại sau.'
    })
  }

  const reconcileReturn = useCallback(
    (item: PlannedOccurrence, journalId?: string) =>
      rowCommand(item, async () => {
        const { occurrence } = item
        const result = journalId
          ? await reconcileJournalOccurrence(occurrence.occurrenceId, journalId)
          : await reconcileEmotionCheckInOccurrence(occurrence.occurrenceId)
        if (
          result.occurrenceId !== occurrence.occurrenceId ||
          result.actionId !== occurrence.actionId ||
          result.localDate !== occurrence.localDate
        )
          throw new Error('Wrong activity')
        updateOccurrence({
          ...occurrence,
          state: result.occurrenceState,
          displayState: result.occurrenceState,
          version: result.version,
          completionEvidence: result.completionEvidence,
          outcomeRecordedAt: result.completedAt,
        })
        return result.sourceState === 'RECORDED'
          ? `Đã ghi nhận: ${item.action.presentation.title}.`
          : 'Chưa thấy ghi nhận cho hoạt động này. Bạn có thể làm lại rồi quay về đây.'
      }),
    // rowCommand only reads refs and stable setters.
    [],
  )

  // One automatic check after returning from the owning feature; never a fabricated done.
  useEffect(() => {
    if (
      !returnOrigin ||
      reconciled.current ||
      !current ||
      occurrencesLoading ||
      !occurrencesReady
    )
      return
    reconciled.current = true
    const item = joinOccurrences(current, occurrences).find(
      ({ occurrence }) =>
        occurrence.occurrenceId === returnOrigin.occurrenceId &&
        occurrence.actionId === returnOrigin.actionId &&
        occurrence.localDate === returnOrigin.localDate,
    )
    const expected = {
      emotion: 'EMOTION_CHECK_IN',
      journal: 'JOURNAL',
      resource: 'RESOURCE',
    }[returnOrigin.kind]
    // A paused plan already explains itself on Today; nothing is checked.
    if (current.status !== 'ACTIVE') return
    // Only today's work is checked; older origins do nothing.
    if (
      !item ||
      item.action.actionType !== expected ||
      item.action.status === 'ENDED' ||
      item.occurrence.localDate !== today
    ) {
      setStaleOrigin(true)
      return
    }
    setTab('today')
    window.requestAnimationFrame(() =>
      document
        .getElementById(`activity-${item.occurrence.occurrenceId}`)
        ?.focus(),
    )
    if (item.occurrence.state !== 'SCHEDULED') return
    if (returnOrigin.kind === 'emotion') void reconcileReturn(item)
    if (returnOrigin.kind === 'journal' && returnOrigin.journalId)
      void reconcileReturn(item, returnOrigin.journalId)
  }, [
    current,
    occurrences,
    occurrencesLoading,
    occurrencesReady,
    reconcileReturn,
    returnOrigin,
    today,
  ])

  async function lifecycle(
    target: SupportPlanV3,
    status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'DISCARDED',
  ) {
    if (dirty) {
      setMessage('Hãy lưu hoặc hoàn tác thay đổi đang dở trước.')
      return
    }
    const copy =
      status === 'DISCARDED' && !current
        ? discardFirstDraftCopy
        : lifecycleCopy[status]
    if (!(await confirm({ ...copy, cancelLabel: 'Quay lại' }))) return
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
          status === 'COMPLETED' ? 'USER_DECISION' : undefined,
        )
      const next = await reload()
      if (status === 'DISCARDED') setRegenerationPending(false)
      if (!next.current && !next.draft && status === 'DISCARDED')
        setProposal('idle')
    })
  }

  async function activate() {
    if (!draft || dirty || regenerationPending) return
    setStarting(true)
    await command(async () => {
      keys.current.activation ??= crypto.randomUUID()
      if (draft.representationMode === 'NATIVE_V3') {
        const activated = await activateNativeSupportPlan(
          draft.supportPlanId,
          draft.version,
          keys.current.activation,
        )
        setLoaded(
          (value) =>
            value && { ...value, current: activated, draft: undefined },
        )
      } else {
        await activateSupportPlan(
          draft.supportPlanId,
          draft.version,
          keys.current.activation,
        )
        await reload()
      }
      keys.current.activation = undefined
      setTab('today')
      setAnnouncement('Kế hoạch đã bắt đầu. Đây là việc của hôm nay.')
    })
    setStarting(false)
  }

  // Saved preferences make the draft stale: discard it, then re-propose from the same screening.
  async function refreshDraft() {
    if (!draft) return
    // Stale from now on: Start stays blocked until the old draft is gone or replaced.
    setRegenerationPending(true)
    if (busyRef.current) return
    // Unsaved time edits would be lost with the old draft; the review button stays for later.
    if (scheduleDirty) {
      setMessage(
        'Lựa chọn đã được lưu. Hãy lưu hoặc hoàn tác thay đổi giờ, rồi chọn “Xem bản đề xuất”.',
      )
      setMessageStep('none')
      return
    }
    // The empty moment after the discard must not trigger a second, automatic proposal.
    proposalStarted.current = true
    setUpdatingProposal(true)
    const discarded = await command(async () => {
      if (draft.representationMode === 'NATIVE_V3')
        await changeNativeSupportPlanStatus(
          draft.supportPlanId,
          draft.version,
          { status: 'DISCARDED' },
        )
      else
        await changeSupportPlanStatus(
          draft.supportPlanId,
          draft.version,
          'DISCARDED',
        )
      // Shown at once, so a failed re-proposal retries without discarding twice.
      keys.current.activation = undefined
      setRegenerationPending(false)
      setLoaded((value) => value && { ...value, draft: undefined })
    })
    setUpdatingProposal(false)
    const regeneration: ProposalRequest = {
      deterministic: true,
      // A draft read from Care has no local source; the newest screening grounds it.
      preferReassessment: proposalSource.current !== 'INITIAL_CHECK',
    }
    if (discarded) return propose(regeneration)
    // Refused (412) or unanswered: re-read so a retry uses the authoritative draft.
    const next = await reload().catch(() => undefined)
    if (next && !next.current && !next.draft) {
      // The discard did land; only the reply was lost.
      setMessage('')
      await propose(regeneration)
    }
  }

  async function saveChoices(request: ReplaceSupportPlanChoicesRequest) {
    if (!adapterDraft) return
    await command(async () => {
      const saved = await replaceSupportPlanChoices(
        adapterDraft.supportPlanId,
        adapterDraft.version,
        request,
      )
      const refreshed = await getSupportPlanActionModel(saved.supportPlanId)
      keys.current.activation = undefined
      setAdapterDraft(saved)
      setLoaded((value) => value && { ...value, draft: refreshed })
      setAnnouncement('Đã lưu lựa chọn của bạn.')
    })
  }

  /** Care applied one reviewed option; show the authoritative plan on Today. */
  async function reviewApplied(result: AdaptiveReviewConfirmation) {
    // The review itself shows the keep outcome; nothing changed to reload.
    if (result.result === 'KEPT') return
    await reload()
    // A prepared draft is compared in the review itself; stay on Adjust.
    if (result.result === 'DRAFT_PREPARED') return
    setTab('today')
    setAnnouncement(
      result.result === 'CYCLE_CONTINUED'
        ? 'Đã bắt đầu thêm 14 ngày với nhịp hiện tại.'
        : 'Đã cập nhật kế hoạch theo lựa chọn của bạn.',
    )
  }

  async function proposeReplacement() {
    if (!current || dirty) return
    await command(async () => {
      pendingReplacement.current ??= {
        id: await getNativeSupportPlanEvaluationSource('REASSESSMENT'),
        purpose: 'REASSESSMENT',
        key: crypto.randomUUID(),
      }
      const attempt = pendingReplacement.current
      let proposed: SupportPlanV3
      try {
        proposed = await proposeNativeSupportPlanDraft(attempt.id, attempt.key)
      } catch (error) {
        if (!uncertain(error)) pendingReplacement.current = undefined
        throw error
      }
      pendingReplacement.current = undefined
      setReview(undefined)
      if ((await acceptProposal(proposed, 'REASSESSMENT')) === 'closed') {
        setMessage(
          'Phương án này đã được cất vào lịch sử. Bạn có thể xem một phương án mới.',
        )
        setMessageStep('none')
      }
    }, true)
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
    }, true)
  }

  async function confirmReplacement() {
    if (!review || !draft || !current || dirty) return
    if (
      !(await confirm({
        title: 'Chuyển sang phương án mới?',
        description:
          'Kế hoạch đang dùng chuyển vào lịch sử. Những gì bạn đã ghi nhận vẫn được giữ.',
        confirmLabel: 'Chuyển sang phương án mới',
        cancelLabel: 'Quay lại',
      }))
    )
      return
    await command(async () => {
      keys.current.replacement ??= crypto.randomUUID()
      await replaceWithNativeSupportPlan(
        draft.supportPlanId,
        draft.version,
        {
          currentSupportPlanId: current.supportPlanId,
          currentVersion: current.version,
          reassessmentSummaryId: review.reassessmentSummary.summaryId,
        },
        keys.current.replacement,
      )
      keys.current.replacement = undefined
      await reload()
      setTab('today')
    })
  }

  async function saveSchedule(
    target: SupportPlanV3,
    actionId: string,
    request: UpdateActionScheduleRequest,
    key: string,
  ) {
    const saved = await replaceSupportPlanActionSchedule(
      target.supportPlanId,
      actionId,
      target.version,
      request,
      key,
    )
    setLoaded(
      (value) =>
        value &&
        (value.draft?.supportPlanId === saved.supportPlanId
          ? { ...value, draft: saved }
          : { ...value, current: saved }),
    )
    keys.current.activation = undefined
    setReview(undefined)
  }

  function scheduleEditor(target: SupportPlanV3) {
    return (
      <SupportPlanScheduleEditor
        plan={target}
        onDirtyChange={setScheduleDirty}
        onSave={(actionId, request, key) =>
          saveSchedule(target, actionId, request, key)
        }
        onReload={async () => {
          const refreshed = await getSupportPlanActionModel(
            target.supportPlanId,
          )
          setLoaded(
            (value) =>
              value &&
              (value.draft?.supportPlanId === refreshed.supportPlanId
                ? { ...value, draft: refreshed }
                : { ...value, current: refreshed }),
          )
          return true
        }}
      />
    )
  }

  async function changeTab(next: Tab) {
    if (next === tab) return true
    if (
      dirty &&
      !(await confirm({
        title: 'Rời phần đang chỉnh sửa?',
        description: 'Thay đổi chưa lưu sẽ bị bỏ.',
        confirmLabel: 'Bỏ thay đổi',
        cancelLabel: 'Ở lại',
      }))
    )
      return false
    setScheduleDirty(false)
    setPersonalizationDirty(false)
    companion.clear()
    setTab(next)
    return true
  }

  function tabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const offsets: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 }
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? TABS.length - 1
          : event.key in offsets
            ? (index + offsets[event.key] + TABS.length) % TABS.length
            : undefined
    if (next === undefined) return
    event.preventDefault()
    void changeTab(TABS[next].id).then((changed) => {
      if (changed) document.getElementById(`tab-${TABS[next].id}`)?.focus()
    })
  }

  function openReview() {
    setReviewOpen(true)
    void changeTab('adjust').then(() =>
      window.requestAnimationFrame(() =>
        document
          .getElementById('mbw-review')
          ?.scrollIntoView?.({ block: 'start' }),
      ),
    )
  }

  const reviewRequested = useRef(openReviewOnLoad)
  const hasCurrent = Boolean(current)
  useEffect(() => {
    if (!reviewRequested.current || !hasCurrent) return
    const timer = window.setTimeout(() => {
      reviewRequested.current = false
      openReview()
    }, 0)
    return () => window.clearTimeout(timer)
    // openReview only reads state setters and the tab helper.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCurrent])

  const focus = current
    ? selectTodayFocus(current, occurrences, today)
    : undefined
  // The page answer is about this tab and this focus; either change retires it.
  const pageIdentity = `${tab}:${
    focus?.kind === 'OCCURRENCE'
      ? focus.occurrence.occurrenceId
      : (focus?.kind ?? '')
  }`
  useMamPageTarget(
    mamEnabled && current ? { kind: 'support-plan.page' } : null,
    mamEnabled
      ? async (intent, { isRegistered }) =>
          intent === 'EXPLAIN'
            ? supportPlanTabAnswer(tab)
            : focus
              ? supportPlanStartAnswer(
                  focus,
                  tab,
                  isRegistered,
                  occurrencesFailed
                    ? 'failed'
                    : occurrencesReady
                      ? 'ready'
                      : 'loading',
                )
              : null
      : undefined,
    pageIdentity,
  )
  const engageable = new Set(
    occurrences
      .filter(
        (item) =>
          item.representationMode === 'NATIVE_V3' ||
          adapterEngagement.get(item.occurrenceId)?.version === item.version,
      )
      .map((item) => item.occurrenceId),
  )
  const progress =
    current && occurrencesReady
      ? summarizeProgress(
          current,
          occurrences,
          occurrenceWindow(current, today),
          today,
        )
      : undefined
  const companionAction =
    tab === 'today' && focus?.kind === 'OCCURRENCE'
      ? focus.action
      : current
        ? planActions(current).find((action) => action.status !== 'ENDED')
        : undefined
  const planForCopy = current ?? draft
  const safetyFirst = planForCopy?.safety.status === 'POSITIVE_SAFETY_SCREEN'
  // Inline safety support is a no-interrupt zone, with or without a plan.
  useMamSuppress(
    mamEnabled &&
      (safetyFirst ||
        proposal === 'safety' ||
        loaded?.journey?.nextAction === 'REVIEW_SAFETY_SUPPORT'),
  )

  function header(subtitle?: string) {
    return (
      <header className="mbw-header">
        <h1>Kế hoạch của bạn</h1>
        {subtitle && <p className="mbw-lead">{subtitle}</p>}
      </header>
    )
  }

  const safetyCard = safetyFirst && (
    <WorkspaceMessage
      tone="safety"
      title="Nếu bạn đang thấy không an toàn"
      primary={{ label: 'Xem số hỗ trợ gần bạn', href: '/safety-directory' }}
    >
      <p>{planForCopy?.safety.guidance}</p>
    </WorkspaceMessage>
  )

  const expiredNotice = access.status === 'expired' &&
    !safetyFirst &&
    loaded?.journey?.nextAction !== 'REVIEW_SAFETY_SUPPORT' && (
      <p className="mbw-quiet">
        Gói của bạn đã hết hạn. Kế hoạch này vẫn mở được; lập kế hoạch mới cần{' '}
        <Link
          className="lpp-inline-link"
          href="/subscription"
          onClick={() => rememberUpgradeIntent()}
        >
          gia hạn Plus
        </Link>
        .
      </p>
    )

  const live = (
    <p className="mbw-visually-hidden" role="status" aria-live="polite">
      {announcement}
    </p>
  )

  if (loadFailed)
    return (
      <div className="mbw-page" data-page-motion="off">
        {header()}
        <WorkspaceMessage
          alert
          title="Chưa tải được kế hoạch"
          primary={{
            label: retrying ? 'Đang thử lại…' : 'Thử lại',
            busy: retrying,
            onClick: () => {
              setRetrying(true)
              void reload()
                .catch(() => setLoadFailed(true))
                .finally(() => setRetrying(false))
            },
          }}
        >
          <p>
            Kế hoạch của bạn không bị thay đổi. Kiểm tra kết nối rồi thử lại.
          </p>
        </WorkspaceMessage>
      </div>
    )

  if (!loaded)
    return (
      <div className="mbw-page" data-page-motion="off">
        {header()}
        <WorkspaceLoading label="Đang tải kế hoạch…" />
      </div>
    )

  // No current plan: either the proposal preview, or one honest next step.
  if (!current) {
    const hadPlan = (loaded.history?.items.length ?? 0) > 0
    const guideId = loaded.journey?.supportGuideId
    // The one quiet free continuation, from Care's facts only.
    const freeNext = guideId
      ? { label: 'Xem lại gợi ý hỗ trợ', href: `/support-guides/${guideId}` }
      : loaded.journey?.stage === 'ASSESSMENT_REQUIRED'
        ? { label: 'Làm bài kiểm tra ngắn', href: '/initial-check' }
        : { label: 'Xem gợi ý hỗ trợ', href: '/support-guides' }
    return (
      <div className="mbw-page" data-page-motion="off">
        {header(draft ? 'Xem trước rồi bắt đầu khi bạn sẵn sàng.' : undefined)}
        {live}
        {message && (
          <p className="mbw-inline-alert" role="alert">
            {message}
          </p>
        )}
        {safetyCard}
        {draft && expiredNotice}
        {draft ? (
          <ProposalPreview
            draft={draft}
            busy={busy}
            starting={starting}
            updating={updatingProposal}
            preferences={
              <SupportPlanPersonalization
                onDirtyChange={setPersonalizationDirty}
                onReviewPlan={(reason) => {
                  if (reason === 'PREFERENCES_CHANGED_AFTER_DRAFT_CREATION')
                    void refreshDraft()
                }}
                onSaved={(saved) => {
                  if (
                    saved.value.planReview.reasonCode ===
                    'PREFERENCES_CHANGED_AFTER_DRAFT_CREATION'
                  )
                    void refreshDraft()
                }}
              />
            }
            blockedReason={
              dirty
                ? 'Hãy lưu hoặc hoàn tác thay đổi đang dở trước khi bắt đầu.'
                : regenerationPending
                  ? 'Mở “Điều chỉnh theo ý bạn” rồi chọn “Xem bản đề xuất” để cập nhật kế hoạch trước khi bắt đầu.'
                  : undefined
            }
            choices={
              adapterDraft?.supportPlanId === draft.supportPlanId &&
              adapterDraft.version === draft.version ? (
                <AdapterChoices
                  key={adapterDraft.supportPlanId}
                  plan={adapterDraft}
                  busy={busy}
                  onSave={saveChoices}
                  onDirtyChange={setChoicesDirty}
                />
              ) : undefined
            }
            schedule={scheduleEditor(draft)}
            onStart={() => void activate()}
            onDiscard={() => void lifecycle(draft, 'DISCARDED')}
          />
        ) : proposal === 'proposing' ? (
          <WorkspaceLoading label="Đang chuẩn bị kế hoạch cho bạn…" />
        ) : proposal === 'safety' ||
          loaded.journey?.nextAction === 'REVIEW_SAFETY_SUPPORT' ? (
          <WorkspaceMessage
            tone="safety"
            title="Ưu tiên lúc này là sự an toàn của bạn"
            primary={{
              label: 'Xem số hỗ trợ gần bạn',
              href: '/safety-directory',
            }}
            secondary={
              loaded.journey?.supportGuideId
                ? {
                    label: 'Xem gợi ý hỗ trợ',
                    href: `/support-guides/${loaded.journey.supportGuideId}`,
                  }
                : undefined
            }
          >
            <p>Kế hoạch có thể đợi. Hãy liên hệ người hỗ trợ trước.</p>
          </WorkspaceMessage>
        ) : !hadPlan &&
          (proposal === 'free' ||
            access.status === 'free' ||
            access.status === 'expired') ? (
          <LockedPlanPreview
            expired={access.status === 'expired'}
            pendingPayment={access.pendingPayment}
            next={freeNext}
          />
        ) : !hadPlan && access.status === 'unavailable' ? (
          <WorkspaceMessage
            alert
            title="Chưa kiểm tra được gói của bạn"
            primary={{ label: 'Thử lại', onClick: () => void retryAccess() }}
            secondary={freeNext}
          >
            <p>Kết nối vừa bị gián đoạn. Gợi ý hỗ trợ vẫn mở được.</p>
          </WorkspaceMessage>
        ) : !hadPlan && access.status === 'loading' ? (
          <WorkspaceLoading label="Đang kiểm tra gói của bạn…" />
        ) : proposal === 'no-screening' ||
          loaded.journey?.stage === 'ASSESSMENT_REQUIRED' ? (
          <WorkspaceMessage
            title="Bắt đầu bằng một bài kiểm tra ngắn"
            primary={{ label: 'Làm bài kiểm tra', href: '/initial-check' }}
          >
            <p>
              Kế hoạch được soạn từ kết quả của bạn, nên cần bài kiểm tra trước.
            </p>
          </WorkspaceMessage>
        ) : proposal === 'failed' ? (
          <WorkspaceMessage
            alert
            title="Chưa chuẩn bị được kế hoạch"
            primary={{
              label: 'Thử lại',
              onClick: () => void propose(lastProposal.current, true),
            }}
          >
            <p>Kết nối vừa bị gián đoạn. Bạn có thể thử lại ngay.</p>
          </WorkspaceMessage>
        ) : proposal === 'declined' ? (
          <WorkspaceMessage
            title="Kế hoạch này đã được cất vào lịch sử"
            primary={{
              label: 'Xem đề xuất mới',
              onClick: () =>
                void propose({
                  deterministic: false,
                  preferReassessment: hadPlan,
                }),
            }}
          >
            <p>Bạn có thể xem một đề xuất mới bất cứ lúc nào.</p>
          </WorkspaceMessage>
        ) : hadPlan ? (
          <WorkspaceMessage
            title="Bạn chưa có kế hoạch đang dùng"
            primary={{
              label: 'Làm bài kiểm tra lại',
              href: '/initial-check?purpose=reassessment',
            }}
            secondary={
              access.status === 'paid' && proposal !== 'free'
                ? {
                    label: 'Xem đề xuất mới',
                    onClick: () =>
                      void propose({
                        deterministic: false,
                        preferReassessment: true,
                      }),
                  }
                : access.status === 'free' ||
                    access.status === 'expired' ||
                    proposal === 'free'
                  ? {
                      label: access.pendingPayment
                        ? 'Xem trạng thái thanh toán'
                        : access.status === 'expired'
                          ? 'Gia hạn Plus'
                          : 'Nâng cấp Plus',
                      href: '/subscription',
                      onNavigate: () => rememberUpgradeIntent(),
                    }
                  : access.status === 'unavailable'
                    ? { label: 'Thử lại', onClick: () => void retryAccess() }
                    : undefined
            }
          >
            <p>Kiểm tra lại giúp đề xuất mới khớp với bạn lúc này.</p>
            <PlanHistory initial={loaded.history} />
          </WorkspaceMessage>
        ) : (
          <WorkspaceMessage
            title="Chưa có kế hoạch"
            primary={{ label: 'Xem gợi ý hỗ trợ', href: '/support-guides' }}
          >
            <p>
              Hoàn tất gợi ý hỗ trợ trước, kế hoạch sẽ được chuẩn bị cho bạn.
            </p>
          </WorkspaceMessage>
        )}
        {planForCopy && (
          <p className="mbw-disclaimer">{planForCopy.disclaimer}</p>
        )}
      </div>
    )
  }

  return (
    <div className="mbw-page" data-page-motion="off">
      {header(
        cycleLine(current.cycle) ??
          (current.status === 'PAUSED'
            ? 'Đang tạm dừng'
            : 'Đang theo kế hoạch'),
      )}
      {live}
      {(invalidOrigin || staleOrigin) && (
        <p className="mbw-inline-alert" role="status">
          Không tìm thấy hoạt động bạn vừa mở trong kế hoạch hiện tại.
        </p>
      )}
      {message && (
        <div className="mbw-inline-alert" role="alert">
          <p>{message}</p>
          {messageStep === 'signin' && (
            <Link className="mbw-link-button" href="/login">
              Đăng nhập lại
            </Link>
          )}
          {messageStep === 'reload' && (
            <button
              type="button"
              className="mbw-link-button"
              disabled={busy}
              onClick={() =>
                void command(async () => {
                  await reload()
                  await loadOccurrences()
                })
              }
            >
              Tải lại kế hoạch
            </button>
          )}
        </div>
      )}
      {safetyCard}
      {expiredNotice}
      <div
        className="mbw-tabs"
        role="tablist"
        aria-label="Các phần của kế hoạch"
      >
        {TABS.map((item, index) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-controls={tab === item.id ? `panel-${item.id}` : undefined}
            aria-selected={tab === item.id}
            tabIndex={tab === item.id ? 0 : -1}
            className={tab === item.id ? 'is-active' : undefined}
            onClick={() => void changeTab(item.id)}
            onKeyDown={(event) => tabKey(event, index)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mbw-layout">
        <section
          id={`panel-${tab}`}
          role="tabpanel"
          aria-labelledby={`tab-${tab}`}
          className="mbw-tabpanel"
        >
          {tab === 'today' && focus && (
            <TodayPanel
              plan={current}
              focus={focus}
              occurrences={occurrences}
              today={today}
              loading={occurrencesLoading && !occurrencesReady}
              loadError={occurrencesFailed}
              returnedOccurrenceId={returnOrigin?.occurrenceId}
              engageable={engageable}
              rows={{ busy: rowBusy, messages: rowMessages }}
              busy={busy}
              companion={companion}
              mam={mamEnabled ? mamExplain : undefined}
              onRetry={() => void loadOccurrences()}
              onSkip={(item) => void changeState(item, 'SKIPPED')}
              onReopen={(item) => void changeState(item, 'SCHEDULED')}
              onAcknowledge={(item) => void changeState(item, 'COMPLETED')}
              onRate={(item, value, reuse) => void rate(item, value, reuse)}
              onBarrier={(item, value, reuse) =>
                void skipReason(item, value, reuse)
              }
              onResume={() => void lifecycle(current, 'ACTIVE')}
              onOpenReview={openReview}
              onOpenPlan={() => void changeTab('plan')}
            />
          )}
          {tab === 'plan' && (
            <PlanPanel
              plan={current}
              companion={companion}
              mam={mamEnabled ? mamExplain : undefined}
            />
          )}
          {tab === 'progress' && (
            <ProgressPanel
              summary={progress}
              occurrences={occurrences}
              loadError={occurrencesFailed}
              onRetry={() => void loadOccurrences()}
            />
          )}
          {tab === 'adjust' && (
            <AdjustPanel
              plan={current}
              replacement={draft}
              review={review}
              busy={busy}
              dirty={dirty}
              reviewOpen={reviewOpen}
              mamReview={mamEnabled}
              schedule={scheduleEditor(current)}
              preferences={
                <SupportPlanPersonalization
                  onDirtyChange={setPersonalizationDirty}
                  onReviewPlan={() => void changeTab('plan')}
                />
              }
              history={<PlanHistory />}
              onApplied={reviewApplied}
              onDiscardDraft={async () => {
                if (draft) await lifecycle(draft, 'DISCARDED')
              }}
              onRefreshPlan={async () => void (await reload())}
              onProposeReplacement={() => void proposeReplacement()}
              onReviewReplacement={() => void reviewReplacement()}
              onConfirmReplacement={() => void confirmReplacement()}
              onDiscardReplacement={() =>
                draft && void lifecycle(draft, 'DISCARDED')
              }
              onTogglePause={() =>
                void lifecycle(
                  current,
                  current.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED',
                )
              }
              onEnd={() => void lifecycle(current, 'COMPLETED')}
            />
          )}
        </section>
        {!mamEnabled && (
          <aside className="mbw-aside">
            <SupportPlanCompanionShell
              state={
                companion.snapshot?.status === 'loading' ? 'thinking' : 'idle'
              }
              surface={tab}
              contextual={companion.snapshot}
              onContextualDismiss={companion.dismiss}
              guidedContext={{
                supportPlanId: current.supportPlanId,
                action: companionAction
                  ? {
                      actionId: companionAction.actionId,
                      title: companionAction.presentation.title,
                      requestSurface:
                        tab === 'today'
                          ? ('TODAY' as const)
                          : tab === 'plan'
                            ? ('PLAN' as const)
                            : undefined,
                    }
                  : undefined,
                review,
              }}
              companionRequestPending={companion.pending}
              interruptionActive={companion.interrupted}
              onGuidedRequest={(request) => void companion.request(request)}
              onGuidedDismiss={companion.dismissGuided}
              onGuidedNavigate={({
                surface,
                actionId,
              }: SupportPlanGuidedNavigationTarget) =>
                void changeTab(surface).then((changed) => {
                  if (!changed) return
                  window.requestAnimationFrame(() => {
                    const target =
                      (actionId &&
                        document.querySelector<HTMLElement>(
                          `[data-support-plan-action-id="${CSS.escape(actionId)}"]`,
                        )) ||
                      document.getElementById(`tab-${surface}`)
                    target?.scrollIntoView?.({ block: 'center' })
                    target?.focus()
                  })
                })
              }
            />
          </aside>
        )}
      </div>
      <p className="mbw-disclaimer">{current.disclaimer}</p>
    </div>
  )
}
