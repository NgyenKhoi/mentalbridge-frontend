import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'

import { ApiError } from '@/api/api-error'
import { colors, radii, spacing, typography } from '@/theme/tokens'

export function journalError(error: unknown) {
  if (error instanceof ApiError && error.status === 401)
    return 'Phiên đăng nhập đã hết hạn. Đăng nhập lại để tiếp tục.'
  if (error instanceof ApiError && error.status === 403)
    return 'Chưa có quyền thực hiện yêu cầu này. Bạn vẫn có thể viết nhật ký khi phiên đăng nhập còn hợp lệ.'
  if (error instanceof ApiError && error.status === 404)
    return 'Bài viết hoặc yêu cầu này không còn có sẵn. Hãy tải lại danh sách.'
  return 'Chưa thể kết nối lúc này. Nội dung đang viết vẫn được giữ trên màn hình.'
}

export function Notice({
  children,
  error = false,
}: Readonly<{ children: ReactNode; error?: boolean }>) {
  return (
    <Text
      accessibilityLiveRegion="polite"
      style={[journalStyles.body, error && journalStyles.error]}
    >
      {children}
    </Text>
  )
}

export function TextAction({
  label,
  onPress,
  disabled = false,
  testID,
}: Readonly<{
  label: string
  onPress: () => void
  disabled?: boolean
  testID?: string
}>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        journalStyles.action,
        pressed && { opacity: 0.65 },
      ]}
    >
      <Text style={journalStyles.actionLabel}>{label}</Text>
    </Pressable>
  )
}

export const journalStyles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.panel,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  title: {
    color: colors.ink,
    fontSize: typography.heading,
    lineHeight: typography.headingLineHeight,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  heading: { color: colors.ink, fontSize: 21, fontWeight: '700' },
  body: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  label: { color: colors.ink, fontSize: typography.body, fontWeight: '700' },
  error: { color: '#9B352D' },
  input: {
    borderWidth: 1,
    borderColor: colors.inkFaint,
    borderRadius: radii.control,
    padding: spacing.md,
    fontSize: typography.body,
    color: colors.ink,
    minHeight: 48,
    backgroundColor: colors.white,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choice: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.control,
    padding: spacing.md,
  },
  selected: { backgroundColor: colors.tealPale, borderColor: colors.tealDeep },
  action: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
  },
  actionLabel: {
    color: colors.tealDeep,
    fontSize: typography.body,
    fontWeight: '700',
  },
  source: { color: colors.inkSoft, fontSize: 13, lineHeight: 20 },
})
