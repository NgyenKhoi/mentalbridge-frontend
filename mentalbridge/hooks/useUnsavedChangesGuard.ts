'use client'

import { useEffect } from 'react'
import { useFeedback } from '@/components/ui/FeedbackProvider'

// A same-route history entry lets ordinary browser Back ask before Next.js
// unmounts an editor. No user data goes into history.
export function useUnsavedChangesGuard(dirty: boolean, description: string) {
  const { confirm } = useFeedback()
  useEffect(() => {
    if (!dirty) return
    const route = window.location.href
    const marker = crypto.randomUUID()
    const previous: unknown = window.history.state
    const state = previous && typeof previous === 'object' ? previous : {}
    const guardedState = { ...state, mentalbridgeDraftGuard: marker }
    let pending = false
    let leaving = false
    window.history.pushState(guardedState, '', route)
    const protect = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    async function askToLeave(leave: () => void) {
      if (pending) return
      pending = true
      const ok = await confirm({
        title: 'Rời trang khi chưa lưu?',
        description,
        confirmLabel: 'Rời trang',
        cancelLabel: 'Tiếp tục chỉnh sửa',
        tone: 'warning',
      })
      pending = false
      if (ok) {
        leaving = true
        window.removeEventListener('beforeunload', protect)
        window.removeEventListener('popstate', protectBack)
        leave()
      }
    }
    const protectBack = () => {
      if (
        leaving ||
        window.location.href !== route ||
        window.history.state?.mentalbridgeDraftGuard === marker
      )
        return
      // Replace the forward guard immediately, keeping the editor mounted while
      // confirmation is open. Confirmed Back skips both same-route entries.
      window.history.pushState(guardedState, '', route)
      void askToLeave(() => window.history.go(-2))
    }
    const protectLink = (event: MouseEvent) => {
      const link =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>('a[href]')
          : null
      if (
        !link ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey ||
        link.target === '_blank' ||
        link.hasAttribute('download')
      )
        return
      if (
        link.pathname === window.location.pathname &&
        link.search === window.location.search
      )
        return
      event.preventDefault()
      event.stopPropagation()
      void askToLeave(() => window.location.assign(link.href))
    }
    window.addEventListener('beforeunload', protect)
    window.addEventListener('popstate', protectBack)
    document.addEventListener('click', protectLink, true)
    return () => {
      window.removeEventListener('beforeunload', protect)
      window.removeEventListener('popstate', protectBack)
      document.removeEventListener('click', protectLink, true)
      if (
        !leaving &&
        window.location.href === route &&
        window.history.state?.mentalbridgeDraftGuard === marker
      )
        window.history.back()
    }
  }, [dirty, confirm, description])
}
