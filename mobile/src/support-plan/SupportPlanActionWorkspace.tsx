import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
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
import { SupportPlanCompanion } from '@/support-plan-companion/SupportPlanCompanion'

import {
  emotionReconciliationMessage,
  localPlanDate,
  occurrenceWindow,
  type EmotionPlanOrigin,
  type OriginInput,
} from './emotion-plan-context'
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
const occurrenceLabels: Record<ActionOccurrence['displayState'], string> = {
  SCHEDULED: 'Chưa ghi nhận hoàn thành',
  OVERDUE: 'Chưa ghi nhận hoàn thành',
  COMPLETED: 'Đã ghi nhận hoàn thành',
  SKIPPED: 'Đã bỏ qua',
  CANCELLED: 'Đã hủy theo trạng thái kế hoạch',
}
const optionalPlan = async (request: Promise<CanonicalSupportPlan>) => {
  try {
    return await request
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
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
function dateLabel(date: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`))
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
  journalOrigin = noJournalOrigin,
  proposalId,
  now = () => new Date(),
}: Props) {
  const { session, signOut } = useSession()
  const subject = session?.subject
  const current = useQuery({
    queryKey: ['support-plan-v3', subject, 'current'],
    enabled: Boolean(subject),
    retry: false,
    refetchOnMount: 'always',
    queryFn: () => optionalPlan(api.getCurrent()),
  })
  const draft = useQuery({
    queryKey: ['support-plan-v3', subject, 'draft'],
    enabled: Boolean(subject),
    retry: false,
    refetchOnMount: 'always',
    queryFn: () => optionalPlan(api.getDraft()),
  })
  const terminalHistory = useQuery({
    queryKey: ['support-plan-v3', subject, 'history'],
    enabled: Boolean(
      subject &&
      current.isSuccess &&
      draft.isSuccess &&
      !current.data &&
      !draft.data,
    ),
    retry: false,
    queryFn: () => api.getHistory(),
  })
  const refresh = async () => {
    const [a, b] = await Promise.all([current.refetch(), draft.refetch()])
    if (a.isError || b.isError) throw new Error('Current plan unavailable')
  }
  if (!subject || current.isPending || draft.isPending)
    return (
      <Screen>
        <Text accessibilityRole="header" style={styles.title}>
          Kế hoạch hỗ trợ
        </Text>
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
      <Screen>
        <Text accessibilityRole="header" style={styles.title}>
          Kế hoạch hỗ trợ
        </Text>
        <Text accessibilityLiveRegion="polite" style={styles.body}>
          Chưa thể tải kế hoạch hỗ trợ. Không có kế hoạch nào bị thay đổi.
        </Text>
        <PrimaryButton
          label="Thử tải lại"
          onPress={() => void refresh().catch(() => undefined)}
        />
      </Screen>
    )
  if (!current.data && !draft.data && terminalHistory.isPending)
    return (
      <Screen>
        <ActivityIndicator
          accessibilityLabel="Đang xác định lịch sử kế hoạch"
          color={colors.tealDeep}
        />
      </Screen>
    )
  if (!current.data && !draft.data && terminalHistory.isError)
    return (
      <Screen>
        <Text accessibilityLiveRegion="polite" style={styles.body}>
          Chưa thể xác định lịch sử kế hoạch. Chưa có bản đề xuất nào được tạo.
        </Text>
        <PrimaryButton
          label="Thử tải lại lịch sử"
          onPress={() => void terminalHistory.refetch()}
        />
      </Screen>
    )
  const native =
    current.data?.representationMode === 'NATIVE_V3' ||
    draft.data?.representationMode === 'NATIVE_V3' ||
    (!current.data &&
      !draft.data &&
      terminalHistory.data?.items[0]?.representationMode !==
        'V2_RESOURCE_ADAPTER')
  if (!native)
    return (
      <SupportPlanScreen
        api={legacyApi}
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
      origin={origin}
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
  onChanged: () => Promise<void>
  origin: OriginInput
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
  origin,
  journalOrigin = noJournalOrigin,
  now,
}: NativeProps) {
  const { session } = useSession()
  const subject = session?.subject
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
  const focusReturnedActivity = useCallback((target: View, heading: Text) => {
    if (!contentRef.current) return
    target.measureLayout(contentRef.current, (_x, y) => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, y + spacing.xxxl - spacing.md),
        animated: false,
      })
      // RN Web has no native accessibility-event bridge; native follows the
      // existing ChatScreen focus pattern without changing the app shell.
      AccessibilityInfo.sendAccessibilityEvent?.(heading, 'focus')
    })
  }, [])
  const plan = current ?? draft
  const timezone =
    current?.focuses
      .flatMap((x) => x.actions)
      .flatMap((x) => x.schedules)
      .find((x) => x.status === 'ACTIVE')?.timezone ?? 'Asia/Ho_Chi_Minh'
  const window =
    journalOrigin.state === 'valid'
      ? {
          from: journalOrigin.value.localDate,
          through: journalOrigin.value.localDate,
        }
      : occurrenceWindow(now(), timezone)
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
  const history = useInfiniteQuery({
    queryKey: ['support-plan-v3', subject, 'history-pages'],
    enabled: Boolean(subject),
    retry: false,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.getHistory(pageParam),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  })
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
  const items = matching ? (occurrences.data?.occurrences ?? []) : []
  const returned =
    journalOrigin.state === 'valid'
      ? items.find(
          (x) =>
            x.occurrenceId === journalOrigin.value.occurrenceId &&
            x.actionId === journalOrigin.value.actionId &&
            x.localDate === journalOrigin.value.localDate &&
            x.actionType === 'JOURNAL',
        )
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
  return (
    <Screen scrollRef={scrollRef} contentRef={contentRef}>
      <Secondary label="← Quay lại" onPress={() => router.back()} />
      <Text style={styles.eyebrow}>CHĂM SÓC BẢN THÂN</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Kế hoạch hỗ trợ
      </Text>
      <Text style={styles.body}>
        Xem hoạt động tiếp theo và chủ động chọn nhịp phù hợp với bạn.
      </Text>
      {notice ? (
        <Text accessibilityLiveRegion="polite" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
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
      <SupportPlanPersonalizationCard
        api={legacyApi}
        subject={subject ?? ''}
        onReviewPlan={() =>
          setNotice(
            'Lựa chọn mới đã được lưu. Kế hoạch hiện tại vẫn giữ nguyên cho đến khi bạn xem lại phương án.',
          )
        }
      />
      {plan?.safety.guidanceCode === 'REVIEW_SAFETY_GUIDANCE' ? (
        <View style={styles.panel}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Khi cần thêm hỗ trợ
          </Text>
          <Text style={styles.body}>{plan.safety.guidance}</Text>
        </View>
      ) : null}
      {current ? (
        <View style={styles.panel}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Kế hoạch hiện tại
          </Text>
          <Text style={styles.state}>{statusLabels[current.status]}</Text>
          {current.representationMode === 'V2_RESOURCE_ADAPTER' ? (
            <Text style={styles.body}>
              Các nội dung đã chọn vẫn được giữ nguyên trong khi bạn xem phương
              án mới.
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
      {current?.representationMode === 'NATIVE_V3' ? (
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Hoạt động gần đây và sắp tới
          </Text>
          {origin.state === 'invalid' ||
          journalOrigin.state === 'invalid' ||
          ((origin.state === 'valid' || journalOrigin.state === 'valid') &&
            !occurrences.isPending &&
            !returned) ? (
            <Text accessibilityLiveRegion="polite" style={styles.body}>
              Không xác định được hoạt động vừa mở. Các hoạt động hiện tại vẫn ở
              bên dưới; không có mục nào được cập nhật thay.
            </Text>
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
                Chưa thể tải lịch hoạt động mới nhất. Không có hoạt động nào bị
                thay đổi.
              </Text>
              <Secondary
                label="Tải lại hoạt động"
                onPress={() => void occurrences.refetch()}
              />
            </>
          ) : null}
          {matching && items.length === 0 ? (
            <Text style={styles.body}>
              Chưa có hoạt động trong khoảng thời gian này.
            </Text>
          ) : null}
          {ordered.map((item) => {
            const action = actions.find((x) => x.actionId === item.actionId)
            return action ? (
              <NativeActivity
                key={`${item.occurrenceId}:${item.version}`}
                api={api}
                occurrence={item}
                plan={current}
                title={action.presentation.title}
                summary={action.presentation.summary}
                source={action.source}
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
                returned={returned?.occurrenceId === item.occurrenceId}
                journalOrigin={
                  journalOrigin.state === 'valid' &&
                  returned?.occurrenceId === item.occurrenceId
                    ? journalOrigin.value
                    : undefined
                }
                navigationBlocked={dirty || busy}
                onReturnLayout={focusReturnedActivity}
                onRefresh={() => occurrences.refetch().then(() => undefined)}
                now={now}
              />
            ) : null
          })}
        </View>
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
              Lưu hoặc hoàn tác lịch đang chỉnh trước khi thay đổi trạng thái kế
              hoạch.
            </Text>
          ) : null}
        </View>
      ) : null}
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
      {!draft ? (
        <NativeProposalEntry
          api={api}
          current={current}
          draft={draft}
          onChanged={onChanged}
          disabled={busy || dirty}
        />
      ) : null}
      <View style={styles.panel}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Nhịp ghi nhận cảm xúc
        </Text>
        {progress.data ? (
          <Text style={styles.body}>
            Trong 7 ngày gần đây, bạn có{' '}
            {progress.data.windows.find((x) => x.days === 7)?.checkedInDays ??
              0}{' '}
            ngày ghi nhận cảm xúc.
          </Text>
        ) : null}
        {progress.isError ? (
          <Text style={styles.body}>
            Chưa tải được số ngày ghi nhận. Lịch hoạt động vẫn có thể sử dụng.
          </Text>
        ) : null}
        <Secondary
          label="Tải lại số ngày ghi nhận"
          onPress={() => void progress.refetch()}
        />
      </View>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Kế hoạch trước đây
        </Text>
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
            <Text style={styles.itemTitle}>{statusLabels[item.status]}</Text>
            <Text style={styles.body}>
              {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(
                new Date(item.updatedAt),
              )}
            </Text>
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
    </Screen>
  )
}

function NativeActivity({
  api,
  occurrence,
  plan,
  title,
  summary,
  source,
  journalEligible,
  returned,
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
  source: CanonicalSupportPlan['focuses'][number]['actions'][number]['source']
  journalEligible: boolean
  returned: boolean
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
    if (running.current || plan.status !== 'ACTIVE') return
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
  return (
    <View
      ref={activityRef}
      onLayout={focusReturn}
      style={[styles.panel, emotion && styles.emotionPanel]}
      testID={`plan-activity-${occurrence.occurrenceId}`}
    >
      {returned ? (
        <Text accessibilityLiveRegion="polite" style={styles.eyebrow}>
          {journal
            ? 'Bạn vừa quay lại từ nhật ký'
            : 'Bạn vừa quay lại từ ghi nhận cảm xúc'}
        </Text>
      ) : null}
      <Text style={styles.supporting}>
        {dateLabel(occurrence.localDate)}
        {schedule
          ? ` · ${schedule.localTime.slice(0, 5)} · ${schedule.estimatedDurationMinutes} phút`
          : ''}
      </Text>
      <Text
        ref={headingRef}
        accessible
        accessibilityRole="header"
        style={styles.sectionTitle}
      >
        {title}
      </Text>
      {summary ? <Text style={styles.body}>{summary}</Text> : null}
      <Text accessibilityLiveRegion="polite" style={styles.state}>
        {completed
          ? 'Đã ghi nhận hoàn thành'
          : occurrenceLabels[occurrence.displayState]}
      </Text>
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
          <Text style={styles.supporting}>
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
        <>
          {occurrence.actionType === 'RESOURCE' && source ? (
            <Secondary
              label={`Mở ${title}`}
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
          {source?.ownerDomain === 'CONTENT' &&
          plan.status === 'ACTIVE' &&
          occurrence.state === 'SCHEDULED' ? (
            <>
              <Secondary
                label="Ghi nhận đã làm"
                disabled={busy}
                onPress={() => void change('COMPLETED')}
              />
              <Secondary
                label="Bỏ qua lần này"
                disabled={busy}
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
        </>
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
  supporting: { color: colors.inkSoft, fontSize: 14, lineHeight: 22 },
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
  emotionPanel: { borderLeftWidth: 4, borderLeftColor: colors.teal },
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
