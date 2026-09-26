'use client'

import type { CSSProperties } from 'react'

import type { ToastItem } from './toast-types'
import styles from './Toast.module.css'

type ActionToastProps = Readonly<{
  items: readonly ToastItem[]
  onDismiss: (id: string) => void
}>

const symbols = { success: '✓', error: '!', warning: '!', info: 'i' } as const

export function ActionToast({ items, onDismiss }: ActionToastProps) {
  return (
    <section
      className={styles.actionRegion}
      aria-label="Phản hồi thao tác"
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
