import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { randomUUID } from 'expo-crypto'
import { router } from 'expo-router'
import type { ReactNode } from 'react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type StyleProp,
  type TextStyle,
  View,
} from 'react-native'

import { ApiError } from '@/api/api-error'
import { useSession } from '@/auth/session-context'
import { PrimaryButton } from '@/components/PrimaryButton'
import { Screen } from '@/components/Screen'
import { colors, radii, spacing, typography } from '@/theme/tokens'
import type { ResolvedEmotionPlanOrigin } from '@/support-plan/emotion-plan-context'

import type { EmotionApi } from './emotion-api'
import type {
  Emotion,
  EmotionCheckIn,
  EmotionCheckInList,
  EmotionInfluenceFactor,
} from './emotion-contract'

const emotions: readonly {
  value: Emotion
  emoji: string
  label: string
}[] = [
  { value: 'GREAT', emoji: '😄', label: 'Rất tốt' },
  { value: 'GOOD', emoji: '😊', label: 'Tốt' },
  { value: 'OKAY', emoji: '😌', label: 'Bình thường' },
  { value: 'LOW', emoji: '🥱', label: 'Không tốt' },
  { value: 'VERY_LOW', emoji: '😟', label: 'Rất không tốt' },
]
const emotionChartColors: Record<Emotion, string> = {
  GREAT: '#298565',
  GOOD: '#427B72',
  OKAY: '#5278AC',
  LOW: '#AA6644',
  VERY_LOW: '#77649A',
}
const intensityLabels = [
  'Rất nhẹ',
  'Nhẹ',
  'Vừa phải',
  'Mạnh',
  'Rất mạnh',
] as const
const periods = [7, 14, 30] as const
const influenceFactors: readonly {
  value: EmotionInfluenceFactor
  label: string
}[] = [
  { value: 'sleep', label: 'Giấc ngủ' },
  { value: 'work', label: 'Công việc' },
  { value: 'study', label: 'Học tập' },
  { value: 'family', label: 'Gia đình' },
  { value: 'friends', label: 'Bạn bè' },
  { value: 'health', label: 'Sức khỏe' },
  { value: 'other', label: 'Điều khác' },
]
type Period = (typeof periods)[number]
type Draft = Readonly<{
  emotion: Emotion | null
  intensity: number | null
  factors: readonly EmotionInfluenceFactor[]
  note: string
}>
type SaveCommand = Readonly<{
  subject: string
  localDate: string
  timezone: string
  scope: string
  draft: Draft
  current: EmotionCheckIn | null
}>
type DeleteCommand = Readonly<{
  subject: string
  localDate: string
  timezone: string
  scope: string
}>

const emptyDraft: Draft = {
  emotion: null,
  intensity: null,
  factors: [],
  note: '',
}
const historyLimit = 30

const savedDraft = (checkIn: EmotionCheckIn): Draft => ({
  emotion: checkIn.emotion,
  intensity: checkIn.intensity,
  factors: checkIn.factors,
  note: checkIn.note ?? '',
})

function draftSyncKey(
  subject: string | undefined,
  localDate: string,
  checkIn: EmotionCheckIn | null,
) {
  const ownerKey = subject ?? 'no-subject'
  return checkIn
    ? `${ownerKey}:${localDate}:${checkIn.id}:${checkIn.revision}`
    : `${ownerKey}:${localDate}:empty`
}

export function localDateInTimeZone(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
})

const displayDate = (localDate: string) =>
  dateFormatter.format(new Date(`${localDate}T00:00:00.000Z`))

function isNotFound(error: unknown) {
  return error instanceof ApiError && error.status === 404
}

function queryErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    return 'Chưa xác minh được quyền truy cập ghi nhận. Vui lòng thử lại.'
  }
  if (error instanceof ApiError && error.status === 403) {
    return 'Tài khoản này không có quyền xem dữ liệu cảm xúc.'
  }
  return 'Chưa thể tải dữ liệu cảm xúc lúc này. Dữ liệu đã lưu không bị thay đổi.'
}

function mutationErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    return 'Phiên đăng nhập đã hết hạn. Lựa chọn của bạn vẫn được giữ lại.'
  }
  if (error instanceof ApiError && error.status === 403) {
    return 'Tài khoản này không có quyền thay đổi dữ liệu cảm xúc.'
  }
  return 'Chưa thể lưu thay đổi lúc này. Lựa chọn của bạn vẫn được giữ lại để thử lại.'
}

function StateMessage({
  children,
  tone = 'neutral',
}: Readonly<{
  children: string
  tone?: 'error' | 'neutral' | 'success'
}>) {
  return (
    <Text
      accessibilityLiveRegion={tone === 'neutral' ? 'polite' : 'assertive'}
      style={[
        baseStyles.message,
        tone === 'error' && baseStyles.errorText,
        tone === 'success' && baseStyles.successText,
      ]}
    >
      {children}
    </Text>
  )
}

export function EmotionCheckInScreen({
  api,
  now = () => new Date(),
  timezone: timezoneOverride,
  planOrigin,
  initialMood,
  inlineSelection,
  useDashboardFont = false,
  beforeProgress,
  savedAppearance,
  onReturnToPlan,
}: Readonly<{
  api: EmotionApi
  now?: () => Date
  timezone?: string
  initialMood?: Draft['emotion'] | undefined
  inlineSelection?: { mood: Emotion | null }
  useDashboardFont?: boolean
  beforeProgress?: ReactNode
  savedAppearance?: {
    surface: string
    title: StyleProp<TextStyle>
    supporting: StyleProp<TextStyle>
    action: StyleProp<TextStyle>
  }
  planOrigin?: ResolvedEmotionPlanOrigin
  onReturnToPlan?: () => void
}>) {
  const { session, signOut } = useSession()
  const queryClient = useQueryClient()
  const subject = session?.subject
  const timezone = useMemo(
    () =>
      timezoneOverride ??
      Intl.DateTimeFormat().resolvedOptions().timeZone ??
      'UTC',
    [timezoneOverride],
  )
  const localDate = useMemo(
    () => localDateInTimeZone(now(), timezone),
    [now, timezone],
  )
  const todayKey = ['emotion-check-in', subject, 'today', localDate] as const
  const historyKey = [
    'emotion-check-in',
    subject,
    'history',
    historyLimit,
  ] as const
  const progressKey = [
    'emotion-check-in',
    subject,
    'progress',
    timezone,
  ] as const
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [period, setPeriod] = useState<Period>(7)
  const [contextExpanded, setContextExpanded] = useState(false)
  const [showSaved, setShowSaved] = useState(inlineSelection?.mood === null)
  const [notice, setNotice] = useState<{
    message: string
    tone: 'error' | 'success'
  } | null>(null)
  const [pendingDeleteDate, setPendingDeleteDate] = useState<string | null>(
    null,
  )
  const syncedDraftKey = useRef<string | undefined>(undefined)
  const scope = `${subject}:${localDate}:${timezone}`
  const currentScope = useRef(scope)
  useLayoutEffect(() => {
    currentScope.current = scope
  }, [scope])
  const saveKey = useRef<{ signature: string; key: string } | null>(null)

  const todayQuery = useQuery({
    queryKey: todayKey,
    enabled: Boolean(subject),
    refetchOnMount: 'always',
    queryFn: async () => {
      try {
        return await api.getCheckIn(localDate)
      } catch (error) {
        if (isNotFound(error)) return null
        throw error
      }
    },
  })
  const historyQuery = useQuery({
    queryKey: historyKey,
    enabled: Boolean(subject),
    refetchOnMount: 'always',
    queryFn: () => api.listCheckIns(historyLimit),
  })
  const progressQuery = useQuery({
    queryKey: progressKey,
    enabled: Boolean(subject),
    refetchOnMount: 'always',
    queryFn: () => api.getProgress(timezone),
  })

  const current = todayQuery.data ?? null
  const inline = inlineSelection !== undefined
  const styles = inline
    ? useDashboardFont
      ? dashboardFontStyles
      : compactStyles
    : baseStyles

  useEffect(() => {
    if (!subject || !todayQuery.isSuccess) return
    const syncKey = draftSyncKey(subject, localDate, current)
    if (syncedDraftKey.current === syncKey) return
    const loadedDraft = current ? savedDraft(current) : emptyDraft
    const firstLoad = syncedDraftKey.current === undefined
    setDraft(
      firstLoad && (inlineSelection?.mood || initialMood)
        ? {
            ...loadedDraft,
            emotion: inlineSelection?.mood ?? initialMood ?? null,
          }
        : loadedDraft,
    )
    syncedDraftKey.current = syncKey
    setNotice(null)
    setPendingDeleteDate(null)
  }, [
    current,
    initialMood,
    inlineSelection,
    localDate,
    subject,
    todayQuery.isSuccess,
  ])

  const [previousSelection, setPreviousSelection] = useState(inlineSelection)
  if (inlineSelection !== previousSelection) {
    setPreviousSelection(inlineSelection)
    const mood = inlineSelection?.mood
    if (mood) {
      setDraft({ ...draft, emotion: mood })
      setShowSaved(false)
      setNotice(null)
    }
  }

  const refreshHistoryAndProgress = async (owner: {
    subject: string
    timezone: string
  }) => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['emotion-check-in', owner.subject, 'history'],
      }),
      queryClient.invalidateQueries({
        queryKey: [
          'emotion-check-in',
          owner.subject,
          'progress',
          owner.timezone,
        ],
      }),
    ])
  }

  const saveMutation = useMutation({
    mutationFn: async (command: SaveCommand) => {
      if (!command.draft.emotion || !command.draft.intensity) {
        throw new Error('Emotion check-in draft is incomplete')
      }
      const value = {
        emotion: command.draft.emotion,
        intensity: command.draft.intensity,
        factors: [...command.draft.factors],
        note: command.draft.note.trim() || null,
      }
      const signature = JSON.stringify([
        command.scope,
        command.current?.revision,
        value,
      ])
      if (saveKey.current?.signature !== signature)
        saveKey.current = { signature, key: randomUUID() }
      return command.current
        ? api.updateCheckIn(
            command.localDate,
            command.current.revision,
            value,
            saveKey.current.key,
          )
        : api.createCheckIn(
            {
              ...value,
              localDate: command.localDate,
              timezone: command.timezone,
            },
            saveKey.current.key,
          )
    },
    onSuccess: async (saved, command) => {
      queryClient.setQueryData(
        ['emotion-check-in', command.subject, 'today', command.localDate],
        saved,
      )
      if (currentScope.current === command.scope) {
        syncedDraftKey.current = draftSyncKey(
          command.subject,
          command.localDate,
          saved,
        )
        setDraft(savedDraft(saved))
        if (!planOrigin) setShowSaved(true)
        saveKey.current = null
        setNotice({
          message: command.current
            ? 'Đã cập nhật ghi nhận hôm nay.'
            : 'Đã lưu ghi nhận hôm nay.',
          tone: 'success',
        })
      }
      await refreshHistoryAndProgress(command)
    },
    onError: async (error, command) => {
      if (currentScope.current !== command.scope) return
      if (
        error instanceof ApiError &&
        (error.status === 409 || error.status === 412)
      ) {
        const refreshed = await todayQuery.refetch()
        if (currentScope.current !== command.scope) return
        if (refreshed.isSuccess && refreshed.data) {
          syncedDraftKey.current = draftSyncKey(
            subject,
            localDate,
            refreshed.data,
          )
          setDraft(savedDraft(refreshed.data))
        }
        setNotice({
          message:
            'Ghi nhận đã thay đổi ở nơi khác. Bản mới nhất đã được tải; hãy kiểm tra lại trước khi lưu.',
          tone: 'error',
        })
        return
      }
      setNotice({ message: mutationErrorMessage(error), tone: 'error' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (command: DeleteCommand) =>
      api.deleteCheckIn(command.localDate, randomUUID()),
    onSuccess: async (tombstone, command) => {
      queryClient.setQueryData(
        ['emotion-check-in', command.subject, 'today', tombstone.localDate],
        null,
      )
      if (
        currentScope.current === command.scope &&
        tombstone.localDate === localDate
      ) {
        syncedDraftKey.current = draftSyncKey(
          command.subject,
          tombstone.localDate,
          null,
        )
        setDraft(emptyDraft)
        setShowSaved(false)
      }
      queryClient.setQueryData<EmotionCheckInList>(
        ['emotion-check-in', command.subject, 'history', historyLimit],
        (history) =>
          history
            ? {
                ...history,
                items: history.items.filter(
                  ({ localDate: date }) => date !== tombstone.localDate,
                ),
              }
            : history,
      )
      if (currentScope.current === command.scope) {
        setPendingDeleteDate(null)
        setNotice({ message: 'Đã xóa ghi nhận đã chọn.', tone: 'success' })
      }
      await refreshHistoryAndProgress(command)
    },
    onError: (error, command) => {
      if (currentScope.current === command.scope)
        setNotice({ message: mutationErrorMessage(error), tone: 'error' })
    },
  })

  if (!subject) {
    return (
      <Screen>
        <Text accessibilityRole="header" style={styles.title}>
          Ghi nhận cảm xúc
        </Text>
        <StateMessage tone="error">
          Bạn cần đăng nhập bằng tài khoản cá nhân để xem dữ liệu cảm xúc.
        </StateMessage>
        <PrimaryButton label="Đăng nhập lại" onPress={() => void signOut()} />
      </Screen>
    )
  }

  const saveDisabled =
    Boolean(planOrigin && planOrigin.occurrence.localDate !== localDate) ||
    !draft.emotion ||
    !draft.intensity ||
    saveMutation.isPending ||
    deleteMutation.isPending ||
    (current?.emotion === draft.emotion &&
      current.intensity === draft.intensity &&
      current.note === (draft.note.trim() || null) &&
      current.factors.join(',') === draft.factors.join(','))
  const emotionCopy = new Map(emotions.map((item) => [item.value, item]))
  const selectedWindow = progressQuery.data?.windows.find(
    ({ days }) => days === period,
  )

  const showingConfirmation = showSaved && current !== null
  const savedTime = current?.updatedAt
    ? new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(new Date(current.updatedAt))
    : null

  const saveButton = (
    <PrimaryButton
      disabled={saveDisabled}
      tone={inline ? 'darkPill' : 'default'}
      labelStyle={styles.saveLabel}
      label={
        saveMutation.isPending
          ? 'Đang lưu…'
          : inline
            ? '✓ Lưu'
            : current
              ? 'Cập nhật ghi nhận'
              : 'Lưu ghi nhận'
      }
      onPress={() =>
        saveMutation.mutate({
          subject,
          localDate,
          timezone,
          scope,
          draft,
          current,
        })
      }
    />
  )

  const content = (
    <>
      {!inline && (
        <>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.backLabel}>← Quay lại</Text>
          </Pressable>

          <Text style={styles.eyebrow}>NHỊP GHI NHẬN CỦA BẠN</Text>
          <Text accessibilityRole="header" style={styles.title}>
            Ghi nhận cảm xúc
          </Text>
          <Text style={styles.description}>
            Chọn cảm xúc và mức độ bạn tự cảm nhận hôm nay. Dữ liệu được lưu
            theo tài khoản của bạn và có thể cập nhật trong cùng ngày.
          </Text>
        </>
      )}
      <View
        style={
          inline
            ? showingConfirmation
              ? [
                  styles.savedCard,
                  savedAppearance && {
                    backgroundColor: savedAppearance.surface,
                  },
                ]
              : styles.inlineForm
            : styles.panel
        }
      >
        {planOrigin && onReturnToPlan && (
          <View style={styles.planOrigin} testID="emotion-plan-origin">
            <Text style={styles.supporting}>
              Đang ghi nhận cho hoạt động trong kế hoạch
            </Text>
            <Text style={styles.sectionTitle}>{planOrigin.title}</Text>
            <Text accessibilityLiveRegion="polite" style={styles.supporting}>
              {saveMutation.isSuccess && saveMutation.variables?.scope === scope
                ? 'Đã lưu ghi nhận cảm xúc. Quay lại để kiểm tra hoạt động trong kế hoạch.'
                : 'Lưu cảm xúc xong, bạn có thể quay lại để kiểm tra hoạt động.'}
            </Text>
            {planOrigin.occurrence.localDate !== localDate && (
              <Text style={styles.supporting}>
                Ngày của hoạt động vừa mở đã qua. Ghi nhận đã lưu được giữ
                nguyên; quay lại để kiểm tra đúng hoạt động này.
              </Text>
            )}
            {current && current.timezone !== planOrigin.timezone && (
              <Text style={styles.supporting}>
                Ghi nhận hôm nay dùng múi giờ khác với hoạt động này. Bạn vẫn có
                thể xem và sửa cảm xúc; việc hoàn thành sẽ được kiểm tra riêng
                khi quay lại.
              </Text>
            )}
            <PrimaryButton
              label="Quay lại hoạt động"
              testID="emotion-return-to-plan"
              disabled={saveMutation.isPending || deleteMutation.isPending}
              onPress={onReturnToPlan}
            />
          </View>
        )}
        {!inline && (
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Cảm xúc hôm nay
          </Text>
        )}
        {todayQuery.isPending ? (
          <View accessibilityLiveRegion="polite" style={styles.loadingRow}>
            <ActivityIndicator
              accessibilityLabel="Đang tải ghi nhận hôm nay"
              color={colors.tealDeep}
            />
            <Text style={styles.supporting}>Đang tải ghi nhận hôm nay…</Text>
          </View>
        ) : todayQuery.isError && todayQuery.data === undefined ? (
          <View>
            <StateMessage tone="error">
              {queryErrorMessage(todayQuery.error)}
            </StateMessage>
            <PrimaryButton
              label="Thử tải lại"
              onPress={() => void todayQuery.refetch()}
            />
          </View>
        ) : showingConfirmation && current ? (
          <View style={inline ? styles.savedContent : undefined}>
            <View style={styles.savedCopy}>
              <Text
                accessibilityRole="header"
                style={
                  inline
                    ? (savedAppearance?.title ?? styles.sectionTitle)
                    : styles.sectionTitle
                }
              >
                Đã ghi nhận: {emotionCopy.get(current.emotion)?.label}
              </Text>
              <Text
                style={
                  inline
                    ? (savedAppearance?.supporting ?? styles.supporting)
                    : styles.supporting
                }
              >
                Cảm ơn bạn đã dành chút thời gian cho mình.
              </Text>
            </View>
            <PrimaryButton
              label="Viết thêm vào nhật ký"
              leadingIcon={inline ? '✎' : ''}
              tone={inline ? 'dashboard' : 'default'}
              labelStyle={inline ? styles.journalLabel : undefined}
              onPress={() => router.push('/(user)/journal')}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Chỉnh sửa ghi nhận"
              style={({ pressed }) => [
                inline ? styles.savedEdit : styles.backButton,
                pressed && styles.pressed,
              ]}
              onPress={() => setShowSaved(false)}
            >
              <Text
                style={
                  inline
                    ? (savedAppearance?.action ?? styles.backLabel)
                    : styles.backLabel
                }
              >
                Chỉnh sửa ghi nhận
              </Text>
            </Pressable>
            {inline && (
              <Text
                accessibilityLiveRegion="polite"
                style={savedAppearance?.supporting ?? styles.missingNote}
              >
                {savedTime
                  ? '✓ Đã cập nhật lúc ' + savedTime
                  : notice?.tone === 'success'
                    ? notice.message
                    : null}
              </Text>
            )}
          </View>
        ) : (
          <>
            <Text style={styles.supporting}>
              {current
                ? 'Bạn có thể điều chỉnh lựa chọn đã lưu trong hôm nay.'
                : 'Hôm nay bạn chưa ghi nhận cảm xúc.'}
            </Text>
            {!inline && (
              <View accessibilityRole="radiogroup" style={styles.choiceGrid}>
                {emotions.map((item) => {
                  const selected = draft.emotion === item.value
                  return (
                    <Pressable
                      key={item.value}
                      accessibilityLabel={item.label}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      disabled={saveMutation.isPending}
                      onPress={() => {
                        setDraft((value) => ({
                          ...value,
                          emotion: item.value,
                        }))
                        setNotice(null)
                      }}
                      style={({ pressed }) => [
                        styles.choice,
                        selected && styles.choiceSelected,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.emoji}>{item.emoji}</Text>
                      <Text style={styles.choiceLabel}>{item.label}</Text>
                    </Pressable>
                  )
                })}
              </View>
            )}

            {draft.emotion ? (
              <>
                <View style={styles.intensityHeader}>
                  <Text style={styles.fieldLabel}>Mức độ cảm nhận</Text>
                  {inline && draft.intensity !== null && (
                    <Text style={styles.intensityBadge}>
                      Mức {draft.intensity} ·{' '}
                      {intensityLabels[draft.intensity - 1]}
                    </Text>
                  )}
                </View>
                <Text style={styles.supporting}>
                  1 là nhẹ, 5 là mạnh — không phải điểm sức khỏe.
                </Text>
                <View
                  accessibilityRole="radiogroup"
                  style={styles.intensityRow}
                >
                  {[1, 2, 3, 4, 5].map((intensity) => {
                    const selected = draft.intensity === intensity
                    return (
                      <Pressable
                        key={intensity}
                        accessibilityLabel={`Mức cảm nhận ${intensity}`}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected }}
                        disabled={saveMutation.isPending}
                        onPress={() => {
                          setDraft((value) => ({ ...value, intensity }))
                          setNotice(null)
                        }}
                        style={({ pressed }) => [
                          styles.intensity,
                          selected && styles.intensitySelected,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.intensityLabel,
                            selected && styles.intensityLabelSelected,
                          ]}
                        >
                          {intensity}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>
                <View style={inline ? styles.checkInActions : undefined}>
                  <Pressable
                    accessibilityLabel="Thêm bối cảnh riêng tư (không bắt buộc)"
                    accessibilityRole="button"
                    accessibilityState={{ expanded: contextExpanded }}
                    onPress={() => setContextExpanded((value) => !value)}
                    style={({ pressed }) => [
                      styles.contextToggle,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.contextToggleLabel}>
                      Thêm bối cảnh riêng tư (không bắt buộc)
                    </Text>
                    <Text accessible={false} style={styles.contextToggleIcon}>
                      {contextExpanded ? '−' : '+'}
                    </Text>
                  </Pressable>
                  {inline && (
                    <View style={styles.inlineSave}>{saveButton}</View>
                  )}
                </View>
                {contextExpanded && (
                  <View style={styles.contextBody}>
                    <Text style={styles.contextPrivacy}>
                      Chỉ lưu khi bạn chọn “Lưu ghi nhận”. Nội dung này giúp bạn
                      xem lại và không tự động gửi cho AI, kế hoạch hỗ trợ hay
                      phân tích.
                    </Text>
                    <Text style={styles.fieldLabel}>
                      Điều gì có thể ảnh hưởng đến cảm xúc này?
                    </Text>
                    <Text style={styles.supporting}>
                      Có thể chọn tối đa 3 mục.
                    </Text>
                    <View style={styles.factorGrid}>
                      {influenceFactors.map((factor) => {
                        const selected = draft.factors.includes(factor.value)
                        const disabled =
                          saveMutation.isPending ||
                          (!selected && draft.factors.length >= 3)
                        return (
                          <Pressable
                            key={factor.value}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: selected, disabled }}
                            disabled={disabled}
                            onPress={() =>
                              setDraft((currentDraft) => ({
                                ...currentDraft,
                                factors: selected
                                  ? currentDraft.factors.filter(
                                      (value) => value !== factor.value,
                                    )
                                  : influenceFactors
                                      .filter(
                                        ({ value }) =>
                                          currentDraft.factors.includes(
                                            value,
                                          ) || value === factor.value,
                                      )
                                      .map(({ value }) => value),
                              }))
                            }
                            style={({ pressed }) => [
                              styles.factorChip,
                              selected && styles.factorSelected,
                              disabled && styles.factorDisabled,
                              pressed && styles.pressed,
                            ]}
                          >
                            <Text
                              style={[
                                styles.factorLabel,
                                selected && styles.factorLabelSelected,
                              ]}
                            >
                              {factor.label}
                            </Text>
                          </Pressable>
                        )
                      })}
                    </View>
                    <Text style={styles.fieldLabel}>
                      Ghi chú riêng (không bắt buộc)
                    </Text>
                    <TextInput
                      accessibilityLabel="Ghi chú riêng (không bắt buộc)"
                      editable={!saveMutation.isPending}
                      maxLength={500}
                      multiline
                      onChangeText={(note) =>
                        setDraft((currentDraft) => ({ ...currentDraft, note }))
                      }
                      placeholder="Bạn có thể để trống"
                      style={styles.noteInput}
                      textAlignVertical="top"
                      value={draft.note}
                    />
                    <Text style={styles.noteCount}>
                      {draft.note.length}/500
                    </Text>
                  </View>
                )}
              </>
            ) : null}
            {!inline && saveButton}
          </>
        )}
      </View>

      {notice &&
        !(inline && showingConfirmation && notice.tone === 'success') && (
          <StateMessage tone={notice.tone}>{notice.message}</StateMessage>
        )}

      {beforeProgress}
      <View style={inline ? styles.inlineStats : styles.panel}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Tiến độ ghi nhận
        </Text>
        <Text style={styles.supporting}>
          Các con số chỉ phản ánh những ngày bạn đã tự ghi nhận.
        </Text>
        {progressQuery.isPending ? (
          <ActivityIndicator
            accessibilityLabel="Đang tải tiến độ ghi nhận"
            color={colors.tealDeep}
          />
        ) : progressQuery.isError && !progressQuery.data ? (
          <View>
            <StateMessage tone="error">
              Chưa thể tải tiến độ ghi nhận lúc này.
            </StateMessage>
            <PrimaryButton
              label="Thử tải tiến độ"
              onPress={() => void progressQuery.refetch()}
            />
          </View>
        ) : progressQuery.data && selectedWindow ? (
          <>
            {progressQuery.isError && (
              <StateMessage tone="error">
                Chưa thể làm mới tiến độ. Số liệu đã tải vẫn được giữ nguyên.
              </StateMessage>
            )}
            <View style={styles.streakRow}>
              <View style={styles.streakItem}>
                <Text style={styles.metricLabel}>Chuỗi hiện tại</Text>
                <Text style={styles.metricValue}>
                  {progressQuery.data.currentStreak} ngày
                </Text>
              </View>
              <View style={styles.streakItem}>
                <Text style={styles.metricLabel}>Chuỗi dài nhất</Text>
                <Text style={styles.metricValue}>
                  {progressQuery.data.longestStreak} ngày
                </Text>
              </View>
            </View>
            <View style={styles.periodRow}>
              {periods.map((days) => (
                <Pressable
                  key={days}
                  accessibilityRole="button"
                  accessibilityState={{ selected: period === days }}
                  onPress={() => setPeriod(days)}
                  style={({ pressed }) => [
                    styles.periodButton,
                    period === days && styles.periodSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.periodLabel,
                      period === days && styles.periodLabelSelected,
                    ]}
                  >
                    {days} ngày
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.chartSummary}>
              <Text style={styles.coverage}>
                Đã ghi nhận {selectedWindow.checkedInDays}/
                {selectedWindow.totalDays} ngày
              </Text>
              <Text style={styles.missingNote}>
                {selectedWindow.totalDays - selectedWindow.checkedInDays} ngày
                chưa ghi
              </Text>
            </View>
            <View style={styles.distribution}>
              <Text style={styles.fieldLabel}>Phân bố cảm xúc</Text>
              {selectedWindow.checkedInDays === 0 ? (
                <Text style={styles.missingNote}>
                  Biểu đồ sẽ có dữ liệu sau lần ghi nhận đầu tiên.
                </Text>
              ) : (
                emotions.map((item) => {
                  const count = selectedWindow.distribution[item.value]
                  const share = Math.round(
                    (count / selectedWindow.checkedInDays) * 100,
                  )
                  return (
                    <View
                      key={item.value}
                      style={styles.chartItem}
                      accessible
                      accessibilityLabel={item.label + ', ' + count + ' ngày'}
                    >
                      <View style={styles.distributionRow}>
                        <Text style={styles.distributionLabel}>
                          {item.emoji} {item.label}
                        </Text>
                        <Text style={styles.distributionCount}>
                          {count} ngày
                        </Text>
                      </View>
                      <View style={styles.chartTrack}>
                        <View
                          style={[
                            styles.chartBar,
                            {
                              width: (share + '%') as `${number}%`,
                              backgroundColor: emotionChartColors[item.value],
                            },
                          ]}
                        />
                      </View>
                    </View>
                  )
                })
              )}
              {selectedWindow.checkedInDays > 0 && (
                <Text style={styles.missingNote}>
                  Những ngày không có ghi nhận được để trống. Tỷ lệ chỉ tính
                  trên ngày đã ghi.
                </Text>
              )}
            </View>
          </>
        ) : null}
      </View>

      {!inline && (
        <View style={styles.panel}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Lịch sử gần đây
          </Text>
          {historyQuery.isPending ? (
            <ActivityIndicator
              accessibilityLabel="Đang tải lịch sử cảm xúc"
              color={colors.tealDeep}
            />
          ) : historyQuery.isError && !historyQuery.data ? (
            <View>
              <StateMessage tone="error">
                Chưa thể tải lịch sử cảm xúc lúc này.
              </StateMessage>
              <PrimaryButton
                label="Thử tải lịch sử"
                onPress={() => void historyQuery.refetch()}
              />
            </View>
          ) : historyQuery.data?.items.length === 0 ? (
            <Text style={styles.supporting}>
              Lịch sử sẽ xuất hiện sau lần lưu đầu tiên.
            </Text>
          ) : (
            <View style={styles.historyList}>
              {historyQuery.isError && (
                <StateMessage tone="error">
                  Chưa thể làm mới lịch sử. Các ghi nhận đã tải vẫn được giữ
                  nguyên.
                </StateMessage>
              )}
              {historyQuery.data?.items.map((item) => {
                const copy = emotionCopy.get(item.emotion)
                const confirming = pendingDeleteDate === item.localDate
                return (
                  <View key={item.id} style={styles.historyItem}>
                    <Text style={styles.historyDate}>
                      {displayDate(item.localDate)}
                    </Text>
                    <Text style={styles.historyEmotion}>
                      {copy?.emoji} {copy?.label}
                    </Text>
                    <Text style={styles.supporting}>
                      Mức cảm nhận {item.intensity}/5
                    </Text>
                    {confirming ? (
                      <View style={styles.deleteConfirm}>
                        <StateMessage tone="error">
                          Xóa ghi nhận này sẽ loại nó khỏi lịch sử và tiến độ.
                        </StateMessage>
                        <View style={styles.inlineActions}>
                          <Pressable
                            accessibilityRole="button"
                            disabled={deleteMutation.isPending}
                            onPress={() =>
                              deleteMutation.mutate({
                                subject,
                                localDate: item.localDate,
                                timezone,
                                scope,
                              })
                            }
                            style={({ pressed }) => [
                              styles.dangerButton,
                              pressed && styles.pressed,
                            ]}
                          >
                            <Text style={styles.dangerLabel}>
                              {deleteMutation.isPending
                                ? 'Đang xóa…'
                                : 'Xác nhận xóa'}
                            </Text>
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            disabled={deleteMutation.isPending}
                            onPress={() => setPendingDeleteDate(null)}
                            style={({ pressed }) => [
                              styles.textButton,
                              pressed && styles.pressed,
                            ]}
                          >
                            <Text style={styles.textButtonLabel}>Giữ lại</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <Pressable
                        accessibilityLabel={`Xóa ghi nhận ngày ${displayDate(item.localDate)}`}
                        accessibilityRole="button"
                        onPress={() => setPendingDeleteDate(item.localDate)}
                        style={({ pressed }) => [
                          styles.deleteButton,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.deleteLabel}>Xóa ghi nhận</Text>
                      </Pressable>
                    )}
                  </View>
                )
              })}
            </View>
          )}
        </View>
      )}
      <Text style={styles.disclaimer}>
        Đây là dữ liệu tự ghi nhận, không phải chẩn đoán, điểm sức khỏe hay đánh
        giá mức độ hồi phục.
      </Text>
    </>
  )
  return inline ? (
    <View style={styles.inlineLayout}>{content}</View>
  ) : (
    <Screen>{content}</Screen>
  )
}

const baseStyles = StyleSheet.create({
  planOrigin: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.control,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  backButton: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: 44,
    marginBottom: spacing.lg,
    paddingRight: spacing.lg,
  },
  backLabel: {
    color: colors.tealDeep,
    fontSize: typography.body,
    fontWeight: '700',
  },
  eyebrow: {
    color: colors.teal,
    fontSize: typography.eyebrow,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: spacing.md,
  },
  title: {
    color: colors.ink,
    fontSize: typography.heading,
    fontWeight: '700',
    lineHeight: typography.headingLineHeight,
    marginBottom: spacing.sm,
  },
  description: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
    marginBottom: spacing.xl,
  },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.panel,
    borderWidth: 1,
    gap: spacing.md,
    marginBottom: spacing.xl,
    padding: spacing.xl,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '700',
  },
  supporting: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  choiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  choice: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderColor: 'transparent',
    borderRadius: radii.control,
    borderWidth: 2,
    justifyContent: 'center',
    minHeight: 78,
    minWidth: 88,
    padding: spacing.sm,
  },
  choiceSelected: {
    backgroundColor: colors.tealPale,
    borderColor: colors.tealDeep,
  },
  emoji: { fontSize: 24 },
  choiceLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  fieldLabel: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  intensityRow: { flexDirection: 'row', gap: spacing.sm },
  intensity: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderColor: 'transparent',
    borderRadius: radii.control,
    borderWidth: 2,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 48,
  },
  intensitySelected: {
    backgroundColor: colors.tealDeep,
    borderColor: colors.tealDeep,
  },
  intensityLabel: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '700',
  },
  intensityLabelSelected: { color: colors.white },
  contextToggle: {
    alignItems: 'center',
    borderTopColor: colors.line,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
  },
  contextToggleLabel: {
    color: colors.tealDeep,
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  contextToggleIcon: {
    color: colors.tealDeep,
    fontSize: 22,
    fontWeight: '700',
    marginLeft: spacing.md,
  },
  contextBody: { gap: spacing.md },
  contextPrivacy: {
    color: colors.inkSoft,
    fontSize: 14,
    lineHeight: 21,
  },
  factorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  factorChip: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
  factorSelected: {
    backgroundColor: colors.tealPale,
    borderColor: colors.tealDeep,
  },
  factorDisabled: { opacity: 0.5 },
  factorLabel: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  factorLabelSelected: { color: colors.tealDeep },
  noteInput: {
    borderColor: colors.line,
    borderRadius: radii.control,
    borderWidth: 1,
    color: colors.ink,
    fontSize: typography.body,
    minHeight: 96,
    padding: spacing.md,
  },
  noteCount: {
    alignSelf: 'flex-end',
    color: colors.inkSoft,
    fontSize: 12,
  },
  message: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
    marginBottom: spacing.lg,
  },
  errorText: { color: '#9B352D' },
  successText: { color: colors.tealDeep },
  streakRow: { flexDirection: 'row', gap: spacing.md },
  streakItem: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.control,
    flex: 1,
    padding: spacing.md,
  },
  metricLabel: { color: colors.inkSoft, fontSize: 14 },
  metricValue: {
    color: colors.tealDeep,
    fontSize: 20,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  periodRow: { flexDirection: 'row', gap: spacing.sm },
  periodButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.pill,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
  periodSelected: { backgroundColor: colors.tealDeep },
  periodLabel: { color: colors.ink, fontWeight: '700' },
  periodLabelSelected: { color: colors.white },
  coverage: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '700',
  },
  missingNote: {
    color: colors.inkSoft,
    fontSize: 14,
    lineHeight: 20,
  },
  inlineLayout: { gap: spacing.md },
  savedCard: {
    padding: spacing.lg,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.panel,
  },
  savedContent: { gap: spacing.sm },
  savedCopy: { gap: spacing.xs },
  savedEdit: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  journalLabel: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  inlineForm: {
    gap: spacing.sm,
    backgroundColor: '#F0F3F1',
    borderRadius: radii.panel,
    padding: spacing.md,
  },
  intensityHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.xs,
  },
  intensityBadge: {
    color: '#174A32',
    backgroundColor: '#CDEFE0',
    borderRadius: radii.pill,
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    fontSize: 11,
  },
  checkInActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  inlineSave: { minWidth: 62 },
  saveLabel: { fontSize: 14 },
  inlineStats: {
    backgroundColor: '#F4F7F5',
    borderRadius: radii.panel,
    padding: spacing.md,
    gap: spacing.md,
  },
  chartSummary: { gap: spacing.xs },
  chartItem: { gap: spacing.xs },
  chartTrack: {
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceSoft,
    overflow: 'hidden',
  },
  chartBar: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.teal,
  },
  distribution: {
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.control,
    padding: spacing.md,
  },
  distributionRow: {
    gap: spacing.sm,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  distributionLabel: { color: colors.ink, fontSize: 14, flex: 1 },
  distributionCount: {
    color: colors.inkSoft,
    fontSize: 15,
    fontWeight: '700',
  },
  historyList: { gap: spacing.md },
  historyItem: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
  historyDate: { color: colors.inkSoft, fontSize: 14 },
  historyEmotion: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '700',
  },
  deleteButton: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: 44,
  },
  deleteLabel: { color: '#9B352D', fontSize: 15, fontWeight: '700' },
  deleteConfirm: {
    backgroundColor: '#FCEBE8',
    borderRadius: radii.control,
    marginTop: spacing.sm,
    padding: spacing.md,
  },
  inlineActions: { flexDirection: 'row', gap: spacing.md },
  dangerButton: {
    alignItems: 'center',
    backgroundColor: '#9B352D',
    borderRadius: radii.control,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
  dangerLabel: { color: colors.white, fontWeight: '700' },
  textButton: {
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
  textButtonLabel: { color: colors.tealDeep, fontWeight: '700' },
  disclaimer: {
    color: colors.inkSoft,
    fontSize: 14,
    lineHeight: 20,
  },
  pressed: { opacity: 0.65 },
})

const compactStyles = {
  ...baseStyles,
  sectionTitle: { ...baseStyles.sectionTitle, color: '#1A1C1E', fontSize: 15 },
  supporting: {
    ...baseStyles.supporting,
    color: '#5B6470',
    fontSize: 13,
    lineHeight: 19,
  },
  fieldLabel: { ...baseStyles.fieldLabel, fontSize: 13 },
  intensity: {
    ...baseStyles.intensity,
    flex: 1,
    minWidth: 0,
    minHeight: 36,
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.pill,
  },
  intensitySelected: {
    ...baseStyles.intensitySelected,
    backgroundColor: '#174A32',
  },
  contextToggle: {
    ...baseStyles.contextToggle,
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    marginTop: 0,
    padding: spacing.sm,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  contextToggleLabel: {
    ...baseStyles.contextToggleLabel,
    fontSize: 12,
    flex: 1,
  },
  coverage: { ...baseStyles.coverage, fontSize: 15 },
  missingNote: {
    ...baseStyles.missingNote,
    color: '#5B6470',
    fontSize: 12,
    lineHeight: 18,
  },
  periodRow: {
    ...baseStyles.periodRow,
    backgroundColor: '#E7EFEA',
    padding: 3,
    borderRadius: radii.pill,
  },
  periodButton: {
    ...baseStyles.periodButton,
    flex: 1,
    paddingHorizontal: spacing.xs,
    minHeight: 36,
    backgroundColor: 'transparent',
  },
  periodSelected: { backgroundColor: '#174A32' },
  periodLabel: { ...baseStyles.periodLabel, fontSize: 12 },
}

const dashboardFont = { fontFamily: 'DashboardSans' }

const dashboardFontStyles = {
  ...compactStyles,
  journalLabel: { ...compactStyles.journalLabel, ...dashboardFont },
  intensityBadge: { ...compactStyles.intensityBadge, ...dashboardFont },
  saveLabel: { ...compactStyles.saveLabel, ...dashboardFont },
  sectionTitle: { ...compactStyles.sectionTitle, ...dashboardFont },
  supporting: { ...compactStyles.supporting, ...dashboardFont },
  fieldLabel: { ...compactStyles.fieldLabel, ...dashboardFont },
  coverage: { ...compactStyles.coverage, ...dashboardFont },
  missingNote: { ...compactStyles.missingNote, ...dashboardFont },
  periodLabel: { ...compactStyles.periodLabel, ...dashboardFont },
  metricLabel: { ...compactStyles.metricLabel, ...dashboardFont },
  metricValue: { ...compactStyles.metricValue, ...dashboardFont },
  intensityLabel: { ...compactStyles.intensityLabel, ...dashboardFont },
  contextToggleLabel: { ...compactStyles.contextToggleLabel, ...dashboardFont },
  contextPrivacy: { ...compactStyles.contextPrivacy, ...dashboardFont },
  factorLabel: { ...compactStyles.factorLabel, ...dashboardFont },
  noteInput: { ...compactStyles.noteInput, ...dashboardFont },
  noteCount: { ...compactStyles.noteCount, ...dashboardFont },
  distributionLabel: { ...compactStyles.distributionLabel, ...dashboardFont },
  distributionCount: { ...compactStyles.distributionCount, ...dashboardFont },
  disclaimer: { ...compactStyles.disclaimer, ...dashboardFont },
  backLabel: { ...compactStyles.backLabel, ...dashboardFont },
}
