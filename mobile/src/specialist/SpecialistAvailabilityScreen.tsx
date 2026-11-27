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
import { SpecialistOverviewTabBar } from '@/navigation/SpecialistOverviewTabBar'
import { colors, radii, spacing, typography } from '@/theme/tokens'
import { useDashboardFonts } from '@/theme/useDashboardFonts'

import {
  AvailabilityMonth,
  availabilityDay,
  availabilityWindow,
  displayAvailabilityDay,
} from './AvailabilityMonth'
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

function formatCompactTime(slot: AvailabilitySlot, timezone: string) {
  const clock = new Intl.DateTimeFormat('vi-VN', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  return (
    clock.format(new Date(slot.startAt)) +
    ' – ' +
    clock.format(new Date(slot.endAt))
  )
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
  const availabilityScope = ['specialist-availability', subject] as const
  const [anchor, setAnchor] = useState<string | null>(null)
  const [today] = useState(() => availabilityDay(new Date(), defaultTimezone()))
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [calendar, setCalendar] = useState(true)
  const serif = useDashboardFonts() && styles.serif
  const [formOpen, setFormOpen] = useState(false)
  const [expandedSlot, setExpandedSlot] = useState<string | null>(null)
  const availabilityKey = anchor
    ? ([...availabilityScope, anchor] as const)
    : availabilityScope
  const window = availabilityWindow(anchor ?? today)
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
    queryFn: () => api.listAvailability(window),
  })

  const profile = profileQuery.data ?? null
  const state = profileState(profile)
  const profileApproved = state === 'APPROVED'
  const list = availabilityQuery.data
  const timezone = defaultTimezone()
  const day = selectedDay ?? anchor ?? today
  const slots = list?.items ?? []
  const visibleSlots = calendar
    ? slots.filter((slot) => availabilityDay(slot.startAt, timezone) === day)
    : slots

  const browseDate = (date: string) => {
    setAnchor(date === today ? null : date)
    setSelectedDay(date)
    setConfirmingSlotId(null)
    setExpandedSlot(null)
  }

  const selectDate = (date: string) => {
    if (mutationBusy) return
    if (
      date.slice(0, 7) !== day.slice(0, 7) ||
      availabilityDay(window.from, timezone) >= date ||
      availabilityDay(window.to, timezone) <= date
    ) {
      browseDate(date)
    } else {
      setSelectedDay(date)
      setConfirmingSlotId(null)
      setExpandedSlot(null)
    }
  }

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
      if (
        Date.parse(slot.startAt) < Date.parse(window.from) ||
        Date.parse(slot.startAt) >= Date.parse(window.to)
      )
        browseDate(availabilityDay(slot.startAt, timezone))
      commandRef.current = null
      setForm((current) => ({ ...current, date: '', startTime: '' }))
      setFormError(null)
      setRuntimeNotice({
        message: 'Đã xuất bản khung tư vấn trực tuyến 60 phút.',
        tone: 'success',
      })
      void queryClient.invalidateQueries({
        queryKey: availabilityScope,
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
        queryKey: availabilityScope,
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
      <Screen bottomActions={<SpecialistOverviewTabBar />}>
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
      <Screen bottomActions={<SpecialistOverviewTabBar />}>
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
      <Screen bottomActions={<SpecialistOverviewTabBar />}>
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
    <Screen
      layout="dashboard"
      backgroundColor="#F8F8F2"
      bottomActions={<SpecialistOverviewTabBar />}
    >
      <View style={styles.masthead}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Về Tổng quan"
          style={styles.avatar}
          onPress={() => router.dismissTo('/(specialist)/specialist')}
        >
          <Text style={styles.avatarText}>
            {profile?.displayName.charAt(0) ?? '◎'}
          </Text>
        </Pressable>
        <View style={styles.slotContent}>
          <Text numberOfLines={1} style={styles.profileName}>
            {profile?.displayName ?? 'Chuyên gia'}
          </Text>
          <Text style={styles.slotMeta}>Lịch khả dụng</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Chuyển sang lịch tháng"
          onPress={() => setCalendar(true)}
          style={styles.modeButton}
        >
          <Text style={styles.modeLabel} aria-hidden>
            ▦
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Thông báo chuyên môn"
          onPress={() => router.push('/(specialist)/notifications')}
          style={styles.modeButton}
        >
          <Text style={styles.modeLabel} aria-hidden>
            🔔︎
          </Text>
        </Pressable>
      </View>
      <Text style={styles.eyebrow}>KHÔNG GIAN CHUYÊN GIA</Text>
      <Text accessibilityRole="header" style={[styles.title, serif]}>
        Lịch khả dụng trực tuyến
      </Text>
      <Text style={styles.description}>
        Xuất bản từng khung 60 phút để người dùng đặt lịch chat hoặc video trong
        ứng dụng khi hình thức đó được hỗ trợ.
      </Text>

      <View style={styles.summaryBar}>
        {list && (
          <>
            <Text style={styles.summaryBadge}>
              ● {slots.filter((slot) => slot.readiness === 'AVAILABLE').length}{' '}
              có thể đặt
            </Text>
            <Text style={styles.summaryBadge}>
              {slots.filter((slot) => slot.status === 'WITHDRAWN').length} đã
              rút
            </Text>
          </>
        )}
        {profileApproved && (
          <PrimaryButton
            label={formOpen ? 'Đóng biểu mẫu' : '+ Thêm khung giờ'}
            onPress={() => setFormOpen(!formOpen)}
          />
        )}
      </View>

      <View style={profileApproved ? styles.approved : styles.statusPanel}>
        {!profileApproved && (
          <Text style={styles.statusLabel}>Trạng thái hồ sơ</Text>
        )}
        <Text
          accessibilityLiveRegion="polite"
          style={profileApproved ? styles.slotMeta : styles.statusValue}
        >
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

      {profileApproved && formOpen && (
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

      <View style={styles.savedControls}>
        <View style={styles.listHeader}>
          <View style={styles.listHeaderCopy}>
            <Text style={styles.sectionTitle}>
              Khung giờ đã lưu{list ? ' · ' + list.count : ''}
            </Text>
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

        <View style={styles.viewControls}>
          <Pressable
            accessibilityRole="button"
            style={styles.modeButton}
            accessibilityLabel="Chuyển sang lịch tháng"
            onPress={() => setCalendar(true)}
          >
            <Text style={styles.slotMeta}>Xem lịch quanh ngày</Text>
            <Text style={styles.modeLabel}>
              {day.split('-').reverse().join('/')}
            </Text>
            <Text style={styles.controlArrow} aria-hidden>
              ⌄
            </Text>
          </Pressable>
          <View accessibilityRole="tablist" style={styles.viewModes}>
            {(['Danh sách', 'Lịch'] as const).map((mode) => {
              const isCalendar = mode === 'Lịch'
              const selected = calendar === isCalendar
              return (
                <Pressable
                  key={mode}
                  accessibilityRole="tab"
                  accessibilityLabel={mode}
                  accessibilityState={{ selected }}
                  onPress={() => setCalendar(isCalendar)}
                  style={[
                    styles.modeButton,
                    styles.segment,
                    selected && styles.modeSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.modeLabel,
                      selected && styles.modeSelectedLabel,
                    ]}
                  >
                    {mode}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>
      </View>

      {calendar && (
        <>
          <AvailabilityMonth
            day={day}
            timezone={timezone}
            slots={slots}
            onSelect={selectDate}
            onBrowse={(date) => {
              if (!mutationBusy) browseDate(date)
            }}
          />
          <Text style={[styles.dayHeading, serif]}>
            {displayAvailabilityDay(day)}
            {list ? ` · ${visibleSlots.length} khung giờ` : ''}
          </Text>
        </>
      )}

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
      ) : visibleSlots.length === 0 ? (
        <View style={styles.listState}>
          <Text style={styles.stateDescription}>
            {calendar
              ? 'Ngày này chưa có khung giờ.'
              : 'Chưa có khung giờ trong khoảng đã tải.'}
          </Text>
        </View>
      ) : (
        <View style={styles.slotList}>
          {visibleSlots.map((slot) => {
            const canWithdraw =
              profileApproved &&
              slot.status === 'ACTIVE' &&
              slot.readiness === 'AVAILABLE'
            const confirming = confirmingSlotId === slot.id
            const slotDay = availabilityDay(slot.startAt, slot.timezone)
            const expanded = expandedSlot === slot.id
            return (
              <View
                key={slot.id}
                style={[styles.slotRow, calendar && styles.compactCard]}
              >
                {calendar ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    onPress={() => {
                      setExpandedSlot(expanded ? null : slot.id)
                      setConfirmingSlotId(null)
                    }}
                    style={styles.compactSlot}
                  >
                    <Text aria-hidden style={styles.slotIcon}>
                      {slot.modality === 'IN_APP_CHAT' ? '▤' : '▣'}
                    </Text>
                    <View style={styles.slotContent}>
                      <Text style={styles.compactTime}>
                        {formatCompactTime(slot, timezone)}
                      </Text>
                      <Text style={styles.slotMeta}>
                        {modalityLabel(slot.modality)}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.slotReadiness,
                        slot.readiness === 'AVAILABLE' && styles.openSlot,
                      ]}
                    >
                      {availabilityReadinessLabels[slot.readiness]}
                    </Text>
                    <Text aria-hidden style={styles.modeLabel}>
                      {expanded ? '⌃' : '›'}
                    </Text>
                  </Pressable>
                ) : (
                  <View style={styles.slotMain}>
                    <View style={styles.dateBlock}>
                      <Text style={styles.slotMeta}>
                        TH {Number(slotDay.slice(5, 7))}
                      </Text>
                      <Text style={styles.dateNumber}>
                        {Number(slotDay.slice(8))}
                      </Text>
                    </View>
                    <View style={styles.slotContent}>
                      <Text style={styles.slotTime}>
                        {formatAvailabilitySlot(slot)}
                      </Text>
                      <Text style={styles.slotMeta}>
                        {modalityLabel(slot.modality)} ·{' '}
                        {Math.round(
                          (Date.parse(slot.endAt) - Date.parse(slot.startAt)) /
                            60000,
                        )}{' '}
                        phút
                      </Text>
                      <Text style={styles.slotMeta}>{slot.timezone}</Text>
                      <Text
                        style={[
                          styles.slotReadiness,
                          slot.readiness === 'AVAILABLE' && styles.openSlot,
                        ]}
                      >
                        {availabilityReadinessLabels[slot.readiness]}
                      </Text>
                    </View>
                  </View>
                )}
                {calendar && expanded && (
                  <Text style={styles.slotMeta}>
                    {displayAvailabilityDay(slotDay)} · {slot.timezone}
                  </Text>
                )}
                {canWithdraw && (!calendar || expanded) && (
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

      {calendar && visibleSlots.length > 0 && (
        <Text style={styles.helper}>
          Chọn một khung giờ để xem chi tiết hoặc chỉnh sửa.
        </Text>
      )}
      <View style={styles.tip}>
        <Text style={styles.tipTitle}>Một lịch hẹn, một khoảng dành riêng</Text>
        <Text style={styles.sectionDescription}>
          Chọn những khung giờ bạn có thể dành trọn vẹn để hai bên dễ sắp xếp.
        </Text>
      </View>
      <View style={[styles.tip, styles.tipSecondary]}>
        <Text style={styles.sectionDescription}>
          ◇ Rút khung giờ chỉ dừng nhận lượt đặt mới. Các lịch đã xác nhận vẫn
          được giữ.
        </Text>
      </View>
      {list && (
        <View style={styles.loadedRange}>
          <Text style={styles.footerText}>
            ◷ Lịch đã tải:{' '}
            {window.from.slice(0, 10).split('-').reverse().join('/')} –{' '}
            {window.to.slice(0, 10).split('-').reverse().join('/')}
          </Text>
          <Text style={styles.footerText}>
            Cập nhật{' '}
            {new Intl.DateTimeFormat('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: timezone,
            }).format(new Date(list.generatedAt))}
          </Text>
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
  serif: { fontFamily: 'DashboardSerif' },
  masthead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 15,
  },
  avatar: {
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#173932',
  },
  avatarText: { color: '#fff', fontWeight: '800' },
  profileName: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  approved: { alignSelf: 'flex-start', marginBottom: 10 },
  savedControls: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 11,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  compactCard: { padding: 8, borderRadius: 16 },
  compactSlot: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    minHeight: 52,
    gap: 7,
  },
  compactTime: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  slotIcon: {
    backgroundColor: '#E8F0E9',
    borderRadius: 15,
    overflow: 'hidden',
    padding: 8,
    color: colors.tealDeep,
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  summaryBadge: {
    backgroundColor: '#EAF0E6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 15,
    overflow: 'hidden',
    color: colors.tealDeep,
    fontSize: 12,
    fontWeight: '700',
  },
  viewControls: { gap: 7 },
  dateControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 11,
    minHeight: 44,
    backgroundColor: '#F0F2ED',
    borderRadius: 16,
  },
  controlArrow: { flexGrow: 1, textAlign: 'right', color: colors.tealDeep },
  viewModes: {
    flexDirection: 'row',
    backgroundColor: '#EEF0EB',
    borderRadius: 22,
    padding: 3,
    gap: 3,
  },
  segment: { flex: 1, alignItems: 'center', borderRadius: 20 },
  modeButton: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 9,
    justifyContent: 'center',
    borderRadius: 10,
  },
  modeLabel: { fontWeight: '700', fontSize: 13, color: colors.tealDeep },
  modeSelected: { backgroundColor: colors.white },
  modeSelectedLabel: { color: colors.ink },
  dayHeading: {
    fontSize: 14,
    color: colors.tealDeep,
    fontWeight: '700',
    marginBottom: 9,
  },
  slotMain: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  slotContent: { flex: 1, minWidth: 0, gap: 4 },
  dateBlock: {
    backgroundColor: '#E9EEE3',
    padding: 8,
    borderRadius: 10,
    minWidth: 46,
    alignItems: 'center',
  },
  dateNumber: { color: colors.tealDeep, fontWeight: '800', fontSize: 23 },
  openSlot: { backgroundColor: '#D9EAE0' },
  helper: {
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: 10,
    fontSize: 12,
  },
  tipTitle: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  tipSecondary: { backgroundColor: '#F0F2EC' },
  loadedRange: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 7,
  },
  footerText: {
    color: colors.inkSoft,
    fontSize: 12,
    marginTop: 10,
    marginBottom: 14,
  },
  tip: {
    backgroundColor: '#E9EEE4',
    borderRadius: 16,
    padding: 12,
    gap: 6,
    marginTop: 12,
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
