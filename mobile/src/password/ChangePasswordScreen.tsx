import { router } from 'expo-router'
import { useRef, useState } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { z } from 'zod'

import { ApiError } from '@/api/api-error'
import { useSession } from '@/auth/session-context'
import { PrimaryButton } from '@/components/PrimaryButton'
import { USER_TAB_BAR_HEIGHT } from '@/navigation/UserTabBar'
import { colors, radii, spacing } from '@/theme/tokens'
import { useDashboardFonts } from '@/theme/useDashboardFonts'

import { passwordStyles as styles } from './password-styles'
import {
  type PasswordFormErrors,
  validateNewPassword,
  validatePasswordChange,
} from './password-validation'

function changeErrorMessage(error: unknown) {
  if (
    error instanceof ApiError &&
    (error.code === 'INVALID_CREDENTIALS' || error.status === 401)
  ) {
    return 'Mật khẩu hiện tại không đúng hoặc phiên đăng nhập không còn hợp lệ.'
  }
  if (error instanceof ApiError && error.code === 'VALIDATION_FAILED') {
    return 'Mật khẩu mới chưa đáp ứng chính sách bảo mật.'
  }
  if (
    error instanceof ApiError &&
    (error.code === 'NETWORK_ERROR' ||
      error.code === 'REQUEST_TIMEOUT' ||
      error.code === 'IDENTITY_TIMEOUT' ||
      error.code === 'IDENTITY_UNAVAILABLE')
  ) {
    return 'Dịch vụ đổi mật khẩu tạm thời chưa sẵn sàng. Nội dung đã nhập vẫn được giữ để bạn thử lại.'
  }
  return 'Không thể đổi mật khẩu lúc này. Vui lòng thử lại.'
}

function PasswordField({
  id,
  label,
  value,
  error,
  autoComplete,
  onChangeText,
  action,
  placeholder,
  disabled,
}: Readonly<{
  id: string
  label: string
  value: string
  error: string | undefined
  autoComplete: 'current-password' | 'new-password'
  onChangeText: (value: string) => void
  action?: React.ReactNode
  placeholder: string
  disabled: boolean
}>) {
  const [visible, setVisible] = useState(false)
  return (
    <View style={sheet.field}>
      <View style={sheet.labelRow}>
        <Text nativeID={`${id}-label`} style={sheet.label}>
          {label}
        </Text>
        {action}
      </View>
      <View style={[sheet.inputRow, error && styles.inputError]}>
        <TextInput
          accessibilityLabel={label}
          accessibilityLabelledBy={`${id}-label`}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!disabled}
          maxLength={128}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.inkFaint}
          secureTextEntry={!visible}
          style={sheet.input}
          value={value}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${visible ? 'Ẩn' : 'Hiện'} ${label.toLocaleLowerCase('vi-VN')}`}
          onPress={() => setVisible((value) => !value)}
          style={sheet.reveal}
        >
          <Text style={sheet.link}>{visible ? 'Ẩn' : 'Hiện'}</Text>
        </Pressable>
      </View>
      {error ? (
        <Text accessibilityLiveRegion="assertive" style={styles.fieldError}>
          {error}
        </Text>
      ) : null}
    </View>
  )
}

export function ChangePasswordScreen({
  onClose,
}: Readonly<{ onClose: () => void }>) {
  const { changePassword, requestPasswordRecovery } = useSession()
  const fontsLoaded = useDashboardFonts()
  const insets = useSafeAreaInsets()
  const submitting = useRef(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [fieldErrors, setFieldErrors] = useState<PasswordFormErrors>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [recovering, setRecovering] = useState(false)
  const [email, setEmail] = useState('')
  const [recoverySent, setRecoverySent] = useState(false)
  const meetsLength =
    newPassword.length > 0 &&
    !validateNewPassword(newPassword, newPassword).newPassword
  const close = () => {
    if (submitting.current) return
    onClose()
  }
  const showRecovery = (value: boolean) => {
    setError('')
    setRecoverySent(false)
    setRecovering(value)
    if (value) {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmation('')
      setFieldErrors({})
    }
  }

  const recover = async () => {
    if (submitting.current) return
    const address = z.email().safeParse(email.trim().toLowerCase())
    if (!address.success) {
      setError('Nhập một địa chỉ email hợp lệ.')
      return
    }
    submitting.current = true
    setLoading(true)
    setError('')
    try {
      await requestPasswordRecovery(address.data)
      setRecoverySent(true)
    } catch {
      setError('Chưa thể gửi yêu cầu đặt lại mật khẩu. Vui lòng thử lại.')
    } finally {
      submitting.current = false
      setLoading(false)
    }
  }

  const submit = async () => {
    if (submitting.current) return
    const errors = validatePasswordChange(
      currentPassword,
      newPassword,
      confirmation,
    )
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    submitting.current = true
    setLoading(true)
    setError('')
    try {
      await changePassword(currentPassword, newPassword)
      router.replace('/sign-in')
    } catch (caught) {
      setError(changeErrorMessage(caught))
    } finally {
      submitting.current = false
      setLoading(false)
    }
  }

  return (
    <Modal
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      supportedOrientations={['portrait', 'landscape']}
      onRequestClose={close}
    >
      <SafeAreaView edges={['top', 'left', 'right']} style={sheet.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={sheet.fill}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đóng bảng bảo mật"
            disabled={loading}
            onPress={close}
            style={StyleSheet.absoluteFill}
          />
          <View accessibilityViewIsModal style={sheet.panel}>
            <View style={sheet.handle} />
            <View style={sheet.header}>
              <View style={sheet.headerIcon}>
                <Text accessible={false} style={sheet.link}>
                  ◇
                </Text>
              </View>
              <Text
                accessibilityRole="header"
                style={[sheet.title, fontsLoaded && sheet.serif]}
              >
                {recovering ? 'Quên mật khẩu' : 'Đổi mật khẩu'}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đóng"
                disabled={loading}
                onPress={close}
                style={sheet.close}
              >
                <Text style={sheet.closeText}>×</Text>
              </Pressable>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={sheet.scroll}
              contentContainerStyle={sheet.content}
            >
              {recovering ? (
                <>
                  <Text style={sheet.description}>
                    Nhập email của tài khoản để yêu cầu liên kết đặt lại mật
                    khẩu.
                  </Text>
                  {recoverySent ? (
                    <Text accessibilityLiveRegion="polite" style={sheet.info}>
                      Hãy kiểm tra email. Nếu tài khoản đủ điều kiện, bạn sẽ
                      nhận được liên kết đặt lại mật khẩu.
                    </Text>
                  ) : (
                    <>
                      <Text style={sheet.label}>Email</Text>
                      <View style={sheet.inputRow}>
                        <TextInput
                          accessibilityLabel="Email"
                          autoComplete="email"
                          inputMode="email"
                          autoCapitalize="none"
                          editable={!loading}
                          onChangeText={setEmail}
                          style={sheet.input}
                          value={email}
                        />
                      </View>
                      <PrimaryButton
                        disabled={loading}
                        label={loading ? 'Đang gửi…' : 'Gửi liên kết đặt lại'}
                        onPress={() => void recover()}
                        tone="darkPill"
                      />
                    </>
                  )}
                  <Pressable
                    accessibilityRole="button"
                    disabled={loading}
                    onPress={() => showRecovery(false)}
                    style={sheet.reveal}
                  >
                    <Text style={sheet.link}>Quay lại đổi mật khẩu</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={sheet.description}>
                    Sau khi đổi, bạn cần đăng nhập lại trên các thiết bị bằng
                    mật khẩu mới.
                  </Text>
                  <PasswordField
                    id="current-password"
                    label="Mật khẩu hiện tại"
                    autoComplete="current-password"
                    value={currentPassword}
                    error={fieldErrors.currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder="Nhập mật khẩu hiện tại"
                    disabled={loading}
                    action={
                      <Pressable
                        accessibilityRole="button"
                        disabled={loading}
                        onPress={() => showRecovery(true)}
                        hitSlop={6}
                      >
                        <Text style={sheet.link}>Quên mật khẩu?</Text>
                      </Pressable>
                    }
                  />
                  <PasswordField
                    id="change-new-password"
                    label="Mật khẩu mới"
                    autoComplete="new-password"
                    value={newPassword}
                    error={fieldErrors.newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Nhập mật khẩu mới"
                    disabled={loading}
                  />
                  <View style={sheet.progress}>
                    {Array.from({ length: 4 }, (_, index) => (
                      <View
                        key={index}
                        style={[
                          sheet.progressSegment,
                          (meetsLength ||
                            index <
                              Math.min(
                                3,
                                Math.floor(Array.from(newPassword).length / 3),
                              )) &&
                            sheet.progressFilled,
                        ]}
                      />
                    ))}
                  </View>
                  <Text accessibilityLiveRegion="polite" style={sheet.hint}>
                    {meetsLength
                      ? 'Đạt yêu cầu độ dài.'
                      : 'Ít nhất 12 ký tự, tối đa 72 byte UTF-8.'}
                  </Text>
                  <PasswordField
                    id="change-password-confirmation"
                    label="Xác nhận mật khẩu mới"
                    autoComplete="new-password"
                    value={confirmation}
                    error={fieldErrors.confirmation}
                    onChangeText={setConfirmation}
                    placeholder="Nhập lại mật khẩu mới"
                    disabled={loading}
                  />
                  <Text style={sheet.info}>
                    Dùng mật khẩu riêng cho MentalBridge để bảo vệ tài khoản của
                    bạn.
                  </Text>
                  <PrimaryButton
                    disabled={loading}
                    label={
                      loading ? 'Đang đổi...' : 'Đổi mật khẩu và đăng xuất'
                    }
                    onPress={() => void submit()}
                    tone="darkPill"
                  />
                </>
              )}
              {error ? (
                <Text accessibilityRole="alert" style={styles.runtimeError}>
                  {error}
                </Text>
              ) : null}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
      <Pressable
        accessible={false}
        importantForAccessibility="no"
        onPress={close}
        style={{ height: USER_TAB_BAR_HEIGHT + insets.bottom }}
      />
    </Modal>
  )
}

const sheet = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(17, 34, 28, 0.42)' },
  fill: { flex: 1, justifyContent: 'flex-end' },
  panel: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 560,
    maxHeight: '96%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  scroll: { flexGrow: 0, flexShrink: 1 },
  handle: {
    width: 38,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.line,
    alignSelf: 'center',
    marginTop: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  headerIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e4efe9',
    borderRadius: radii.pill,
  },
  title: { flex: 1, color: colors.ink, fontSize: 21, fontWeight: '700' },
  serif: { fontFamily: 'DashboardSerif' },
  close: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: '#eff3f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: { color: colors.ink, fontSize: 23 },
  description: { color: colors.inkSoft, fontSize: 14, lineHeight: 20 },
  field: { gap: spacing.xs },
  labelRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  label: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  link: { color: colors.tealDeep, fontSize: 13, fontWeight: '700' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f4f1',
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  input: {
    flex: 1,
    color: colors.ink,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  reveal: {
    minHeight: 44,
    minWidth: 48,
    paddingHorizontal: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progress: { flexDirection: 'row', gap: spacing.xs },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: '#e4ede8',
  },
  progressFilled: { backgroundColor: colors.teal },
  hint: { color: colors.inkSoft, fontSize: 12 },
  info: {
    color: colors.inkSoft,
    backgroundColor: '#f0f4f1',
    padding: spacing.md,
    borderRadius: radii.control,
    fontSize: 12,
    lineHeight: 18,
  },
})
