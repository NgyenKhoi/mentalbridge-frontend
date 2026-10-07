import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { ApiError } from '@/api/api-error'
import { useSession } from '@/auth/session-context'
import { PrimaryButton } from '@/components/PrimaryButton'
import { Screen } from '@/components/Screen'
import { colors, radii, spacing, typography } from '@/theme/tokens'

import type { ResourceApi } from './resource-api'
import type {
  ResourceProgressItem,
  ResourceProgressUpdate,
} from './resource-contract'
import {
  localDateInTimeZone,
  resourceActions,
  resourceFormat,
  resourceTimerSeconds,
  structuredResourceContent,
} from './resource-model'

function safeExternalUrl(value: string | null | undefined) {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
      ? url.toString()
      : null
  } catch {
    return null
  }
}

function progressErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    return 'Phiên đăng nhập đã hết hạn. Đăng nhập lại để tiếp tục.'
  }
  if (error instanceof ApiError && error.status === 403) {
    return 'Tài khoản này không có quyền cập nhật tiến độ.'
  }
  if (error instanceof ApiError && error.status === 404) {
    return 'Tài nguyên này không còn khả dụng để cập nhật tiến độ.'
  }
  return 'Chưa thể lưu tiến độ. Lựa chọn của bạn vẫn được giữ để thử lại.'
}

function StateMessage({
  children,
  tone = 'neutral',
}: Readonly<{
  children: string
  tone?: 'neutral' | 'error' | 'success'
}>) {
  return (
    <Text
      accessibilityLiveRegion={tone === 'neutral' ? 'polite' : 'assertive'}
      style={[
        styles.message,
        tone === 'error' && styles.errorText,
        tone === 'success' && styles.successText,
      ]}
    >
      {children}
    </Text>
  )
}

export function ResourceDetailScreen({
  api,
  resourceId,
  activityDate,
  now = () => new Date(),
  timezone: timezoneOverride,
  onBack,
}: Readonly<{
  api: ResourceApi
  resourceId: string
  activityDate?: string
  now?: () => Date
  timezone?: string
  onBack: () => void
}>) {
  const { session, signOut } = useSession()
  const queryClient = useQueryClient()
  const subject = session?.subject
  const isUser = session?.role === 'USER'
  const timezone = useMemo(
    () =>
      timezoneOverride ??
      Intl.DateTimeFormat().resolvedOptions().timeZone ??
      'UTC',
    [timezoneOverride],
  )
  const today = useMemo(
    () => localDateInTimeZone(now(), timezone),
    [now, timezone],
  )
  const localDate = /^\d{4}-\d{2}-\d{2}$/.test(activityDate ?? '')
    ? (activityDate as string)
    : today
  const resourceKey = ['resource', resourceId, 'vi-VN'] as const
  const progressKey = [
    'resource-progress',
    subject,
    localDate,
    localDate,
  ] as const
  const [completedActionIds, setCompletedActionIds] = useState<string[]>([])
  const [notice, setNotice] = useState<{
    message: string
    tone: 'error' | 'success'
  } | null>(null)
  const [videoOpened, setVideoOpened] = useState(false)
  const [timerState, setTimerState] = useState<{
    resourceId: string
    remaining: number
    running: boolean
  } | null>(null)
  const syncedProgressKey = useRef<string | undefined>(undefined)
  const timerCompletionSent = useRef(false)

  const resourceQuery = useQuery({
    queryKey: resourceKey,
    enabled: Boolean(subject && isUser && resourceId),
    queryFn: () => api.getResource(resourceId, 'vi-VN'),
  })
  const progressQuery = useQuery({
    queryKey: progressKey,
    enabled: Boolean(subject && isUser && resourceId),
    refetchOnMount: 'always',
    queryFn: () => api.listProgress(localDate, localDate),
  })
  const resource = resourceQuery.data
  const savedProgress = progressQuery.data?.find(
    (item) => item.resourceId === resourceId,
  )
  const actions = useMemo(
    () => (resource ? resourceActions(resource) : []),
    [resource],
  )
  const timerSeconds = useMemo(
    () => (resource ? resourceTimerSeconds(resource) : undefined),
    [resource],
  )

  useEffect(() => {
    if (!subject || !progressQuery.isSuccess) return
    const syncKey = savedProgress
      ? `${subject}:${localDate}:${resourceId}:${savedProgress.version}:${savedProgress.updatedAt}`
      : `${subject}:${localDate}:${resourceId}:empty`
    if (syncedProgressKey.current === syncKey) return
    syncedProgressKey.current = syncKey
    setCompletedActionIds(savedProgress?.completedActionIds ?? [])
  }, [localDate, progressQuery.isSuccess, resourceId, savedProgress, subject])

  const saveMutation = useMutation({
    mutationFn: (update: ResourceProgressUpdate) =>
      api.saveProgress(resourceId, localDate, update),
    onSuccess: async (saved) => {
      queryClient.setQueryData<ResourceProgressItem[]>(
        progressKey,
        (current = []) => [
          ...current.filter((item) => item.resourceId !== saved.resourceId),
          saved,
        ],
      )
      syncedProgressKey.current = `${subject ?? 'no-subject'}:${localDate}:${resourceId}:${saved.version}:${saved.updatedAt}`
      setCompletedActionIds(saved.completedActionIds)
      setNotice({ message: 'Đã lưu tiến độ.', tone: 'success' })
      await queryClient.invalidateQueries({
        queryKey: ['resource-progress', subject],
      })
    },
    onError: (error) => {
      setNotice({ message: progressErrorMessage(error), tone: 'error' })
    },
  })

  const activeTimer =
    timerState?.resourceId === resource?.id ? timerState : undefined
  const timerRemaining = activeTimer?.remaining ?? timerSeconds ?? null
  const timerRunning = activeTimer?.running ?? false

  useEffect(() => {
    if (!activeTimer?.running || activeTimer.remaining <= 0) return
    const timeout = setTimeout(
      () =>
        setTimerState((value) =>
          value && value.resourceId === activeTimer.resourceId
            ? { ...value, remaining: Math.max(0, value.remaining - 1) }
            : value,
        ),
      1000,
    )
    return () => clearTimeout(timeout)
  }, [activeTimer])

  useEffect(() => {
    if (
      !timerRunning ||
      timerRemaining !== 0 ||
      timerCompletionSent.current ||
      saveMutation.isPending
    ) {
      return
    }
    timerCompletionSent.current = true
    setTimerState((value) => (value ? { ...value, running: false } : value))
    saveMutation.mutate({
      status: 'COMPLETED',
      completedActionIds: actions.map((action) => action.id),
    })
  }, [actions, saveMutation, timerRemaining, timerRunning])

  if (!subject || !isUser) {
    const unauthenticated = !subject
    return (
      <Screen>
        <Text accessibilityRole="header" style={styles.title}>
          Chi tiết tài nguyên
        </Text>
        <StateMessage tone="error">
          {unauthenticated
            ? 'Bạn cần đăng nhập bằng tài khoản cá nhân để xem tài nguyên.'
            : 'Tài khoản này không có quyền xem tài nguyên dành cho người dùng.'}
        </StateMessage>
        <PrimaryButton
          label={unauthenticated ? 'Đăng nhập lại' : 'Quay lại'}
          onPress={() => {
            if (unauthenticated) void signOut()
            else onBack()
          }}
        />
      </Screen>
    )
  }

  const permissionError = [resourceQuery.error, progressQuery.error].find(
    (error) =>
      error instanceof ApiError &&
      (error.status === 401 || error.status === 403),
  )
  if (permissionError) {
    const unauthorized =
      permissionError instanceof ApiError && permissionError.status === 401
    return (
      <Screen>
        <Text accessibilityRole="header" style={styles.title}>
          Chi tiết tài nguyên
        </Text>
        <StateMessage tone="error">
          {progressErrorMessage(permissionError)}
        </StateMessage>
        <PrimaryButton
          label={unauthorized ? 'Đăng nhập lại' : 'Quay lại'}
          onPress={() => {
            if (unauthorized) void signOut()
            else onBack()
          }}
        />
      </Screen>
    )
  }

  if (resourceQuery.isPending) {
    return (
      <Screen>
        <View accessibilityLiveRegion="polite" style={styles.loadingRow}>
          <ActivityIndicator
            accessibilityLabel="Đang tải tài nguyên"
            color={colors.tealDeep}
          />
          <Text style={styles.supporting}>Đang chuẩn bị nội dung…</Text>
        </View>
      </Screen>
    )
  }

  if (resourceQuery.isError || !resource) {
    const unavailable =
      resourceQuery.error instanceof ApiError &&
      resourceQuery.error.status === 404
    return (
      <Screen>
        <Text accessibilityRole="header" style={styles.title}>
          {unavailable
            ? 'Tài nguyên không còn khả dụng'
            : 'Chưa thể tải tài nguyên'}
        </Text>
        <StateMessage tone="error">
          {unavailable
            ? 'Nội dung có thể đã được lưu trữ hoặc không còn trong thời gian phát hành.'
            : 'Tiến độ đã lưu của bạn không bị thay đổi. Hãy thử lại sau.'}
        </StateMessage>
        <PrimaryButton label="Quay lại danh sách" onPress={onBack} />
      </Screen>
    )
  }

  const content = structuredResourceContent(resource)
  const externalUrl = safeExternalUrl(resource.externalUrl)
  const isVideo = resource.completionMode === 'VIDEO_CONFIRMATION'
  const isTimed = resource.completionMode === 'TIMED'
  const isSteps = resource.completionMode === 'STEPS'
  const interactionUnsupported =
    (isSteps && actions.length === 0) ||
    (isTimed && (actions.length === 0 || timerSeconds === undefined)) ||
    (isVideo && !externalUrl)
  const completed = savedProgress?.status === 'COMPLETED'
  const allStepsSelected =
    actions.length > 0 &&
    actions.every((action) => completedActionIds.includes(action.id))
  const canSave =
    progressQuery.isSuccess &&
    !interactionUnsupported &&
    !saveMutation.isPending &&
    (!isSteps || allStepsSelected) &&
    (!isVideo || videoOpened || completed) &&
    !isTimed

  async function toggleAction(actionId: string) {
    if (!progressQuery.isSuccess || saveMutation.isPending) return
    const next = completedActionIds.includes(actionId)
      ? completedActionIds.filter((id) => id !== actionId)
      : [...completedActionIds, actionId]
    setCompletedActionIds(next)
    setNotice(null)
    saveMutation.mutate({
      status: completed ? 'COMPLETED' : 'IN_PROGRESS',
      completedActionIds: next,
    })
  }

  async function openVideo() {
    if (!externalUrl) return
    setNotice(null)
    try {
      const supported = await Linking.canOpenURL(externalUrl)
      if (!supported) throw new Error('Unsupported URL')
      await Linking.openURL(externalUrl)
      setVideoOpened(true)
    } catch {
      setNotice({
        message: 'Chưa thể mở video trên thiết bị này. Hãy thử lại sau.',
        tone: 'error',
      })
    }
  }

  function completeResource() {
    saveMutation.mutate({
      status: 'COMPLETED',
      completedActionIds: isSteps
        ? actions.map((action) => action.id)
        : completedActionIds,
    })
  }

  function startTimer() {
    if (!timerSeconds || saveMutation.isPending) return
    timerCompletionSent.current = false
    setTimerState({
      resourceId,
      remaining: timerSeconds,
      running: true,
    })
    setNotice(null)
  }

  return (
    <Screen>
      <Pressable
        accessibilityRole="button"
        onPress={onBack}
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
      >
        <Text style={styles.backLabel}>← Quay lại tài nguyên</Text>
      </Pressable>

      <Text style={styles.eyebrow}>
        {resourceFormat(resource).toUpperCase()}
      </Text>
      <Text accessibilityRole="header" style={styles.title}>
        {resource.title}
      </Text>
      <Text style={styles.description}>{resource.summary}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.meta}>{resource.expectedDurationMinutes} phút</Text>
        <Text style={styles.meta}>
          {completed ? 'Đã hoàn thành' : 'Chưa hoàn thành'}
        </Text>
      </View>

      {content.overview && (
        <View style={styles.panel}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Tổng quan
          </Text>
          <Text style={styles.body}>{content.overview}</Text>
          {content.whenUseful && (
            <Text style={styles.callout}>{content.whenUseful}</Text>
          )}
        </View>
      )}

      {content.keyIdeas.length > 0 && (
        <View style={styles.panel}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Điều cần nhớ
          </Text>
          {content.keyIdeas.map((idea) => (
            <Text key={idea} style={styles.listItem}>
              • {idea}
            </Text>
          ))}
        </View>
      )}

      {content.steps.length > 0 && actions.length === 0 && (
        <View style={styles.panel}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Các bước gợi ý
          </Text>
          {content.steps.map((step, index) => (
            <Text key={`${index}:${step}`} style={styles.listItem}>
              {index + 1}. {step}
            </Text>
          ))}
        </View>
      )}

      <View style={styles.panel}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          {isVideo
            ? 'Xem nội dung'
            : isTimed
              ? 'Thực hành theo thời gian'
              : isSteps
                ? 'Thực hiện từng bước'
                : 'Ghi nhận hoàn thành'}
        </Text>

        {progressQuery.isPending ? (
          <View accessibilityLiveRegion="polite" style={styles.loadingRow}>
            <ActivityIndicator color={colors.tealDeep} />
            <Text style={styles.supporting}>Đang tải tiến độ…</Text>
          </View>
        ) : progressQuery.isError ? (
          <View>
            <StateMessage tone="error">
              Chưa thể tải tiến độ. Nội dung vẫn có thể đọc, nhưng cập nhật đang
              tạm dừng để tránh ghi đè dữ liệu đã lưu.
            </StateMessage>
            <PrimaryButton
              label="Thử tải tiến độ"
              onPress={() => void progressQuery.refetch()}
            />
          </View>
        ) : interactionUnsupported ? (
          <StateMessage tone="error">
            Hoạt động này chưa hỗ trợ đầy đủ trên ứng dụng. Bạn vẫn có thể đọc
            nội dung và quay lại sau.
          </StateMessage>
        ) : (
          <>
            {actions.length > 0 && !isTimed && (
              <View style={styles.actionList}>
                {actions.map((action) => {
                  const checked = completedActionIds.includes(action.id)
                  return (
                    <Pressable
                      key={action.id}
                      accessibilityLabel={action.label}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked }}
                      disabled={saveMutation.isPending}
                      onPress={() => void toggleAction(action.id)}
                      style={({ pressed }) => [
                        styles.checkRow,
                        checked && styles.checkRowSelected,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.checkMark}>
                        {checked ? '✓' : '○'}
                      </Text>
                      <Text style={styles.checkLabel}>{action.label}</Text>
                    </Pressable>
                  )
                })}
              </View>
            )}

            {isVideo && (
              <PrimaryButton
                label={videoOpened ? 'Mở lại video' : 'Mở video đã rà soát'}
                onPress={() => void openVideo()}
              />
            )}

            {isTimed && (
              <View>
                <Text accessibilityLiveRegion="polite" style={styles.timer}>
                  {timerRemaining === null
                    ? 'Sẵn sàng'
                    : `${Math.floor(timerRemaining / 60)}:${String(
                        timerRemaining % 60,
                      ).padStart(2, '0')}`}
                </Text>
                <PrimaryButton
                  disabled={timerRunning || saveMutation.isPending}
                  label={
                    timerRunning
                      ? 'Đang thực hành…'
                      : completed
                        ? 'Thực hành lại'
                        : 'Bắt đầu thực hành'
                  }
                  onPress={startTimer}
                />
              </View>
            )}

            {!isTimed && (
              <PrimaryButton
                disabled={!canSave || completed}
                label={
                  saveMutation.isPending
                    ? 'Đang lưu…'
                    : completed
                      ? 'Đã hoàn thành'
                      : isVideo
                        ? 'Xác nhận đã xem nội dung'
                        : 'Đánh dấu hoàn thành'
                }
                onPress={completeResource}
              />
            )}
          </>
        )}

        {notice && (
          <StateMessage tone={notice.tone}>{notice.message}</StateMessage>
        )}
      </View>

      {resource.safetyNotes.length > 0 && (
        <View style={styles.safetyPanel}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Lưu ý để thực hiện vừa sức
          </Text>
          {resource.safetyNotes.map((note) => (
            <Text key={note} style={styles.listItem}>
              • {note}
            </Text>
          ))}
        </View>
      )}

      {content.nextStep && (
        <Text style={styles.nextStep}>{content.nextStep}</Text>
      )}
      {resource.sourceOrganization && (
        <Text style={styles.source}>Nguồn: {resource.sourceOrganization}</Text>
      )}
      <Text style={styles.disclaimer}>
        Hoàn thành tài nguyên chỉ ghi nhận hoạt động bạn đã thực hiện, không
        phải đánh giá cải thiện sức khỏe hay mức độ tuân thủ kế hoạch.
      </Text>
    </Screen>
  )
}

const styles = StyleSheet.create({
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
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.ink,
    fontSize: typography.heading,
    fontWeight: '700',
    lineHeight: typography.headingLineHeight,
    marginBottom: spacing.md,
  },
  description: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
    marginBottom: spacing.lg,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  meta: {
    backgroundColor: colors.tealPale,
    borderRadius: radii.pill,
    color: colors.tealDeep,
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.panel,
    borderWidth: 1,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  safetyPanel: {
    backgroundColor: '#FFF7E8',
    borderColor: 'rgba(225, 166, 81, 0.35)',
    borderRadius: radii.panel,
    borderWidth: 1,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 28,
    marginBottom: spacing.md,
  },
  body: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  callout: {
    color: colors.tealDeep,
    fontSize: typography.body,
    fontWeight: '600',
    lineHeight: typography.bodyLineHeight,
    marginTop: spacing.md,
  },
  listItem: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
    marginBottom: spacing.sm,
  },
  actionList: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  checkRow: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: radii.control,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 52,
    padding: spacing.md,
  },
  checkRowSelected: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.teal,
  },
  checkMark: {
    color: colors.tealDeep,
    fontSize: 20,
    fontWeight: '800',
    width: 24,
  },
  checkLabel: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  timer: {
    color: colors.tealDeep,
    fontSize: 34,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
    marginBottom: spacing.lg,
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  supporting: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  message: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
    marginTop: spacing.md,
  },
  errorText: {
    color: '#9B352D',
  },
  successText: {
    color: colors.tealDeep,
    fontWeight: '700',
  },
  nextStep: {
    color: colors.tealDeep,
    fontSize: typography.body,
    fontWeight: '600',
    lineHeight: typography.bodyLineHeight,
    marginBottom: spacing.md,
  },
  source: {
    color: colors.inkFaint,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: spacing.md,
  },
  disclaimer: {
    color: colors.inkFaint,
    fontSize: 14,
    lineHeight: 21,
  },
  pressed: {
    opacity: 0.7,
  },
})
