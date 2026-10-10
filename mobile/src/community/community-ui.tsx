import { useRef, useState } from 'react'
import { randomUUID } from 'expo-crypto'
import { Pressable, StyleSheet, Text } from 'react-native'

import { ApiError } from '@/api/api-error'
import { colors, radii, spacing, typography } from '@/theme/tokens'

export function communityMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401)
      return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại để tiếp tục.'
    if (error.status === 403)
      return 'Chưa thể truy cập cộng đồng bằng tài khoản này.'
    if (error.status === 404)
      return 'Nội dung không còn hiển thị hoặc bạn không có quyền truy cập.'
    if (error.status === 412)
      return 'Nội dung đã thay đổi. Tải lại bản mới trước khi sửa tiếp; bản nháp chưa được lưu.'
    if (error.status === 409)
      return 'Chưa thể hoàn tất với trạng thái hiện tại. Kiểm tra lại trước khi thử tiếp.'
    if (error.status === 400)
      return 'Thông tin chưa hợp lệ. Kiểm tra lại nội dung bạn muốn gửi.'
  }
  return 'Chưa thể xác nhận yêu cầu lúc này. Hãy thử lại; không có kết quả thành công nào được giả định.'
}

export function useCommandKey() {
  const command = useRef<{ body: string; key: string } | null>(null)
  return (body: unknown) => {
    const signature = JSON.stringify(body)
    if (!command.current || command.current.body !== signature)
      command.current = { body: signature, key: randomUUID() }
    return command.current.key
  }
}

export function useCommunityAction() {
  const running = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (action: () => Promise<void>) => {
    if (running.current) return
    running.current = true
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (failure) {
      setError(communityMessage(failure))
    } finally {
      running.current = false
      setBusy(false)
    }
  }
  return { busy, error, run }
}

export function CommunityButton({
  label,
  onPress,
  disabled = false,
  selected,
  testID,
}: Readonly<{
  label: string
  onPress: () => void
  disabled?: boolean
  selected?: boolean
  testID?: string
}>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{
        disabled,
        ...(selected === undefined ? {} : { selected }),
      }}
      disabled={disabled}
      testID={testID}
      onPress={onPress}
      style={[
        communityStyles.button,
        selected && communityStyles.selected,
        disabled && communityStyles.disabled,
      ]}
    >
      <Text style={communityStyles.buttonText}>{label}</Text>
    </Pressable>
  )
}

export function CommunityMessage({ children }: Readonly<{ children: string }>) {
  return (
    <Text accessibilityLiveRegion="polite" style={communityStyles.message}>
      {children}
    </Text>
  )
}

export const communityStyles = StyleSheet.create({
  column: { gap: spacing.lg },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  title: {
    color: colors.ink,
    fontSize: typography.heading,
    lineHeight: typography.headingLineHeight,
    fontWeight: '700',
  },
  heading: {
    color: colors.ink,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
  },
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
  message: {
    color: colors.tealDeep,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
    paddingVertical: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.panel,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  input: {
    color: colors.ink,
    backgroundColor: colors.surface,
    borderColor: colors.inkSoft,
    borderWidth: 1,
    borderRadius: radii.control,
    minHeight: 48,
    padding: spacing.md,
    fontSize: typography.body,
    textAlignVertical: 'top',
  },
  button: {
    borderWidth: 1,
    borderColor: colors.tealDeep,
    borderRadius: radii.control,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  selected: { backgroundColor: colors.tealPale },
  buttonText: {
    color: colors.tealDeep,
    fontSize: typography.body,
    fontWeight: '600',
  },
  disabled: { opacity: 0.55 },
  media: { width: '100%', height: 220, borderRadius: radii.control },
})
