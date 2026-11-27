import { Pressable, StyleSheet, Text } from 'react-native'
import { ApiError } from '@/api/api-error'
import { colors, radii, spacing, typography } from '@/theme/tokens'

export function notificationError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401)
      return 'Phiên đăng nhập đã hết hạn. Đăng nhập lại để tiếp tục.'
    if (error.status === 403)
      return 'Tài khoản này không có quyền thực hiện thao tác.'
    if ([404, 410].includes(error.status ?? 0))
      return 'Thông báo hoặc nội dung này không còn khả dụng.'
    if ([409, 412, 428].includes(error.status ?? 0))
      return 'Tùy chọn đã thay đổi trên thiết bị khác. Tải lại trước khi lưu.'
    if (error.status === 422) return 'Kiểm tra giờ và múi giờ rồi thử lưu lại.'
  }
  return 'Chưa thể hoàn tất thao tác. Bạn có thể tải lại để thử tiếp.'
}
export function NotificationButton({
  label,
  onPress,
  disabled = false,
}: Readonly<{ label: string; onPress: () => void; disabled?: boolean }>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  )
}
export const styles = StyleSheet.create({
  column: { gap: spacing.lg },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    color: colors.ink,
    fontSize: typography.heading,
    lineHeight: typography.headingLineHeight,
    fontWeight: '700',
  },
  heading: { color: colors.ink, fontSize: 20, fontWeight: '700' },
  body: {
    color: colors.ink,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  muted: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  item: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  button: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.tealDeep,
    alignSelf: 'flex-start',
  },
  buttonText: {
    color: colors.tealDeep,
    fontSize: typography.body,
    fontWeight: '700',
  },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.55 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.tealDeep,
    borderRadius: radii.control,
    padding: spacing.md,
    color: colors.ink,
    backgroundColor: colors.surface,
    fontSize: typography.body,
  },
})
