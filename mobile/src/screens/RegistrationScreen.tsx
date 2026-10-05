import { randomUUID } from 'expo-crypto'
import { router } from 'expo-router'
import { useRef, useState } from 'react'
import { Text, TextInput, View } from 'react-native'

import { ApiError } from '@/api/api-error'
import { useSession } from '@/auth/session-context'
import { PrimaryButton } from '@/components/PrimaryButton'
import { Screen } from '@/components/Screen'

import { authStyles as styles } from './auth-styles'

function registrationErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'ACCOUNT_ALREADY_EXISTS') {
      return 'Email này đã được dùng. Vui lòng đăng nhập hoặc dùng email khác.'
    }
    if (error.status === 429) {
      return 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng chờ rồi thử lại.'
    }
    if (error.code === 'NETWORK_ERROR' || error.code === 'REQUEST_TIMEOUT') {
      return 'Dịch vụ đăng ký tạm thời chưa sẵn sàng. Vui lòng thử lại sau.'
    }
  }
  return 'Không thể tạo tài khoản. Vui lòng kiểm tra thông tin và thử lại.'
}

function utf8ByteLength(value: string) {
  let length = 0
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0
    length +=
      codePoint <= 0x7f
        ? 1
        : codePoint <= 0x7ff
          ? 2
          : codePoint <= 0xffff
            ? 3
            : 4
  }
  return length
}

export function RegistrationScreen() {
  const { registerUser, requestEmailVerification } = useSession()
  const idempotencyKey = useRef<string | null>(null)
  const submitting = useRef(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [registeredEmail, setRegisteredEmail] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (submitting.current) return
    const normalizedEmail = email.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError('Nhập một địa chỉ email hợp lệ.')
      return
    }
    const passwordLength = Array.from(password).length
    if (passwordLength < 12) {
      setError('Mật khẩu phải có ít nhất 12 ký tự.')
      return
    }
    if (passwordLength > 128 || utf8ByteLength(password) > 72) {
      setError('Mật khẩu không được vượt quá 72 byte UTF-8.')
      return
    }
    if (password !== confirmation) {
      setError('Mật khẩu xác nhận chưa khớp.')
      return
    }

    submitting.current = true
    setLoading(true)
    setError('')
    const key = idempotencyKey.current ?? randomUUID()
    idempotencyKey.current = key
    try {
      await registerUser(normalizedEmail, password, key)
      setRegisteredEmail(normalizedEmail)
    } catch (caught) {
      setError(registrationErrorMessage(caught))
    } finally {
      submitting.current = false
      setLoading(false)
    }
  }

  const resend = async () => {
    setNotice('')
    setError('')
    try {
      await requestEmailVerification(registeredEmail)
      setNotice(
        'Nếu tài khoản đang chờ xác minh, một liên kết mới đã được gửi đến email của bạn.',
      )
    } catch (caught) {
      setError(registrationErrorMessage(caught))
    }
  }

  if (registeredEmail) {
    return (
      <Screen>
        <Text accessibilityRole="header" style={styles.title}>
          Kiểm tra email của bạn
        </Text>
        <Text style={styles.description}>
          Tài khoản cho {registeredEmail} đang chờ xác minh. Hãy mở liên kết một
          lần trong email.
        </Text>
        {notice ? (
          <Text accessibilityRole="alert" style={styles.success}>
            {notice}
          </Text>
        ) : null}
        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}
        <View style={styles.actions}>
          <PrimaryButton label="Gửi lại email" onPress={() => void resend()} />
          <Text
            accessibilityRole="link"
            onPress={() => router.replace('/sign-in')}
            style={styles.link}
          >
            Đến trang đăng nhập
          </Text>
        </View>
      </Screen>
    )
  }

  return (
    <Screen>
      <Text style={styles.eyebrow}>TÀI KHOẢN CÁ NHÂN</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Tạo tài khoản MentalBridge
      </Text>
      <Text style={styles.description}>
        MentalBridge sẽ gửi email xác minh trước khi tài khoản có thể đăng nhập.
      </Text>
      <View style={styles.field}>
        <Text nativeID="register-email-label" style={styles.label}>
          Email
        </Text>
        <TextInput
          accessibilityLabel="Email"
          accessibilityLabelledBy="register-email-label"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          maxLength={254}
          onChangeText={(value) => {
            setEmail(value)
            idempotencyKey.current = null
          }}
          style={styles.input}
          value={email}
        />
      </View>
      <View style={styles.field}>
        <Text nativeID="register-password-label" style={styles.label}>
          Mật khẩu
        </Text>
        <TextInput
          accessibilityLabel="Mật khẩu"
          accessibilityLabelledBy="register-password-label"
          autoComplete="new-password"
          maxLength={128}
          onChangeText={(value) => {
            setPassword(value)
            idempotencyKey.current = null
          }}
          secureTextEntry
          style={styles.input}
          value={password}
        />
      </View>
      <View style={styles.field}>
        <Text nativeID="register-confirmation-label" style={styles.label}>
          Xác nhận mật khẩu
        </Text>
        <TextInput
          accessibilityLabel="Xác nhận mật khẩu"
          accessibilityLabelledBy="register-confirmation-label"
          autoComplete="new-password"
          maxLength={128}
          onChangeText={setConfirmation}
          secureTextEntry
          style={styles.input}
          value={confirmation}
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
          label={loading ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
          onPress={() => void submit()}
        />
        <Text
          accessibilityRole="link"
          onPress={() => router.back()}
          style={styles.link}
        >
          Quay lại đăng nhập
        </Text>
      </View>
    </Screen>
  )
}
