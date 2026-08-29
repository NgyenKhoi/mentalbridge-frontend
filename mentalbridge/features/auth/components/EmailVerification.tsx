'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import {
  verificationErrorMessage,
  verifyEmailChallenge,
} from '../api/browser-auth'
import styles from './EmailVerification.module.css'

type VerificationState = 'pending' | 'success' | 'invalid' | 'error'

export default function EmailVerification({
  challenge,
}: Readonly<{ challenge: string | null }>) {
  const started = useRef(false)
  const statusCard = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<VerificationState>(
    challenge ? 'pending' : 'invalid',
  )
  const [message, setMessage] = useState(
    challenge
      ? 'Đang kiểm tra liên kết xác minh một lần của bạn.'
      : 'Liên kết xác minh không chứa thử thách hợp lệ.',
  )

  useEffect(() => {
    if (!challenge || started.current) return

    started.current = true
    window.history.replaceState(window.history.state, '', '/verify-email')
    let active = true

    void verifyEmailChallenge(challenge)
      .then(() => {
        if (!active) return
        setState('success')
        setMessage(
          'Email đã được xác minh. Tài khoản của bạn hiện đã sẵn sàng để đăng nhập.',
        )
      })
      .catch((error: unknown) => {
        if (!active) return
        const nextMessage = verificationErrorMessage(error)
        setState(
          nextMessage.startsWith('Liên kết xác minh') ? 'invalid' : 'error',
        )
        setMessage(nextMessage)
      })

    return () => {
      active = false
    }
  }, [challenge])

  useEffect(() => {
    if (state !== 'pending') statusCard.current?.focus()
  }, [state])

  const title =
    state === 'pending'
      ? 'Đang xác minh email'
      : state === 'success'
        ? 'Xác minh thành công'
        : state === 'invalid'
          ? 'Liên kết không còn hợp lệ'
          : 'Chưa thể xác minh'

  return (
    <div
      className={styles.statusCard}
      data-state={state}
      role="status"
      aria-live="polite"
      tabIndex={-1}
      ref={statusCard}
    >
      <span className={styles.statusIcon} aria-hidden="true">
        {state === 'pending' ? (
          <span className={styles.spinner} />
        ) : state === 'success' ? (
          '✓'
        ) : (
          '!'
        )}
      </span>
      <h1>{title}</h1>
      <p>{message}</p>
      {state === 'success' ? (
        <div className={styles.statusActions}>
          <Link href="/login" className="btn btn-primary">
            Đăng nhập
          </Link>
        </div>
      ) : state === 'pending' ? null : (
        <div className={styles.statusActions}>
          <Link href="/login" className="btn btn-outline">
            Về trang đăng nhập
          </Link>
          <Link href="/" className="btn btn-ghost">
            Về trang chủ
          </Link>
        </div>
      )}
    </div>
  )
}
