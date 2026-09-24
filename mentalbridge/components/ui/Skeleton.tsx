import type { CSSProperties } from 'react'

import styles from './Skeleton.module.css'

export function Skeleton({
  className,
  width,
  height,
}: Readonly<{
  className?: string
  width?: CSSProperties['width']
  height?: CSSProperties['height']
}>) {
  return (
    <span
      className={[styles.skeleton, className].filter(Boolean).join(' ')}
      style={{ width, height }}
      aria-hidden="true"
    />
  )
}
