import { router } from 'expo-router'
import { useRef, useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'

import { ApiError } from '@/api/api-error'
import { useSession } from '@/auth/session-context'
import { PrimaryButton } from '@/components/PrimaryButton'
import { Screen } from '@/components/Screen'
import { authStyles } from '@/screens/auth-styles'

import { passwordStyles as styles } from './password-styles'
import {
  type PasswordFormErrors,
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
}: Readonly<{
  id: string
  label: string
  value: string
  error: string | undefined
  autoComplete: 'current-password' | 'new-password'
  onChangeText: (value: string) => void
}>) {
  return (
    <View style={styles.field}>
      <Text nativeID={`${id}-label`} style={styles.label}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityLabelledBy={`${id}-label`}
        autoComplete={autoComplete}
        maxLength={128}
        onChangeText={onChangeText}
        secureTextEntry
        style={[styles.input, error ? styles.inputError : undefined]}
        value={value}
      />
      {error ? (
        <Text accessibilityLiveRegion="assertive" style={styles.fieldError}>
          {error}
        </Text>
      ) : null}
    </View>
  )
}

export function ChangePasswordScreen() {
  const { changePassword } = useSession()
  const submitting = useRef(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [fieldErrors, setFieldErrors] = useState<PasswordFormErrors>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
    <Screen>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.back()}
        style={styles.backButton}
      >
        <Text style={styles.backLabel}>← Quay lại</Text>
      </Pressable>
      <Text style={authStyles.eyebrow}>BẢO MẬT TÀI KHOẢN</Text>
      <Text accessibilityRole="header" style={authStyles.title}>
        Đổi mật khẩu
      </Text>
      <Text style={authStyles.description}>
        Thành công sẽ đăng xuất tất cả thiết bị. Bạn cần đăng nhập lại bằng mật
        khẩu mới.
      </Text>
      <PasswordField
        id="current-password"
        label="Mật khẩu hiện tại"
        autoComplete="current-password"
        value={currentPassword}
        error={fieldErrors.currentPassword}
        onChangeText={setCurrentPassword}
      />
      <PasswordField
        id="change-new-password"
        label="Mật khẩu mới"
        autoComplete="new-password"
        value={newPassword}
        error={fieldErrors.newPassword}
        onChangeText={setNewPassword}
      />
      <PasswordField
        id="change-password-confirmation"
        label="Xác nhận mật khẩu mới"
        autoComplete="new-password"
        value={confirmation}
        error={fieldErrors.confirmation}
        onChangeText={setConfirmation}
      />
      <Text style={[styles.hint, { marginBottom: 16 }]}>
        12–128 ký tự và tối đa 72 byte UTF-8.
      </Text>
      {error ? (
        <Text accessibilityRole="alert" style={styles.runtimeError}>
          {error}
        </Text>
      ) : null}
      <PrimaryButton
        disabled={loading}
        label={loading ? 'Đang đổi...' : 'Đổi mật khẩu và đăng xuất'}
        onPress={() => void submit()}
      />
    </Screen>
  )
}
