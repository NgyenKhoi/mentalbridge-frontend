import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useState } from 'react'
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

import type { CareProfileApi } from './profile-api'
import type { CareProfile } from './profile-contract'
import {
  profileErrorsFromProblem,
  type ProfileFieldErrors,
  type ProfileForm,
  validateProfileForm,
} from './profile-form'

const emptyForm: ProfileForm = {
  displayName: '',
  dateOfBirth: '',
  gender: '',
}

function profileForm(profile: CareProfile | null): ProfileForm {
  return profile
    ? {
        displayName: profile.displayName,
        dateOfBirth: profile.dateOfBirth ?? '',
        gender: profile.gender ?? '',
      }
    : emptyForm
}

function isMissingProfile(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 404 &&
    error.code === 'PROFILE_NOT_FOUND'
  )
}

function loadErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) {
    return 'Phiên đăng nhập đã hết hạn. Đăng nhập lại để xem hồ sơ của bạn.'
  }
  if (error instanceof ApiError && error.status === 403) {
    return 'Tài khoản này không có quyền xem hồ sơ cá nhân.'
  }
  return 'Chưa thể tải hồ sơ lúc này. Thông tin đã lưu không bị thay đổi.'
}

function saveErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) {
    return 'Phiên đăng nhập đã hết hạn. Nội dung bạn vừa nhập vẫn được giữ lại.'
  }
  if (error instanceof ApiError && error.status === 403) {
    return 'Tài khoản này không có quyền thay đổi hồ sơ.'
  }
  if (error instanceof ApiError && error.status === 409) {
    return 'Chưa thể lưu thay đổi này. Hãy tải lại hồ sơ rồi thử lại.'
  }
  return 'Chưa thể lưu hồ sơ lúc này. Nội dung bạn vừa nhập vẫn được giữ lại.'
}

function StateMessage({
  message,
  tone = 'neutral',
}: Readonly<{ message: string; tone?: 'error' | 'neutral' | 'success' }>) {
  return (
    <Text
      accessibilityLiveRegion={tone === 'neutral' ? 'polite' : 'assertive'}
      style={[
        styles.runtimeMessage,
        tone === 'error' && styles.errorMessage,
        tone === 'success' && styles.successMessage,
      ]}
    >
      {message}
    </Text>
  )
}

type RuntimeNotice = Readonly<{
  message: string
  tone: 'error' | 'success'
}>

export function UserProfileScreen({ api }: Readonly<{ api: CareProfileApi }>) {
  const { session, signOut } = useSession()
  const queryClient = useQueryClient()
  const subject = session?.subject
  const queryKey = ['care-profile', subject] as const
  const [form, setForm] = useState<ProfileForm>(emptyForm)
  const [formSourceKey, setFormSourceKey] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({})
  const [runtimeNotice, setRuntimeNotice] = useState<RuntimeNotice | null>(null)

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
  const nextFormSourceKey = profileQuery.isSuccess
    ? `${subject}:${profile?.version ?? 'empty'}`
    : null

  if (nextFormSourceKey !== null && nextFormSourceKey !== formSourceKey) {
    setFormSourceKey(nextFormSourceKey)
    setForm(profileForm(profile))
    setFieldErrors({})
  }

  const saveProfile = useMutation({
    mutationFn: async (request: ReturnType<typeof validateProfileForm>) => {
      if (!request.success) throw new Error('Profile form was not validated')
      return api.putProfile(request.value, profile?.version)
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKey, saved)
      setForm(profileForm(saved))
      setFieldErrors({})
      setRuntimeNotice({
        message: profile ? 'Đã lưu thay đổi hồ sơ.' : 'Đã tạo hồ sơ của bạn.',
        tone: 'success',
      })
      void queryClient.invalidateQueries({ queryKey, refetchType: 'none' })
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 412) {
        setRuntimeNotice({
          message:
            'Hồ sơ vừa được cập nhật ở nơi khác. Đang tải lại thông tin mới nhất trước khi bạn lưu tiếp.',
          tone: 'error',
        })
        void profileQuery.refetch()
        return
      }

      const serverFieldErrors =
        error instanceof ApiError ? profileErrorsFromProblem(error.problem) : {}
      setFieldErrors(serverFieldErrors)
      setRuntimeNotice({ message: saveErrorMessage(error), tone: 'error' })
    },
  })

  const updateField = (field: keyof ProfileForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
    setRuntimeNotice(null)
  }

  const submit = () => {
    const validation = validateProfileForm(form)
    if (!validation.success) {
      setFieldErrors(validation.errors)
      setRuntimeNotice({
        message: 'Kiểm tra lại các thông tin được đánh dấu bên dưới.',
        tone: 'error',
      })
      return
    }

    setFieldErrors({})
    setRuntimeNotice(null)
    saveProfile.mutate(validation)
  }

  const reset = () => {
    setForm(profileForm(profile))
    setFieldErrors({})
    setRuntimeNotice(null)
  }

  if (!subject) {
    return (
      <Screen>
        <Text accessibilityRole="header" style={styles.title}>
          Hồ sơ cá nhân
        </Text>
        <StateMessage
          message="Bạn cần đăng nhập bằng tài khoản cá nhân để xem hồ sơ."
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
            accessibilityLabel="Đang tải hồ sơ"
            color={colors.tealDeep}
            size="large"
          />
          <Text accessibilityRole="header" style={styles.stateTitle}>
            Đang tải hồ sơ
          </Text>
          <Text style={styles.stateDescription}>
            Thông tin đã lưu của bạn đang được tải.
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
    const forbidden =
      profileQuery.error instanceof ApiError &&
      profileQuery.error.status === 403

    return (
      <Screen>
        <Text style={styles.eyebrow}>TÀI KHOẢN CỦA BẠN</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Hồ sơ cá nhân
        </Text>
        <StateMessage
          message={loadErrorMessage(profileQuery.error)}
          tone="error"
        />
        <PrimaryButton
          label={
            unauthorized ? 'Đăng nhập lại' : forbidden ? 'Quay lại' : 'Thử lại'
          }
          onPress={() => {
            if (unauthorized) void signOut()
            else if (forbidden) router.back()
            else void profileQuery.refetch()
          }}
        />
      </Screen>
    )
  }

  const originalForm = profileForm(profile)
  const hasChanges =
    form.displayName !== originalForm.displayName ||
    form.dateOfBirth !== originalForm.dateOfBirth ||
    form.gender !== originalForm.gender

  return (
    <Screen>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.back()}
        style={({ pressed }) => [
          styles.backButton,
          pressed && styles.secondaryPressed,
        ]}
      >
        <Text style={styles.backLabel}>← Quay lại</Text>
      </Pressable>

      <Text style={styles.eyebrow}>TÀI KHOẢN CỦA BẠN</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Hồ sơ cá nhân
      </Text>
      <Text style={styles.description}>
        Giữ thông tin cơ bản của bạn chính xác để tiếp tục sử dụng các tính năng
        cá nhân.
      </Text>

      {!profile && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Bạn chưa có hồ sơ</Text>
          <Text style={styles.emptyDescription}>
            Thêm tên hiển thị để bắt đầu. Ngày sinh và giới tính là thông tin
            không bắt buộc.
          </Text>
        </View>
      )}

      {profileQuery.isError && profileQuery.data !== undefined && (
        <View style={styles.partialError}>
          <StateMessage
            message="Chưa thể làm mới hồ sơ. Bạn vẫn có thể xem thông tin đã tải trước đó."
            tone="error"
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => void profileQuery.refetch()}
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.secondaryPressed,
            ]}
          >
            <Text style={styles.secondaryLabel}>Thử tải lại</Text>
          </Pressable>
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
          <Text style={styles.label}>Tên hiển thị</Text>
          <TextInput
            accessibilityLabel="Tên hiển thị"
            accessibilityState={{ disabled: saveProfile.isPending }}
            autoCapitalize="words"
            autoComplete="name"
            editable={!saveProfile.isPending}
            maxLength={120}
            onChangeText={(value) => updateField('displayName', value)}
            style={[styles.input, fieldErrors.displayName && styles.inputError]}
            value={form.displayName}
          />
          {fieldErrors.displayName && (
            <Text accessibilityLiveRegion="assertive" style={styles.fieldError}>
              {fieldErrors.displayName}
            </Text>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Ngày sinh (không bắt buộc)</Text>
          <TextInput
            accessibilityLabel="Ngày sinh"
            accessibilityState={{ disabled: saveProfile.isPending }}
            autoCapitalize="none"
            editable={!saveProfile.isPending}
            inputMode="numeric"
            maxLength={10}
            onChangeText={(value) => updateField('dateOfBirth', value)}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.inkFaint}
            style={[styles.input, fieldErrors.dateOfBirth && styles.inputError]}
            value={form.dateOfBirth}
          />
          {fieldErrors.dateOfBirth && (
            <Text accessibilityLiveRegion="assertive" style={styles.fieldError}>
              {fieldErrors.dateOfBirth}
            </Text>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Giới tính (không bắt buộc)</Text>
          <TextInput
            accessibilityLabel="Giới tính"
            accessibilityState={{ disabled: saveProfile.isPending }}
            editable={!saveProfile.isPending}
            maxLength={32}
            onChangeText={(value) => updateField('gender', value)}
            style={[styles.input, fieldErrors.gender && styles.inputError]}
            value={form.gender}
          />
          {fieldErrors.gender && (
            <Text accessibilityLiveRegion="assertive" style={styles.fieldError}>
              {fieldErrors.gender}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          disabled={saveProfile.isPending || (Boolean(profile) && !hasChanges)}
          label={
            saveProfile.isPending
              ? 'Đang lưu…'
              : profile
                ? 'Lưu thay đổi'
                : 'Tạo hồ sơ'
          }
          onPress={submit}
        />
        {hasChanges && !saveProfile.isPending && (
          <Pressable
            accessibilityRole="button"
            onPress={reset}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.secondaryPressed,
            ]}
          >
            <Text style={styles.secondaryLabel}>Hoàn tác thay đổi</Text>
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
  stateDescription: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
    textAlign: 'center',
  },
  emptyState: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.panel,
    marginBottom: spacing.xl,
    padding: spacing.xl,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  emptyDescription: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  runtimeMessage: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
    marginBottom: spacing.lg,
  },
  partialError: {
    marginBottom: spacing.lg,
  },
  errorMessage: {
    color: '#9B352D',
  },
  successMessage: {
    color: colors.tealDeep,
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
  inputError: {
    borderColor: '#9B352D',
  },
  fieldError: {
    color: '#9B352D',
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    alignItems: 'flex-start',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  secondaryButton: {
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
  retryButton: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
  secondaryLabel: {
    color: colors.tealDeep,
    fontSize: typography.body,
    fontWeight: '700',
  },
  secondaryPressed: {
    opacity: 0.65,
  },
})
