import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { randomUUID } from 'expo-crypto'
import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { ApiError } from '@/api/api-error'
import { useSession } from '@/auth/session-context'
import { PrimaryButton } from '@/components/PrimaryButton'
import { Screen } from '@/components/Screen'
import { colors, radii, spacing, typography } from '@/theme/tokens'

import type { SpecialistApi } from './specialist-api'
import type {
  AvailabilityModality,
  AvailabilitySlot,
  AvailabilitySlotList,
  PublishAvailabilityRequest,
} from './specialist-contract'
import {
  availabilityReadinessLabels,
  availabilitySignature,
  defaultTimezone,
  formatAvailabilitySlot,
  localSlotToUtc,
  profileState,
  specialistProfileStatusLabels,
} from './specialist-model'

type AuthorityRecovery = 'idle' | 'refreshing' | 'blocked'

type AvailabilityForm = Readonly<{
  date: string
  startTime: string
  timezone: string
  modality: AvailabilityModality
}>

type RuntimeNotice = Readonly<{
  message: string
  tone: 'error' | 'success'
}>

type StableCommand = Readonly<{ signature: string; key: string }>

const authorityRefreshCodes = new Set([
  'SPECIALIST_NOT_APPROVED',
  'AVAILABILITY_SLOT_NOT_FOUND',
  'AVAILABILITY_SLOT_STALE',
  'AVAILABILITY_SLOT_VERSION_MISMATCH',
  'AVAILABILITY_SLOT_VERSION_REQUIRED',
  'AVAILABILITY_SLOT_WITHDRAWN',
])

function isMissingProfile(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 404 &&
    error.code === 'SPECIALIST_PROFILE_NOT_FOUND'
  )
}

function availabilityErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'AVAILABILITY_SLOT_OVERLAP':
        return 'Khung giờ này trùng với một khung giờ đang hoạt động. Hãy chọn thời gian khác.'
      case 'VIDEO_AVAILABILITY_DISABLED':
        return 'Tư vấn video chưa được bật. Hãy chọn chat trong ứng dụng.'
      case 'SPECIALIST_NOT_APPROVED':
        return 'Hồ sơ cần được phê duyệt trước khi bạn xuất bản lịch khả dụng.'
      case 'IDEMPOTENCY_KEY_REUSED':
        return 'Lần gửi này xung đột với một yêu cầu trước. Hãy kiểm tra lại thời gian rồi thử lại.'
      case 'AVAILABILITY_SLOT_VERSION_MISMATCH':
        return 'Khung giờ vừa thay đổi. Đang tải lại danh sách mới nhất.'
      case 'AVAILABILITY_SLOT_WITHDRAWN':
        return 'Khung giờ này đã được rút. Đang tải lại danh sách mới nhất.'
      case 'AVAILABILITY_SLOT_STALE':
        return 'Khung giờ đã bắt đầu nên không thể rút. Đang tải lại danh sách mới nhất.'
      case 'AVAILABILITY_SLOT_NOT_FOUND':
        return 'Không tìm thấy khung giờ này. Đang tải lại danh sách mới nhất.'
      case 'AVAILABILITY_SLOT_VERSION_REQUIRED':
        return 'Chưa thể xác nhận phiên bản khung giờ. Đang tải lại danh sách mới nhất.'
      case 'VALIDATION_FAILED':
        return 'Thông tin khung giờ chưa hợp lệ. Kiểm tra ngày, giờ và múi giờ.'
    }
    if (error.status === 401) {
      return 'Phiên đăng nhập đã hết hạn. Đăng nhập lại để quản lý lịch.'
    }
    if (error.status === 403) {
      return 'Tài khoản này không có quyền quản lý lịch chuyên gia.'
    }
    if (error.status === undefined || error.status >= 500) {
      return 'Chưa xác nhận được kết quả. Bạn có thể thử lại an toàn với cùng khung giờ.'
    }
  }
  return 'Chưa thể hoàn tất yêu cầu. Kiểm tra kết nối rồi thử lại.'
}

function StateMessage({
  message,
  tone,
}: Readonly<{ message: string; tone: 'error' | 'success' }>) {
  return (
    <Text
      accessibilityLiveRegion={tone === 'error' ? 'assertive' : 'polite'}
      style={[
        styles.runtimeMessage,
        tone === 'error' ? styles.errorMessage : styles.successMessage,
      ]}
    >
      {message}
    </Text>
  )
}

function replaceSlot(
  list: AvailabilitySlotList | undefined,
  slot: AvailabilitySlot,
): AvailabilitySlotList | undefined {
  if (!list) return list
  const exists = list.items.some((item) => item.id === slot.id)
  return {
    ...list,
    count: exists ? list.count : list.count + 1,
    items: [slot, ...list.items.filter((item) => item.id !== slot.id)],
  }
}

function modalityLabel(modality: AvailabilityModality): string {
  return modality === 'IN_APP_CHAT'
    ? 'Chat trong ứng dụng'
    : 'Video trong ứng dụng'
}

function ModalityChoice({
  disabled,
  label,
  onPress,
  selected,
}: Readonly<{
  disabled: boolean
  label: string
  onPress: () => void
  selected: boolean
}>) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.modalityChoice,
        selected && styles.modalityChoiceSelected,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.modalityChoiceLabel,
          selected && styles.modalityChoiceLabelSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

export function SpecialistAvailabilityScreen({
  api,
}: Readonly<{ api: SpecialistApi }>) {
  const { session, signOut } = useSession()
  const queryClient = useQueryClient()
  const subject = session?.subject
  const profileKey = ['specialist-profile', subject] as const
  const availabilityKey = ['specialist-availability', subject] as const
  const commandRef = useRef<StableCommand | null>(null)
  const authorityLockedRef = useRef(false)
  const activeSubjectRef = useRef(subject)
  const [seededProfileVersion, setSeededProfileVersion] = useState<
    number | null
  >(null)
  const [form, setForm] = useState<AvailabilityForm>({
    date: '',
    startTime: '',
    timezone: defaultTimezone(),
    modality: 'IN_APP_CHAT',
  })
  const [formError, setFormError] = useState<string | null>(null)
  const [runtimeNotice, setRuntimeNotice] = useState<RuntimeNotice | null>(null)
  const [authorityRecovery, setAuthorityRecovery] =
    useState<AuthorityRecovery>('idle')
  const [confirmingSlotId, setConfirmingSlotId] = useState<string | null>(null)

  useEffect(() => {
    activeSubjectRef.current = subject
  }, [subject])

  const profileQuery = useQuery({
    queryKey: profileKey,
    enabled: Boolean(subject),
    refetchOnMount: 'always',
    queryFn: async () => {
      try {
        return await api.getProfile()
      } catch (error) {
        if (isMissingProfile(error)) return null
        throw error
      }
    },
  })

  const availabilityQuery = useQuery({
    queryKey: availabilityKey,
    enabled: Boolean(subject) && profileQuery.isSuccess,
    refetchOnMount: 'always',
    queryFn: () => api.listAvailability(),
  })

  const profile = profileQuery.data ?? null
  const state = profileState(profile)
  const profileApproved = state === 'APPROVED'
  const list = availabilityQuery.data

  if (profile && seededProfileVersion !== profile.version) {
    setSeededProfileVersion(profile.version)
    setForm((current) => ({
      ...current,
      timezone: profile.timezone,
    }))
  }

  useEffect(() => {
    commandRef.current = null
  }, [profile?.version])

  const selectedModality =
    list && !list.videoPublishingEnabled ? 'IN_APP_CHAT' : form.modality

  const refreshAuthority = async (message: string) => {
    const recoverySubject = subject
    authorityLockedRef.current = true
    setAuthorityRecovery('refreshing')
    setRuntimeNotice({ message, tone: 'error' })
    const [profileResult, availabilityResult] = await Promise.all([
      profileQuery.refetch(),
      availabilityQuery.refetch(),
    ])
    if (activeSubjectRef.current !== recoverySubject) return
    if (profileResult.isSuccess && availabilityResult.isSuccess) {
      authorityLockedRef.current = false
      setAuthorityRecovery('idle')
      setConfirmingSlotId(null)
      setRuntimeNotice({
        message: 'Đã tải hồ sơ và lịch mới nhất.',
        tone: 'success',
      })
      return
    }
    setAuthorityRecovery('blocked')
    setRuntimeNotice({
      message:
        'Chưa thể tải trạng thái mới nhất. Các thao tác lịch đang được khóa để tránh dùng thông tin cũ.',
      tone: 'error',
    })
  }

  const publishMutation = useMutation({
    mutationFn: ({
      input,
      key,
    }: Readonly<{ input: PublishAvailabilityRequest; key: string }>) =>
      api.publishAvailability(input, key),
    onSuccess: (slot) => {
      queryClient.setQueryData<AvailabilitySlotList | undefined>(
        availabilityKey,
        (current) => replaceSlot(current, slot),
      )
      commandRef.current = null
      setForm((current) => ({ ...current, date: '', startTime: '' }))
      setFormError(null)
      setRuntimeNotice({
        message: 'Đã xuất bản khung tư vấn trực tuyến 60 phút.',
        tone: 'success',
      })
      void queryClient.invalidateQueries({
        queryKey: availabilityKey,
        refetchType: 'none',
      })
    },
    onError: (error) => {
      if (
        error instanceof ApiError &&
        error.code === 'IDEMPOTENCY_KEY_REUSED'
      ) {
        commandRef.current = null
      }
      if (error instanceof ApiError && authorityRefreshCodes.has(error.code)) {
        void refreshAuthority(availabilityErrorMessage(error))
        return
      }
      setRuntimeNotice({
        message: availabilityErrorMessage(error),
        tone: 'error',
      })
    },
  })

  const withdrawMutation = useMutation({
    mutationFn: (slot: AvailabilitySlot) => api.withdrawAvailability(slot),
    onSuccess: (slot) => {
      queryClient.setQueryData<AvailabilitySlotList | undefined>(
        availabilityKey,
        (current) => replaceSlot(current, slot),
      )
      setConfirmingSlotId(null)
      setRuntimeNotice({
        message: 'Đã rút khung giờ khỏi lịch khả dụng.',
        tone: 'success',
      })
      void queryClient.invalidateQueries({
        queryKey: availabilityKey,
        refetchType: 'none',
      })
    },
    onError: (error) => {
      if (error instanceof ApiError && authorityRefreshCodes.has(error.code)) {
        void refreshAuthority(availabilityErrorMessage(error))
        return
      }
      setRuntimeNotice({
        message: availabilityErrorMessage(error),
        tone: 'error',
      })
    },
  })

  const mutationBusy =
    publishMutation.isPending ||
    withdrawMutation.isPending ||
    authorityRecovery !== 'idle'
  const authorityConfirmed =
    profileQuery.isSuccess &&
    !profileQuery.isError &&
    !profileQuery.isFetching &&
    availabilityQuery.isSuccess &&
    !availabilityQuery.isError &&
    !availabilityQuery.isFetching
  const governedBusy = mutationBusy || !authorityConfirmed
  const reloadDisabled =
    publishMutation.isPending ||
    withdrawMutation.isPending ||
    authorityRecovery === 'refreshing' ||
    profileQuery.isFetching ||
    availabilityQuery.isFetching

  const updateForm = <Field extends keyof AvailabilityForm>(
    field: Field,
    value: AvailabilityForm[Field],
  ) => {
    commandRef.current = null
    setForm((current) => ({ ...current, [field]: value }))
    setFormError(null)
    setRuntimeNotice(null)
  }

  const publish = () => {
    if (!profileApproved || governedBusy || authorityLockedRef.current) return
    try {
      new Intl.DateTimeFormat('vi-VN', { timeZone: form.timezone }).format()
      const range = localSlotToUtc(form.date, form.startTime, form.timezone)
      const input: PublishAvailabilityRequest = {
        ...range,
        timezone: form.timezone.trim(),
        modality: selectedModality,
      }
      const signature = availabilitySignature(input)
      if (commandRef.current?.signature !== signature) {
        commandRef.current = { signature, key: randomUUID() }
      }
      setFormError(null)
      setRuntimeNotice(null)
      publishMutation.mutate({ input, key: commandRef.current.key })
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Kiểm tra lại ngày, giờ và múi giờ.',
      )
    }
  }

  const withdraw = (slot: AvailabilitySlot) => {
    if (!profileApproved || governedBusy || authorityLockedRef.current) return
    if (confirmingSlotId !== slot.id) {
      setConfirmingSlotId(slot.id)
      return
    }
    setRuntimeNotice(null)
    withdrawMutation.mutate(slot)
  }

  const reloadAuthority = () => {
    if (
      publishMutation.isPending ||
      withdrawMutation.isPending ||
      authorityRecovery === 'refreshing'
    ) {
      return
    }
    void refreshAuthority('Đang tải hồ sơ và lịch mới nhất.')
  }

  if (!subject) {
    return (
      <Screen>
        <Text accessibilityRole="header" style={styles.title}>
          Lịch khả dụng
        </Text>
        <StateMessage
          message="Bạn cần đăng nhập bằng tài khoản chuyên gia để quản lý lịch."
          tone="error"
        />
        <PrimaryButton label="Đăng nhập lại" onPress={() => void signOut()} />
      </Screen>
    )
  }

  if (profileQuery.isPending) {
    return (
      <Screen>
        <View accessibilityLiveRegion="polite" style={styles.centeredState}>
          <ActivityIndicator
            accessibilityLabel="Đang kiểm tra hồ sơ chuyên gia"
            color={colors.tealDeep}
            size="large"
          />
          <Text accessibilityRole="header" style={styles.stateTitle}>
            Đang kiểm tra hồ sơ chuyên gia
          </Text>
        </View>
      </Screen>
    )
  }

  if (profileQuery.isError && profileQuery.data === undefined) {
    const unauthorized =
      profileQuery.error instanceof ApiError &&
      profileQuery.error.status === 401
    return (
      <Screen>
        <Text accessibilityRole="header" style={styles.title}>
          Lịch khả dụng
        </Text>
        <StateMessage
          message={availabilityErrorMessage(profileQuery.error)}
          tone="error"
        />
        <PrimaryButton
          label={unauthorized ? 'Đăng nhập lại' : 'Thử lại'}
          onPress={() => {
            if (unauthorized) void signOut()
            else void profileQuery.refetch()
          }}
        />
      </Screen>
    )
  }

  return (
    <Screen>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.back()}
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
      >
        <Text style={styles.backLabel}>← Quay lại</Text>
      </Pressable>

      <Text style={styles.eyebrow}>KHÔNG GIAN CHUYÊN GIA</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Lịch khả dụng trực tuyến
      </Text>
      <Text style={styles.description}>
        Xuất bản từng khung 60 phút để người dùng đặt lịch chat hoặc video trong
        ứng dụng khi hình thức đó được hỗ trợ.
      </Text>

      <View style={styles.statusPanel}>
        <Text style={styles.statusLabel}>Trạng thái hồ sơ</Text>
        <Text accessibilityLiveRegion="polite" style={styles.statusValue}>
          {specialistProfileStatusLabels[state]}
        </Text>
        {!profileApproved && (
          <Text style={styles.statusDescription}>
            Lịch đã lưu vẫn có thể xem, nhưng chỉ hồ sơ đã được phê duyệt mới có
            thể xuất bản hoặc rút khung giờ.
          </Text>
        )}
      </View>

      {runtimeNotice && (
        <StateMessage
          message={runtimeNotice.message}
          tone={runtimeNotice.tone}
        />
      )}

      {profileQuery.isError && profileQuery.data !== undefined && (
        <StateMessage
          message="Chưa thể xác nhận trạng thái phê duyệt mới nhất. Các thao tác lịch đang được khóa cho đến khi tải lại thành công."
          tone="error"
        />
      )}

      {availabilityQuery.isError && availabilityQuery.data !== undefined && (
        <StateMessage
          message="Chưa thể xác nhận phiên bản lịch mới nhất. Các thao tác lịch đang được khóa cho đến khi tải lại thành công."
          tone="error"
        />
      )}

      {profileApproved && (
        <View style={styles.publishPanel}>
          <Text style={styles.sectionTitle}>Thêm khung giờ</Text>
          <Text style={styles.sectionDescription}>
            Nhập thời gian địa phương; ứng dụng sẽ gửi đúng khoảng 60 phút.
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>Ngày</Text>
            <TextInput
              accessibilityLabel="Ngày khả dụng"
              accessibilityState={{ disabled: governedBusy }}
              editable={!governedBusy}
              inputMode="numeric"
              maxLength={10}
              onChangeText={(value) => updateForm('date', value)}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.inkFaint}
              style={styles.input}
              value={form.date}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Giờ bắt đầu</Text>
            <TextInput
              accessibilityLabel="Giờ bắt đầu"
              accessibilityState={{ disabled: governedBusy }}
              editable={!governedBusy}
              inputMode="numeric"
              maxLength={5}
              onChangeText={(value) => updateForm('startTime', value)}
              placeholder="HH:mm"
              placeholderTextColor={colors.inkFaint}
              style={styles.input}
              value={form.startTime}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Múi giờ hiển thị</Text>
            <TextInput
              accessibilityLabel="Múi giờ hiển thị"
              accessibilityState={{ disabled: governedBusy }}
              autoCapitalize="none"
              editable={!governedBusy}
              maxLength={64}
              onChangeText={(value) => updateForm('timezone', value)}
              style={styles.input}
              value={form.timezone}
            />
          </View>

          <View accessibilityRole="radiogroup" style={styles.field}>
            <Text style={styles.label}>Hình thức</Text>
            <View style={styles.choiceGroup}>
              <ModalityChoice
                disabled={governedBusy}
                label="Chat trong ứng dụng"
                onPress={() => updateForm('modality', 'IN_APP_CHAT')}
                selected={selectedModality === 'IN_APP_CHAT'}
              />
              <ModalityChoice
                disabled={governedBusy || !list?.videoPublishingEnabled}
                label="Video trong ứng dụng"
                onPress={() => updateForm('modality', 'IN_APP_VIDEO')}
                selected={selectedModality === 'IN_APP_VIDEO'}
              />
            </View>
          </View>

          {!list?.videoPublishingEnabled && (
            <Text style={styles.infoText}>
              Video chưa sẵn sàng. Bạn vẫn có thể xuất bản lịch chat.
            </Text>
          )}
          <Text style={styles.durationText}>Thời lượng cố định: 60 phút</Text>
          {formError && (
            <Text accessibilityLiveRegion="assertive" style={styles.fieldError}>
              {formError}
            </Text>
          )}
          <PrimaryButton
            disabled={governedBusy}
            label={
              publishMutation.isPending
                ? 'Đang xuất bản…'
                : 'Xuất bản khung giờ'
            }
            onPress={publish}
            testID="availability-publish"
          />
        </View>
      )}

      <View style={styles.listHeader}>
        <View style={styles.listHeaderCopy}>
          <Text style={styles.sectionTitle}>Khung giờ đã lưu</Text>
          <Text style={styles.sectionDescription}>
            Bao gồm cả khung đã rút để bạn theo dõi chính xác.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: reloadDisabled }}
          disabled={reloadDisabled}
          onPress={reloadAuthority}
          style={({ pressed }) => [
            styles.reloadButton,
            reloadDisabled && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.reloadLabel}>Tải lại</Text>
        </Pressable>
      </View>

      {availabilityQuery.isPending ? (
        <View accessibilityLiveRegion="polite" style={styles.listState}>
          <ActivityIndicator
            accessibilityLabel="Đang tải lịch khả dụng"
            color={colors.tealDeep}
          />
          <Text style={styles.stateDescription}>Đang tải lịch khả dụng…</Text>
        </View>
      ) : availabilityQuery.isError && !list ? (
        <View style={styles.listState}>
          <StateMessage
            message="Chưa thể tải lịch khả dụng. Hồ sơ và các khung giờ đã lưu không bị thay đổi."
            tone="error"
          />
          <PrimaryButton label="Thử tải lại" onPress={reloadAuthority} />
        </View>
      ) : !list || list.items.length === 0 ? (
        <View style={styles.listState}>
          <Text style={styles.stateDescription}>
            Chưa có khung giờ nào. Khi hồ sơ được phê duyệt, bạn có thể xuất bản
            khung đầu tiên ở phía trên.
          </Text>
        </View>
      ) : (
        <View style={styles.slotList}>
          {list.items.map((slot) => {
            const canWithdraw =
              profileApproved &&
              slot.status === 'ACTIVE' &&
              slot.readiness === 'AVAILABLE'
            const confirming = confirmingSlotId === slot.id
            return (
              <View key={slot.id} style={styles.slotRow}>
                <Text style={styles.slotTime}>
                  {formatAvailabilitySlot(slot)}
                </Text>
                <Text style={styles.slotMeta}>
                  {modalityLabel(slot.modality)} · {slot.timezone}
                </Text>
                <Text style={styles.slotReadiness}>
                  {availabilityReadinessLabels[slot.readiness]}
                </Text>
                {canWithdraw && (
                  <View style={styles.inlineActions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ disabled: governedBusy }}
                      disabled={governedBusy}
                      onPress={() => withdraw(slot)}
                      style={({ pressed }) => [
                        styles.withdrawButton,
                        governedBusy && styles.disabled,
                        pressed && styles.pressed,
                      ]}
                      testID={`availability-withdraw-${slot.id}`}
                    >
                      <Text style={styles.withdrawLabel}>
                        {confirming
                          ? 'Xác nhận rút khung giờ'
                          : 'Rút khung giờ'}
                      </Text>
                    </Pressable>
                    {confirming && (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setConfirmingSlotId(null)}
                        style={({ pressed }) => [
                          styles.keepButton,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.keepLabel}>Giữ lại</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            )
          })}
        </View>
      )}

      {authorityRecovery === 'blocked' && (
        <View style={styles.recoveryPanel}>
          <PrimaryButton
            label="Thử tải lại trạng thái"
            onPress={reloadAuthority}
          />
        </View>
      )}
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
  centeredState: {
    alignItems: 'center',
    gap: spacing.md,
  },
  stateTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '700',
  },
  statusPanel: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.panel,
    marginBottom: spacing.lg,
    padding: spacing.xl,
  },
  statusLabel: {
    color: colors.inkSoft,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  statusValue: {
    color: colors.tealDeep,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  statusDescription: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  runtimeMessage: {
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
    marginBottom: spacing.lg,
  },
  errorMessage: {
    color: '#9B352D',
  },
  successMessage: {
    color: colors.tealDeep,
  },
  publishPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.panel,
    borderWidth: 1,
    gap: spacing.lg,
    marginBottom: spacing.xxl,
    padding: spacing.xl,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '800',
  },
  sectionDescription: {
    color: colors.inkSoft,
    fontSize: 14,
    lineHeight: 20,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '700',
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.control,
    borderWidth: 1,
    color: colors.ink,
    fontSize: typography.body,
    minHeight: 50,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  choiceGroup: {
    gap: spacing.sm,
  },
  modalityChoice: {
    borderColor: colors.line,
    borderRadius: radii.control,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  modalityChoiceSelected: {
    backgroundColor: colors.tealPale,
    borderColor: colors.tealDeep,
  },
  modalityChoiceLabel: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '600',
  },
  modalityChoiceLabelSelected: {
    color: colors.tealDeep,
    fontWeight: '800',
  },
  infoText: {
    color: colors.inkSoft,
    fontSize: 14,
    lineHeight: 20,
  },
  durationText: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '700',
  },
  fieldError: {
    color: '#9B352D',
    fontSize: 14,
    lineHeight: 20,
  },
  listHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  listHeaderCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  reloadButton: {
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
  reloadLabel: {
    color: colors.tealDeep,
    fontSize: typography.body,
    fontWeight: '700',
  },
  listState: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.panel,
    gap: spacing.md,
    marginBottom: spacing.xl,
    padding: spacing.xl,
  },
  stateDescription: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  slotList: {
    gap: spacing.lg,
  },
  slotRow: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    paddingBottom: spacing.lg,
  },
  slotTime: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '800',
    lineHeight: typography.bodyLineHeight,
    marginBottom: spacing.xs,
  },
  slotMeta: {
    color: colors.inkSoft,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  slotReadiness: {
    color: colors.tealDeep,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  inlineActions: {
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  withdrawButton: {
    borderColor: colors.terracotta,
    borderRadius: radii.control,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
  withdrawLabel: {
    color: '#8E3F2D',
    fontSize: typography.body,
    fontWeight: '700',
  },
  keepButton: {
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
  keepLabel: {
    color: colors.tealDeep,
    fontSize: typography.body,
    fontWeight: '700',
  },
  recoveryPanel: {
    marginTop: spacing.xl,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.65,
  },
})
