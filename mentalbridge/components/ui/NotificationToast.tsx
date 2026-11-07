'use client'

import type { CSSProperties } from 'react'
import Link from 'next/link'

import type { ToastItem } from './toast-types'
import styles from './Toast.module.css'

type NotificationToastProps = Readonly<{
  items: readonly ToastItem[]
  onDismiss: (id: string) => void
  label?: string
}>

const symbols = { success: '✓', error: '!', warning: '!', info: 'i' } as const

export function NotificationToast({
  items,
  onDismiss,
  label = 'Thông báo mới',
}: NotificationToastProps) {
  return (
    <section
      className={styles.notificationRegion}
      aria-label={label}
      aria-live="polite"
      aria-atomic="false"
    >
      {items.map((item) => (
        <article
          key={item.id}
          className={styles.toast}
          data-tone={item.tone}
          role={item.tone === 'error' ? 'alert' : 'status'}
        >
          <span className={styles.icon} aria-hidden="true">
            {symbols[item.tone]}
          </span>
          <p className={styles.copy}>
            <strong>{item.title}</strong>
            {item.description && <span>{item.description}</span>}
            {item.action && (
              <Link
                className={styles.actionLink}
                href={item.action.href}
                onClick={() => onDismiss(item.id)}
              >
                {item.action.label} <span aria-hidden="true">↗</span>
              </Link>
            )}
          </p>
          <button
            type="button"
            className={styles.dismiss}
            aria-label="Đóng thông báo"
            onClick={() => onDismiss(item.id)}
          >
            ×
          </button>
          <span
            className={styles.progress}
            aria-hidden="true"
            style={{ animationDuration: `${item.duration}ms` } as CSSProperties}
          />
        </article>
      ))}
    </section>
  )
}
