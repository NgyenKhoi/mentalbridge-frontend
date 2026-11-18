import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { randomUUID } from 'expo-crypto'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import {
  ActivityIndicator,
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import type { ScrollView } from 'react-native'

import { ApiError } from '@/api/api-error'
import { useSession } from '@/auth/session-context'
import { PrimaryButton } from '@/components/PrimaryButton'
import { Screen } from '@/components/Screen'
import type { EmotionApi } from '@/emotion/emotion-api'
import { colors, radii, spacing, typography } from '@/theme/tokens'
import { useDashboardFonts } from '@/theme/useDashboardFonts'
import { SupportPlanCompanion } from '@/support-plan-companion/SupportPlanCompanion'

import {
  addPlanDays,
  emotionReconciliationMessage,
  localPlanDate,
  occurrenceWindow,
  type EmotionPlanOrigin,
  type OriginInput,
} from './emotion-plan-context'
import {
  noHomePlanOrigin,
  resolveNativeHomePlanOrigin,
  type HomePlanOriginInput,
} from './home-plan-context'
import type { SupportPlanApi } from './support-plan-api'
import type { SupportPlanActionApi } from './support-plan-action-api'
import type {
  ActionOccurrence,
  CanonicalSupportPlan,
  EmotionReconciliation,
  JournalReconciliation,
  NativeReplacementReview,
} from './support-plan-action-contract'
import { SupportPlanPersonalizationCard } from './SupportPlanPersonalizationCard'
import { SupportPlanScheduleEditor } from './SupportPlanScheduleEditor'
import { SupportPlanScreen } from './SupportPlanScreen'
import { AdaptiveReviewPanel } from './AdaptiveReviewPanel'
import { PlanActivityHistory } from './PlanActivityHistory'
import {
  planDayLabel,
  readPlanCycle,
  SupportPlanHeader,
  type PlanTab,
} from './SupportPlanHeader'
import {
  isSupportedJournalAction,
  journalReconciliationMessage,
  noJournalOrigin,
  type JournalOriginInput,
  type JournalPlanOrigin,
} from './journal-plan-context'

const statusLabels: Record<CanonicalSupportPlan['status'], string> = {
  DRAFT: 'Bản đề xuất',
  ACTIVE: 'Đang thực hiện',
  PAUSED: 'Đang tạm dừng',
  COMPLETED: 'Đã kết thúc',
  SUPERSEDED: 'Đã được thay thế',
  DISCARDED: 'Đã bỏ',
}
const planBackground = '#f5f9f6'
const occurrenceLabels: Record<ActionOccurrence['displayState'], string> = {
  SCHEDULED: 'Chưa ghi nhận hoàn thành',
  OVERDUE: 'Chưa ghi nhận hoàn thành',
  COMPLETED: 'Đã ghi nhận hoàn thành',
  SKIPPED: 'Đã bỏ qua',
  CANCELLED: 'Đã hủy theo trạng thái kế hoạch',
}
const optionalPlan = async (
  request: Promise<CanonicalSupportPlan>,
  missingCode:
    'SUPPORT_PLAN_CURRENT_NOT_FOUND' | 'SUPPORT_PLAN_DRAFT_NOT_FOUND',
) => {
  try {
    return await request
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 404 &&
      error.code === missingCode
    )
      return null
    throw error
  }
}

function useSupportPlanHistory(
  api: SupportPlanActionApi,
  subject: string | undefined,
  enabled: boolean,
) {
  return useInfiniteQuery({
    queryKey: ['support-plan-v3', subject, 'history-pages'],
    enabled,
    retry: false,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.getHistory(pageParam),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  })
}
function message(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401)
      return 'Phiên đăng nhập đã hết hạn. Đăng nhập lại để tiếp tục.'
    if (
      error.code === 'EMOTION_CHECK_IN_EVIDENCE_UNAVAILABLE' ||
      error.code === 'JOURNAL_ENTRY_EVIDENCE_UNAVAILABLE'
    )
      return 'Chưa thể kiểm tra ghi nhận. Trạng thái trước đó vẫn được giữ. Bạn có thể thử lại.'
    if (error.code === 'EMOTION_CHECK_IN_EVIDENCE_MISMATCH')
      return 'Ghi nhận không cùng ngày, múi giờ hoặc được lưu trước khi kế hoạch bắt đầu. Hoạt động vẫn chưa nhận thêm cập nhật.'
    if (
      error.code === 'JOURNAL_ENTRY_EVIDENCE_MISMATCH' ||
      error.code === 'COMPLETION_EVIDENCE_ALREADY_USED'
    )
      return 'Bài nhật ký chưa phù hợp với lần viết này hoặc đã được ghi nhận cho hoạt động khác. Ngày tạo bài mới phải phù hợp với hoạt động; sửa ngày hay nội dung bài cũ không tạo một lần viết mới.'
    if (error.code === 'EMOTION_CHECK_IN_NOT_DUE')
      return 'Chưa đến ngày của hoạt động này. Bạn có thể quay lại đúng ngày để ghi nhận.'
    if (error.status === 409 || error.status === 412)
      return 'Kế hoạch hoặc hoạt động đã thay đổi. Tải lại để kiểm tra trước khi thử lại; dữ liệu đã lưu vẫn được giữ.'
  }
  return 'Chưa thể thực hiện thao tác này. Dữ liệu đã lưu vẫn được giữ để thử lại.'
}
const activityTypes: Record<
  ActionOccurrence['actionType'],
  { label: string; icon: string }
> = {
  RESOURCE: { label: 'Tài nguyên', icon: '▤' },
  JOURNAL: { label: 'Nhật ký', icon: '✎' },
  EMOTION_CHECK_IN: { label: 'Ghi nhận cảm xúc', icon: '☼' },
  ROUTINE_SELF_MANAGEMENT: { label: 'Hoạt động nhỏ', icon: '♧' },
  PROFESSIONAL_SUPPORT: { label: 'Hỗ trợ chuyên gia', icon: '+' },
  REASSESSMENT_SCREENING: { label: 'Đánh giá lại', icon: '▣' },
  SELF_REPORT_REVIEW: { label: 'Xem lại ghi nhận', icon: '✓' },
}

function Secondary({
  label,
  onPress,
  disabled = false,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondary,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={styles.secondaryText}>{label}</Text>
    </Pressable>
  )
}

type Props = Readonly<{
  api: SupportPlanActionApi
  legacyApi: SupportPlanApi
  emotionApi: Pick<EmotionApi, 'getProgress'>
  origin: OriginInput
  homeOrigin?: HomePlanOriginInput
  journalOrigin?: JournalOriginInput
  proposalId?: string
  now?: () => Date
}>

/** Dispatches by the owner representation; existing resource plans keep their legacy UI. */
export function SupportPlanActionWorkspace({
  api,
  legacyApi,
  emotionApi,
  origin,
  homeOrigin = noHomePlanOrigin,
  journalOrigin = noJournalOrigin,
  proposalId,
  now = () => new Date(),
}: Props) {
  const { session, signOut } = useSession()
  const subject = session?.subject
  const fontsLoaded = useDashboardFonts()
  const current = useQuery({
    queryKey: ['support-plan-v3', subject, 'current'],
    enabled: Boolean(subject),
    retry: false,
    refetchOnMount: 'always',
    queryFn: () =>
      optionalPlan(api.getCurrent(), 'SUPPORT_PLAN_CURRENT_NOT_FOUND'),
  })
  const draft = useQuery({
    queryKey: ['support-plan-v3', subject, 'draft'],
    enabled: Boolean(subject),
    retry: false,
    refetchOnMount: 'always',
    queryFn: () => optionalPlan(api.getDraft(), 'SUPPORT_PLAN_DRAFT_NOT_FOUND'),
  })
  const terminalHistory = useSupportPlanHistory(
    api,
    subject,
    Boolean(
      subject &&
      current.isSuccess &&
      draft.isSuccess &&
      !current.data &&
      !draft.data,
    ),
  )
  const refresh = async () => {
    const [a, b] = await Promise.all([current.refetch(), draft.refetch()])
    if (a.isError || b.isError) throw new Error('Current plan unavailable')
  }
  if (!subject || current.isPending || draft.isPending)
    return (
      <Screen layout="dashboard" backgroundColor={planBackground}>
        <SupportPlanHeader fontsLoaded={fontsLoaded} />
        {subject ? (
          <ActivityIndicator
            accessibilityLabel="Đang tải kế hoạch hỗ trợ"
            color={colors.tealDeep}
          />
        ) : (
          <PrimaryButton label="Đăng nhập lại" onPress={() => void signOut()} />
        )}
      </Screen>
    )
  if (current.isError || draft.isError)
    return (
      <Screen layout="dashboard" backgroundColor={planBackground}>
        <SupportPlanHeader fontsLoaded={fontsLoaded} />
        <Text accessibilityLiveRegion="polite" style={styles.body}>
          Chưa thể tải kế hoạch hỗ trợ. Không có kế hoạch nào bị thay đổi.
        </Text>
        <PrimaryButton
          label="Thử tải lại"
          onPress={() => void refresh().catch(() => undefined)}
        />
      </Screen>
    )
  const needsHistory = !current.data && !draft.data
  const native =
    current.data?.representationMode === 'NATIVE_V3' ||
    draft.data?.representationMode === 'NATIVE_V3' ||
    (needsHistory &&
      terminalHistory.data?.pages[0]?.items[0]?.representationMode !==
        'V2_RESOURCE_ADAPTER')
  if (!native)
    return (
      <SupportPlanScreen
        api={legacyApi}
        homeOrigin={homeOrigin}
        {...(proposalId ? { proposalId } : {})}
        nativeProposalEntry={
          <NativeProposalEntry
            api={api}
            current={current.data ?? null}
            draft={draft.data ?? null}
            onChanged={refresh}
          />
        }
      />
    )
  return (
    <NativeSupportPlanScreen
      key={subject}
      api={api}
      legacyApi={legacyApi}
      emotionApi={emotionApi}
      current={current.data ?? null}
      draft={draft.data ?? null}
      onChanged={refresh}
      requireHistory={needsHistory}
      origin={origin}
      homeOrigin={homeOrigin}
      journalOrigin={journalOrigin}
      now={now}
    />
  )
}

export function NativeProposalEntry({
  api,
  current,
  draft,
  onChanged,
  disabled = false,
}: Readonly<{
  api: SupportPlanActionApi
  current: CanonicalSupportPlan | null
  draft: CanonicalSupportPlan | null
  onChanged: () => Promise<void>
  disabled?: boolean
}>) {
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('')
  const key = useRef<{ evaluation: string; key: string } | null>(null)
  const running = useRef(false)
  const propose = async () => {
    if (running.current || draft || disabled) return
    running.current = true
    setBusy(true)
    setNotice('')
    try {
      const evaluation = await api.getProposalEvaluationId(
        current ? 'REASSESSMENT' : 'INITIAL_CHECK',
      )
      if (key.current?.evaluation !== evaluation)
        key.current = {
          evaluation,
          key: randomUUID(),
        }
      await api.propose(evaluation, key.current.key)
      await onChanged()
      key.current = null
    } catch (error) {
      setNotice(message(error))
    } finally {
      running.current = false
      setBusy(false)
    }
  }
  return (
    <View style={styles.panel}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        Xem phương án theo lựa chọn của bạn
      </Text>
      <Text style={styles.body}>
        Lưu cách bạn muốn thực hành ở trên, rồi xem các hoạt động và lịch đề
        xuất trước khi quyết định bắt đầu.
        {current ? ' Kế hoạch hiện tại vẫn được giữ nguyên.' : ''}
      </Text>
      {draft ? (
        <Text style={styles.body}>
          Bạn đang có một bản đề xuất. Hãy xem lại hoặc bỏ bản đó trước khi tạo
          phương án khác.
        </Text>
      ) : (
        <PrimaryButton
          label={busy ? 'Đang tạo phương án…' : 'Tạo phương án để xem lại'}
          disabled={busy || disabled}
          onPress={() => void propose()}
        />
      )}
      {notice ? (
        <Text accessibilityLiveRegion="polite" style={styles.body}>
          {notice}
        </Text>
      ) : null}
    </View>
  )
}

type NativeProps = Readonly<{
  api: SupportPlanActionApi
  legacyApi: SupportPlanApi
  emotionApi: Pick<EmotionApi, 'getProgress'>
  current: CanonicalSupportPlan | null
  draft: CanonicalSupportPlan | null
  requireHistory?: boolean
  onChanged: () => Promise<void>
  origin: OriginInput
  homeOrigin?: HomePlanOriginInput
  journalOrigin?: JournalOriginInput
  now: () => Date
}>

export function NativeSupportPlanScreen({
  api,
  legacyApi,
  emotionApi,
  current,
  draft,
  onChanged,
  requireHistory = false,
  origin,
  homeOrigin = noHomePlanOrigin,
  journalOrigin = noJournalOrigin,
  now,
}: NativeProps) {
  const { session } = useSession()
  const subject = session?.subject
  const queryClient = useQueryClient()
  const [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false)
  const [confirmation, setConfirmation] = useState<
    'PAUSED' | 'COMPLETED' | 'DISCARDED' | null
  >(null)
  const [review, setReview] = useState<NativeReplacementReview | null>(null)
  const key = useRef<{ signature: string; key: string } | null>(null),
    running = useRef(false)
  const scrollRef = useRef<ScrollView>(null)
  const contentRef = useRef<View>(null)
  const reviewTrigger = useRef<(() => void) | null>(null)
  const fontsLoaded = useDashboardFonts()
  const hasOrigin = [origin, homeOrigin, journalOrigin].some(
    (entry) => entry.state !== 'none',
  )
  const [selectedTab, setSelectedTab] = useState<PlanTab>()
  const tab =
    selectedTab ?? (current || hasOrigin || requireHistory ? 'today' : 'adjust')
  const [showAllEarlier, setShowAllEarlier] = useState(false)
  const selectTab = (next: PlanTab) => {
    setSelectedTab(next)
    scrollRef.current?.scrollTo({ y: 0, animated: false })
  }
  useFocusEffect(
    useCallback(() => {
      if (hasOrigin) setSelectedTab('today')
    }, [hasOrigin]),
  )
  const focusReturnedActivity = useCallback((target: View, heading: Text) => {
    if (!contentRef.current) return
    target.measureLayout(contentRef.current, (_x, y) => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, y + spacing.sm),
        animated: false,
      })
      // RN Web has no native accessibility-event bridge; native follows the
      // existing ChatScreen focus pattern without changing the app shell.
      AccessibilityInfo.sendAccessibilityEvent?.(heading, 'focus')
    })
  }, [])
  const plan = current ?? draft
  const cycle = readPlanCycle(plan?.cycle)
  const reviewDue =
    current?.status === 'ACTIVE' && cycle?.state === 'REVIEW_DUE'
  const timezone =
    cycle?.timezone ??
    current?.focuses
      .flatMap((x) => x.actions)
      .flatMap((x) => x.schedules)
      .find((x) => x.status === 'ACTIVE')?.timezone ??
    'Asia/Ho_Chi_Minh'
  const localToday = localPlanDate(now(), timezone)
  const cycleEnd = addPlanDays(localToday, 7)
  const oldestAllowed = addPlanDays(cycleEnd, -30)
  const cycleStart = cycle?.startedOn
  const defaultWindow =
    cycleStart && cycleStart <= localToday
      ? {
          from: cycleStart > oldestAllowed ? cycleStart : oldestAllowed,
          through: cycleEnd,
        }
      : occurrenceWindow(now(), timezone)
  const window =
    tab !== 'progress' && journalOrigin.state === 'valid'
      ? {
          from: journalOrigin.value.localDate,
          through: journalOrigin.value.localDate,
        }
      : tab !== 'progress' && homeOrigin.state === 'valid'
        ? {
            from: homeOrigin.value.localDate,
            through: homeOrigin.value.localDate,
          }
        : defaultWindow
  const occurrences = useQuery({
    queryKey: [
      'support-plan-v3',
      subject,
      'occurrences',
      current?.supportPlanId,
      window.from,
      window.through,
    ],
    enabled: Boolean(subject && current),
    retry: false,
    refetchOnMount: 'always',
    queryFn: () => api.getOccurrences(window.from, window.through),
  })
  const history = useSupportPlanHistory(
    api,
    subject,
    Boolean(subject && !requireHistory),
  )
  const historyReady = !requireHistory || history.data !== undefined
  const historyItems = history.data?.pages.flatMap((page) => page.items) ?? []
  const progress = useQuery({
    queryKey: ['emotion-check-in', subject, 'progress', timezone],
    enabled: Boolean(subject),
    retry: false,
    queryFn: () => emotionApi.getProgress(timezone),
  })
  const actions = current?.focuses.flatMap((x) => x.actions) ?? []
  const matching =
    occurrences.data?.supportPlanId === current?.supportPlanId &&
    occurrences.data?.supportPlanStatus === current?.status &&
    occurrences.data?.representationMode === 'NATIVE_V3'
  const items = matching
    ? (occurrences.data?.occurrences.filter(
        (item) =>
          !item.hidden &&
          actions.some(
            (action) =>
              action.actionId === item.actionId &&
              action.actionType === item.actionType,
          ),
      ) ?? [])
    : []
  const homeReturned =
    homeOrigin.state === 'valid'
      ? resolveNativeHomePlanOrigin(
          current,
          occurrences.data && { ...occurrences.data, occurrences: items },
          homeOrigin.value,
        )
      : null
  const returned =
    journalOrigin.state === 'valid'
      ? items.find(
          (x) =>
            x.occurrenceId === journalOrigin.value.occurrenceId &&
            x.actionId === journalOrigin.value.actionId &&
            x.localDate === journalOrigin.value.localDate &&
            x.actionType === 'JOURNAL',
        )
      : homeReturned
        ? homeReturned
        : origin.state === 'valid'
          ? items.find(
              (x) =>
                x.occurrenceId === origin.value.occurrenceId &&
                x.actionId === origin.value.actionId &&
                x.actionType === 'EMOTION_CHECK_IN',
            )
          : undefined
  const ordered = returned
    ? [
        returned,
        ...items.filter((x) => x.occurrenceId !== returned.occurrenceId),
      ]
    : items
  const earlier = ordered
    .filter(
      (item) =>
        item.occurrenceId !== returned?.occurrenceId &&
        item.localDate < localToday &&
        item.state === 'SCHEDULED' &&
        actions.some(
          (action) =>
            action.actionId === item.actionId && action.status === 'ACTIVE',
        ) &&
        [
          'RESOURCE',
          'ROUTINE_SELF_MANAGEMENT',
          'JOURNAL',
          'EMOTION_CHECK_IN',
        ].includes(item.actionType),
    )
    .sort((a, b) => Date.parse(b.scheduledAt) - Date.parse(a.scheduledAt))
  const earlierIds = new Set(earlier.map((item) => item.occurrenceId))
  const todayItems = ordered.filter(
    (item) =>
      item.occurrenceId === returned?.occurrenceId ||
      item.localDate === localToday,
  )
  const todayIds = new Set(todayItems.map((item) => item.occurrenceId))
  const otherItems = ordered.filter(
    (item) =>
      !todayIds.has(item.occurrenceId) && !earlierIds.has(item.occurrenceId),
  )
  const getKey = (signature: string) => {
    if (key.current?.signature !== signature)
      key.current = { signature, key: randomUUID() }
    return key.current.key
  }
  const run = async (operation: () => Promise<unknown>, success: string) => {
    if (running.current || dirty) return
    running.current = true
    setBusy(true)
    setNotice('')
    try {
      await operation()
      await onChanged()
      await Promise.all([occurrences.refetch(), history.refetch()])
      key.current = null
      setReview(null)
      setConfirmation(null)
      setNotice(success)
    } catch (error) {
      setNotice(message(error))
    } finally {
      running.current = false
      setBusy(false)
    }
  }
  const loadReview = async () => {
    if (!current || !draft || running.current || dirty) return
    running.current = true
    setBusy(true)
    setNotice('')
    try {
      const summary = await api.getReassessmentSummary()
      const result = await api.reviewReplacement(
        draft.supportPlanId,
        draft.version,
        {
          currentSupportPlanId: current.supportPlanId,
          currentVersion: current.version,
          reassessmentSummaryId: summary.summaryId,
        },
      )
      setReview(result)
    } catch (error) {
      setNotice(message(error))
      setReview(null)
    } finally {
      running.current = false
      setBusy(false)
    }
  }
  const reviewMatches = Boolean(
    review &&
    current &&
    draft &&
    review.currentPlan.supportPlanId === current.supportPlanId &&
    review.currentPlan.version === current.version &&
    review.proposedPlan.supportPlanId === draft.supportPlanId &&
    review.proposedPlan.version === draft.version,
  )
  const renderActivity = (item: ActionOccurrence) => {
    const action = actions.find((entry) => entry.actionId === item.actionId)
    if (!current || !action) return null
    const isReturned = returned?.occurrenceId === item.occurrenceId
    return (
      <NativeActivity
        key={`${item.occurrenceId}:${item.version}`}
        api={api}
        occurrence={item}
        plan={current}
        title={action.presentation.title}
        summary={action.presentation.summary ?? action.rationale}
        purposeCode={action.purposeCode}
        actionActive={action.status === 'ACTIVE'}
        source={action.source}
        fontsLoaded={fontsLoaded}
        journalEligible={
          isSupportedJournalAction(action) &&
          action.schedules.some(
            (schedule) =>
              schedule.scheduleId === item.scheduleId &&
              schedule.version === item.scheduleVersion,
          ) &&
          (item.state === 'COMPLETED' ||
            (action.status === 'ACTIVE' &&
              Boolean(action.activatedAt) &&
              Boolean(current.activatedAt) &&
              action.actionVersion === item.actionVersion))
        }
        returnSource={
          !isReturned
            ? null
            : homeReturned?.occurrenceId === item.occurrenceId
              ? 'home'
              : journalOrigin.state === 'valid'
                ? 'journal'
                : 'emotion'
        }
        journalOrigin={
          journalOrigin.state === 'valid' && isReturned
            ? journalOrigin.value
            : undefined
        }
        navigationBlocked={dirty || busy}
        onReturnLayout={focusReturnedActivity}
        onRefresh={() =>
          queryClient.invalidateQueries(
            {
              queryKey: [
                'support-plan-v3',
                subject,
                'occurrences',
                current.supportPlanId,
              ],
            },
            { throwOnError: true },
          )
        }
        now={now}
      />
    )
  }
  return (
    <Screen
      layout="dashboard"
      backgroundColor={planBackground}
      scrollRef={scrollRef}
      contentRef={contentRef}
    >
      <SupportPlanHeader
        cycle={cycle}
        status={plan ? statusLabels[plan.status] : undefined}
        tab={tab}
        onTab={selectTab}
        fontsLoaded={fontsLoaded}
      />
      {!historyReady && (
        <View style={styles.panel}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Lịch sử kế hoạch
          </Text>
          {history.isFetching ? (
            <ActivityIndicator
              accessibilityLabel="Đang xác định lịch sử kế hoạch"
              color={colors.tealDeep}
            />
          ) : (
            <>
              <Text accessibilityLiveRegion="polite" style={styles.body}>
                Chưa thể tải lịch sử kế hoạch. Hãy thử lại để xem các kế hoạch
                đã lưu.
              </Text>
              <Secondary
                label="Thử tải lại lịch sử"
                onPress={() => void history.refetch()}
              />
            </>
          )}
        </View>
      )}
      {notice ? (
        <Text accessibilityLiveRegion="polite" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
      {plan?.safety.guidanceCode === 'REVIEW_SAFETY_GUIDANCE' ? (
        <View style={styles.panel}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Khi cần thêm hỗ trợ
          </Text>
          <Text style={styles.body}>{plan.safety.guidance}</Text>
        </View>
      ) : null}
      <View style={tab !== 'plan' && styles.hidden}>
        {plan && subject ? (
          <SupportPlanCompanion
            api={api}
            subject={subject}
            plan={plan}
            occurrences={ordered}
            now={now}
            {...(returned
              ? { preferredOccurrenceId: returned.occurrenceId }
              : {})}
            interrupted={busy || dirty || confirmation !== null}
          />
        ) : null}
        {current ? (
          <View style={styles.panel}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Kế hoạch hiện tại
            </Text>
            <Text style={styles.state}>{statusLabels[current.status]}</Text>
            {current.representationMode === 'V2_RESOURCE_ADAPTER' ? (
              <Text style={styles.body}>
                Các nội dung đã chọn vẫn được giữ nguyên trong khi bạn xem
                phương án mới.
              </Text>
            ) : null}
            {current.focuses.map((focus) => (
              <View key={focus.focusId} style={styles.section}>
                <Text style={styles.itemTitle}>{focus.title}</Text>
                {focus.rationale ? (
                  <Text style={styles.body}>{focus.rationale}</Text>
                ) : null}
                {focus.actions
                  .filter(
                    (x) =>
                      x.actionType === 'PROFESSIONAL_SUPPORT' &&
                      x.pathRole === 'PRIMARY',
                  )
                  .map((action) => (
                    <View key={action.actionId}>
                      <Text style={styles.itemTitle}>
                        {action.presentation.title}
                      </Text>
                      <Text style={styles.body}>
                        {action.presentation.summary}
                      </Text>
                      <PrimaryButton
                        label="Tìm chuyên gia"
                        onPress={() =>
                          router.push({
                            pathname: '/(user)/specialists',
                            params: { planActionId: action.actionId },
                          })
                        }
                      />
                    </View>
                  ))}
              </View>
            ))}
            {current.representationMode === 'NATIVE_V3' ? (
              <View style={styles.controls}>
                <Secondary
                  label={
                    current.status === 'PAUSED'
                      ? 'Tiếp tục kế hoạch'
                      : 'Tạm dừng kế hoạch'
                  }
                  disabled={busy || dirty}
                  onPress={() =>
                    current.status === 'PAUSED'
                      ? void run(
                          () =>
                            api.changeStatus(
                              current.supportPlanId,
                              current.version,
                              'ACTIVE',
                            ),
                          'Đã tiếp tục kế hoạch.',
                        )
                      : setConfirmation('PAUSED')
                  }
                />
                <Secondary
                  label="Kết thúc kế hoạch"
                  disabled={busy || dirty}
                  onPress={() => setConfirmation('COMPLETED')}
                />
              </View>
            ) : null}
          </View>
        ) : null}
        {otherItems.length ? (
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Lịch hoạt động
            </Text>
            {otherItems.map(renderActivity)}
          </View>
        ) : null}
        {!current && historyReady ? (
          <View style={styles.panel}>
            <Text style={styles.body}>
              {draft
                ? 'Bạn có một kế hoạch đề xuất để xem lại.'
                : 'Bạn chưa có kế hoạch đang thực hiện.'}
            </Text>
            <Secondary
              label="Mở phần điều chỉnh"
              onPress={() => selectTab('adjust')}
            />
          </View>
        ) : null}
      </View>
      <View style={tab !== 'today' && styles.hidden}>
        {reviewDue ? (
          <View style={styles.reviewCard}>
            <View style={styles.activityHeading}>
              <View style={styles.activityIcon}>
                <Text accessible={false} style={styles.iconInk}>
                  ▣
                </Text>
              </View>
              <View style={styles.flex}>
                <Text
                  accessibilityRole="header"
                  style={[styles.reviewTitle, fontsLoaded && styles.serif]}
                >
                  Đến lúc cùng xem lại kế hoạch
                </Text>
                <Text style={[styles.deck, fontsLoaded && styles.sans]}>
                  Cùng nhìn lại những gì bạn đã ghi nhận rồi chọn cách đi tiếp.
                </Text>
              </View>
            </View>
            <PrimaryButton
              disabled={busy || dirty || confirmation !== null}
              label="Xem lại kế hoạch →"
              accessibilityLabel="Xem lại kế hoạch"
              tone="darkPill"
              onPress={() => {
                selectTab('progress')
                reviewTrigger.current?.()
              }}
            />
            <PrimaryButton
              label="Làm bài kiểm tra lại"
              disabled={busy || dirty || confirmation !== null}
              tone="light"
              onPress={() => router.push('/(user)/reassessment')}
            />
          </View>
        ) : null}
        {current?.representationMode === 'NATIVE_V3' ? (
          <View style={styles.section}>
            {todayItems.length > 0 ? (
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                Hoạt động hôm nay
              </Text>
            ) : null}
            {origin.state === 'invalid' ||
            homeOrigin.state === 'invalid' ||
            journalOrigin.state === 'invalid' ||
            ((origin.state === 'valid' ||
              homeOrigin.state === 'valid' ||
              journalOrigin.state === 'valid') &&
              !occurrences.isPending &&
              !returned) ? (
              <>
                <Text accessibilityLiveRegion="polite" style={styles.body}>
                  Hoạt động đã thay đổi hoặc không còn trong kế hoạch hiện tại.
                  Các mục bên dưới vẫn giữ nguyên.
                </Text>
                <Secondary
                  label="Tải lại hoạt động"
                  onPress={() => void occurrences.refetch()}
                />
              </>
            ) : null}
            {occurrences.isPending ? (
              <ActivityIndicator
                accessibilityLabel="Đang tải hoạt động"
                color={colors.tealDeep}
              />
            ) : null}
            {occurrences.isError || (!matching && !occurrences.isPending) ? (
              <>
                <Text accessibilityLiveRegion="polite" style={styles.body}>
                  Chưa thể tải lịch hoạt động mới nhất. Không có hoạt động nào
                  bị thay đổi.
                </Text>
                <Secondary
                  label="Tải lại hoạt động"
                  onPress={() => void occurrences.refetch()}
                />
              </>
            ) : null}
            {matching &&
            !occurrences.isError &&
            todayItems.length === 0 &&
            !reviewDue ? (
              <Text style={styles.body}>
                Không có hoạt động nào được lên lịch hôm nay.
              </Text>
            ) : null}
            {todayItems.map(renderActivity)}
            {earlier.length > 0 ? (
              <View style={styles.earlier}>
                <View style={styles.earlierHeading}>
                  <Text
                    accessibilityRole="header"
                    style={[styles.sectionTitle, fontsLoaded && styles.sans]}
                  >
                    Còn lại từ những ngày trước
                  </Text>
                  <Text style={styles.activityType}>
                    {earlier.length} hoạt động
                  </Text>
                </View>
                <Text style={styles.deck}>
                  Bạn có thể hoàn thành theo nhịp của mình.
                </Text>
                <View style={styles.timeline}>
                  {(showAllEarlier ? earlier : earlier.slice(0, 3)).map(
                    (item) => (
                      <View
                        key={item.occurrenceId}
                        style={styles.timelineEntry}
                      >
                        <View style={styles.timelineDot} />
                        {renderActivity(item)}
                      </View>
                    ),
                  )}
                </View>
                {earlier.length > 3 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: showAllEarlier }}
                    onPress={() => setShowAllEarlier((value) => !value)}
                    style={styles.earlierToggle}
                  >
                    <Text style={styles.deck}>
                      {showAllEarlier
                        ? 'Thu gọn hoạt động'
                        : `Xem thêm ${earlier.length - 3} hoạt động  ›`}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}
        {!current && historyReady ? (
          <View style={styles.panel}>
            <Text style={styles.body}>
              {draft
                ? 'Bạn có một kế hoạch đề xuất để xem lại.'
                : 'Bạn chưa có kế hoạch đang thực hiện.'}
            </Text>
            <Secondary
              label="Mở phần điều chỉnh"
              onPress={() => selectTab('adjust')}
            />
          </View>
        ) : null}
      </View>
      <View style={tab !== 'progress' && styles.hidden}>
        {tab === 'progress' &&
          current &&
          (matching ? (
            <>
              {occurrences.isError && (
                <Secondary
                  label="Chưa cập nhật được lịch hoạt động · Thử lại"
                  onPress={() => void occurrences.refetch()}
                />
              )}
              <PlanActivityHistory
                key={current.supportPlanId}
                plan={current}
                cycle={cycle}
                items={items}
                today={localToday}
                timezone={timezone}
                window={window}
              />
            </>
          ) : occurrences.isPending ? (
            <ActivityIndicator
              accessibilityLabel="Đang tải lịch sử hoạt động"
              color={colors.tealDeep}
            />
          ) : (
            <Secondary
              label="Chưa tải được lịch sử hoạt động · Thử lại"
              onPress={() => void occurrences.refetch()}
            />
          ))}
        {current?.representationMode === 'NATIVE_V3' &&
        (current.status === 'ACTIVE' || current.status === 'PAUSED') ? (
          <AdaptiveReviewPanel
            key={`${current.supportPlanId}:${current.version}`}
            api={api}
            current={current}
            draft={draft}
            disabled={busy || dirty || confirmation !== null}
            onChanged={async () => {
              await onChanged()
              await Promise.all([occurrences.refetch(), history.refetch()])
            }}
            reviewTrigger={reviewTrigger}
            onReassessment={() => router.push('/(user)/reassessment')}
            onProfessionalSupport={() => router.push('/(user)/specialists')}
          />
        ) : null}
        <View style={styles.panel}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Nhịp ghi nhận cảm xúc
          </Text>
          {progress.isPending && (
            <ActivityIndicator
              accessibilityLabel="Đang tải nhịp ghi nhận cảm xúc"
              color={colors.tealDeep}
            />
          )}
          {progress.data?.windows.map((item) => (
            <Text key={item.days} style={styles.body}>
              {item.days} ngày gần đây · Đã ghi nhận {item.checkedInDays}/
              {item.days} ngày
            </Text>
          ))}
          {progress.isError ? (
            <Text style={styles.body}>
              Chưa tải được số ngày ghi nhận. Lịch hoạt động vẫn có thể sử dụng.
            </Text>
          ) : null}
          <Secondary
            label="Tải lại số ngày ghi nhận"
            onPress={() => void progress.refetch()}
          />
          <Secondary
            label="Xem lịch sử sàng lọc"
            onPress={() => router.push('/(user)/assessment')}
          />
          <Secondary
            label="Mở Thống kê & Phân tích"
            onPress={() => router.push('/(user)/analytics')}
          />
        </View>
        {historyReady ? (
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Kế hoạch trước đây
            </Text>
            {history.isPending ? (
              <ActivityIndicator
                accessibilityLabel="Đang tải lịch sử kế hoạch"
                color={colors.tealDeep}
              />
            ) : null}
            {history.isError ? (
              <>
                <Text style={styles.body}>Chưa thể tải lịch sử kế hoạch.</Text>
                <Secondary
                  label="Tải lại lịch sử"
                  onPress={() => void history.refetch()}
                />
              </>
            ) : null}
            {historyItems.map((item) => (
              <View style={styles.historyRow} key={item.supportPlanId}>
                <Text style={styles.itemTitle}>
                  {statusLabels[item.status]}
                </Text>
                <Text style={styles.body}>
                  {new Intl.DateTimeFormat('vi-VN', {
                    dateStyle: 'medium',
                  }).format(new Date(item.updatedAt))}
                </Text>
                {item.focuses
                  .flatMap((focus) => focus.actions)
                  .map((action) => (
                    <Text key={action.actionId} style={styles.body}>
                      {action.presentation.title}
                    </Text>
                  ))}
              </View>
            ))}
            {history.isSuccess && historyItems.length === 0 ? (
              <Text style={styles.body}>
                Chưa có kế hoạch đã kết thúc hoặc được thay thế.
              </Text>
            ) : null}
            {history.hasNextPage ? (
              <Secondary
                label={
                  history.isFetchingNextPage
                    ? 'Đang tải lịch sử…'
                    : 'Xem thêm kế hoạch trước đây'
                }
                disabled={history.isFetchingNextPage}
                onPress={() => {
                  if (!history.isFetchingNextPage) void history.fetchNextPage()
                }}
              />
            ) : null}
          </View>
        ) : null}
      </View>
      <View style={tab !== 'adjust' && styles.hidden}>
        {historyReady ? (
          <SupportPlanPersonalizationCard
            api={legacyApi}
            subject={subject ?? ''}
            onReviewPlan={() => {
              selectTab('plan')
              setNotice(
                'Lựa chọn mới đã được lưu. Kế hoạch hiện tại vẫn giữ nguyên cho đến khi bạn xem lại phương án.',
              )
            }}
          />
        ) : null}
        {draft?.representationMode === 'NATIVE_V3' ? (
          <View style={styles.panel}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Phương án để bạn xem lại
            </Text>
            {draft.focuses.map((focus) => (
              <View key={focus.focusId} style={styles.section}>
                <Text style={styles.itemTitle}>{focus.title}</Text>
                {focus.actions.map((action) => (
                  <View key={action.actionId} style={styles.section}>
                    <Text style={styles.itemTitle}>
                      {action.presentation.title}
                    </Text>
                    {action.presentation.summary ? (
                      <Text style={styles.body}>
                        {action.presentation.summary}
                      </Text>
                    ) : null}
                    {action.actionType === 'EMOTION_CHECK_IN' ? (
                      <Text style={styles.body}>
                        • Nhận biết điều bạn đang cảm nhận.{'\n'}• Ghi nhận theo
                        nhịp bạn đã chọn; việc lưu cảm xúc không tự thay đổi kế
                        hoạch.
                      </Text>
                    ) : null}
                    {action.schedules
                      .filter((x) => x.status === 'DRAFT')
                      .map((schedule) => (
                        <Text key={schedule.scheduleId} style={styles.body}>
                          {schedule.recurrenceType === 'DAILY'
                            ? 'Mỗi ngày'
                            : schedule.recurrenceType === 'WEEKLY'
                              ? 'Theo tuần'
                              : 'Một lần'}{' '}
                          ·{schedule.localTime.slice(0, 5)} ·
                          {schedule.estimatedDurationMinutes} phút ·
                          {schedule.timezone}
                        </Text>
                      ))}
                  </View>
                ))}
              </View>
            ))}
            <SupportPlanScheduleEditor
              plan={draft}
              disabled={busy}
              onDirtyChange={setDirty}
              onSave={async (actionId, request, idempotencyKey) => {
                await api.replaceSchedule(
                  draft.supportPlanId,
                  draft.version,
                  actionId,
                  request,
                  idempotencyKey,
                )
                await onChanged()
              }}
              onReload={async () => {
                await onChanged()
                return api.getDraft()
              }}
            />
            {dirty ? (
              <Text style={styles.body}>
                Lưu hoặc hoàn tác lịch đang chỉnh trước khi bắt đầu hay thay thế
                kế hoạch.
              </Text>
            ) : null}
            {!current ? (
              <PrimaryButton
                label={busy ? 'Đang bắt đầu…' : 'Bắt đầu kế hoạch'}
                testID="native-plan-activate"
                disabled={busy || dirty}
                onPress={() =>
                  void run(
                    () =>
                      api.activate(
                        draft.supportPlanId,
                        draft.version,
                        getKey(
                          `activate:${draft.supportPlanId}:${draft.version}`,
                        ),
                      ),
                    'Kế hoạch hỗ trợ đã bắt đầu.',
                  )
                }
              />
            ) : (
              <>
                <Text style={styles.body}>
                  Kế hoạch hiện tại chưa thay đổi. Cần có đánh giá lại và xem so
                  sánh trước khi chọn phương án này.
                </Text>
                <PrimaryButton
                  label="Kiểm tra và so sánh phương án"
                  disabled={busy || dirty}
                  onPress={() => void loadReview()}
                />
                {reviewMatches && review ? (
                  <View style={styles.section}>
                    <Text style={styles.body}>
                      {review.outcome ===
                      'CURRENT_PLAN_VALID_NO_BETTER_ALTERNATIVE'
                        ? 'Kế hoạch hiện tại vẫn phù hợp; phương án này không có thay đổi đáng kể.'
                        : 'Phương án mới đã được kiểm tra. Bạn có thể giữ kế hoạch hiện tại hoặc chủ động thay thế; lịch sử cũ vẫn được lưu.'}
                    </Text>
                    {review.rationaleCodes.includes(
                      'PROPOSED_PLAN_ADMISSIBLE',
                    ) ? (
                      <PrimaryButton
                        label="Chọn phương án mới"
                        disabled={busy || dirty}
                        onPress={() =>
                          void run(
                            () =>
                              api.replace(
                                draft.supportPlanId,
                                draft.version,
                                {
                                  currentSupportPlanId: current.supportPlanId,
                                  currentVersion: current.version,
                                  reassessmentSummaryId:
                                    review.reassessmentSummary.summaryId,
                                },
                                getKey(
                                  `replace:${draft.supportPlanId}:${draft.version}:${current.version}`,
                                ),
                              ),
                            'Đã thay thế kế hoạch. Lịch sử trước đó vẫn được lưu.',
                          )
                        }
                      />
                    ) : null}
                  </View>
                ) : null}
              </>
            )}
            <Secondary
              label="Bỏ bản đề xuất"
              disabled={busy || dirty}
              onPress={() => setConfirmation('DISCARDED')}
            />
          </View>
        ) : null}
        {current?.representationMode === 'NATIVE_V3' && !draft ? (
          <View style={styles.panel}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Điều chỉnh nhịp hoạt động
            </Text>
            <SupportPlanScheduleEditor
              plan={current}
              disabled={busy || current.status !== 'ACTIVE'}
              onDirtyChange={setDirty}
              onSave={async (actionId, request, idempotencyKey) => {
                await api.replaceSchedule(
                  current.supportPlanId,
                  current.version,
                  actionId,
                  request,
                  idempotencyKey,
                )
                await onChanged()
                await occurrences.refetch()
              }}
              onReload={async () => {
                await onChanged()
                return api.getCurrent()
              }}
            />
            {dirty ? (
              <Text style={styles.body}>
                Lưu hoặc hoàn tác lịch đang chỉnh trước khi thay đổi trạng thái
                kế hoạch.
              </Text>
            ) : null}
          </View>
        ) : null}
        {!draft && historyReady ? (
          <NativeProposalEntry
            api={api}
            current={current}
            draft={draft}
            onChanged={onChanged}
            disabled={busy || dirty}
          />
        ) : null}
      </View>
      {confirmation ? (
        <View style={styles.panel} accessibilityLiveRegion="polite">
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            {confirmation === 'PAUSED'
              ? 'Tạm dừng kế hoạch?'
              : confirmation === 'COMPLETED'
                ? 'Kết thúc kế hoạch?'
                : 'Bỏ bản đề xuất?'}
          </Text>
          <Text style={styles.body}>
            {confirmation === 'PAUSED'
              ? 'Các hoạt động tương lai sẽ tạm dừng; lịch sử đã ghi nhận vẫn giữ nguyên.'
              : confirmation === 'COMPLETED'
                ? 'Kế hoạch được khép lại, không mang ý nghĩa bạn đã hồi phục. Lịch sử vẫn được lưu.'
                : 'Bản đề xuất này sẽ không còn để bạn bắt đầu. Kế hoạch hiện tại không thay đổi.'}
          </Text>
          <Secondary
            label="Giữ nguyên"
            disabled={busy}
            onPress={() => setConfirmation(null)}
          />
          <PrimaryButton
            label={
              busy
                ? 'Đang xử lý…'
                : confirmation === 'PAUSED'
                  ? 'Tạm dừng kế hoạch'
                  : confirmation === 'COMPLETED'
                    ? 'Kết thúc kế hoạch'
                    : 'Bỏ bản đề xuất'
            }
            disabled={busy || dirty}
            onPress={() => {
              const target = confirmation === 'DISCARDED' ? draft : current
              if (target)
                void run(
                  () =>
                    api.changeStatus(
                      target.supportPlanId,
                      target.version,
                      confirmation,
                      confirmation === 'COMPLETED'
                        ? 'USER_DECISION'
                        : undefined,
                    ),
                  'Đã cập nhật trạng thái kế hoạch.',
                )
            }}
          />
        </View>
      ) : null}
      {plan?.disclaimer ? (
        <View style={styles.disclaimerBox}>
          <Text accessible={false} style={styles.iconInk}>
            ◇
          </Text>
          <Text style={[styles.deck, styles.flex, fontsLoaded && styles.sans]}>
            {plan.disclaimer}
          </Text>
        </View>
      ) : null}
    </Screen>
  )
}

function NativeActivity({
  api,
  occurrence,
  plan,
  title,
  summary,
  purposeCode,
  actionActive,
  source,
  fontsLoaded,
  journalEligible,
  returnSource,
  journalOrigin,
  navigationBlocked,
  onReturnLayout,
  onRefresh,
  now,
}: Readonly<{
  api: SupportPlanActionApi
  occurrence: ActionOccurrence
  plan: CanonicalSupportPlan
  title: string
  summary: string | null
  purposeCode: string
  actionActive: boolean
  source: CanonicalSupportPlan['focuses'][number]['actions'][number]['source']
  fontsLoaded: boolean
  journalEligible: boolean
  returnSource: 'home' | 'journal' | 'emotion' | null
  journalOrigin?: JournalPlanOrigin | undefined
  navigationBlocked: boolean
  onReturnLayout: (target: View, heading: Text) => void
  onRefresh: () => Promise<void>
  now: () => Date
}>) {
  const [result, setResult] = useState<
      EmotionReconciliation | JournalReconciliation | null
    >(null),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false)
  const running = useRef(false)
  const activityRef = useRef<View>(null)
  const headingRef = useRef<Text>(null)
  const returnFocused = useRef(false)
  const returned = returnSource !== null
  const focusReturn = useCallback(() => {
    if (
      !returnFocused.current &&
      returned &&
      activityRef.current &&
      headingRef.current
    ) {
      onReturnLayout(activityRef.current, headingRef.current)
      returnFocused.current = true
    }
  }, [returned, onReturnLayout])
  useFocusEffect(
    useCallback(() => {
      returnFocused.current = false
      const frame = requestAnimationFrame(focusReturn)
      return () => cancelAnimationFrame(frame)
    }, [focusReturn]),
  )
  const emotion = occurrence.actionType === 'EMOTION_CHECK_IN'
  const journal = occurrence.actionType === 'JOURNAL'
  const completed =
    result?.occurrenceState === 'COMPLETED' || occurrence.state === 'COMPLETED'
  const eligible =
    (!journal || journalEligible) &&
    (plan.status === 'ACTIVE' || (journal && completed)) &&
    ['SCHEDULED', 'COMPLETED'].includes(occurrence.state)
  const acceptedJournalId =
    result?.completionEvidence?.kind === 'JOURNAL_ENTRY'
      ? result.completionEvidence.factId
      : occurrence.completionEvidence?.kind === 'JOURNAL_ENTRY'
        ? occurrence.completionEvidence.factId
        : undefined
  const candidate = acceptedJournalId ?? journalOrigin?.journalId
  const check = async () => {
    if (running.current || !eligible || (journal && !candidate)) return
    running.current = true
    setBusy(true)
    setNotice('Đang kiểm tra ghi nhận…')
    try {
      const updated = journal
        ? await api.reconcileJournal(occurrence.occurrenceId, candidate!)
        : await api.reconcileEmotion(occurrence.occurrenceId)
      if (
        updated.occurrenceId !== occurrence.occurrenceId ||
        updated.actionId !== occurrence.actionId ||
        updated.localDate !== occurrence.localDate ||
        (journal &&
          (!('journalId' in updated) || updated.journalId !== candidate))
      )
        throw new Error('Origin mismatch')
      setResult(updated)
      setNotice(
        (journal ? journalReconciliationMessage : emotionReconciliationMessage)(
          updated.sourceState,
          updated.occurrenceState === 'COMPLETED',
        ),
      )
    } catch (error) {
      setNotice(message(error))
    } finally {
      running.current = false
      setBusy(false)
    }
  }
  const change = async (state: 'COMPLETED' | 'SKIPPED') => {
    if (
      running.current ||
      navigationBlocked ||
      !actionActive ||
      plan.status !== 'ACTIVE'
    )
      return
    running.current = true
    setBusy(true)
    try {
      await api.changeOccurrenceState(
        occurrence.occurrenceId,
        occurrence.version,
        state,
      )
      await onRefresh()
      setNotice(
        state === 'COMPLETED'
          ? 'Đã ghi nhận hoạt động.'
          : 'Đã bỏ qua hoạt động.',
      )
    } catch (error) {
      setNotice(message(error))
    } finally {
      running.current = false
      setBusy(false)
    }
  }
  const schedule = plan.focuses
    .flatMap((x) => x.actions)
    .find((x) => x.actionId === occurrence.actionId)
    ?.schedules.find(
      (x) =>
        x.scheduleId === occurrence.scheduleId &&
        x.version === occurrence.scheduleVersion,
    )
  const today = schedule
    ? localPlanDate(now(), schedule.timezone) === occurrence.localDate
    : false
  const origin: EmotionPlanOrigin = {
    occurrenceId: occurrence.occurrenceId,
    actionId: occurrence.actionId,
  }
  const { label, icon } = purposeCode.includes('PSYCHOEDUCATION')
    ? { label: 'Kiến thức tâm lý', icon: '▤' }
    : purposeCode.includes('SLEEP')
      ? { label: 'Giấc ngủ & nghỉ ngơi', icon: '☾' }
      : purposeCode.includes('SUPPORT_ACTIVITY')
        ? activityTypes.ROUTINE_SELF_MANAGEMENT
        : activityTypes[occurrence.actionType]
  return (
    <View
      ref={activityRef}
      onLayout={focusReturn}
      style={styles.activityCard}
      testID={`plan-activity-${occurrence.occurrenceId}`}
    >
      {returned ? (
        <Text accessibilityLiveRegion="polite" style={styles.eyebrow}>
          {returnSource === 'home'
            ? 'Hoạt động bạn vừa mở từ Trang chủ'
            : returnSource === 'journal'
              ? 'Bạn vừa quay lại từ nhật ký'
              : 'Bạn vừa quay lại từ ghi nhận cảm xúc'}
        </Text>
      ) : null}
      <View style={styles.activityMeta}>
        <Text style={styles.activityType}>{label}</Text>
        {schedule?.estimatedDurationMinutes != null ? (
          <Text style={styles.activityDate}>
            ◷ {schedule.estimatedDurationMinutes} phút
          </Text>
        ) : null}
        <Text style={styles.activityDate}>
          {planDayLabel(occurrence.localDate)}
        </Text>
      </View>
      <View style={styles.activityHeading}>
        <View style={styles.activityIcon}>
          <Text accessible={false} style={styles.iconInk}>
            {icon}
          </Text>
        </View>
        <View style={styles.flex}>
          <Text
            ref={headingRef}
            accessible
            accessibilityRole="header"
            style={[styles.itemTitle, fontsLoaded && styles.sans]}
          >
            {title}
          </Text>
          {summary ? (
            <Text style={[styles.deck, fontsLoaded && styles.sans]}>
              {summary}
            </Text>
          ) : null}
          {completed ||
          emotion ||
          journal ||
          occurrence.state !== 'SCHEDULED' ? (
            <Text
              accessibilityLiveRegion="polite"
              style={styles.activityStatus}
            >
              {completed
                ? 'Đã ghi nhận hoàn thành'
                : occurrenceLabels[occurrence.displayState]}
            </Text>
          ) : null}
        </View>
      </View>
      {notice ? (
        <Text accessibilityLiveRegion="polite" style={styles.body}>
          {notice}
        </Text>
      ) : null}
      {emotion ? (
        <>
          {!completed && today && eligible ? (
            <Secondary
              label={`Ghi nhận cảm xúc: ${title}`}
              disabled={busy}
              onPress={() =>
                router.push({ pathname: '/(user)/emotion', params: origin })
              }
            />
          ) : null}
          {!today ? (
            <Text style={styles.body}>
              Ghi nhận cảm xúc mới chỉ được lưu cho hôm nay. Bạn vẫn có thể kiểm
              tra ghi nhận đã có của ngày này.
            </Text>
          ) : null}
          <PrimaryButton
            label={
              busy
                ? 'Đang kiểm tra ghi nhận…'
                : returned
                  ? 'Kiểm tra ghi nhận cho hoạt động vừa mở'
                  : 'Kiểm tra ghi nhận'
            }
            testID={`reconcile-${occurrence.occurrenceId}`}
            disabled={busy || !eligible}
            onPress={() => void check()}
          />
          <Text style={styles.deck}>
            Lưu cảm xúc không tự hoàn thành hoạt động. Chọn kiểm tra để cập nhật
            đúng mục này.
          </Text>
        </>
      ) : journal ? (
        <>
          <Text style={styles.body}>
            Nội dung nhật ký vẫn riêng tư. Kế hoạch chỉ ghi nhận việc bạn đã lưu
            bài.
          </Text>
          {!journalEligible ? (
            <Text style={styles.body}>
              Hoạt động đã thay đổi hoặc chưa hỗ trợ mở nhật ký. Tải lại hoạt
              động để xem trạng thái mới nhất; bài viết đã lưu vẫn được giữ.
            </Text>
          ) : null}
          {candidate && !completed ? (
            <Text accessibilityLiveRegion="polite" style={styles.body}>
              Đã có bài nhật ký để kiểm tra. Việc lưu bài chưa tự hoàn thành
              hoạt động.
            </Text>
          ) : null}
          {!completed && today && eligible && !candidate ? (
            <PrimaryButton
              testID={`journal-write-${occurrence.occurrenceId}`}
              label={`Viết nhật ký: ${title}`}
              disabled={busy || navigationBlocked}
              onPress={() =>
                router.push({
                  pathname: '/(user)/journal',
                  params: {
                    source: 'journal',
                    occurrenceId: occurrence.occurrenceId,
                    actionId: occurrence.actionId,
                    localDate: occurrence.localDate,
                  },
                })
              }
            />
          ) : null}
          {!today && !completed ? (
            <Text style={styles.body}>
              Bài mới chỉ được ghi nhận cho ngày tạo bài. Không thể viết bài mới
              để hoàn thành hoạt động ở ngày khác.
            </Text>
          ) : null}
          {candidate ? (
            <PrimaryButton
              label={
                busy ? 'Đang kiểm tra ghi nhận…' : 'Kiểm tra ghi nhận nhật ký'
              }
              testID={`reconcile-journal-${occurrence.occurrenceId}`}
              disabled={busy || !eligible || navigationBlocked}
              onPress={() => void check()}
            />
          ) : null}
          {acceptedJournalId ? (
            <Secondary
              label="Xem nhật ký đã ghi nhận"
              disabled={busy || navigationBlocked}
              onPress={() =>
                router.push({
                  pathname: '/(user)/journal',
                  params: {
                    source: 'journal',
                    occurrenceId: occurrence.occurrenceId,
                    actionId: occurrence.actionId,
                    localDate: occurrence.localDate,
                    journalId: acceptedJournalId,
                  },
                })
              }
            />
          ) : null}
          {notice ? (
            <Secondary
              label="Tải lại hoạt động nhật ký"
              disabled={busy || navigationBlocked}
              onPress={() =>
                void onRefresh().catch(() =>
                  setNotice(
                    'Chưa tải lại được hoạt động. Bài nhật ký đã lưu và ghi nhận trước đó vẫn được giữ.',
                  ),
                )
              }
            />
          ) : null}
          {plan.status === 'ACTIVE' &&
          journalEligible &&
          occurrence.state === 'SCHEDULED' &&
          !completed ? (
            <Secondary
              label="Bỏ qua lần viết này"
              disabled={busy || navigationBlocked}
              onPress={() => void change('SKIPPED')}
            />
          ) : null}
        </>
      ) : (
        <View style={styles.activityActions}>
          {occurrence.actionType === 'RESOURCE' && source ? (
            <PrimaryButton
              label="Mở nội dung"
              accessibilityLabel={`Mở ${title}`}
              leadingIcon="▷"
              tone="darkPill"
              labelStyle={styles.activityActionText}
              disabled={navigationBlocked}
              onPress={() =>
                router.push({
                  pathname: '/(user)/resources/[resourceId]',
                  params: {
                    resourceId: source.sourceId,
                    date: occurrence.localDate,
                  },
                })
              }
            />
          ) : null}
          {(source?.ownerDomain === 'CONTENT' ||
            occurrence.actionType === 'ROUTINE_SELF_MANAGEMENT') &&
          actionActive &&
          plan.status === 'ACTIVE' &&
          occurrence.state === 'SCHEDULED' ? (
            <>
              <PrimaryButton
                label="Đã làm xong"
                tone="light"
                labelStyle={styles.activityActionText}
                disabled={busy || navigationBlocked}
                onPress={() => void change('COMPLETED')}
              />
              <PrimaryButton
                label="Để hôm khác"
                tone="light"
                labelStyle={styles.activityActionText}
                disabled={busy || navigationBlocked}
                onPress={() => void change('SKIPPED')}
              />
            </>
          ) : null}
          {occurrence.actionType === 'PROFESSIONAL_SUPPORT' ? (
            <Secondary
              label="Xem lịch hẹn"
              onPress={() => router.push('/(user)/appointments')}
            />
          ) : null}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  title: {
    color: colors.ink,
    fontSize: typography.heading,
    lineHeight: typography.headingLineHeight,
    fontWeight: '700',
    marginVertical: spacing.md,
  },
  eyebrow: {
    color: colors.teal,
    fontSize: typography.eyebrow,
    fontWeight: '800',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 28,
  },
  itemTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '700',
    lineHeight: typography.bodyLineHeight,
  },
  body: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  notice: {
    color: colors.tealDeep,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
    marginVertical: spacing.lg,
  },
  state: {
    color: colors.tealDeep,
    fontSize: typography.body,
    fontWeight: '700',
    lineHeight: typography.bodyLineHeight,
  },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radii.panel,
    padding: spacing.xl,
    gap: spacing.md,
    marginVertical: spacing.md,
  },
  hidden: { display: 'none' },
  flex: { flex: 1 },
  sans: { fontFamily: 'DashboardSans' },
  serif: { fontFamily: 'DashboardSerif' },
  deck: { color: colors.inkSoft, fontSize: 13, lineHeight: 20 },
  reviewCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.panel,
    borderWidth: 1,
    borderColor: '#e4ede7',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  reviewTitle: {
    color: colors.ink,
    fontSize: 19,
    lineHeight: 26,
    fontWeight: '600',
  },
  earlier: { gap: spacing.sm },
  earlierHeading: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timeline: {
    marginTop: spacing.xs,
    marginLeft: spacing.sm,
    paddingLeft: spacing.md,
    borderLeftWidth: 1,
    borderLeftColor: colors.tealPale,
    gap: spacing.md,
  },
  timelineEntry: { position: 'relative' },
  timelineDot: {
    width: 11,
    height: 11,
    position: 'absolute',
    top: 20,
    left: -18,
    zIndex: 1,
    borderRadius: radii.pill,
    borderColor: colors.tealPale,
    borderWidth: 2,
    backgroundColor: colors.tealDeep,
  },
  earlierToggle: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    borderRadius: radii.control,
    backgroundColor: '#edf2ef',
  },
  activityCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.panel,
    borderWidth: 1,
    borderColor: '#e4ede7',
    padding: spacing.md,
    gap: spacing.sm,
  },
  activityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  activityType: {
    borderRadius: radii.pill,
    overflow: 'hidden',
    backgroundColor: '#edf2ef',
    color: colors.tealDeep,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    fontSize: 11,
  },
  activityDate: { color: colors.inkSoft, fontSize: 11 },
  activityHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.control,
    backgroundColor: '#edf2ef',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInk: { color: colors.tealDeep, fontSize: 17 },
  activityStatus: {
    color: colors.tealDeep,
    marginTop: spacing.xs,
    fontSize: 12,
    fontWeight: '600',
  },
  activityActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  activityActionText: { fontSize: 12 },
  disclaimerBox: {
    marginTop: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
    borderRadius: radii.control,
    backgroundColor: '#edf2ef',
    padding: spacing.lg,
  },
  section: { gap: spacing.md, marginVertical: spacing.lg },
  controls: { gap: spacing.md, marginTop: spacing.md },
  secondary: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.teal,
    borderRadius: radii.control,
    backgroundColor: colors.surface,
  },
  secondaryText: {
    color: colors.tealDeep,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
    fontWeight: '700',
  },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.55 },
  historyRow: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
})
