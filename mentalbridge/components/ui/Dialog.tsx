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
}>

export function Dialog({
  open,
  onOpenChange,
  labelledBy,
  describedBy,
  children,
  className,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open) {
      delete dialog.dataset.closing
      restoreFocusRef.current = document.activeElement as HTMLElement | null
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
      restoreFocusRef.current?.focus()
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
      restoreFocusRef.current?.focus()
    }, 140)
    return () => window.clearTimeout(timer)
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className={[styles.dialog, className].filter(Boolean).join(' ')}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
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
