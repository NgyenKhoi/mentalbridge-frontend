'use client'

import { useEffect } from 'react'
import { useFeedback } from '@/components/ui/FeedbackProvider'

export function useProfileDraftGuard(dirty: boolean) {
  const { confirm } = useFeedback()
  useEffect(() => {
    if (!dirty) return
    const protect = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    const protectLink = (event: MouseEvent) => {
      const link =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>('a[href]')
          : null
      if (
        !link ||
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey ||
        link.target === '_blank'
      )
        return
      if (
        link.pathname === window.location.pathname &&
        link.search === window.location.search
      )
        return
      event.preventDefault()
      event.stopPropagation()
      void confirm({
        title: 'Rời trang khi chưa lưu?',
        description: 'Các chỉnh sửa trên màn hình chưa được lưu vào bản nháp.',
        confirmLabel: 'Rời trang',
        cancelLabel: 'Tiếp tục chỉnh sửa',
        tone: 'warning',
      }).then((ok) => {
        if (ok) {
          window.removeEventListener('beforeunload', protect)
          window.location.assign(link.href)
        }
      })
    }
    window.addEventListener('beforeunload', protect)
    document.addEventListener('click', protectLink, true)
    return () => {
      window.removeEventListener('beforeunload', protect)
      document.removeEventListener('click', protectLink, true)
    }
  }, [dirty, confirm])
}
