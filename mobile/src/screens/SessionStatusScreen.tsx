import { ActivityIndicator, StyleSheet, Text } from 'react-native'

import { PrimaryButton } from '@/components/PrimaryButton'
import { Screen } from '@/components/Screen'
import { colors, spacing, typography } from '@/theme/tokens'

export function SessionStatusScreen({
  onRetry,
  unavailable = false,
}: Readonly<{ onRetry?: () => void; unavailable?: boolean }>) {
  return (
    <Screen>
      <Text accessibilityRole="header" style={styles.title}>
        {unavailable
          ? 'Chưa thể xác minh phiên'
          : 'Đang kiểm tra phiên đăng nhập'}
      </Text>
      <Text style={styles.description}>
        {unavailable
          ? 'Dịch vụ tài khoản tạm thời chưa phản hồi. Ứng dụng chưa mở nội dung cá nhân cho đến khi Identity xác nhận phiên.'
          : 'MentalBridge đang xác nhận phiên an toàn của bạn.'}
      </Text>
      {unavailable && onRetry ? (
        <PrimaryButton label="Thử lại" onPress={onRetry} />
      ) : (
        <ActivityIndicator color={colors.tealDeep} size="large" />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
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
    marginBottom: spacing.xl,
  },
})
