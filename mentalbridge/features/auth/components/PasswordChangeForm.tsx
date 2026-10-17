'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { changePassword, passwordChangeErrorMessage } from '../api/browser-auth'
import styles from './CredentialForms.module.css'

type PasswordFieldProps = {
  id: string
  label: string
  value: string
  autoComplete: string
  minLength?: number
  maxLength?: number
  hint?: string
  onChange: (value: string) => void
}

function PasswordField({
  id,
  label,
  value,
  autoComplete,
  minLength,
  maxLength,
  hint,
  onChange,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="form-group">
      <label className="form-label" htmlFor={id}>
        {label}
      </label>
      <div className={styles.passwordControl}>
        <input
          className="form-input"
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          required
          minLength={minLength}
          maxLength={maxLength}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          className={`${styles.passwordVisibility} settings-password-visibility`}
          type="button"
          aria-label={
            visible
              ? `Ẩn ${label.toLowerCase()}`
              : `Hiện ${label.toLowerCase()}`
          }
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M2.8 12s3.3-5.5 9.2-5.5 9.2 5.5 9.2 5.5-3.3 5.5-9.2 5.5S2.8 12 2.8 12Z" />
            <circle cx="12" cy="12" r="2.6" />
            {visible && <path d="m4 4 16 16" />}
          </svg>
        </button>
      </div>
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  )
}

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
      <PasswordField
        id="current-password"
        label="Mật khẩu hiện tại"
        autoComplete="current-password"
        maxLength={128}
        value={currentPassword}
        onChange={setCurrentPassword}
      />
      <PasswordField
        id="change-new-password"
        label="Mật khẩu mới"
        autoComplete="new-password"
        minLength={12}
        maxLength={128}
        value={newPassword}
        hint="12–128 ký tự và tối đa 72 byte UTF-8."
        onChange={setNewPassword}
      />
      <PasswordField
        id="change-confirm-password"
        label="Xác nhận mật khẩu mới"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={setConfirmPassword}
      />
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
