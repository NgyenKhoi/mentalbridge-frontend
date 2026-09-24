import type { ComponentPropsWithoutRef, ReactNode } from 'react'

import styles from './Disclosure.module.css'

type DisclosureProps = Omit<
  ComponentPropsWithoutRef<'details'>,
  'children' | 'className'
> &
  Readonly<{
    summary: ReactNode
    meta?: ReactNode
    children: ReactNode
    className?: string
    contentClassName?: string
    summaryLabel?: string
  }>

export function Disclosure({
  summary,
  meta,
  children,
  className,
  contentClassName,
  summaryLabel,
  ...detailsProps
}: DisclosureProps) {
  return (
    <details
      className={[styles.root, className].filter(Boolean).join(' ')}
      {...detailsProps}
    >
      <summary
        className={styles.summary}
        role="button"
        aria-label={summaryLabel}
      >
        <span className={styles.label}>{summary}</span>
        {meta ? <span className={styles.meta}>{meta}</span> : null}
        <svg
          className={styles.chevron}
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 8 4 4 4-4" />
        </svg>
      </summary>
      <div
        className={[styles.content, contentClassName].filter(Boolean).join(' ')}
      >
        {children}
      </div>
    </details>
  )
}
