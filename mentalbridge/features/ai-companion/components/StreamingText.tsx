'use client'

import { memo, useEffect, useMemo, useRef, useState } from 'react'
import styles from './AiCompanionChat.module.css'

const AnimatedToken = memo(function AnimatedToken({
  value,
}: {
  value: string
}) {
  return <span className={styles.streamingToken}>{value}</span>
})

type Props = Readonly<{
  text: string
  stopped?: boolean
  onProgress?: (value: string) => void
  onComplete?: () => void
}>

export default function StreamingText({
  text,
  stopped = false,
  onProgress,
  onComplete,
}: Props) {
  const tokens = useMemo(() => text.match(/\S+\s*|\s+/g) ?? [text], [text])
  const [visible, setVisible] = useState(0)
  const completedRef = useRef(false)

  useEffect(() => {
    if (completedRef.current) return
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      const timer = window.setTimeout(() => {
        completedRef.current = true
        setVisible(tokens.length)
        onProgress?.(text)
        onComplete?.()
      }, 0)
      return () => window.clearTimeout(timer)
    }
    if (stopped) {
      completedRef.current = true
      onComplete?.()
      return
    }
    if (visible >= tokens.length) {
      completedRef.current = true
      onProgress?.(text)
      onComplete?.()
      return
    }
    const backlog = tokens.length - visible
    const delay = backlog > 55 ? 18 : backlog > 28 ? 25 : 34
    const timer = window.setTimeout(() => {
      const next = visible + 1
      setVisible(next)
      onProgress?.(tokens.slice(0, next).join(''))
    }, delay)
    return () => window.clearTimeout(timer)
  }, [onComplete, onProgress, stopped, text, tokens, visible])

  if (visible >= tokens.length || stopped) {
    return <>{tokens.slice(0, visible).join('')}</>
  }

  return (
    <>
      {tokens.slice(0, visible).map((token, index) => (
        <AnimatedToken key={index} value={token} />
      ))}
    </>
  )
}
