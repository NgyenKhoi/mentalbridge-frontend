import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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

export function SpecialistProfileScreen({
  api,
}: Readonly<{ api: SpecialistApi }>) {
  const { session, signOut } = useSession()
  const queryClient = useQueryClient()
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
      <Screen>
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
      <Screen>
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
        Hồ sơ nghề nghiệp
      </Text>
      <Text style={styles.description}>
        Hoàn thiện thông tin hỗ trợ của bạn và gửi xét duyệt. Hồ sơ này tách
        biệt với hồ sơ cá nhân và danh tính trong Cộng đồng.
      </Text>

      <View style={styles.statusPanel}>
        <Text style={styles.statusLabel}>Trạng thái hồ sơ</Text>
        <Text accessibilityLiveRegion="polite" style={styles.statusValue}>
          {specialistProfileStatusLabels[state]}
        </Text>
        <Text style={styles.statusDescription}>
          {state === 'PENDING_REVIEW'
            ? 'Hồ sơ đang được xem xét. Nếu lưu thay đổi, hồ sơ sẽ rời hàng đợi cho đến khi bạn gửi lại.'
            : state === 'REJECTED'
              ? 'Chỉnh sửa theo phản hồi bên dưới, lưu hồ sơ rồi gửi lại để xét duyệt.'
              : state === 'APPROVED'
                ? 'Hồ sơ đã được phê duyệt. Bạn có thể quản lý lịch tư vấn trực tuyến.'
                : state === 'SUSPENDED'
                  ? 'Hồ sơ đang tạm ngưng. Chỉ quản trị viên có thể khôi phục trạng thái.'
                  : 'Lưu hồ sơ trước, sau đó gửi xét duyệt khi thông tin đã sẵn sàng.'}
        </Text>
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
        <View style={styles.field}>
          <Text style={styles.label}>Tên hiển thị nghề nghiệp</Text>
          <TextInput
            accessibilityLabel="Tên hiển thị nghề nghiệp"
            accessibilityState={{ disabled: formLocked }}
            autoCapitalize="words"
            editable={!formLocked}
            maxLength={120}
            onChangeText={(value) => updateField('displayName', value)}
            style={[styles.input, fieldErrors.displayName && styles.inputError]}
            value={form.displayName}
          />
          {fieldError(fieldErrors, 'displayName')}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Giới thiệu</Text>
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
              {state === 'REJECTED' ? 'Gửi lại để xét duyệt' : 'Gửi xét duyệt'}
            </Text>
          </Pressable>
        )}
        {state === 'APPROVED' && (
          <PrimaryButton
            label="Quản lý lịch khả dụng"
            onPress={() => router.push('./availability')}
          />
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
    alignItems: 'flex-start',
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
