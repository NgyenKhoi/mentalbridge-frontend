import type { ResourceStickerVariant } from '../model/resource-experience'

import styles from './animated-resource-sticker.module.css'

type Props = Readonly<{
  variant: ResourceStickerVariant
  size?: 'small' | 'medium' | 'large'
}>

function StickerArtwork({ variant }: Pick<Props, 'variant'>) {
  if (variant === 'breathe') {
    return (
      <>
        <path d="M21 52c-8 0-14-5-14-12s6-12 14-12c2-10 10-17 20-17 12 0 21 9 21 21 7 1 12 6 12 13 0 8-6 14-15 14H21Z" />
        <path
          d="M22 37c8-5 18-5 27 0M28 46c7-4 14-4 21 0"
          className={styles.line}
        />
      </>
    )
  }
  if (variant === 'meditate') {
    return (
      <>
        <path d="M40 58C25 49 19 37 22 24c10 2 17 7 22 16 3-11 10-20 20-25 5 14 2 27-9 38 7-4 14-5 22-3-4 13-16 20-37 20S7 63 3 50c8-2 15-1 22 3-8-10-10-21-6-33 10 4 17 12 21 23Z" />
        <circle cx="40" cy="44" r="6" className={styles.cutout} />
      </>
    )
  }
  if (variant === 'read') {
    return (
      <>
        <path d="M9 18c13-3 23 0 31 8v40c-8-8-18-11-31-8V18Zm62 0c-13-3-23 0-31 8v40c8-8 18-11 31-8V18Z" />
        <path
          d="M40 27v39M16 29c7-1 13 1 18 5M46 34c5-4 11-6 18-5"
          className={styles.line}
        />
      </>
    )
  }
  if (variant === 'video') {
    return (
      <>
        <rect x="7" y="15" width="66" height="48" rx="13" />
        <path d="m34 29 19 10-19 11V29Z" className={styles.cutout} />
        <path d="M24 70h32" className={styles.line} />
      </>
    )
  }
  if (variant === 'journal') {
    return (
      <>
        <rect x="11" y="9" width="48" height="62" rx="10" />
        <path d="M22 25h25M22 35h19M22 45h23" className={styles.line} />
        <path d="m54 51 15-23 7 5-15 23-10 5 3-10Z" />
      </>
    )
  }
  if (variant === 'community') {
    return (
      <>
        <circle cx="28" cy="31" r="12" />
        <circle cx="57" cy="31" r="12" />
        <path d="M8 68c2-15 10-23 20-23s18 8 20 23H8Zm30 0c2-15 9-23 19-23s17 8 19 23H38Z" />
        <path
          d="M42 18c5-10 18-5 13 4-3 5-8 8-13 12-5-4-10-7-13-12-5-9 8-14 13-4Z"
          className={styles.accent}
        />
      </>
    )
  }
  if (variant === 'complete') {
    return (
      <>
        <path d="m40 6 9 20 22 2-17 15 5 22-19-11-19 11 5-22L9 28l22-2L40 6Z" />
        <path d="m28 40 8 8 17-19" className={styles.line} />
      </>
    )
  }
  if (variant === 'rest') {
    return (
      <>
        <path d="M57 13c-20 2-30 25-18 41 8 10 23 12 34 5-7 12-20 18-34 15C20 70 9 52 13 34 17 17 36 7 57 13Z" />
        <path
          d="m61 21 3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1 3-7Z"
          className={styles.accent}
        />
      </>
    )
  }
  return (
    <>
      <path d="M38 69c-3-17 0-33 10-48 5 17 2 34-10 48Z" />
      <path d="M38 68C25 60 18 49 17 34c14 4 23 14 27 29M42 56c8-9 17-13 28-12-3 14-13 23-30 27" />
      <path d="M39 70v7" className={styles.line} />
    </>
  )
}

export function AnimatedResourceSticker({ variant, size = 'medium' }: Props) {
  return (
    <span
      className={styles.sticker}
      data-variant={variant}
      data-size={size}
      aria-hidden="true"
    >
      <span className={styles.halo} />
      <svg viewBox="0 0 80 80" focusable="false">
        <StickerArtwork variant={variant} />
      </svg>
      <i className={styles.sparkOne} />
      <i className={styles.sparkTwo} />
    </span>
  )
}
