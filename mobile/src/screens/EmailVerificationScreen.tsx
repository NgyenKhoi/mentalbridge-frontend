import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Text, TextInput, View } from 'react-native'

import { ApiError } from '@/api/api-error'
import { useSession } from '@/auth/session-context'
import { PrimaryButton } from '@/components/PrimaryButton'
import { Screen } from '@/components/Screen'

import { authStyles as styles } from './auth-styles'

type VerificationState = 'pending' | 'success' | 'invalid' | 'unavailable'

function verificationFailure(error: unknown): VerificationState {
  if (
    error instanceof ApiError &&
    (error.code === 'NETWORK_ERROR' || error.code === 'REQUEST_TIMEOUT')
  ) {
    return 'unavailable'
  }
  return 'invalid'
}

export function EmailVerificationScreen() {
  const params = useLocalSearchParams<{ challenge?: string | string[] }>()
  const { requestEmailVerification, verifyEmail } = useSession()
  const started = useRef(false)
  const [state, setState] = useState<VerificationState>('pending')
  const [email, setEmail] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (started.current) return
    started.current = true
    const challenge = Array.isArray(params.challenge)
      ? params.challenge[0]
      : params.challenge
    router.replace('./verify-email')

    if (!challenge || challenge.length < 32 || challenge.length > 512) {
      queueMicrotask(() => setState('invalid'))
      return
    }

    void verifyEmail(challenge)
      .then(() => setState('success'))
      .catch((error: unknown) => setState(verificationFailure(error)))
  }, [params.challenge, verifyEmail])

  const resend = async () => {
    setNotice('')
    try {
      await requestEmailVerification(email.trim().toLowerCase())
      setNotice(
        'Nếu tài khoản đang chờ xác minh, Identity đã gửi một liên kết mới.',
      )
    } catch {
      setNotice(
        'Dịch vụ xác minh tạm thời chưa sẵn sàng. Vui lòng thử lại sau.',
      )
    }
  }

  const title =
    state === 'pending'
      ? 'Đang xác minh email'
      : state === 'success'
        ? 'Xác minh thành công'
        : state === 'unavailable'
          ? 'Chưa thể xác minh'
          : 'Liên kết không còn hợp lệ'

  const description =
    state === 'pending'
      ? 'Identity đang kiểm tra liên kết một lần của bạn.'
      : state === 'success'
        ? 'Email đã được xác minh. Tài khoản của bạn sẵn sàng để đăng nhập.'
        : state === 'unavailable'
          ? 'Dịch vụ xác minh tạm thời chưa sẵn sàng. Liên kết chưa được kết luận là không hợp lệ.'
          : 'Liên kết xác minh không hợp lệ, đã hết hạn hoặc đã được sử dụng.'

  return (
    <Screen>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <Text style={styles.description}>{description}</Text>
      {state === 'success' ? (
        <PrimaryButton
          label="Đăng nhập"
          onPress={() => router.replace('/sign-in')}
        />
      ) : state === 'pending' ? null : (
        <View>
          <View style={styles.field}>
            <Text nativeID="verification-email-label" style={styles.label}>
              Email
            </Text>
            <TextInput
              accessibilityLabel="Email"
              accessibilityLabelledBy="verification-email-label"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              maxLength={254}
              onChangeText={setEmail}
              style={styles.input}
              value={email}
            />
          </View>
          {notice ? (
            <Text accessibilityRole="alert" style={styles.success}>
              {notice}
            </Text>
          ) : null}
          <PrimaryButton
            disabled={!email.trim()}
            label="Gửi lại email xác minh"
            onPress={() => void resend()}
          />
        </View>
      )}
    </Screen>
  )
}
