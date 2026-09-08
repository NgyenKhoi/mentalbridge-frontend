'use client'

import { useEffect, useRef, useState } from 'react'

import {
  credentialRequestErrorMessage,
  requestEmailVerification,
} from '../api/browser-auth'
import styles from './CredentialForms.module.css'

export default function VerificationResendForm({
  initialEmail = '',
}: Readonly<{ initialEmail?: string }>) {
  const [email, setEmail] = useState(initialEmail)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const result = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (message || error) result.current?.focus()
  }, [message, error])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return
    setLoading(true)
    setMessage('')
    setError('')
    try {
      await requestEmailVerification(email.trim())
      setMessage(
        'Kiểm tra email của bạn. Nếu tài khoản đang chờ xác minh và đủ điều kiện, một liên kết mới sẽ được gửi.',
      )
    } catch (cause) {
      setError(credentialRequestErrorMessage(cause))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div className="form-group">
        <label className="form-label" htmlFor="verification-resend-email">
          Email tài khoản
        </label>
        <input
          className="form-input"
          id="verification-resend-email"
          type="email"
          autoComplete="email"
          maxLength={254}
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      {(message || error) && (
        <div
          className={`${styles.status} ${error ? styles.error : ''}`}
          role={error ? 'alert' : 'status'}
          aria-live="polite"
          tabIndex={-1}
          ref={result}
        >
          {error || message}
        </div>
      )}
      <button
        className="btn btn-outline"
        disabled={loading}
        aria-busy={loading}
      >
        {loading ? 'Đang gửi…' : 'Gửi lại email xác minh'}
      </button>
    </form>
  )
}
