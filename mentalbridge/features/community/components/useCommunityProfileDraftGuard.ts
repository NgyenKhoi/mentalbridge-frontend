'use client'

import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'

export function useCommunityProfileDraftGuard(dirty: boolean) {
  useUnsavedChangesGuard(
    dirty,
    'Lựa chọn ảnh và chỉnh sửa tên chưa lưu sẽ không được giữ khi rời trang.',
  )
}
