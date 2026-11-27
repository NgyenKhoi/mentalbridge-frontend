import { useRef, useState } from 'react'
import { randomUUID } from 'expo-crypto'
import { StyleSheet } from 'react-native'

import { ApiError } from '@/api/api-error'
import { Txt } from '@/theme/dashboard'
import { radii, spacing, typography } from '@/theme/tokens'

import { communityColors } from './community-theme'

// Primitives live in their own files; chat screens import them from here.
export * from './community-avatar'
export * from './community-primitives'
export * from './community-skeleton'
export { BottomSheet } from './CommunityBottomSheet'
export { CommunityTabBar, type CommunityTab } from './CommunityTabBar'

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
  const next = (body: unknown) => {
    const signature = JSON.stringify(body)
    if (!command.current || command.current.body !== signature)
      command.current = { body: signature, key: randomUUID() }
    return command.current.key
  }
  // Call after an acknowledged success so identical text sent again is a new command, not a replay.
  next.done = () => {
    command.current = null
  }
  return next
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

export function CommunityMessage({ children }: Readonly<{ children: string }>) {
  return (
    <Txt accessibilityLiveRegion="polite" style={communityStyles.message}>
      {children}
    </Txt>
  )
}

export const communityStyles = StyleSheet.create({
  column: { gap: spacing.lg },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  title: {
    color: communityColors.ink,
    fontSize: typography.heading,
    lineHeight: typography.headingLineHeight,
    fontWeight: '700',
  },
  heading: {
    color: communityColors.ink,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
  },
  body: {
    color: communityColors.ink,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  muted: {
    color: communityColors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  message: {
    color: communityColors.primaryDeep,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
    paddingVertical: spacing.md,
  },
  card: {
    backgroundColor: communityColors.background,
    borderRadius: radii.panel,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: communityColors.line,
  },
  input: {
    color: communityColors.ink,
    backgroundColor: communityColors.background,
    borderColor: communityColors.inkSoft,
    borderWidth: 1,
    borderRadius: radii.control,
    minHeight: 48,
    padding: spacing.md,
    fontSize: typography.body,
    textAlignVertical: 'top',
  },
  disabled: { opacity: 0.55 },
  media: { width: '100%', height: 220, borderRadius: radii.control },
})
