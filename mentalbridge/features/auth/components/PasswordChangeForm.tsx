'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { changePassword, passwordChangeErrorMessage } from '../api/browser-auth'
import styles from './CredentialForms.module.css'

export default function PasswordChangeForm() {
  const router = useRouter()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận chưa khớp.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await changePassword(currentPassword, newPassword)
      router.replace('/login?credential=changed')
      router.refresh()
    } catch (cause) {
      setError(passwordChangeErrorMessage(cause))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div className="form-group">
        <label className="form-label" htmlFor="current-password">
          Mật khẩu hiện tại
        </label>
        <input
          className="form-input"
          id="current-password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={128}
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="change-new-password">
          Mật khẩu mới
        </label>
        <input
          className="form-input"
          id="change-new-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={128}
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
        <span className={styles.hint}>
          12–128 ký tự và tối đa 72 byte UTF-8.
        </span>
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="change-confirm-password">
          Xác nhận mật khẩu mới
        </label>
        <input
          className="form-input"
          id="change-confirm-password"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
      </div>
      {error && (
        <div className={`${styles.status} ${styles.error}`} role="alert">
          {error}
        </div>
      )}
      <button
        className="btn btn-primary"
        disabled={loading}
        aria-busy={loading}
      >
        {loading ? 'Đang đổi…' : 'Đổi mật khẩu và đăng xuất'}
      </button>
    </form>
  )
}
