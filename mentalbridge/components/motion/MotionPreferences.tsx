'use client'

import type { ReactNode } from 'react'
import { MotionConfig } from 'framer-motion'

export type MotionPreferencesProps = {
  children: ReactNode
}

/** Applies the operating system motion preference to all nested Motion elements. */
export default function MotionPreferences({
  children,
}: MotionPreferencesProps) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}
