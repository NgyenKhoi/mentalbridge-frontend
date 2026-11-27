import { GuideReplayButton } from '@/onboarding/OnboardingGuide'
import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { router } from 'expo-router'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  Modal,
  ScrollView,
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
import { AccountSignOutButton } from '@/components/AccountSignOutButton'
import { SpecialistOverviewTabBar } from '@/navigation/SpecialistOverviewTabBar'
import { colors, radii, spacing, typography } from '@/theme/tokens'
import { useDashboardFonts } from '@/theme/useDashboardFonts'

import type { SpecialistApi } from './specialist-api'
import type {
  SpecialistLanguage,
  SpecialistProfile,
  SpecialistProfileRequest,
  SupportArea,
} from './specialist-contract'
import {
  emptySpecialistProfileForm,
  profileErrorsFromProblem,
  profileForm,
  profileState,
  specialistDecisionReasonLabels,
  specialistProfileStatusLabels,
  toggleValue,
  validateSpecialistProfileForm,
  type SpecialistProfileField,
  type SpecialistProfileFieldErrors,
  type SpecialistProfileForm,
  type SpecialistProfileState,
} from './specialist-model'

type AuthorityRecovery = 'idle' | 'refreshing' | 'blocked'

type RuntimeNotice = Readonly<{
  message: string
  tone: 'error' | 'success'
}>

const supportAreaOptions: readonly Readonly<{
  value: SupportArea
  label: string
}>[] = [
  { value: 'DEPRESSIVE_SYMPTOMS', label: 'Khó khăn liên quan trầm cảm' },
  { value: 'ANXIETY_SYMPTOMS', label: 'Khó khăn liên quan lo âu' },
]

const languageOptions: readonly Readonly<{
  value: SpecialistLanguage
  label: string
}>[] = [
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'en', label: 'Tiếng Anh' },
]

function isMissingProfile(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 404 &&
    error.code === 'SPECIALIST_PROFILE_NOT_FOUND'
  )
}

function isAuthorityUncertain(error: unknown): boolean {
  return (
    !(error instanceof ApiError) ||
    error.status === undefined ||
    error.status >= 500 ||
    error.status === 409 ||
    error.status === 412
  )
}

function loadErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) {
    return 'Phiên đăng nhập đã hết hạn. Đăng nhập lại để xem hồ sơ chuyên gia.'
  }
  if (error instanceof ApiError && error.status === 403) {
    return 'Tài khoản này không có quyền truy cập hồ sơ chuyên gia.'
  }
  return 'Chưa thể tải hồ sơ chuyên gia. Thông tin đã lưu không bị thay đổi.'
}

function mutationErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) {
    return 'Phiên đăng nhập đã hết hạn. Nội dung bạn vừa nhập vẫn được giữ lại.'
  }
  if (error instanceof ApiError && error.status === 403) {
    return 'Tài khoản này không có quyền thay đổi hồ sơ chuyên gia.'
  }
  if (
    error instanceof ApiError &&
    (error.status === 409 || error.status === 412)
  ) {
    return 'Hồ sơ vừa thay đổi. Đang tải trạng thái mới nhất trước khi bạn tiếp tục.'
  }
  if (
    !(error instanceof ApiError) ||
    error.status === undefined ||
    error.status >= 500
  ) {
    return 'Chưa xác nhận được kết quả. Đang kiểm tra hồ sơ mới nhất; nội dung bạn nhập vẫn được giữ lại.'
  }
  return 'Chưa thể hoàn tất thao tác. Kiểm tra thông tin được đánh dấu rồi thử lại.'
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

function SelectionButton<Value extends string>({
  disabled,
  label,
  onPress,
  selected,
  value,
}: Readonly<{
  disabled: boolean
  label: string
  onPress: (value: Value) => void
  selected: boolean
  value: Value
}>) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={() => onPress(value)}
      style={({ pressed }) => [
        styles.choice,
        selected && styles.choiceSelected,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[styles.choiceLabel, selected && styles.choiceLabelSelected]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

function fieldError(
  errors: SpecialistProfileFieldErrors,
  field: SpecialistProfileField,
) {
  const message = errors[field]
  return message ? (
    <Text accessibilityLiveRegion="assertive" style={styles.fieldError}>
      {message}
    </Text>
  ) : null
}

function canEditProfile(state: SpecialistProfileState): boolean {
  return ['NEW', 'DRAFT', 'PENDING_REVIEW', 'REJECTED'].includes(state)
}

function ProfileSection({
  number,
  title,
  detail,
  expanded,
  onPress,
  serif,
  children,
}: {
  number: string
  title: string
  detail: string
  expanded: boolean
  onPress: () => void
  serif: boolean
  children: ReactNode
}) {
  return (
    <View style={styles.section}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded }}
        onPress={onPress}
        style={styles.sectionHeader}
      >
        <Text style={styles.sectionNumber}>{number}</Text>
        <View style={styles.grow}>
          <Text style={[styles.sectionTitle, serif && styles.serif]}>
            {title}
          </Text>
          <Text style={styles.sectionDetail}>{detail}</Text>
        </View>
        <Text aria-hidden style={styles.chevron}>
          {expanded ? '⌃' : '⌄'}
        </Text>
      </Pressable>
      {expanded && <View style={styles.sectionBody}>{children}</View>}
    </View>
  )
}

export function SpecialistProfileScreen({
  api,
}: Readonly<{ api: SpecialistApi }>) {
  const { session, signOut } = useSession()
  const queryClient = useQueryClient()
  const serif = useDashboardFonts()
  const [sections, setSections] = useState<string[]>(['01'])
  const [preview, setPreview] = useState(false)
  const toggleSection = (section: string) =>
    setSections((current) =>
      current.includes(section)
        ? current.filter((item) => item !== section)
        : [...current, section],
    )
  const subject = session?.subject
  const queryKey = ['specialist-profile', subject] as const
  const activeSubjectRef = useRef(subject)
  const authorityLockedRef = useRef(false)
  const [form, setForm] = useState<SpecialistProfileForm>(
    emptySpecialistProfileForm,
  )
  const [formSourceKey, setFormSourceKey] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<SpecialistProfileFieldErrors>(
    {},
  )
  const [runtimeNotice, setRuntimeNotice] = useState<RuntimeNotice | null>(null)
  const [authorityRecovery, setAuthorityRecovery] =
    useState<AuthorityRecovery>('idle')
  const [confirmPendingEdit, setConfirmPendingEdit] = useState(false)

  useEffect(() => {
    activeSubjectRef.current = subject
  }, [subject])

  const profileQuery = useQuery({
    queryKey,
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

  const profile = profileQuery.data ?? null
  const state = profileState(profile)
  const credentials = useQuery({
    queryKey: ['specialist-profile-credentials', subject],
    enabled: Boolean(subject && profile && api.listCredentials),
    queryFn: api.listCredentials ?? skipToken,
  })

  const nextFormSourceKey = profileQuery.isSuccess
    ? `${subject}:${profile?.version ?? 'empty'}`
    : null

  if (nextFormSourceKey !== null && nextFormSourceKey !== formSourceKey) {
    setFormSourceKey(nextFormSourceKey)
    setForm(profileForm(profile))
    setFieldErrors({})
    setConfirmPendingEdit(false)
  }

  const applyAuthoritativeProfile = (value: SpecialistProfile | null) => {
    queryClient.setQueryData(queryKey, value)
    setFormSourceKey(`${subject}:${value?.version ?? 'empty'}`)
    setForm(profileForm(value))
    setFieldErrors({})
    setConfirmPendingEdit(false)
  }

  const recoverAuthority = async (message: string) => {
    const recoverySubject = subject
    authorityLockedRef.current = true
    setAuthorityRecovery('refreshing')
    setRuntimeNotice({ message, tone: 'error' })
    const result = await profileQuery.refetch()
    if (activeSubjectRef.current !== recoverySubject) return
    if (result.isSuccess) {
      applyAuthoritativeProfile(result.data ?? null)
      authorityLockedRef.current = false
      setAuthorityRecovery('idle')
      setRuntimeNotice({
        message:
          'Đã tải trạng thái hồ sơ mới nhất. Hãy kiểm tra lại trước khi tiếp tục.',
        tone: 'success',
      })
      return
    }
    setAuthorityRecovery('blocked')
    setRuntimeNotice({
      message:
        'Chưa thể tải trạng thái mới nhất. Các thao tác hồ sơ đang được khóa để tránh dùng thông tin cũ.',
      tone: 'error',
    })
  }

  const saveMutation = useMutation({
    mutationFn: (request: SpecialistProfileRequest) =>
      api.saveProfile(request, profile?.version),
    onSuccess: (saved) => {
      applyAuthoritativeProfile(saved)
      setRuntimeNotice({
        message: profile
          ? 'Đã lưu thay đổi hồ sơ.'
          : 'Đã tạo hồ sơ chuyên gia.',
        tone: 'success',
      })
      void queryClient.invalidateQueries({ queryKey, refetchType: 'none' })
    },
    onError: (error) => {
      if (isAuthorityUncertain(error)) {
        void recoverAuthority(mutationErrorMessage(error))
        return
      }
      setFieldErrors(
        error instanceof ApiError
          ? profileErrorsFromProblem(error.problem)
          : {},
      )
      setRuntimeNotice({ message: mutationErrorMessage(error), tone: 'error' })
    },
  })

  const reviewMutation = useMutation({
    mutationFn: (current: SpecialistProfile) =>
      state === 'REJECTED'
        ? api.resubmitProfile(current)
        : api.submitProfile(current),
    onSuccess: (saved) => {
      applyAuthoritativeProfile(saved)
      setRuntimeNotice({
        message: 'Hồ sơ đã được gửi để xét duyệt.',
        tone: 'success',
      })
      void queryClient.invalidateQueries({ queryKey, refetchType: 'none' })
    },
    onError: (error) => {
      if (isAuthorityUncertain(error)) {
        void recoverAuthority(mutationErrorMessage(error))
        return
      }
      setRuntimeNotice({ message: mutationErrorMessage(error), tone: 'error' })
    },
  })

  const original = profileForm(profile)
  const dirty = JSON.stringify(form) !== JSON.stringify(original)
  const editable = canEditProfile(state)
  const formLocked =
    !editable ||
    saveMutation.isPending ||
    reviewMutation.isPending ||
    authorityRecovery !== 'idle' ||
    profileQuery.isFetching ||
    profileQuery.isError

  const updateField = (field: SpecialistProfileField, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
    setRuntimeNotice(null)
    setConfirmPendingEdit(false)
  }

  const toggleSupportArea = (value: SupportArea) => {
    setForm((current) => ({
      ...current,
      supportAreas: toggleValue(current.supportAreas, value, 2),
    }))
    setFieldErrors((current) => {
      const { supportAreas: _supportAreas, ...remaining } = current
      return remaining
    })
    setRuntimeNotice(null)
    setConfirmPendingEdit(false)
  }

  const toggleLanguage = (value: SpecialistLanguage) => {
    setForm((current) => ({
      ...current,
      languages: toggleValue(current.languages, value, 2),
    }))
    setFieldErrors((current) => {
      const { languages: _languages, ...remaining } = current
      return remaining
    })
    setRuntimeNotice(null)
    setConfirmPendingEdit(false)
  }

  const save = () => {
    if (formLocked || authorityLockedRef.current) return
    const validation = validateSpecialistProfileForm(form)
    if (!validation.success) {
      setFieldErrors(validation.errors)
      setSections(['01', '02', '03'])
      setRuntimeNotice({
        message: 'Kiểm tra lại các thông tin được đánh dấu bên dưới.',
        tone: 'error',
      })
      return
    }
    if (state === 'PENDING_REVIEW' && !confirmPendingEdit) {
      setConfirmPendingEdit(true)
      return
    }
    setFieldErrors({})
    setRuntimeNotice(null)
    saveMutation.mutate(validation.value)
  }

  const submitForReview = () => {
    if (
      !profile ||
      dirty ||
      formLocked ||
      authorityLockedRef.current ||
      !['DRAFT', 'REJECTED'].includes(state)
    ) {
      return
    }
    setRuntimeNotice(null)
    reviewMutation.mutate(profile)
  }

  const reloadAuthority = () => {
    if (saveMutation.isPending || reviewMutation.isPending) return
    void recoverAuthority('Đang tải trạng thái hồ sơ mới nhất.')
  }

  if (!subject) {
    return (
      <Screen>
        <GuideReplayButton />
        <Text accessibilityRole="header" style={styles.title}>
          Hồ sơ chuyên gia
        </Text>
        <StateMessage
          message="Bạn cần đăng nhập bằng tài khoản chuyên gia để xem hồ sơ này."
          tone="error"
        />
        <PrimaryButton label="Đăng nhập lại" onPress={() => void signOut()} />
      </Screen>
    )
  }

  if (profileQuery.isPending) {
    return (
      <Screen bottomActions={<SpecialistOverviewTabBar onProfile />}>
        <GuideReplayButton />
        <View accessibilityLiveRegion="polite" style={styles.centeredState}>
          <ActivityIndicator
            accessibilityLabel="Đang tải hồ sơ chuyên gia"
            color={colors.tealDeep}
            size="large"
          />
          <Text accessibilityRole="header" style={styles.stateTitle}>
            Đang tải hồ sơ chuyên gia
          </Text>
        </View>
        <AccountSignOutButton />
      </Screen>
    )
  }

  const permissionError =
    profileQuery.error instanceof ApiError &&
    (profileQuery.error.status === 401 || profileQuery.error.status === 403)

  if (
    profileQuery.isError &&
    (profileQuery.data === undefined || permissionError)
  ) {
    const unauthorized =
      profileQuery.error instanceof ApiError &&
      profileQuery.error.status === 401
    return (
      <Screen bottomActions={<SpecialistOverviewTabBar onProfile />}>
        <GuideReplayButton />
        <Text accessibilityRole="header" style={styles.title}>
          Hồ sơ chuyên gia
        </Text>
        <StateMessage
          message={loadErrorMessage(profileQuery.error)}
          tone="error"
        />
        <PrimaryButton
          label={unauthorized ? 'Đăng nhập lại' : 'Thử lại'}
          onPress={() => {
            if (unauthorized) void signOut()
            else void profileQuery.refetch()
          }}
        />
        {!unauthorized && <AccountSignOutButton />}
      </Screen>
    )
  }

  const initials =
    form.displayName
      .trim()
      .split(/\s+/)
      .slice(-2)
      .map((part) => part.charAt(0))
      .join('')
      .toUpperCase() || 'CG'
  const verified = credentials.data?.filter(
    (item) => item.verificationStatus === 'VERIFIED',
  ).length
  const completeFields = Object.values(form).filter((value) =>
    typeof value === 'string' ? value.trim().length > 0 : value.length > 0,
  ).length
  const stats = [
    { label: 'Năm kinh nghiệm', value: form.yearsOfExperience || '—' },
    { label: 'Lĩnh vực hỗ trợ', value: form.supportAreas.length },
    { label: 'Ngôn ngữ', value: form.languages.length },
    {
      label: 'Đã hoàn thiện',
      value:
        Math.round((completeFields / Object.keys(form).length) * 100) + '%',
    },
  ]

  return (
    <Screen
      layout="dashboard"
      backgroundColor="#F8F8F2"
      bottomActions={<SpecialistOverviewTabBar onProfile />}
    >
      <View style={styles.masthead}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Về Tổng quan"
          onPress={() => router.dismissTo('/(specialist)/specialist')}
          style={styles.avatar}
        >
          <Text style={styles.avatarText}>{initials}</Text>
        </Pressable>
        <Text style={[styles.mastheadTitle, serif && styles.serif]}>Hồ sơ</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(specialist)/notifications')}
          style={styles.chip}
        >
          <Text style={styles.chipText}>Thông báo</Text>
        </Pressable>
      </View>
      <GuideReplayButton />
      <View style={styles.heroBar}>
        <Text style={styles.eyebrow}>KHÔNG GIAN CHUYÊN GIA</Text>
        <Pressable
          accessibilityRole="button"
          disabled={!profile}
          onPress={() => setPreview(true)}
          style={[styles.chip, !profile && styles.disabled]}
        >
          <Text style={styles.chipText}>Xem trước hồ sơ</Text>
        </Pressable>
      </View>
      <Text
        accessibilityRole="header"
        style={[styles.title, styles.heroTitle, serif && styles.serif]}
      >
        Hồ sơ chuyên gia
      </Text>
      <Text style={styles.description}>
        Quản lý thông tin cá nhân, chuyên môn và thiết lập tư vấn.
      </Text>

      <View style={styles.statusPanel}>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.grow}>
            <Text style={[styles.sectionTitle, serif && styles.serif]}>
              {form.displayName || 'Hồ sơ chuyên gia'}
            </Text>
            <Text style={styles.sectionDetail}>Chuyên gia tâm lý</Text>
          </View>
          <Text accessibilityLiveRegion="polite" style={styles.statusValue}>
            {specialistProfileStatusLabels[state]}
          </Text>
        </View>
        <View style={styles.stats}>
          {stats.map(({ label, value }, index) => (
            <View
              key={label}
              style={[styles.stat, index === 3 && styles.statAccent]}
            >
              <Text style={[styles.statValue, serif && styles.serif]}>
                {value}
              </Text>
              <Text style={styles.statLabel}>{label}</Text>
            </View>
          ))}
        </View>
        {state !== 'APPROVED' && (
          <Text style={styles.helpText}>
            {state === 'PENDING_REVIEW'
              ? 'Lưu thay đổi sẽ rút hồ sơ khỏi hàng đợi xét duyệt.'
              : state === 'SUSPENDED'
                ? 'Chỉ quản trị viên có thể khôi phục hồ sơ.'
                : 'Lưu hồ sơ trước khi gửi xét duyệt.'}
          </Text>
        )}
      </View>

      {profile?.decisionReasonCode && (
        <View style={styles.reasonPanel}>
          <Text style={styles.reasonTitle}>Phản hồi hiện tại</Text>
          <Text style={styles.reasonText}>
            {specialistDecisionReasonLabels[profile.decisionReasonCode]}
          </Text>
        </View>
      )}

      {profileQuery.isError && profileQuery.data !== undefined && (
        <View style={styles.recoveryPanel}>
          <StateMessage
            message="Chưa thể làm mới hồ sơ. Các thao tác đang được khóa cho đến khi tải lại thành công."
            tone="error"
          />
          <PrimaryButton label="Tải lại hồ sơ" onPress={reloadAuthority} />
        </View>
      )}

      {runtimeNotice && (
        <StateMessage
          message={runtimeNotice.message}
          tone={runtimeNotice.tone}
        />
      )}

      <View style={styles.form}>
        <ProfileSection
          number="01"
          title="Thông tin cá nhân & Tiểu sử"
          detail={'Họ tên, danh xưng, định hướng tham vấn'}
          expanded={sections.includes('01')}
          onPress={() => toggleSection('01')}
          serif={serif}
        >
          <View style={styles.field}>
            <Text style={styles.label}>Họ và tên hiển thị</Text>
            <TextInput
              accessibilityLabel="Tên hiển thị nghề nghiệp"
              accessibilityState={{ disabled: formLocked }}
              autoCapitalize="words"
              editable={!formLocked}
              maxLength={120}
              onChangeText={(value) => updateField('displayName', value)}
              style={[
                styles.input,
                fieldErrors.displayName && styles.inputError,
              ]}
              value={form.displayName}
            />
            {fieldError(fieldErrors, 'displayName')}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Giới thiệu với thân chủ</Text>
            <TextInput
              accessibilityLabel="Giới thiệu nghề nghiệp"
              accessibilityState={{ disabled: formLocked }}
              editable={!formLocked}
              maxLength={2000}
              multiline
              onChangeText={(value) => updateField('bio', value)}
              style={[
                styles.input,
                styles.multilineInput,
                fieldErrors.bio && styles.inputError,
              ]}
              textAlignVertical="top"
              value={form.bio}
            />
            {fieldError(fieldErrors, 'bio')}
          </View>
        </ProfileSection>
        <ProfileSection
          number="02"
          title="Chuyên môn & Đánh giá lâm sàng"
          detail={'Kinh nghiệm và lĩnh vực hỗ trợ'}
          expanded={sections.includes('02')}
          onPress={() => toggleSection('02')}
          serif={serif}
        >
          <View style={styles.field}>
            <Text style={styles.label}>Số năm kinh nghiệm</Text>
            <TextInput
              accessibilityLabel="Số năm kinh nghiệm"
              accessibilityState={{ disabled: formLocked }}
              editable={!formLocked}
              inputMode="numeric"
              maxLength={2}
              onChangeText={(value) => updateField('yearsOfExperience', value)}
              style={[
                styles.input,
                fieldErrors.yearsOfExperience && styles.inputError,
              ]}
              value={form.yearsOfExperience}
            />
            {fieldError(fieldErrors, 'yearsOfExperience')}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Lĩnh vực hỗ trợ (tối đa 2)</Text>
            <View style={styles.choiceGroup}>
              {supportAreaOptions.map((option) => (
                <SelectionButton
                  key={option.value}
                  disabled={formLocked}
                  label={option.label}
                  onPress={toggleSupportArea}
                  selected={form.supportAreas.includes(option.value)}
                  value={option.value}
                />
              ))}
            </View>
            {fieldError(fieldErrors, 'supportAreas')}
          </View>
        </ProfileSection>
        <ProfileSection
          number="03"
          title="Ngôn ngữ & Thiết lập lịch phiên"
          detail={'60 phút / phiên tư vấn trực tuyến'}
          expanded={sections.includes('03')}
          onPress={() => toggleSection('03')}
          serif={serif}
        >
          <View style={styles.field}>
            <Text style={styles.label}>Ngôn ngữ hỗ trợ</Text>
            <View style={styles.choiceGroup}>
              {languageOptions.map((option) => (
                <SelectionButton
                  key={option.value}
                  disabled={formLocked}
                  label={option.label}
                  onPress={toggleLanguage}
                  selected={form.languages.includes(option.value)}
                  value={option.value}
                />
              ))}
            </View>
            {fieldError(fieldErrors, 'languages')}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Múi giờ làm việc</Text>
            <TextInput
              accessibilityLabel="Múi giờ làm việc"
              accessibilityState={{ disabled: formLocked }}
              autoCapitalize="none"
              editable={!formLocked}
              maxLength={64}
              onChangeText={(value) => updateField('timezone', value)}
              placeholder="Asia/Ho_Chi_Minh"
              placeholderTextColor={colors.inkFaint}
              style={[styles.input, fieldErrors.timezone && styles.inputError]}
              value={form.timezone}
            />
            <Text style={styles.helpText}>
              Dùng tên múi giờ IANA để lịch hiển thị ổn định.
            </Text>
            {fieldError(fieldErrors, 'timezone')}
          </View>
        </ProfileSection>
        <ProfileSection
          number="04"
          title="Bằng cấp & Chứng nhận chuyên khoa"
          detail={
            verified === undefined
              ? 'Giấy tờ chuyên môn'
              : verified + ' giấy tờ đã xác minh'
          }
          expanded={sections.includes('04')}
          onPress={() => toggleSection('04')}
          serif={serif}
        >
          {credentials.isError ? (
            <PrimaryButton
              label="Tải lại giấy tờ"
              onPress={() => void credentials.refetch()}
            />
          ) : credentials.isFetching ? (
            <ActivityIndicator color={colors.teal} />
          ) : credentials.data?.length ? (
            credentials.data.map((item) => (
              <View key={item.id} style={styles.stat}>
                <Text style={styles.label}>{item.title}</Text>
                <Text style={styles.sectionDetail}>
                  {item.issuer} · {item.issueYear} ·{' '}
                  {item.verificationStatus === 'VERIFIED'
                    ? 'Đã xác minh'
                    : item.verificationStatus === 'REJECTED'
                      ? 'Chưa được xác minh'
                      : 'Đang chờ xác minh'}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.sectionDetail}>
              Chưa có giấy tờ để hiển thị.
            </Text>
          )}
        </ProfileSection>
      </View>

      {confirmPendingEdit && (
        <View accessibilityLiveRegion="assertive" style={styles.confirmPanel}>
          <Text style={styles.confirmTitle}>
            Lưu thay đổi và rút hồ sơ khỏi hàng đợi?
          </Text>
          <Text style={styles.confirmDescription}>
            Sau khi lưu, bạn cần gửi lại hồ sơ để tiếp tục xét duyệt.
          </Text>
          <View style={styles.inlineActions}>
            <PrimaryButton label="Lưu và rút hồ sơ" onPress={save} />
            <Pressable
              accessibilityRole="button"
              onPress={() => setConfirmPendingEdit(false)}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.secondaryLabel}>Tiếp tục kiểm tra</Text>
            </Pressable>
          </View>
        </View>
      )}

      <View style={styles.actions}>
        <Text style={styles.label}>
          {dirty
            ? 'Có thay đổi chưa lưu'
            : profile
              ? 'Hồ sơ đã đồng bộ'
              : 'Hồ sơ chưa được lưu'}
        </Text>
        <View style={styles.actionRow}>
          {editable && (
            <PrimaryButton
              disabled={formLocked || (Boolean(profile) && !dirty)}
              label={
                authorityRecovery === 'refreshing'
                  ? 'Đang tải lại…'
                  : authorityRecovery === 'blocked'
                    ? 'Cần tải lại hồ sơ'
                    : saveMutation.isPending
                      ? 'Đang lưu…'
                      : profile
                        ? 'Lưu thay đổi'
                        : 'Tạo hồ sơ chuyên gia'
              }
              onPress={save}
              testID="specialist-profile-save"
            />
          )}
          {profile && ['DRAFT', 'REJECTED'].includes(state) && (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: formLocked || dirty }}
              disabled={formLocked || dirty}
              onPress={submitForReview}
              style={({ pressed }) => [
                styles.outlineButton,
                (formLocked || dirty) && styles.disabled,
                pressed && styles.pressed,
              ]}
              testID="specialist-profile-submit"
            >
              <Text style={styles.outlineLabel}>
                {state === 'REJECTED'
                  ? 'Gửi lại để xét duyệt'
                  : 'Gửi xét duyệt'}
              </Text>
            </Pressable>
          )}
          {state === 'APPROVED' && (
            <PrimaryButton
              label="Quản lý lịch khả dụng"
              onPress={() => router.push('./availability')}
            />
          )}
        </View>
        {state === 'APPROVED' && (
          <Text style={styles.sectionDetail}>
            Hồ sơ hiện tại đã được phê duyệt.
          </Text>
        )}
        {authorityRecovery === 'blocked' && (
          <Pressable
            accessibilityRole="button"
            onPress={reloadAuthority}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.secondaryLabel}>Thử tải lại hồ sơ</Text>
          </Pressable>
        )}
      </View>
      <AccountSignOutButton />
      <Modal
        visible={preview}
        transparent
        animationType="fade"
        onRequestClose={() => setPreview(false)}
      >
        <View style={styles.overlay}>
          <View accessibilityViewIsModal style={styles.preview}>
            <ScrollView contentContainerStyle={styles.sectionBody}>
              <Text
                accessibilityRole="header"
                style={[styles.sectionTitle, serif && styles.serif]}
              >
                Xem trước hồ sơ
              </Text>
              <Text style={styles.label}>{profile?.displayName}</Text>
              <Text style={styles.statusDescription}>{profile?.bio}</Text>
              <Text style={styles.sectionDetail}>
                {profile?.yearsOfExperience} năm kinh nghiệm
              </Text>
              <PrimaryButton
                label="Đóng xem trước"
                onPress={() => setPreview(false)}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  )
}

const styles = StyleSheet.create({
  serif: { fontFamily: 'DashboardSerif', fontWeight: '400' },
  grow: { flex: 1, minWidth: 0 },
  masthead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderColor: colors.line,
    marginBottom: 12,
  },
  mastheadTitle: { flex: 1, fontSize: 22, color: colors.ink },
  avatar: {
    borderRadius: 26,
    width: 48,
    height: 48,
    backgroundColor: colors.tealDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  heroBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  heroTitle: { fontSize: 29, lineHeight: 38 },
  chip: {
    backgroundColor: '#EDEFE9',
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 28,
    paddingHorizontal: 13,
  },
  chipText: { color: colors.tealDeep, fontSize: 13, fontWeight: '700' },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  stat: {
    flex: 1,
    minWidth: 64,
    backgroundColor: '#F1F2ED',
    padding: 8,
    borderRadius: 8,
    gap: 4,
  },
  statAccent: { backgroundColor: colors.tealPale },
  statValue: {
    color: colors.ink,
    fontWeight: '700',
    fontSize: 17,
    textAlign: 'center',
  },
  statLabel: { color: colors.inkSoft, fontSize: 12, textAlign: 'center' },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 25,
    borderColor: colors.line,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 70,
    gap: 11,
    padding: 14,
  },
  sectionNumber: {
    backgroundColor: colors.tealPale,
    color: colors.tealDeep,
    borderRadius: 22,
    width: 42,
    textAlign: 'center',
    lineHeight: 42,
    overflow: 'hidden',
    fontSize: 15,
    fontWeight: '700',
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '700',
  },
  sectionDetail: { color: colors.inkSoft, fontSize: 13, lineHeight: 19 },
  chevron: { color: colors.inkSoft, fontSize: 21 },
  sectionBody: { padding: 14, paddingTop: 6, gap: 14 },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#10262280',
    padding: 20,
  },
  preview: {
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 24,
    maxHeight: '80%',
    width: '100%',
    maxWidth: 550,
    alignSelf: 'center',
  },
  eyebrow: {
    color: colors.teal,
    fontSize: typography.eyebrow,
    fontWeight: '800',
    letterSpacing: 0.5,
    backgroundColor: colors.tealPale,
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 10,
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
    backgroundColor: colors.surface,
    borderRadius: 25,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    marginBottom: spacing.lg,
    padding: spacing.xl,
  },
  statusValue: {
    color: colors.tealDeep,
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: colors.tealPale,
    borderRadius: 16,
    maxWidth: 115,
    padding: 8,
  },
  statusDescription: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  reasonPanel: {
    borderColor: colors.terracotta,
    borderRadius: radii.control,
    borderWidth: 1,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  reasonTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  reasonText: {
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
  recoveryPanel: {
    marginBottom: spacing.lg,
  },
  form: {
    gap: spacing.lg,
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
    backgroundColor: '#F1F2ED',
    borderColor: colors.line,
    borderRadius: radii.control,
    borderWidth: 1,
    color: colors.ink,
    fontSize: typography.body,
    minHeight: 50,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  multilineInput: {
    minHeight: 132,
  },
  inputError: {
    borderColor: '#9B352D',
  },
  fieldError: {
    color: '#9B352D',
    fontSize: 14,
    lineHeight: 20,
  },
  helpText: {
    color: colors.inkFaint,
    fontSize: 14,
    lineHeight: 20,
  },
  choiceGroup: {
    gap: spacing.sm,
  },
  choice: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.control,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  choiceSelected: {
    backgroundColor: colors.tealPale,
    borderColor: colors.tealDeep,
  },
  choiceLabel: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '600',
  },
  choiceLabelSelected: {
    color: colors.tealDeep,
    fontWeight: '800',
  },
  confirmPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.amber,
    borderRadius: radii.panel,
    borderWidth: 1,
    marginTop: spacing.xl,
    padding: spacing.xl,
  },
  confirmTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  confirmDescription: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
    marginBottom: spacing.lg,
  },
  inlineActions: {
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  actions: {
    backgroundColor: colors.surface,
    borderRadius: 25,
    padding: 16,
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  outlineButton: {
    borderColor: colors.tealDeep,
    borderRadius: radii.control,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  outlineLabel: {
    color: colors.tealDeep,
    fontSize: typography.body,
    fontWeight: '700',
  },
  secondaryButton: {
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
  secondaryLabel: {
    color: colors.tealDeep,
    fontSize: typography.body,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.65,
  },
})
