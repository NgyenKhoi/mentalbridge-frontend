import { router } from 'expo-router'
import { type ReactNode } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useResourceFonts } from '@/resources/useResourceFonts'

export function AccountPage({ children }: { children: ReactNode }) {
  const fonts = useResourceFonts()
  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.scroll}
        >
          <View style={s.page}>
            <View style={s.brandRow}>
              <View style={s.brandMark}>
                <Text aria-hidden style={s.mark}>
                  ☺
                </Text>
              </View>
              <View style={s.flex}>
                <Text style={[s.brand, fonts && s.serif]}>MentalBridge</Text>
                <Text style={s.caption}>TÂM AN TRÍ SÁNG</Text>
              </View>
              <Text style={s.badge}>✓ Bảo mật</Text>
            </View>
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

export function AccountHeading({
  title,
  children,
  centered = false,
}: {
  title: string
  children: ReactNode
  centered?: boolean
}) {
  const fonts = useResourceFonts()
  return (
    <View style={s.heading}>
      <Text
        accessibilityRole="header"
        style={[s.title, fonts && s.serif, centered && s.center]}
      >
        {title}
      </Text>
      <Text style={[s.copy, centered && s.center]}>{children}</Text>
    </View>
  )
}

export function AccountAction({
  label,
  onPress,
  disabled = false,
  outline = false,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  outline?: boolean
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        outline && s.outline,
        (disabled || pressed) && s.muted,
      ]}
    >
      <Text style={[s.buttonText, outline && s.dark]}>{label}</Text>
      {!outline && (
        <Text aria-hidden style={s.arrow}>
          →
        </Text>
      )}
    </Pressable>
  )
}

export function AccountLoginLink() {
  return (
    <View style={s.footer}>
      <Text style={s.copy}>Đã có tài khoản?</Text>
      <Text
        accessibilityRole="link"
        style={s.link}
        onPress={() => router.replace('/sign-in')}
      >
        Đăng nhập ngay
      </Text>
    </View>
  )
}

export const accountStyles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F6F8F2',
    experimental_backgroundImage:
      'radial-gradient(circle at 80% 0%, #DDEEE5, transparent 44%), linear-gradient(155deg, #F5FAF7, #F8F8F1)',
  },
  flex: { flex: 1, minWidth: 0 },
  scroll: {
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 84,
    flexGrow: 1,
  },
  page: { width: '100%', maxWidth: 540, alignSelf: 'center', gap: 20 },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    flexWrap: 'wrap',
    paddingBottom: 7,
  },
  brandMark: {
    width: 39,
    height: 39,
    borderRadius: 16,
    backgroundColor: '#193F34',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: { color: '#F6FEF9', fontSize: 25 },
  brand: { color: '#193F34', fontSize: 24, fontWeight: '800' },
  serif: { fontFamily: 'ResourceSerif', fontWeight: 'normal' },
  caption: { color: '#527364', fontSize: 10, letterSpacing: 0.8 },
  badge: {
    backgroundColor: '#E5F7ED',
    color: '#2D5C4C',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 24,
    overflow: 'hidden',
    fontWeight: '700',
    fontSize: 12,
  },
  heading: { gap: 6 },
  title: { color: '#162E25', fontSize: 32, lineHeight: 39, fontWeight: '800' },
  copy: { color: '#4B6056', fontSize: 14, lineHeight: 22 },
  center: { textAlign: 'center' },
  button: {
    minHeight: 52,
    borderRadius: 17,
    backgroundColor: '#1B4236',
    borderWidth: 1,
    borderColor: '#1B4236',
    padding: 12,
    gap: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  outline: { backgroundColor: '#FFF', borderColor: '#D9E2DA' },
  buttonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    flexShrink: 1,
  },
  dark: { color: '#234C3E' },
  arrow: { color: '#D3F5E4', fontSize: 19 },
  muted: { opacity: 0.57 },
  field: { gap: 6 },
  label: { color: '#18332B', fontSize: 14, fontWeight: '700' },
  input: {
    color: '#18332B',
    fontSize: 16,
    flex: 1,
    paddingVertical: 13,
    minWidth: 0,
  },
  control: {
    backgroundColor: '#FFF',
    borderColor: '#E2E8E0',
    borderWidth: 1,
    borderRadius: 17,
    minHeight: 50,
    paddingLeft: 13,
    gap: 9,
    flexDirection: 'row',
    alignItems: 'center',
  },
  glyph: { color: '#5C7B6D', width: 20, textAlign: 'center', fontSize: 17 },
  link: {
    fontSize: 14,
    minHeight: 44,
    paddingVertical: 11,
    color: '#235645',
    fontWeight: '700',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#DFE7DE',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  error: {
    color: '#8E332F',
    backgroundColor: '#FFF1ED',
    padding: 12,
    borderRadius: 12,
    lineHeight: 22,
  },
  notice: {
    color: '#2F5D4B',
    backgroundColor: '#E6F3E9',
    padding: 12,
    borderRadius: 12,
    lineHeight: 22,
  },
})
const s = accountStyles
