import { router } from 'expo-router'
import { useRef, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ApiError } from '@/api/api-error'
import { useSession } from '@/auth/session-context'
import { useResourceFonts } from '@/resources/useResourceFonts'
import { colors } from '@/theme/tokens'

import { SignInBreathing } from './sign-in-breathing'

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
  const fonts = useResourceFonts()
  const { width, height, fontScale } = useWindowDimensions()
  const wide = width >= 820 && height >= 580 && fontScale <= 1.2
  const breathingSize =
    width < 360 || height < 680 || fontScale > 1.2 ? 92 : 116
  const passwordInput = useRef<TextInput>(null)
  const [passwordVisible, setPasswordVisible] = useState(false)
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
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          bounces={false}
          overScrollMode="never"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}
        >
          <View style={[styles.page, wide && styles.pageWide]}>
            <View style={styles.top}>
              <View style={styles.brandBlock}>
                <View style={styles.brandMark} aria-hidden>
                  <View style={styles.arc} />
                  <View style={styles.leftPost} />
                  <View style={styles.rightPost} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.brand}>MentalBridge</Text>
                  <Text style={styles.brandCaption}>WELLNESS SPACE</Text>
                </View>
              </View>
              <Text style={styles.security}>Bảo mật</Text>
            </View>

            <View style={[styles.columns, wide && styles.columnsWide]}>
              <View
                style={[styles.intro, wide ? styles.flex : styles.compactIntro]}
              >
                <View style={styles.introCopy}>
                  <Text
                    accessibilityRole="header"
                    style={[
                      styles.title,
                      !wide && styles.compactTitle,
                      fonts && styles.serif,
                    ]}
                  >
                    Chào mừng trở lại
                  </Text>
                  <Text style={[styles.description, fonts && styles.sans]}>
                    Đăng nhập để tiếp tục hành trình chăm sóc sức khỏe tinh thần
                    của bạn.
                  </Text>
                </View>
                <SignInBreathing
                  fonts={fonts}
                  {...(!wide && { compactSize: breathingSize })}
                />
              </View>

              <View style={[styles.form, wide && styles.formWide]}>
                {notice ? (
                  <Text accessibilityRole="alert" style={styles.error}>
                    {notice}
                  </Text>
                ) : null}
                <View style={styles.field}>
                  <Text nativeID="sign-in-email-label" style={styles.label}>
                    Email
                  </Text>
                  <View style={styles.inputBox}>
                    <Text aria-hidden style={styles.inputIcon}>
                      ✉
                    </Text>
                    <TextInput
                      accessibilityLabel="Email"
                      testID="sign-in-email-input"
                      accessibilityLabelledBy="sign-in-email-label"
                      autoCapitalize="none"
                      autoComplete="email"
                      autoCorrect={false}
                      keyboardType="email-address"
                      maxLength={254}
                      onChangeText={setEmail}
                      onSubmitEditing={() => passwordInput.current?.focus()}
                      returnKeyType="next"
                      placeholder="Nhập email của bạn"
                      placeholderTextColor={colors.inkFaint}
                      style={[styles.input, fonts && styles.sans]}
                      value={email}
                    />
                  </View>
                </View>
                <View style={styles.field}>
                  <View style={styles.fieldTop}>
                    <Text
                      nativeID="sign-in-password-label"
                      style={styles.label}
                    >
                      Mật khẩu
                    </Text>
                    <Text
                      accessibilityRole="link"
                      onPress={() => router.push('./reset-password')}
                      style={styles.link}
                    >
                      Quên mật khẩu?
                    </Text>
                  </View>
                  <View style={styles.inputBox}>
                    <View aria-hidden style={styles.lockMark}>
                      <View style={styles.shackle} />
                      <View style={styles.lockBody} />
                    </View>
                    <TextInput
                      ref={passwordInput}
                      accessibilityLabel="Mật khẩu"
                      testID="sign-in-password-input"
                      accessibilityLabelledBy="sign-in-password-label"
                      autoCapitalize="none"
                      autoComplete="current-password"
                      autoCorrect={false}
                      maxLength={128}
                      onChangeText={setPassword}
                      onSubmitEditing={() => void submit()}
                      returnKeyType="go"
                      secureTextEntry={!passwordVisible}
                      placeholder="Nhập mật khẩu của bạn"
                      placeholderTextColor={colors.inkFaint}
                      style={[styles.input, fonts && styles.sans]}
                      value={password}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        passwordVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'
                      }
                      onPress={() => setPasswordVisible((value) => !value)}
                      style={styles.passwordToggle}
                    >
                      <View aria-hidden style={styles.eye}>
                        <View style={styles.pupil} />
                        {passwordVisible && <View style={styles.eyeStrike} />}
                      </View>
                    </Pressable>
                  </View>
                </View>
                {error ? (
                  <Text accessibilityRole="alert" style={styles.error}>
                    {error}
                  </Text>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    loading ? 'Đang đăng nhập...' : 'Đăng nhập'
                  }
                  accessibilityState={{ disabled: loading, busy: loading }}
                  disabled={loading}
                  onPress={() => void submit()}
                  testID="sign-in-submit"
                  style={({ pressed }) => [
                    styles.submit,
                    (pressed || loading) && styles.pressed,
                  ]}
                >
                  <Text style={styles.submitText}>
                    {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                  </Text>
                  {!loading && (
                    <Text aria-hidden style={styles.arrow}>
                      →
                    </Text>
                  )}
                </Pressable>
                <View style={styles.separator}>
                  <View style={styles.line} />
                  <Text style={styles.or}>HOẶC</Text>
                  <View style={styles.line} />
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Tiếp tục ẩn danh với bài đánh giá"
                  onPress={() => router.push('/assessment/anonymous')}
                  style={({ pressed }) => [
                    styles.guest,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.guestTitle}>
                    ♧ Tiếp tục ẩn danh với bài đánh giá
                  </Text>
                  {wide && (
                    <Text style={styles.guestCopy}>
                      Làm bài đánh giá sức khỏe tinh thần không cần đăng ký.
                    </Text>
                  )}
                </Pressable>
                <View style={styles.signup}>
                  <Text style={styles.guestCopy}>Chưa có tài khoản?</Text>
                  <Text
                    accessibilityRole="link"
                    onPress={() => router.push('./register')}
                    style={styles.link}
                  >
                    Đăng ký ngay
                  </Text>
                </View>
              </View>
            </View>
            {wide && (
              <Text style={styles.footer}>
                ✓ Không gian đăng nhập riêng tư và bảo mật
              </Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#E8F3EF',
    experimental_backgroundImage:
      'radial-gradient(circle at 5% 40%, #D5F0E3, transparent 46%), linear-gradient(145deg, #F7FAFA, #E5F1EC 92%)',
  },
  flex: { flex: 1, minWidth: 0 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 23,
    paddingTop: 12,
    paddingBottom: 64,
  },
  page: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: 15 },
  pageWide: { maxWidth: 1000, paddingHorizontal: 16, gap: 36 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  brandBlock: {
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
    flexGrow: 1,
  },
  brandMark: {
    width: 39,
    height: 39,
    backgroundColor: '#FBFEFD',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E6EEEA',
  },
  arc: {
    position: 'absolute',
    top: 11,
    width: 17,
    height: 14,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderColor: '#1B483A',
  },
  leftPost: {
    position: 'absolute',
    left: 10,
    top: 20,
    width: 6,
    height: 8,
    borderRadius: 2,
    backgroundColor: '#1B483A',
  },
  rightPost: {
    position: 'absolute',
    right: 10,
    top: 20,
    width: 6,
    height: 8,
    borderRadius: 2,
    backgroundColor: '#1B483A',
  },
  brand: { fontSize: 20, color: '#143A2F', fontWeight: '800' },
  brandCaption: { fontSize: 10, color: '#2D574B', letterSpacing: 1.1 },
  security: {
    overflow: 'hidden',
    backgroundColor: '#FAFDFC',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#214C3F',
    fontSize: 12,
    fontWeight: '700',
  },
  columns: { gap: 14 },
  compactIntro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  introCopy: { minWidth: 0, flexShrink: 1, gap: 5 },
  compactTitle: { fontSize: 29, lineHeight: 35 },
  columnsWide: { flexDirection: 'row', alignItems: 'center', gap: 35 },
  intro: { gap: 11 },
  title: { color: '#142820', fontSize: 34, fontWeight: '800', lineHeight: 43 },
  serif: { fontFamily: 'ResourceSerif', fontWeight: 'normal' },
  sans: { fontFamily: 'ResourceSans' },
  description: {
    color: '#3F5C51',
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 8,
  },
  form: { gap: 8 },
  formWide: {
    flex: 1,
    minWidth: 0,
    padding: 24,
    borderRadius: 22,
    backgroundColor: '#F6FAF8',
  },
  field: { gap: 7 },
  fieldTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  label: {
    color: '#182E25',
    fontSize: 15,
    fontWeight: '700',
    paddingVertical: 5,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    paddingLeft: 14,
    borderWidth: 1,
    borderColor: '#DCE8F0',
    borderRadius: 17,
    backgroundColor: '#EAF2FA',
  },
  inputIcon: { width: 21, color: '#37695E', fontSize: 17 },
  input: {
    minWidth: 0,
    flex: 1,
    color: '#172E26',
    fontSize: 16,
    paddingHorizontal: 9,
    paddingVertical: 13,
  },
  lockMark: { width: 21, height: 22, alignItems: 'center' },
  shackle: {
    width: 9,
    height: 9,
    borderWidth: 1.5,
    borderColor: '#37695E',
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },
  lockBody: {
    width: 14,
    height: 10,
    borderWidth: 1.5,
    borderColor: '#37695E',
    borderRadius: 2,
    marginTop: -1,
  },
  passwordToggle: {
    width: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eye: {
    width: 17,
    height: 11,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#37695E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pupil: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#37695E' },
  eyeStrike: {
    position: 'absolute',
    width: 18,
    height: 1.5,
    backgroundColor: '#37695E',
    transform: [{ rotate: '-35deg' }],
  },
  link: {
    minHeight: 44,
    textAlignVertical: 'center',
    paddingVertical: 11,
    fontSize: 14,
    fontWeight: '700',
    color: '#1A4939',
  },
  submit: {
    backgroundColor: '#193F34',
    borderRadius: 18,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    padding: 12,
    boxShadow: '0px 8px 18px rgba(24,63,52,.18)',
  },
  submitText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  arrow: { color: '#9CE1C6', fontSize: 21 },
  pressed: { opacity: 0.65 },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 5,
  },
  line: { flex: 1, height: 1, backgroundColor: '#D1E0D9' },
  or: { color: '#4E6B60', fontSize: 12, letterSpacing: 0.7 },
  guest: {
    minHeight: 48,
    padding: 12,
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FBFDFC',
    borderColor: '#D3E2DA',
    borderWidth: 1,
    borderRadius: 18,
  },
  guestTitle: {
    color: '#18352B',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '800',
  },
  guestCopy: {
    color: '#3D5D50',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  signup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 5,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#D8E7E1',
    textAlign: 'center',
    color: '#486D5D',
    paddingTop: 11,
    fontSize: 11,
  },
  error: {
    color: '#892E28',
    fontSize: 14,
    lineHeight: 21,
    backgroundColor: '#FFF1EB',
    borderRadius: 12,
    padding: 12,
  },
})
