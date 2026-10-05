import { StyleSheet, Text } from 'react-native'

import { Screen } from '@/components/Screen'
import { colors, spacing, typography } from '@/theme/tokens'

export function UserHomeScreen() {
  return (
    <Screen>
      <Text style={styles.eyebrow}>DÀNH CHO BẠN</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Chào mừng bạn quay lại
      </Text>
      <Text style={styles.description}>
        Nội dung dành cho bạn sẽ xuất hiện tại đây sau khi phiên đăng nhập được
        xác nhận.
      </Text>
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
  },
})
