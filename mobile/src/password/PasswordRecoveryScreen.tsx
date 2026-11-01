import {
  router,
  useLocalSearchParams,
  useRootNavigationState,
} from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Text, TextInput, View } from 'react-native'

import { ApiError } from '@/api/api-error'
import { useSession } from '@/auth/session-context'
import { PrimaryButton } from '@/components/PrimaryButton'
import { Screen } from '@/components/Screen'
import { authStyles } from '@/screens/auth-styles'

import { passwordStyles as styles } from './password-styles'
import { validateNewPassword } from './password-validation'

type Mode = 'initializing' | 'request' | 'reset' | 'reset-success'

const genericAcknowledgement =
  'Kiểm tra email của bạn. Nếu tài khoản đủ điều kiện, liên kết đặt lại mật khẩu sẽ được gửi.'

function dependencyFailure(error: unknown) {
  return (
    error instanceof ApiError &&
    (error.code === 'NETWORK_ERROR' ||
      error.code === 'REQUEST_TIMEOUT' ||
      error.code === 'IDENTITY_TIMEOUT' ||
      error.code === 'IDENTITY_UNAVAILABLE')
  )
}

function requestErrorMessage(error: unknown) {
  return dependencyFailure(error)
    ? 'Dịch vụ tài khoản tạm thời chưa sẵn sàng. Vui lòng thử lại sau.'
    : 'Không thể gửi yêu cầu lúc này. Kiểm tra email và thử lại.'
}

function resetErrorMessage(error: unknown) {
  if (
    error instanceof ApiError &&
    (error.code === 'INVALID_CHALLENGE' || error.code === 'VALIDATION_FAILED')
  ) {
    return 'Liên kết đặt lại mật khẩu không hợp lệ, đã hết hạn hoặc đã được sử dụng.'
  }
  return dependencyFailure(error)
    ? 'Dịch vụ đặt lại mật khẩu tạm thời chưa sẵn sàng. Bạn có thể thử lại với liên kết này.'
    : 'Không thể đặt lại mật khẩu lúc này. Vui lòng yêu cầu một liên kết mới.'
}

function PasswordField({
  id,
  label,
  value,
  error,
  onChangeText,
}: Readonly<{
  id: string
  label: string
  value: string
  error: string | undefined
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
        autoComplete="new-password"
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

export function PasswordRecoveryScreen() {
  const params = useLocalSearchParams<{ challenge?: string | string[] }>()
  const rootNavigationState = useRootNavigationState()
  const { requestPasswordRecovery, resetPassword } = useSession()
  const suppliedChallenge = Array.isArray(params.challenge)
    ? params.challenge[0]
    : params.challenge
  const initialized = useRef(false)
  const challenge = useRef<string | null>(suppliedChallenge ?? null)
  const submitting = useRef(false)
  const [mode, setMode] = useState<Mode>('initializing')
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{
    newPassword?: string
    confirmation?: string
  }>({})
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!rootNavigationState?.key || initialized.current) return
    initialized.current = true

    queueMicrotask(() => {
      if (params.challenge !== undefined) {
        router.setParams({ challenge: undefined })
      }

      if (!suppliedChallenge) {
        setMode('request')
      } else {
        setMode('reset')
        if (suppliedChallenge.length < 32 || suppliedChallenge.length > 512) {
          setError(
            'Liên kết đặt lại mật khẩu không hợp lệ, đã hết hạn hoặc đã được sử dụng.',
          )
          challenge.current = null
        }
      }
    })
  }, [params.challenge, rootNavigationState?.key, suppliedChallenge])

  const requestRecovery = async () => {
    if (submitting.current) return
    const normalizedEmail = email.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError('Nhập một địa chỉ email hợp lệ.')
      return
    }

    submitting.current = true
    setLoading(true)
    setError('')
    setNotice('')
    try {
      await requestPasswordRecovery(normalizedEmail)
      setNotice(genericAcknowledgement)
    } catch (caught) {
      setError(requestErrorMessage(caught))
    } finally {
      submitting.current = false
      setLoading(false)
    }
  }

  const submitReset = async () => {
    if (submitting.current) return
    const errors = validateNewPassword(newPassword, confirmation)
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return
    if (!challenge.current) {
      setError(
        'Liên kết đặt lại mật khẩu không hợp lệ, đã hết hạn hoặc đã được sử dụng.',
      )
      return
    }

    submitting.current = true
    setLoading(true)
    setError('')
    try {
      await resetPassword(challenge.current, newPassword)
      challenge.current = null
      setMode('reset-success')
    } catch (caught) {
      setError(resetErrorMessage(caught))
    } finally {
      submitting.current = false
      setLoading(false)
    }
  }

  const startNewRequest = () => {
    challenge.current = null
    setMode('request')
    setError('')
    setNotice('')
    setNewPassword('')
    setConfirmation('')
    setFieldErrors({})
  }

  if (mode === 'initializing') {
    return (
      <Screen>
        <Text accessibilityRole="header" style={authStyles.title}>
          Đang chuẩn bị khôi phục
        </Text>
        <Text accessibilityLiveRegion="polite" style={authStyles.description}>
          MentalBridge đang kiểm tra liên kết an toàn của bạn.
        </Text>
      </Screen>
    )
  }

  if (mode === 'reset-success') {
    return (
      <Screen>
        <Text style={authStyles.eyebrow}>HOÀN TẤT BẢO MẬT</Text>
        <Text accessibilityRole="header" style={authStyles.title}>
          Mật khẩu đã được thay đổi
        </Text>
        <Text accessibilityLiveRegion="assertive" style={styles.notice}>
          Tất cả phiên đăng nhập đã kết thúc. Hãy đăng nhập lại bằng mật khẩu
          mới.
        </Text>
        <PrimaryButton
          label="Về trang đăng nhập"
          onPress={() => router.replace('/sign-in')}
        />
      </Screen>
    )
  }

  const isReset = mode === 'reset'

  return (
    <Screen>
      <Text style={authStyles.eyebrow}>
        {isReset ? 'ĐẶT LẠI MẬT KHẨU' : 'KHÔI PHỤC TÀI KHOẢN'}
      </Text>
      <Text accessibilityRole="header" style={authStyles.title}>
        {isReset ? 'Tạo mật khẩu mới' : 'Quên mật khẩu?'}
      </Text>
      <Text style={authStyles.description}>
        {isReset
          ? 'Liên kết chỉ dùng một lần và có hiệu lực trong 15 phút.'
          : 'Nhập email tài khoản. Phản hồi luôn giống nhau để bảo vệ trạng thái tài khoản.'}
      </Text>

      {isReset ? (
        <>
          <PasswordField
            id="reset-new-password"
            label="Mật khẩu mới"
            value={newPassword}
            error={fieldErrors.newPassword}
            onChangeText={setNewPassword}
          />
          <PasswordField
            id="reset-password-confirmation"
            label="Xác nhận mật khẩu mới"
            value={confirmation}
            error={fieldErrors.confirmation}
            onChangeText={setConfirmation}
          />
          <Text style={[styles.hint, { marginBottom: 16 }]}>
            12–128 ký tự và tối đa 72 byte UTF-8.
          </Text>
        </>
      ) : (
        <View style={styles.field}>
          <Text nativeID="recovery-email-label" style={styles.label}>
            Email
          </Text>
          <TextInput
            accessibilityLabel="Email"
            accessibilityLabelledBy="recovery-email-label"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            maxLength={254}
            onChangeText={setEmail}
            style={styles.input}
            value={email}
          />
        </View>
      )}

      {notice ? (
        <Text accessibilityLiveRegion="polite" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={styles.runtimeError}>
          {error}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <PrimaryButton
          disabled={loading}
          label={
            loading
              ? isReset
                ? 'Đang đặt lại...'
                : 'Đang gửi...'
              : isReset
                ? 'Đặt lại mật khẩu'
                : 'Gửi liên kết khôi phục'
          }
          onPress={() => void (isReset ? submitReset() : requestRecovery())}
        />
        {isReset && error ? (
          <Text
            accessibilityRole="link"
            onPress={startNewRequest}
            style={styles.link}
          >
            Yêu cầu liên kết mới
          </Text>
        ) : null}
        <Text
          accessibilityRole="link"
          onPress={() => router.replace('/sign-in')}
          style={styles.link}
        >
          Về trang đăng nhập
        </Text>
      </View>
    </Screen>
  )
}
