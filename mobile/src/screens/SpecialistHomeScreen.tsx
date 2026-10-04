import { StyleSheet, Text } from 'react-native'

import { Screen } from '@/components/Screen'
import { colors, spacing, typography } from '@/theme/tokens'

export function SpecialistHomeScreen() {
  return (
    <Screen>
      <Text style={styles.eyebrow}>DÀNH CHO CHUYÊN GIA</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Không gian làm việc của bạn
      </Text>
      <Text style={styles.description}>
        Nội dung dành cho chuyên gia sẽ xuất hiện tại đây sau khi phiên đăng
        nhập và vai trò được xác nhận.
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
