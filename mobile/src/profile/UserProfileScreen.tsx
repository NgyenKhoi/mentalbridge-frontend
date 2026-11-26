import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { GuideReplayButton } from '@/onboarding/OnboardingGuide'
import {
  ActivityIndicator,
  Pressable,
  type ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { ApiError } from '@/api/api-error'
import { useSession } from '@/auth/session-context'
import { AccountSignOutButton } from '@/components/AccountSignOutButton'
import { PrimaryButton } from '@/components/PrimaryButton'
import { Screen } from '@/components/Screen'
import { ChangePasswordScreen } from '@/password/ChangePasswordScreen'
import { colors, radii, spacing, typography } from '@/theme/tokens'
import { useDashboardFonts } from '@/theme/useDashboardFonts'

import { loadCareProfile, type CareProfileApi } from './profile-api'
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

type StaleRecovery = 'idle' | 'refreshing' | 'blocked'

const profileSections = [
  ['profile', 'Hồ sơ'],
  ['notifications', 'Thông báo'],
  ['security', 'Bảo mật'],
] as const
type ProfileSection = (typeof profileSections)[number][0]

export function UserProfileScreen({ api }: Readonly<{ api: CareProfileApi }>) {
  const { session, signOut } = useSession()
  const queryClient = useQueryClient()
  const subject = session?.subject
  const activeSubjectRef = useRef(subject)
  const queryKey = ['care-profile', subject] as const
  const [form, setForm] = useState<ProfileForm>(emptyForm)
  const [formSourceKey, setFormSourceKey] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({})
  const [runtimeNotice, setRuntimeNotice] = useState<RuntimeNotice | null>(null)
  const [staleRecovery, setStaleRecovery] = useState<StaleRecovery>('idle')
  const [passwordSheetOwner, setPasswordSheetOwner] = useState<string | null>(
    null,
  )
  const fontsLoaded = useDashboardFonts()
  const scrollRef = useRef<ScrollView>(null)
  const sectionOffset = useRef<Record<ProfileSection, number>>({
    profile: 0,
    notifications: 0,
    security: 0,
  })
  const staleRecoveryRef = useRef(false)

  useEffect(() => {
    activeSubjectRef.current = subject
  }, [subject])

  useEffect(() => {
    if (formSourceKey !== null) staleRecoveryRef.current = false
  }, [formSourceKey])

  const profileQuery = useQuery({
    queryKey,
    enabled: Boolean(subject),
    refetchOnMount: 'always',
    queryFn: () => loadCareProfile(api),
  })

  const profile = profileQuery.data ?? null
  const nextFormSourceKey = profileQuery.isSuccess
    ? `${subject}:${profile?.version ?? 'empty'}`
    : null

  if (nextFormSourceKey !== null && nextFormSourceKey !== formSourceKey) {
    setFormSourceKey(nextFormSourceKey)
    setForm(profileForm(profile))
    setFieldErrors({})
    if (staleRecovery !== 'idle') setStaleRecovery('idle')
  }

  const refreshAuthoritativeProfile = async (blockSave: boolean) => {
    const recoverySubject = subject
    if (blockSave) {
      staleRecoveryRef.current = true
      setStaleRecovery('refreshing')
    }

    const result = await profileQuery.refetch()
    if (!blockSave || activeSubjectRef.current !== recoverySubject) return

    if (result.isSuccess) {
      const refreshedProfile = result.data ?? null
      setFormSourceKey(
        `${recoverySubject}:${refreshedProfile?.version ?? 'empty'}`,
      )
      setForm(profileForm(refreshedProfile))
      setFieldErrors({})
      staleRecoveryRef.current = false
      setStaleRecovery('idle')
      setRuntimeNotice({
        message:
          'Đã tải thông tin mới nhất. Hãy kiểm tra lại trước khi lưu thay đổi.',
        tone: 'success',
      })
      return
    }

    setStaleRecovery('blocked')
    setRuntimeNotice(null)
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
        void refreshAuthoritativeProfile(true)
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
    if (staleRecoveryRef.current || saveProfile.isPending) return

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
        <GuideReplayButton />
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
        <GuideReplayButton />
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
    const forbidden =
      profileQuery.error instanceof ApiError &&
      profileQuery.error.status === 403

    return (
      <Screen>
        <GuideReplayButton />
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
        {!unauthorized && <AccountSignOutButton />}
      </Screen>
    )
  }

  const originalForm = profileForm(profile)
  const hasChanges =
    form.displayName !== originalForm.displayName ||
    form.dateOfBirth !== originalForm.dateOfBirth ||
    form.gender !== originalForm.gender
  const formLocked = saveProfile.isPending || staleRecovery !== 'idle'
  const initials = profile?.displayName
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => Array.from(part)[0])
    .join('')
    .toLocaleUpperCase('vi-VN')
  const joined = profile
    ? new Intl.DateTimeFormat('vi-VN', {
        month: '2-digit',
        year: 'numeric',
        timeZone: 'Asia/Ho_Chi_Minh',
      }).format(new Date(profile.createdAt))
    : null

  return (
    <Screen layout="dashboard" backgroundColor="#f5f9f6" scrollRef={scrollRef}>
      <View style={styles.masthead}>
        <View style={styles.brandIcon}>
          <Text accessible={false} style={styles.secondaryLabel}>
            ✿
          </Text>
        </View>
        <View style={styles.fieldGrow}>
          <Text style={[styles.brand, fontsLoaded && styles.serif]}>
            MentalBridge
          </Text>
          <Text style={styles.caption}>Tài khoản cá nhân</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mở thông báo"
          onPress={() => router.push('/(user)/notifications')}
          style={styles.headerButton}
        >
          <Text accessible={false} style={styles.secondaryLabel}>
            ♧
          </Text>
        </Pressable>
      </View>
      <GuideReplayButton />
      <View style={[styles.card, styles.overview]}>
        <View style={styles.profileHeading}>
          <View style={styles.avatar}>
            <Text accessible={false} style={styles.avatarText}>
              {initials || '◎'}
            </Text>
          </View>
          <View style={styles.fieldGrow}>
            <Text style={styles.accountBadge}>HỒ SƠ CÁ NHÂN</Text>
            <Text
              accessibilityRole="header"
              numberOfLines={2}
              style={[styles.profileName, fontsLoaded && styles.serif]}
            >
              {profile?.displayName ?? 'Hồ sơ cá nhân'}
            </Text>
            {joined ? (
              <Text style={styles.caption}>Tạo hồ sơ {joined}</Text>
            ) : null}
          </View>
        </View>
        {profile ? (
          <View style={styles.facts}>
            <View style={styles.fact}>
              <Text style={styles.caption}>Múi giờ</Text>
              <Text style={styles.factValue}>
                {profile.timezone === 'Asia/Ho_Chi_Minh'
                  ? 'Giờ Việt Nam'
                  : profile.timezone}
              </Text>
            </View>
            <View style={styles.fact}>
              <Text style={styles.caption}>Nhắc nhở hồ sơ</Text>
              <Text style={styles.factValue}>
                {profile.reminderEnabled ? 'Đang bật' : 'Đang tắt'}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
      <View style={styles.sectionLinks}>
        {profileSections.map(([key, label], index) => (
          <Pressable
            accessibilityRole="button"
            key={key}
            onPress={() =>
              scrollRef.current?.scrollTo({
                y: sectionOffset.current[key],
                animated: true,
              })
            }
            style={[
              styles.sectionLink,
              index === 0 && styles.sectionLinkPrimary,
            ]}
          >
            <Text
              style={[
                styles.sectionLinkText,
                index === 0 && styles.sectionLinkPrimaryText,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

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
            message={
              staleRecovery === 'blocked'
                ? 'Chưa thể tải thông tin mới nhất. Hãy thử tải lại trước khi tiếp tục chỉnh sửa.'
                : 'Chưa thể làm mới hồ sơ. Bạn vẫn có thể xem thông tin đã tải trước đó.'
            }
            tone="error"
          />
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              void refreshAuthoritativeProfile(staleRecoveryRef.current)
            }
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

      <View
        style={styles.card}
        onLayout={(event) => {
          sectionOffset.current.profile = event.nativeEvent.layout.y
        }}
      >
        <View style={styles.cardHeading}>
          <View style={styles.cardIcon}>
            <Text accessible={false} style={styles.secondaryLabel}>
              ◎
            </Text>
          </View>
          <View style={styles.fieldGrow}>
            <Text accessibilityRole="header" style={styles.securityTitle}>
              Thông tin cá nhân
            </Text>
            <Text style={styles.caption}>Cập nhật thông tin hồ sơ của bạn</Text>
          </View>
        </View>
        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Tên hiển thị</Text>
            <TextInput
              accessibilityLabel="Tên hiển thị"
              accessibilityState={{ disabled: formLocked }}
              autoCapitalize="words"
              autoComplete="name"
              editable={!formLocked}
              maxLength={120}
              onChangeText={(value) => updateField('displayName', value)}
              style={[
                styles.input,
                fieldErrors.displayName && styles.inputError,
              ]}
              value={form.displayName}
            />
            {fieldErrors.displayName && (
              <Text
                accessibilityLiveRegion="assertive"
                style={styles.fieldError}
              >
                {fieldErrors.displayName}
              </Text>
            )}
          </View>

          <View style={styles.fieldRow}>
            <View style={[styles.field, styles.sideField]}>
              <Text style={styles.label}>Ngày sinh (không bắt buộc)</Text>
              <TextInput
                accessibilityLabel="Ngày sinh"
                accessibilityState={{ disabled: formLocked }}
                autoCapitalize="none"
                editable={!formLocked}
                inputMode="numeric"
                maxLength={10}
                onChangeText={(value) => updateField('dateOfBirth', value)}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.inkFaint}
                style={[
                  styles.input,
                  fieldErrors.dateOfBirth && styles.inputError,
                ]}
                value={form.dateOfBirth}
              />
              {fieldErrors.dateOfBirth && (
                <Text
                  accessibilityLiveRegion="assertive"
                  style={styles.fieldError}
                >
                  {fieldErrors.dateOfBirth}
                </Text>
              )}
            </View>

            <View style={[styles.field, styles.sideField]}>
              <Text style={styles.label}>Giới tính (không bắt buộc)</Text>
              <TextInput
                accessibilityLabel="Giới tính"
                accessibilityState={{ disabled: formLocked }}
                editable={!formLocked}
                maxLength={32}
                onChangeText={(value) => updateField('gender', value)}
                style={[styles.input, fieldErrors.gender && styles.inputError]}
                value={form.gender}
              />
              {fieldErrors.gender && (
                <Text
                  accessibilityLiveRegion="assertive"
                  style={styles.fieldError}
                >
                  {fieldErrors.gender}
                </Text>
              )}
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <PrimaryButton
            disabled={formLocked || (Boolean(profile) && !hasChanges)}
            label={
              staleRecovery === 'refreshing'
                ? 'Đang tải lại…'
                : staleRecovery === 'blocked'
                  ? 'Cần tải lại hồ sơ'
                  : saveProfile.isPending
                    ? 'Đang lưu…'
                    : profile
                      ? 'Lưu thay đổi'
                      : 'Tạo hồ sơ'
            }
            onPress={submit}
            tone="darkPill"
          />
          {hasChanges && !formLocked && (
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
      </View>

      <View
        style={styles.card}
        onLayout={(event) => {
          sectionOffset.current.notifications = event.nativeEvent.layout.y
        }}
      >
        <View style={styles.cardHeading}>
          <View style={styles.cardIcon}>
            <Text accessible={false} style={styles.secondaryLabel}>
              ♧
            </Text>
          </View>
          <View style={styles.fieldGrow}>
            <Text accessibilityRole="header" style={styles.securityTitle}>
              Thông báo và nhắc nhở
            </Text>
            <Text style={styles.caption}>
              Quản lý thông báo nhận trong ứng dụng
            </Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push('/(user)/notification-preferences')}
          style={styles.softLink}
        >
          <Text style={styles.secondaryLabel}>Cài đặt thông báo</Text>
          <Text accessible={false} style={styles.secondaryLabel}>
            ›
          </Text>
        </Pressable>
      </View>
      <View
        style={styles.card}
        onLayout={(event) => {
          sectionOffset.current.security = event.nativeEvent.layout.y
        }}
      >
        <View style={styles.cardHeading}>
          <View style={styles.cardIcon}>
            <Text accessible={false} style={styles.secondaryLabel}>
              ◇
            </Text>
          </View>
          <View style={styles.fieldGrow}>
            <Text accessibilityRole="header" style={styles.securityTitle}>
              Bảo mật tài khoản
            </Text>
            <Text style={styles.caption}>Mật khẩu và phiên đăng nhập</Text>
          </View>
        </View>
        <Text style={styles.securityDescription}>
          Đổi mật khẩu sẽ kết thúc mọi phiên đăng nhập để bảo vệ tài khoản của
          bạn.
        </Text>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Đổi mật khẩu"
          onPress={() => setPasswordSheetOwner(subject)}
          style={({ pressed }) => [
            styles.softLink,
            pressed && styles.secondaryPressed,
          ]}
        >
          <Text style={styles.secondaryLabel}>Đổi mật khẩu</Text>
          <Text accessible={false} style={styles.secondaryLabel}>
            ›
          </Text>
        </Pressable>
      </View>
      {passwordSheetOwner === subject ? (
        <ChangePasswordScreen onClose={() => setPasswordSheetOwner(null)} />
      ) : null}
      <AccountSignOutButton />
    </Screen>
  )
}

const styles = StyleSheet.create({
  masthead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  brandIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: '#deede5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: { fontSize: 18, fontWeight: '700', color: colors.tealDeep },
  serif: { fontFamily: 'DashboardSerif' },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderWidth: 1,
    borderColor: '#e4ece6',
    backgroundColor: colors.surface,
    borderRadius: radii.panel,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  overview: { backgroundColor: '#f0f6f2' },
  profileHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: radii.panel,
    backgroundColor: colors.tealPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.tealDeep, fontSize: 19, fontWeight: '700' },
  accountBadge: {
    color: colors.tealDeep,
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: '800',
  },
  profileName: {
    color: colors.ink,
    fontSize: 21,
    lineHeight: 28,
    fontWeight: '700',
  },
  caption: { color: colors.inkSoft, fontSize: 12, lineHeight: 18 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  fact: {
    minWidth: 116,
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.control,
    padding: spacing.md,
  },
  factValue: { color: colors.tealDeep, fontSize: 14, fontWeight: '700' },
  sectionLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionLink: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: '#e9f1ed',
  },
  sectionLinkPrimary: { backgroundColor: colors.tealDeep },
  sectionLinkText: { color: colors.tealDeep, fontSize: 13, fontWeight: '700' },
  sectionLinkPrimaryText: { color: colors.white },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.control,
    backgroundColor: '#e4efe9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldGrow: { flex: 1 },
  fieldRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  sideField: { flex: 1, minWidth: 120 },
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
    gap: spacing.md,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#f0f4f1',
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
    gap: spacing.sm,
  },
  securityTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  securityDescription: {
    color: colors.inkSoft,
    fontSize: 14,
    lineHeight: 20,
  },
  softLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: spacing.md,
    backgroundColor: '#eff5f1',
    borderRadius: radii.control,
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
