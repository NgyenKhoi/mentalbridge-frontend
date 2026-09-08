'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import {
  credentialRequestErrorMessage,
  passwordResetErrorMessage,
  requestPasswordRecovery,
  resetPassword,
} from '../api/browser-auth'
import styles from './CredentialForms.module.css'

type Mode = 'initializing' | 'request' | 'reset'

export default function PasswordRecovery() {
  const router = useRouter()
  const challenge = useRef<string | null>(null)
  const result = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<Mode>('initializing')
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const supplied = new URLSearchParams(window.location.search).get(
      'challenge',
    )
    window.history.replaceState(window.history.state, '', '/reset-password')
    challenge.current = supplied
    let active = true
    queueMicrotask(() => {
      if (active) setMode(supplied ? 'reset' : 'request')
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (message || error) result.current?.focus()
  }, [message, error])

  async function requestRecovery(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return
    setLoading(true)
    setError('')
    setMessage('')
    try {
      await requestPasswordRecovery(email.trim())
      setMessage(
        'Kiểm tra email của bạn. Nếu tài khoản đủ điều kiện, liên kết đặt lại mật khẩu sẽ được gửi.',
      )
    } catch (cause) {
      setError(credentialRequestErrorMessage(cause))
    } finally {
      setLoading(false)
    }
  }

  async function submitReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận chưa khớp.')
      return
    }
    const value = challenge.current
    if (!value) {
      setError('Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await resetPassword(value, newPassword)
      challenge.current = null
      router.replace('/login?credential=reset')
      router.refresh()
    } catch (cause) {
      setError(passwordResetErrorMessage(cause))
    } finally {
      setLoading(false)
    }
  }

  if (mode === 'initializing') {
    return (
      <div className={styles.status} role="status">
        Đang chuẩn bị luồng khôi phục an toàn…
      </div>
    )
  }

  return (
    <>
      <div className="auth-header">
        <h1>{mode === 'reset' ? 'Đặt lại mật khẩu' : 'Quên mật khẩu?'}</h1>
        <p>
          {mode === 'reset'
            ? 'Chọn mật khẩu mới. Liên kết chỉ dùng một lần và không được lưu trong trình duyệt.'
            : 'Nhập email tài khoản. Phản hồi luôn giống nhau để bảo vệ trạng thái tài khoản.'}
        </p>
      </div>
      <form
        className={styles.form}
        onSubmit={mode === 'reset' ? submitReset : requestRecovery}
        noValidate
      >
        {mode === 'request' ? (
          <div className="form-group">
            <label className="form-label" htmlFor="recovery-email">
              Email
            </label>
            <input
              className="form-input"
              id="recovery-email"
              type="email"
              autoComplete="email"
              maxLength={254}
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
        ) : (
          <>
            <div className="form-group">
              <label className="form-label" htmlFor="reset-new-password">
                Mật khẩu mới
              </label>
              <input
                className="form-input"
                id="reset-new-password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
              <span className={styles.hint}>
                12–128 ký tự và tối đa 72 byte UTF-8.
              </span>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="reset-confirm-password">
                Xác nhận mật khẩu mới
              </label>
              <input
                className="form-input"
                id="reset-confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
          </>
        )}
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
          className="btn btn-primary auth-submit"
          disabled={loading}
          aria-busy={loading}
        >
          {loading
            ? 'Đang xử lý…'
            : mode === 'reset'
              ? 'Đặt lại mật khẩu'
              : 'Gửi liên kết khôi phục'}
        </button>
      </form>
      <div className="auth-switch">
        <p>
          <Link href="/login" className="switch-link">
            Về trang đăng nhập
          </Link>
        </p>
      </div>
    </>
  )
}
