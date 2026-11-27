import { randomUUID } from 'expo-crypto'
import * as Linking from 'expo-linking'
import { router } from 'expo-router'
import { useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

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
  const [agreed, setAgreed] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [resending, setResending] = useState(false)
  const resendPending = useRef(false)

  const openWeb = async (path: '/terms' | '/privacy' | '/register') => {
    try {
      const origin = new URL(
        process.env.EXPO_PUBLIC_LANDING_URL ||
          'https://staging.mentalbridge.online/',
      )
      if (origin.protocol !== 'https:' || origin.username || origin.password) {
        throw new Error('Public HTTPS website required')
      }
      await Linking.openURL(new URL(path, origin).href)
    } catch {
      setError('Chưa mở được trang web MentalBridge. Vui lòng thử lại.')
    }
  }

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

    if (!agreed) {
      setError(
        'Hãy đọc và đồng ý với điều khoản dịch vụ và chính sách bảo mật.',
      )
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
      setPassword('')
      setConfirmation('')
      setShowPassword(false)
      setShowConfirmation(false)
    } catch (caught) {
      setError(registrationErrorMessage(caught))
    } finally {
      submitting.current = false
      setLoading(false)
    }
  }

  const resend = async () => {
    if (resendPending.current) return
    resendPending.current = true
    setResending(true)
    setNotice('')
    setError('')
    try {
      await requestEmailVerification(registeredEmail)
      setNotice(
        'Nếu tài khoản đang chờ xác minh, một liên kết mới đã được gửi đến email của bạn.',
      )
    } catch (caught) {
      setError(registrationErrorMessage(caught))
    } finally {
      resendPending.current = false
      setResending(false)
    }
  }

  const feedback = (
    <>
      {notice ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </>
  )

  if (registeredEmail) {
    const [local = '', domain = ''] = registeredEmail.split('@')
    const masked = `${Array.from(local).slice(0, 2).join('')}***@${domain}`
    const changeEmail = () => {
      setRegisteredEmail('')
      setNotice('')
      setError('')
      setAgreed(false)
      idempotencyKey.current = null
    }
    return (
      <AccountPage>
        <View style={s.toolbar}>
          <Text
            accessibilityRole="button"
            accessibilityLabel="Quay lại biểu mẫu đăng ký"
            onPress={changeEmail}
            style={styles.link}
          >
            ← Quay lại
          </Text>
          <Text style={styles.badge}>Liên kết một lần</Text>
        </View>
        <View style={s.mailHero}>
          <AuthPulseIcon glyph="✉" />
        </View>
        <AccountHeading title="Kiểm tra hộp thư của bạn" centered>
          Hãy mở liên kết xác minh một lần trong email gửi đến:
        </AccountHeading>
        <View style={s.emailChip}>
          <Text style={s.emailText}>@ {masked}</Text>
          <Text
            accessibilityRole="button"
            accessibilityState={{ disabled: resending }}
            onPress={resending ? undefined : changeEmail}
            style={styles.link}
          >
            Thay đổi
          </Text>
        </View>
        {feedback}
        <AccountAction
          label="Đến trang đăng nhập"
          onPress={() => router.replace('/sign-in')}
        />
        <AccountAction
          label={resending ? 'Đang gửi…' : 'Gửi lại email xác minh'}
          onPress={() => void resend()}
          disabled={resending}
          outline
        />
        <Text style={[s.help, styles.copy]}>
          Không thấy email? Hãy kiểm tra thư mục thư rác hoặc gửi lại liên kết
          xác minh.
        </Text>
      </AccountPage>
    )
  }

  const passwordLength = Array.from(password).length
  const passwordReady = passwordLength >= 12 && utf8ByteLength(password) <= 72
  return (
    <AccountPage>
      <View style={s.breatheCard}>
        <AuthPulseIcon glyph="≋" />
        <View style={styles.flex}>
          <Text style={s.kicker}>CHẠM &amp; THẢ LỎNG</Text>
          <Text style={s.quote}>
            “Hành trình ngàn dặm bắt đầu từ một bước chân.”
          </Text>
        </View>
      </View>
      <AccountHeading title="Bắt đầu hành trình">
        Tạo tài khoản để tiếp tục hành trình chăm sóc sức khỏe tinh thần của
        bạn.
      </AccountHeading>
      <View style={s.specialist}>
        <Text style={s.specialistText}>
          DÀNH RIÊNG CHO BÁC SĨ &amp; CHUYÊN GIA
        </Text>
        <Text
          accessibilityRole="link"
          style={s.specialistLink}
          onPress={() => void openWeb('/register')}
        >
          Đăng ký trên web MentalBridge →
        </Text>
      </View>
      <View style={styles.field}>
        <Text nativeID="register-email-label" style={styles.label}>
          Địa chỉ email
        </Text>
        <View style={styles.control}>
          <Text aria-hidden style={styles.glyph}>
            ✉
          </Text>
          <TextInput
            accessibilityLabel="Email"
            accessibilityLabelledBy="register-email-label"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            keyboardType="email-address"
            maxLength={254}
            onChangeText={(value) => {
              setEmail(value)
              idempotencyKey.current = null
            }}
            style={styles.input}
            value={email}
            placeholder="tenban@email.com"
            placeholderTextColor="#687C71"
          />
        </View>
      </View>
      <View style={styles.field}>
        <View style={s.toolbar}>
          <Text nativeID="register-password-label" style={styles.label}>
            Mật khẩu
          </Text>
          <Text style={styles.copy}>Ít nhất 12 ký tự</Text>
        </View>
        <View style={styles.control}>
          <Text aria-hidden style={styles.glyph}>
            ♙
          </Text>
          <TextInput
            accessibilityLabel="Mật khẩu"
            accessibilityLabelledBy="register-password-label"
            autoCapitalize="none"
            autoComplete="new-password"
            autoCorrect={false}
            maxLength={128}
            onChangeText={(value) => {
              setPassword(value)
              idempotencyKey.current = null
            }}
            secureTextEntry={!showPassword}
            style={styles.input}
            value={password}
            placeholder="Nhập mật khẩu"
            placeholderTextColor="#687C71"
          />
          <PasswordToggle
            shown={showPassword}
            onPress={() => setShowPassword((value) => !value)}
          />
        </View>
        <View style={s.meterRow}>
          {Array.from({ length: 3 }, (_, index) => (
            <View
              aria-hidden
              key={index}
              style={[
                s.segment,
                ((index === 0 && passwordLength > 0) ||
                  (index === 1 && passwordLength >= 8) ||
                  (index === 2 && passwordReady)) &&
                  s.segmentFilled,
              ]}
            />
          ))}
          <Text style={s.meterLabel}>
            {passwordReady ? 'Đạt yêu cầu' : 'Độ dài mật khẩu'}
          </Text>
        </View>
      </View>
      <View style={styles.field}>
        <Text nativeID="register-confirmation-label" style={styles.label}>
          Xác nhận mật khẩu
        </Text>
        <View style={styles.control}>
          <Text aria-hidden style={styles.glyph}>
            ✓
          </Text>
          <TextInput
            accessibilityLabel="Xác nhận mật khẩu"
            accessibilityLabelledBy="register-confirmation-label"
            autoCapitalize="none"
            autoComplete="new-password"
            autoCorrect={false}
            maxLength={128}
            onChangeText={setConfirmation}
            secureTextEntry={!showConfirmation}
            style={styles.input}
            value={confirmation}
            placeholder="Nhập lại mật khẩu"
            placeholderTextColor="#687C71"
          />
          <PasswordToggle
            shown={showConfirmation}
            onPress={() => setShowConfirmation((value) => !value)}
            confirmation
          />
        </View>
      </View>
      <View style={s.consent}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel="Tôi đồng ý với điều khoản dịch vụ và chính sách bảo mật"
          accessibilityState={{ checked: agreed }}
          onPress={() => setAgreed((value) => !value)}
          style={s.checkTarget}
        >
          <View style={[s.check, agreed && s.checkFilled]}>
            {agreed && <Text style={s.checkGlyph}>✓</Text>}
          </View>
        </Pressable>
        <Text style={[styles.copy, styles.flex]}>
          Tôi đồng ý với{' '}
          <Text
            accessibilityRole="link"
            onPress={() => void openWeb('/terms')}
            style={s.policy}
          >
            Điều khoản dịch vụ
          </Text>{' '}
          và{' '}
          <Text
            accessibilityRole="link"
            onPress={() => void openWeb('/privacy')}
            style={s.policy}
          >
            Chính sách bảo mật
          </Text>
          .
        </Text>
      </View>
      {feedback}
      <AccountAction
        label={loading ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
        onPress={() => void submit()}
        disabled={loading}
      />
      <View style={s.divider}>
        <View style={s.rule} />
        <Text style={styles.copy}>hoặc khám phá trước</Text>
        <View style={s.rule} />
      </View>
      <AccountAction
        label="Thử bài đánh giá ẩn danh trước"
        onPress={() => router.push('/assessment/anonymous')}
        outline
      />
      <Text style={[styles.copy, styles.center]}>
        Làm bài đánh giá sức khỏe tâm thần không cần tạo tài khoản.
      </Text>
      <AccountLoginLink />
    </AccountPage>
  )
}

function PasswordToggle({
  shown,
  onPress,
  confirmation = false,
}: {
  shown: boolean
  onPress: () => void
  confirmation?: boolean
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${shown ? 'Ẩn' : 'Hiện'} mật khẩu${confirmation ? ' xác nhận' : ''}`}
      onPress={onPress}
      style={s.toggle}
    >
      <View aria-hidden style={s.eye}>
        <View style={s.dot} />
        {shown && <View style={s.slash} />}
      </View>
    </Pressable>
  )
}
const s = StyleSheet.create({
  breatheCard: {
    flexDirection: 'row',
    gap: 13,
    alignItems: 'center',
    padding: 13,
    backgroundColor: '#F8FBF7',
    borderColor: '#DBE6DD',
    borderWidth: 1,
    borderRadius: 22,
    boxShadow: '0px 7px 20px rgba(35,85,68,.09)',
  },
  kicker: {
    color: '#2F6552',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.75,
  },
  quote: {
    color: '#25463B',
    fontFamily: 'serif',
    fontStyle: 'italic',
    fontSize: 15,
    lineHeight: 21,
    marginTop: 4,
  },
  specialist: {
    backgroundColor: '#193F34',
    borderRadius: 17,
    padding: 13,
    gap: 2,
  },
  specialistText: {
    color: '#DCECE3',
    fontSize: 11,
    letterSpacing: 0.6,
    fontWeight: '700',
  },
  specialistLink: {
    color: '#FFF',
    fontSize: 14,
    minHeight: 36,
    paddingVertical: 7,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  mailHero: { alignItems: 'center', justifyContent: 'center', minHeight: 130 },
  emailChip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: '#E8F3EC',
  },
  emailText: { color: '#25483A', fontWeight: '700', flexShrink: 1 },
  help: { padding: 14, borderRadius: 15, backgroundColor: '#EDF4ED' },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  segment: { flex: 1, height: 4, borderRadius: 3, backgroundColor: '#DCE6DE' },
  segmentFilled: { backgroundColor: '#49846E' },
  meterLabel: { fontSize: 11, color: '#506B5E', flexShrink: 1 },
  consent: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  checkTarget: {
    width: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#829C8E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkFilled: { backgroundColor: '#265A47', borderColor: '#265A47' },
  checkGlyph: { color: '#FFF', fontSize: 12 },
  policy: {
    fontWeight: '700',
    textDecorationLine: 'underline',
    color: '#234F3E',
  },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rule: { flex: 1, height: 1, backgroundColor: '#DFE7DF' },
  toggle: {
    width: 48,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eye: {
    width: 18,
    height: 11,
    borderColor: '#55766A',
    borderWidth: 1.5,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#55766A' },
  slash: {
    position: 'absolute',
    width: 18,
    height: 1.5,
    backgroundColor: '#55766A',
    transform: [{ rotate: '-35deg' }],
  },
})
