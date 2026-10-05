import { router } from 'expo-router'
import { StyleSheet, Text } from 'react-native'

import { PrimaryButton } from '@/components/PrimaryButton'
import { Screen } from '@/components/Screen'
import { colors, spacing, typography } from '@/theme/tokens'

export function SignInPlaceholderScreen() {
  return (
    <Screen>
      <Text style={styles.eyebrow}>ĐĂNG NHẬP</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Chưa thể đăng nhập trên ứng dụng
      </Text>
      <Text style={styles.description}>
        Tài khoản và phiên đăng nhập của bạn vẫn được bảo vệ. Vui lòng quay lại
        sau khi chức năng này sẵn sàng.
      </Text>
      <PrimaryButton label="Quay lại" onPress={() => router.back()} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  eyebrow: {
    color: colors.teal,
    fontSize: typography.eyebrow,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: spacing.md,
  },
  title: {
    color: colors.ink,
    fontSize: typography.heading,
    fontWeight: '700',
    lineHeight: typography.headingLineHeight,
    marginBottom: spacing.lg,
  },
  description: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
    marginBottom: spacing.xxl,
  },
})
