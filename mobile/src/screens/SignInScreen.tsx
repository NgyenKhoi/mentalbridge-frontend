import { router } from 'expo-router'
import { useRef, useState } from 'react'
import { Text, TextInput, View } from 'react-native'

import { ApiError } from '@/api/api-error'
import { useSession } from '@/auth/session-context'
import { PrimaryButton } from '@/components/PrimaryButton'
import { Screen } from '@/components/Screen'

import { authStyles as styles } from './auth-styles'

function signInErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'INVALID_CREDENTIALS' || error.status === 401) {
      return 'Email, mật khẩu hoặc trạng thái tài khoản không hợp lệ.'
    }
    if (error.code === 'NETWORK_ERROR' || error.code === 'REQUEST_TIMEOUT') {
      return 'Dịch vụ đăng nhập tạm thời chưa sẵn sàng. Vui lòng thử lại sau.'
    }
  }
  return 'Không thể đăng nhập lúc này. Vui lòng thử lại.'
}

export function SignInScreen() {
  const { notice, signIn } = useSession()
  const submitting = useRef(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (submitting.current) return
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail || !password) {
      setError('Nhập email và mật khẩu để tiếp tục.')
      return
    }

    submitting.current = true
    setError('')
    setLoading(true)
    try {
      await signIn(normalizedEmail, password)
    } catch (caught) {
      setError(signInErrorMessage(caught))
    } finally {
      submitting.current = false
      setLoading(false)
    }
  }

  return (
    <Screen>
      <Text style={styles.eyebrow}>ĐĂNG NHẬP</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Tiếp tục hành trình của bạn
      </Text>
      <Text style={styles.description}>
        Phiên chỉ được mở sau khi Identity xác nhận tài khoản USER đang hoạt
        động.
      </Text>
      {notice ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {notice}
        </Text>
      ) : null}
      <View style={styles.field}>
        <Text nativeID="sign-in-email-label" style={styles.label}>
          Email
        </Text>
        <TextInput
          accessibilityLabel="Email"
          accessibilityLabelledBy="sign-in-email-label"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          maxLength={254}
          onChangeText={setEmail}
          style={styles.input}
          value={email}
        />
      </View>
      <View style={styles.field}>
        <Text nativeID="sign-in-password-label" style={styles.label}>
          Mật khẩu
        </Text>
        <TextInput
          accessibilityLabel="Mật khẩu"
          accessibilityLabelledBy="sign-in-password-label"
          autoComplete="current-password"
          maxLength={128}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
          value={password}
        />
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <PrimaryButton
          disabled={loading}
          label={loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          onPress={() => void submit()}
        />
        <Text
          accessibilityRole="link"
          onPress={() => router.push('./register')}
          style={styles.link}
        >
          Tạo tài khoản USER
        </Text>
      </View>
    </Screen>
  )
}
