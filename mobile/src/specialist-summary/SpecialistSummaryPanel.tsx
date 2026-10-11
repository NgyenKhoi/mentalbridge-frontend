import { randomUUID } from 'expo-crypto'
import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { ApiError } from '@/api/api-error'
import { colors, radii, spacing, typography } from '@/theme/tokens'

import type { SpecialistSummaryApi } from './specialist-summary-api'
import type {
  AgreedNextStepType,
  PublishSessionSummaryRequest,
  SessionSummaryList,
} from './specialist-summary-contract'

type DraftStep = Readonly<{
  type: Exclude<AgreedNextStepType, 'PLATFORM_RESOURCE'>
  title: string
  details: string
}>

const STEP_TYPES: readonly {
  value: DraftStep['type']
  label: string
}[] = [
  { value: 'CHECKLIST', label: 'Việc cần làm' },
  { value: 'JOURNAL', label: 'Nhật ký' },
  { value: 'EMOTION_CHECK_IN', label: 'Ghi nhận cảm xúc' },
  { value: 'REASSESSMENT', label: 'Sàng lọc lại' },
  { value: 'FOLLOW_UP_APPOINTMENT', label: 'Lịch hẹn tiếp theo' },
]

function count(value: string) {
  return [...value].length
}

export function normalizeSummaryDraft(input: {
  topics: string
  progressSummary: string
  specialistNoteForUser: string
  followUpSuggested: boolean
  steps: DraftStep[]
}): PublishSessionSummaryRequest {
  const topicsDiscussed = input.topics
    .split('\n')
    .map((topic) => topic.trim())
    .filter(Boolean)
  if (
    topicsDiscussed.length < 1 ||
    topicsDiscussed.length > 8 ||
    topicsDiscussed.some((topic) => count(topic) > 160)
  ) {
    throw new Error('TOPICS_INVALID')
  }
  const progressSummary = input.progressSummary.trim()
  const specialistNoteForUser = input.specialistNoteForUser.trim()
  if (count(progressSummary) > 1000 || count(specialistNoteForUser) > 1000) {
    throw new Error('SUMMARY_TOO_LONG')
  }
  if (
    input.steps.length > 8 ||
    input.steps.some(
      (step) =>
        !step.title.trim() ||
        count(step.title.trim()) > 160 ||
        count(step.details.trim()) > 500,
    )
  ) {
    throw new Error('STEPS_INVALID')
  }
  return {
    topicsDiscussed,
    progressSummary: progressSummary || null,
    specialistNoteForUser: specialistNoteForUser || null,
    followUpSuggested: input.followUpSuggested,
    agreedNextSteps: input.steps.map((step) => ({
      type: step.type,
      title: step.title.trim(),
      details: step.details.trim() || null,
      resourceId: null,
      resourceVersion: null,
      resourceProposalReasonCode: null,
    })),
  }
}

function summaryError(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    return 'Phiên đăng nhập đã hết hạn.'
  }
  if (
    error instanceof ApiError &&
    (error.status === 403 || error.status === 404)
  ) {
    return 'Bạn không có quyền xem hoặc xuất bản tóm tắt cho lịch hẹn này.'
  }
  if (
    error instanceof ApiError &&
    (error.status === 409 || error.status === 412)
  ) {
    return 'Lịch hẹn hoặc bản tóm tắt vừa thay đổi. Cần tải lại trước khi tiếp tục.'
  }
  return 'Chưa thể hoàn tất thao tác. Nội dung bạn nhập vẫn được giữ để thử lại.'
}

export function SpecialistSummaryPanel({
  api,
  appointmentId,
  appointmentAuthorityConfirmed,
  refreshAppointmentAuthority,
}: Readonly<{
  api: SpecialistSummaryApi
  appointmentId: string
  appointmentAuthorityConfirmed: boolean
  refreshAppointmentAuthority: () => Promise<boolean>
}>) {
  const queryClient = useQueryClient()
  const queryKey = ['specialist-session-summaries', appointmentId] as const
  const [topics, setTopics] = useState('')
  const [progressSummary, setProgressSummary] = useState('')
  const [specialistNoteForUser, setSpecialistNoteForUser] = useState('')
  const [followUpSuggested, setFollowUpSuggested] = useState(false)
  const [steps, setSteps] = useState<DraftStep[]>([])
  const [editing, setEditing] = useState(false)
  const [notice, setNotice] = useState('')
  const [authorityRecovery, setAuthorityRecovery] = useState<
    'idle' | 'refreshing' | 'blocked'
  >('idle')
  const authorityLockedRef = useRef(false)
  const commandRef = useRef<{ signature: string; key: string } | null>(null)

  const summariesQuery = useQuery({
    queryKey,
    queryFn: () => api.list(appointmentId),
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  })
  const latest = summariesQuery.data?.items[0]

  const publishMutation = useMutation({
    mutationFn: (input: {
      request: PublishSessionSummaryRequest
      key: string
      version: number | undefined
    }) => api.publish(appointmentId, input.request, input.key, input.version),
  })

  const reconcileAuthority = async () => {
    authorityLockedRef.current = true
    setAuthorityRecovery('refreshing')
    const [summaries, appointmentOk] = await Promise.all([
      summariesQuery.refetch(),
      refreshAppointmentAuthority(),
    ])
    if (summaries.isError || !summaries.data || !appointmentOk) {
      setAuthorityRecovery('blocked')
      return false
    }
    authorityLockedRef.current = false
    setAuthorityRecovery('idle')
    return true
  }

  const governedBusy =
    !appointmentAuthorityConfirmed ||
    !summariesQuery.isSuccess ||
    summariesQuery.isFetching ||
    publishMutation.isPending ||
    authorityRecovery !== 'idle'

  const draftError = useMemo(() => {
    try {
      normalizeSummaryDraft({
        topics,
        progressSummary,
        specialistNoteForUser,
        followUpSuggested,
        steps,
      })
      return ''
    } catch (error) {
      if (error instanceof Error && error.message === 'TOPICS_INVALID') {
        return 'Nhập từ 1 đến 8 chủ đề, mỗi chủ đề trên một dòng và không quá 160 ký tự.'
      }
      if (error instanceof Error && error.message === 'SUMMARY_TOO_LONG') {
        return 'Mỗi phần tóm tắt hoặc lời nhắn không được quá 1.000 ký tự.'
      }
      return 'Mỗi bước cần có tên, tối đa 160 ký tự; chi tiết tối đa 500 ký tự.'
    }
  }, [followUpSuggested, progressSummary, specialistNoteForUser, steps, topics])

  const publish = async () => {
    if (governedBusy || authorityLockedRef.current || draftError) return
    const request = normalizeSummaryDraft({
      topics,
      progressSummary,
      specialistNoteForUser,
      followUpSuggested,
      steps,
    })
    const version = latest?.version
    const signature = JSON.stringify({ appointmentId, version, request })
    const command =
      commandRef.current?.signature === signature
        ? commandRef.current
        : { signature, key: randomUUID() }
    commandRef.current = command
    setNotice('')
    try {
      const saved = await publishMutation.mutateAsync({
        request,
        key: command.key,
        version,
      })
      queryClient.setQueryData<SessionSummaryList>(queryKey, (current) => ({
        items: [saved, ...(current?.items ?? [])],
        count: (current?.count ?? 0) + 1,
        generatedAt: saved.publishedAt,
      }))
      const reconciled = await reconcileAuthority()
      if (reconciled) {
        commandRef.current = null
        setEditing(false)
        setNotice('Đã xuất bản tóm tắt và các bước đã thống nhất.')
      }
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.status === 409 || error.status === 412 || error.status === 428)
      ) {
        await reconcileAuthority()
      }
      if (
        error instanceof ApiError &&
        error.code === 'SESSION_SUMMARY_IDEMPOTENCY_CONFLICT'
      ) {
        commandRef.current = null
      }
      setNotice(summaryError(error))
    }
  }

  return (
    <View style={styles.panel}>
      <View style={styles.heading}>
        <Text style={styles.title}>Tóm tắt sau phiên</Text>
        <Text style={styles.copy}>
          Xuất bản nội dung người dùng có thể xem và các bước hai bên đã thống
          nhất. Mỗi lần đính chính tạo một phiên bản mới.
        </Text>
      </View>

      {summariesQuery.isFetching || authorityRecovery === 'refreshing' ? (
        <Text accessibilityLiveRegion="polite" style={styles.state}>
          Đang xác nhận bản tóm tắt mới nhất…
        </Text>
      ) : null}
      {summariesQuery.isError || authorityRecovery === 'blocked' ? (
        <View style={styles.noticeBox}>
          <Text accessibilityRole="alert" style={styles.copy}>
            {authorityRecovery === 'blocked'
              ? 'Chưa thể tải lại đầy đủ. Tính năng xuất bản đang được khóa để không dùng phiên bản cũ.'
              : summaryError(summariesQuery.error)}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void reconcileAuthority()}
            style={styles.linkButton}
          >
            <Text style={styles.linkLabel}>Tải lại an toàn</Text>
          </Pressable>
        </View>
      ) : null}

      {notice ? (
        <Text accessibilityLiveRegion="polite" style={styles.state}>
          {notice}
        </Text>
      ) : null}

      {latest ? (
        <View style={styles.published}>
          <Text style={styles.version}>
            Bản đã xuất bản · phiên bản {latest.version}
          </Text>
          <Text style={styles.label}>Chủ đề đã trao đổi</Text>
          {latest.topicsDiscussed.map((topic) => (
            <Text key={topic} style={styles.copy}>
              • {topic}
            </Text>
          ))}
          {latest.progressSummary ? (
            <Text style={styles.copy}>{latest.progressSummary}</Text>
          ) : null}
          {latest.specialistNoteForUser ? (
            <Text style={styles.copy}>{latest.specialistNoteForUser}</Text>
          ) : null}
          {latest.agreedNextSteps.length > 0 ? (
            <View style={styles.steps}>
              <Text style={styles.label}>Các bước đã thống nhất</Text>
              {latest.agreedNextSteps.map((step) => (
                <Text key={step.id} style={styles.copy}>
                  • {step.title}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : summariesQuery.isSuccess && !summariesQuery.isFetching ? (
        <Text style={styles.state}>Chưa có bản tóm tắt được xuất bản.</Text>
      ) : null}

      {summariesQuery.isSuccess && !editing ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: governedBusy }}
          disabled={governedBusy}
          onPress={() => setEditing(true)}
          style={[styles.primaryButton, governedBusy && styles.disabled]}
        >
          <Text style={styles.primaryLabel}>
            {latest ? 'Tạo bản đính chính' : 'Tạo tóm tắt sau phiên'}
          </Text>
        </Pressable>
      ) : null}

      {editing ? (
        <View style={styles.form}>
          <Text style={styles.label}>Chủ đề đã trao đổi</Text>
          <TextInput
            accessibilityLabel="Chủ đề đã trao đổi"
            multiline
            onChangeText={setTopics}
            placeholder="Mỗi chủ đề trên một dòng"
            style={styles.input}
            value={topics}
          />
          <Text style={styles.label}>Tiến triển được ghi nhận</Text>
          <TextInput
            accessibilityLabel="Tiến triển được ghi nhận"
            multiline
            onChangeText={setProgressSummary}
            style={styles.input}
            value={progressSummary}
          />
          <Text style={styles.label}>Lời nhắn cho người dùng</Text>
          <TextInput
            accessibilityLabel="Lời nhắn cho người dùng"
            multiline
            onChangeText={setSpecialistNoteForUser}
            style={styles.input}
            value={specialistNoteForUser}
          />
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: followUpSuggested }}
            onPress={() => setFollowUpSuggested((value) => !value)}
            style={styles.checkbox}
          >
            <Text style={styles.checkboxMark}>
              {followUpSuggested ? '✓' : '○'}
            </Text>
            <Text style={styles.copy}>Đề xuất một buổi trao đổi tiếp theo</Text>
          </Pressable>

          <Text style={styles.label}>Các bước đã thống nhất</Text>
          {steps.map((step, index) => (
            <View key={index} style={styles.stepEditor}>
              <View style={styles.stepTypes}>
                {STEP_TYPES.map((option) => (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{
                      selected: step.type === option.value,
                    }}
                    key={option.value}
                    onPress={() =>
                      setSteps((current) =>
                        current.map((item, position) =>
                          position === index
                            ? { ...item, type: option.value }
                            : item,
                        ),
                      )
                    }
                    style={[
                      styles.typeButton,
                      step.type === option.value && styles.typeButtonSelected,
                    ]}
                  >
                    <Text
                      style={
                        step.type === option.value
                          ? styles.typeLabelSelected
                          : styles.typeLabel
                      }
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                accessibilityLabel={`Tên bước ${index + 1}`}
                onChangeText={(value) =>
                  setSteps((current) =>
                    current.map((item, position) =>
                      position === index ? { ...item, title: value } : item,
                    ),
                  )
                }
                placeholder="Tên bước"
                style={styles.input}
                value={step.title}
              />
              <TextInput
                accessibilityLabel={`Chi tiết bước ${index + 1}`}
                multiline
                onChangeText={(value) =>
                  setSteps((current) =>
                    current.map((item, position) =>
                      position === index ? { ...item, details: value } : item,
                    ),
                  )
                }
                placeholder="Chi tiết (không bắt buộc)"
                style={styles.input}
                value={step.details}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  setSteps((current) =>
                    current.filter((_, position) => position !== index),
                  )
                }
                style={styles.linkButton}
              >
                <Text style={styles.removeLabel}>Xóa bước này</Text>
              </Pressable>
            </View>
          ))}
          {steps.length < 8 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                setSteps((current) => [
                  ...current,
                  { type: 'CHECKLIST', title: '', details: '' },
                ])
              }
              style={styles.linkButton}
            >
              <Text style={styles.linkLabel}>+ Thêm bước tiếp theo</Text>
            </Pressable>
          ) : null}
          {draftError ? (
            <Text style={styles.validation}>{draftError}</Text>
          ) : null}
          <View style={styles.formActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{
                disabled: governedBusy || Boolean(draftError),
              }}
              disabled={governedBusy || Boolean(draftError)}
              onPress={() => void publish()}
              style={[
                styles.primaryButton,
                (governedBusy || Boolean(draftError)) && styles.disabled,
              ]}
            >
              <Text style={styles.primaryLabel}>
                {latest ? 'Xuất bản bản đính chính' : 'Xuất bản tóm tắt'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={publishMutation.isPending}
              onPress={() => setEditing(false)}
              style={styles.linkButton}
            >
              <Text style={styles.linkLabel}>Đóng trình soạn</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.panel,
    borderWidth: 1,
    gap: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.xl,
  },
  heading: { gap: spacing.sm },
  title: { color: colors.ink, fontSize: 20, fontWeight: '700' },
  copy: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  state: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  noticeBox: { gap: spacing.sm },
  linkButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  linkLabel: {
    color: colors.tealDeep,
    fontSize: typography.body,
    fontWeight: '700',
  },
  removeLabel: {
    color: colors.terracotta,
    fontSize: typography.body,
    fontWeight: '700',
  },
  published: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.control,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  version: { color: colors.tealDeep, fontSize: 13, fontWeight: '800' },
  label: { color: colors.ink, fontSize: typography.body, fontWeight: '700' },
  steps: { gap: spacing.sm, marginTop: spacing.sm },
  primaryButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.tealDeep,
    borderRadius: radii.control,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  primaryLabel: {
    color: colors.white,
    fontSize: typography.body,
    fontWeight: '700',
  },
  disabled: { opacity: 0.5 },
  form: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    gap: spacing.md,
    paddingTop: spacing.lg,
  },
  input: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: radii.control,
    borderWidth: 1,
    color: colors.ink,
    fontSize: typography.body,
    minHeight: 48,
    padding: spacing.md,
    textAlignVertical: 'top',
  },
  checkbox: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 44,
  },
  checkboxMark: { color: colors.tealDeep, fontSize: 22, fontWeight: '700' },
  stepEditor: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.control,
    gap: spacing.sm,
    padding: spacing.md,
  },
  stepTypes: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  typeButton: {
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  typeButtonSelected: {
    backgroundColor: colors.tealDeep,
    borderColor: colors.tealDeep,
  },
  typeLabel: { color: colors.tealDeep, fontSize: 13, fontWeight: '700' },
  typeLabelSelected: { color: colors.white, fontSize: 13, fontWeight: '700' },
  validation: { color: colors.terracotta, fontSize: 14, lineHeight: 20 },
  formActions: { alignItems: 'flex-start', gap: spacing.sm },
})
