import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { ApiError } from '@/api/api-error'
import { useSession } from '@/auth/session-context'
import {
  AccountAction,
  AccountHeading,
  AccountLoginLink,
  AccountPage,
  accountStyles as styles,
} from './account-page'
import { AuthPulseIcon } from './sign-in-breathing'

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
  const [resending, setResending] = useState(false)
  const resendPending = useRef(false)

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
    if (resendPending.current || !email.trim()) return
    resendPending.current = true
    setResending(true)
    setNotice('')
    try {
      await requestEmailVerification(email.trim().toLowerCase())
      setNotice(
        'Nếu tài khoản đang chờ xác minh, một liên kết mới đã được gửi đến email của bạn.',
      )
    } catch {
      setNotice(
        'Dịch vụ xác minh tạm thời chưa sẵn sàng. Vui lòng thử lại sau.',
      )
    } finally {
      resendPending.current = false
      setResending(false)
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
      ? 'MentalBridge đang kiểm tra liên kết một lần của bạn.'
      : state === 'success'
        ? 'Email đã được xác minh. Tài khoản của bạn sẵn sàng để đăng nhập.'
        : state === 'unavailable'
          ? 'Dịch vụ xác minh tạm thời chưa sẵn sàng. Liên kết chưa được kết luận là không hợp lệ.'
          : 'Liên kết xác minh không hợp lệ, đã hết hạn hoặc đã được sử dụng.'

  return (
    <AccountPage>
      <View style={local.toolbar}>
        <Text
          accessibilityRole="link"
          style={styles.link}
          onPress={() => router.replace('/sign-in')}
        >
          ← Quay lại
        </Text>
        <Text style={styles.badge}>Liên kết một lần</Text>
      </View>
      <View style={local.hero}>
        <AuthPulseIcon glyph={state === 'success' ? '✓' : '✉'} />
        {state === 'pending' && <ActivityIndicator color="#2E6956" />}
      </View>
      <AccountHeading title={title} centered>
        {description}
      </AccountHeading>
      {state === 'success' ? (
        <AccountAction
          label="Đăng nhập"
          onPress={() => router.replace('/sign-in')}
        />
      ) : state === 'pending' ? null : (
        <>
          <View style={styles.field}>
            <Text nativeID="verification-email-label" style={styles.label}>
              Email
            </Text>
            <View style={styles.control}>
              <Text aria-hidden style={styles.glyph}>
                ✉
              </Text>
              <TextInput
                accessibilityLabel="Email"
                accessibilityLabelledBy="verification-email-label"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                keyboardType="email-address"
                maxLength={254}
                onChangeText={setEmail}
                style={styles.input}
                value={email}
                placeholder="Nhập email đăng ký"
                placeholderTextColor="#687C71"
              />
            </View>
          </View>
          {notice ? (
            <Text accessibilityRole="alert" style={styles.notice}>
              {notice}
            </Text>
          ) : null}
          <AccountAction
            disabled={!email.trim() || resending}
            label={resending ? 'Đang gửi…' : 'Gửi lại email xác minh'}
            onPress={() => void resend()}
          />
          <Text style={[styles.copy, local.help]}>
            Không thấy email? Kiểm tra thư mục thư rác để tìm liên kết xác minh.
          </Text>
          <AccountLoginLink />
        </>
      )}
    </AccountPage>
  )
}

const local = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  hero: {
    minHeight: 134,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  help: { padding: 14, borderRadius: 14, backgroundColor: '#EDF4ED' },
})
