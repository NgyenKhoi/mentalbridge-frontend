'use client'

import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'

import styles from './Dialog.module.css'

type DialogProps = Readonly<{
  open: boolean
  onOpenChange: (open: boolean) => void
  labelledBy: string
  describedBy?: string
  children: ReactNode
  className?: string
  restoreFocusTo?: () => HTMLElement | null
}>

export function Dialog({
  open,
  onOpenChange,
  labelledBy,
  describedBy,
  children,
  className,
  restoreFocusTo,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const restoreFocusFallback = useRef<(() => HTMLElement | null) | undefined>(
    undefined,
  )

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open) {
      delete dialog.dataset.closing
      restoreFocusRef.current = document.activeElement as HTMLElement | null
      restoreFocusFallback.current = restoreFocusTo
      if (!dialog.open) {
        try {
          if (typeof dialog.showModal === 'function') dialog.showModal()
          else dialog.setAttribute('open', '')
        } catch {
          dialog.setAttribute('open', '')
        }
      }
      return
    }

    if (!dialog.open) return
    const reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reducedMotion) {
      try {
        dialog.close?.()
      } catch {
        // Test DOMs may expose dialog without implementing close().
      }
      dialog.removeAttribute('open')
      const target = restoreFocusRef.current?.isConnected
        ? restoreFocusRef.current
        : restoreFocusFallback.current?.()
      target?.focus()
      return
    }

    dialog.dataset.closing = 'true'
    const timer = window.setTimeout(() => {
      try {
        dialog.close?.()
      } catch {
        // Test DOMs may expose dialog without implementing close().
      }
      dialog.removeAttribute('open')
      delete dialog.dataset.closing
      const target = restoreFocusRef.current?.isConnected
        ? restoreFocusRef.current
        : restoreFocusFallback.current?.()
      target?.focus()
    }, 140)
    return () => window.clearTimeout(timer)
  }, [open, restoreFocusTo])

  return (
    <dialog
      ref={dialogRef}
      className={[styles.dialog, className].filter(Boolean).join(' ')}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return
        const dialog = dialogRef.current
        if (!dialog) return
        const controls = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter(
          (element) =>
            element.tabIndex >= 0 &&
            element.getClientRects().length > 0 &&
            !element.closest('[inert]'),
        )
        const first = controls[0]
        const last = controls[controls.length - 1]
        if (!first || !last) {
          event.preventDefault()
          dialog.focus()
        } else if (
          event.shiftKey &&
          (document.activeElement === first ||
            !dialog.contains(document.activeElement))
        ) {
          event.preventDefault()
          last.focus()
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            !dialog.contains(document.activeElement))
        ) {
          event.preventDefault()
          first.focus()
        }
      }}
      onCancel={(event) => {
        event.preventDefault()
        onOpenChange(false)
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onOpenChange(false)
      }}
    >
      <div className={styles.surface}>{children}</div>
    </dialog>
  )
}
