'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import {
  verificationErrorMessage,
  verifyEmailChallenge,
} from '../api/browser-auth'
import styles from './EmailVerification.module.css'
import VerificationResendForm from './VerificationResendForm'

type VerificationState = 'pending' | 'success' | 'invalid' | 'error'

export default function EmailVerification() {
  const started = useRef(false)
  const statusCard = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<VerificationState>('pending')
  const [message, setMessage] = useState(
    'Đang kiểm tra liên kết xác minh một lần của bạn.',
  )

  useEffect(() => {
    if (started.current) return

    started.current = true
    const challenge = new URLSearchParams(window.location.search).get(
      'challenge',
    )
    window.history.replaceState(window.history.state, '', '/verify-email')
    if (!challenge) {
      let active = true
      queueMicrotask(() => {
        if (!active) return
        setState('invalid')
        setMessage('Liên kết xác minh không chứa thử thách hợp lệ.')
      })
      return () => {
        active = false
      }
    }
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
  }, [])

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
        <>
          <div className={styles.statusActions}>
            <Link href="/login" className="btn btn-outline">
              Về trang đăng nhập
            </Link>
            <Link href="/" className="btn btn-ghost">
              Về trang chủ
            </Link>
          </div>
          <VerificationResendForm />
        </>
      )}
    </div>
  )
}
