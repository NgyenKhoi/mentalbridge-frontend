'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { ApiError } from '@/lib/api/api-error'

import type { PublicRegistrationRole } from '../api/identity-contract'
import {
  createRegistrationIdempotencyKey,
  registerAccount,
  registrationErrorMessage,
} from '../api/browser-auth'
import styles from './RegistrationForm.module.css'

type RegistrationFields = Readonly<{
  email: string
  password: string
  confirmPassword: string
  actorType: PublicRegistrationRole
  agreeToTerms: boolean
}>

type FieldName = keyof RegistrationFields
type FieldErrors = Partial<Record<FieldName, string>>

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(fields: RegistrationFields): FieldErrors {
  const errors: FieldErrors = {}
  const passwordCharacters = Array.from(fields.password).length
  const passwordBytes = new TextEncoder().encode(fields.password).byteLength

  if (!EMAIL_PATTERN.test(fields.email.trim()) || fields.email.length > 254) {
    errors.email = 'Nhập một địa chỉ email hợp lệ.'
  }
  if (passwordCharacters < 12) {
    errors.password = 'Mật khẩu phải có ít nhất 12 ký tự.'
  } else if (passwordCharacters > 128 || passwordBytes > 72) {
    errors.password = 'Mật khẩu không được vượt quá 72 byte UTF-8.'
  }
  if (fields.confirmPassword !== fields.password) {
    errors.confirmPassword = 'Mật khẩu xác nhận chưa khớp.'
  }
  if (!fields.agreeToTerms) {
    errors.agreeToTerms = 'Bạn cần đồng ý với điều khoản và chính sách.'
  }

  return errors
}

export default function RegistrationForm() {
  const submitting = useRef(false)
  const idempotencyKey = useRef<string | null>(null)
  const successPanel = useRef<HTMLDivElement>(null)
  const [fields, setFields] = useState<RegistrationFields>({
    email: '',
    password: '',
    confirmPassword: '',
    actorType: 'USER',
    agreeToTerms: false,
  })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submissionError, setSubmissionError] = useState('')
  const [loading, setLoading] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')

  useEffect(() => {
    if (registeredEmail) successPanel.current?.focus()
  }, [registeredEmail])

  const updateField = <K extends FieldName>(
    field: K,
    value: RegistrationFields[K],
  ) => {
    setFields((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
    setSubmissionError('')

    if (field === 'email' || field === 'password' || field === 'actorType') {
      idempotencyKey.current = null
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting.current) return

    const errors = validate(fields)
    setFieldErrors(errors)
    setSubmissionError('')
    if (Object.keys(errors).length > 0) return

    submitting.current = true
    setLoading(true)
    const key = idempotencyKey.current ?? createRegistrationIdempotencyKey()
    idempotencyKey.current = key

    try {
      const email = fields.email.trim().toLowerCase()
      await registerAccount(
        {
          email,
          password: fields.password,
          actorType: fields.actorType,
        },
        key,
      )
      setRegisteredEmail(email)
    } catch (error) {
      setSubmissionError(registrationErrorMessage(error))
      if (
        error instanceof ApiError &&
        error.code === 'IDEMPOTENCY_KEY_REUSED'
      ) {
        idempotencyKey.current = null
      }
    } finally {
      submitting.current = false
      setLoading(false)
    }
  }

  if (registeredEmail) {
    return (
      <div
        className={styles.pending}
        role="status"
        tabIndex={-1}
        ref={successPanel}
      >
        <span className={styles.pendingIcon} aria-hidden="true">
          ✓
        </span>
        <h2>Kiểm tra email của bạn</h2>
        <p>
          Tài khoản cho <strong>{registeredEmail}</strong> đang chờ xác minh.
          Hãy mở liên kết một lần trong email để kích hoạt tài khoản.
        </p>
        <p className={styles.deliveryNote}>
          Việc gửi lại email chưa được hỗ trợ. Nếu email chưa đến, vui lòng chờ
          hệ thống giao thư hiện tại hoàn tất.
        </p>
        <Link href="/login" className="btn btn-primary">
          Đến trang đăng nhập
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form" noValidate>
      <fieldset className={styles.actorFieldset}>
        <legend className={`form-label ${styles.actorLegend}`}>
          Bạn đăng ký với vai trò
        </legend>
        <div className={styles.actorOptions}>
          {(
            [
              ['USER', 'Người dùng', 'Chăm sóc và theo dõi sức khỏe tinh thần'],
              [
                'SPECIALIST',
                'Chuyên gia',
                'Cung cấp dịch vụ tư vấn chuyên môn',
              ],
            ] as const
          ).map(([value, label, description]) => (
            <label
              className={styles.actorOption}
              data-selected={fields.actorType === value}
              key={value}
            >
              <input
                type="radio"
                name="actorType"
                value={value}
                checked={fields.actorType === value}
                onChange={() => updateField('actorType', value)}
              />
              <span className={styles.actorCopy}>
                <strong>{label}</strong>
                <small>{description}</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="form-group">
        <label htmlFor="registration-email" className="form-label">
          Email
        </label>
        <input
          type="email"
          id="registration-email"
          name="email"
          value={fields.email}
          onChange={(event) => updateField('email', event.target.value)}
          className="form-input"
          placeholder="your@email.com"
          autoComplete="email"
          maxLength={254}
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={
            fieldErrors.email ? 'registration-email-error' : undefined
          }
          required
        />
        {fieldErrors.email ? (
          <span id="registration-email-error" className={styles.fieldError}>
            {fieldErrors.email}
          </span>
        ) : null}
      </div>

      <div className="form-group">
        <label htmlFor="registration-password" className="form-label">
          Mật khẩu
        </label>
        <input
          type="password"
          id="registration-password"
          name="password"
          value={fields.password}
          onChange={(event) => updateField('password', event.target.value)}
          className="form-input"
          placeholder="Ít nhất 12 ký tự"
          autoComplete="new-password"
          maxLength={128}
          aria-invalid={Boolean(fieldErrors.password)}
          aria-describedby={
            fieldErrors.password
              ? 'registration-password-hint registration-password-error'
              : 'registration-password-hint'
          }
          required
        />
        <span id="registration-password-hint" className={styles.fieldHint}>
          Từ 12 ký tự và tối đa 72 byte UTF-8. Mật khẩu không bị tự động chuẩn
          hóa hoặc cắt ngắn.
        </span>
        {fieldErrors.password ? (
          <span id="registration-password-error" className={styles.fieldError}>
            {fieldErrors.password}
          </span>
        ) : null}
      </div>

      <div className="form-group">
        <label htmlFor="registration-confirm-password" className="form-label">
          Xác nhận mật khẩu
        </label>
        <input
          type="password"
          id="registration-confirm-password"
          name="confirmPassword"
          value={fields.confirmPassword}
          onChange={(event) =>
            updateField('confirmPassword', event.target.value)
          }
          className="form-input"
          placeholder="Nhập lại mật khẩu"
          autoComplete="new-password"
          maxLength={128}
          aria-invalid={Boolean(fieldErrors.confirmPassword)}
          aria-describedby={
            fieldErrors.confirmPassword
              ? 'registration-confirm-password-error'
              : undefined
          }
          required
        />
        {fieldErrors.confirmPassword ? (
          <span
            id="registration-confirm-password-error"
            className={styles.fieldError}
          >
            {fieldErrors.confirmPassword}
          </span>
        ) : null}
      </div>

      <div className="form-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            name="agreeToTerms"
            checked={fields.agreeToTerms}
            onChange={(event) =>
              updateField('agreeToTerms', event.target.checked)
            }
            className="checkbox-input"
            aria-invalid={Boolean(fieldErrors.agreeToTerms)}
            aria-describedby={
              fieldErrors.agreeToTerms ? 'registration-terms-error' : undefined
            }
            required
          />
          <span className="checkbox-custom" aria-hidden="true" />
          <span className="checkbox-text">
            Tôi đồng ý với{' '}
            <Link href="/terms" className="terms-link">
              Điều khoản dịch vụ
            </Link>{' '}
            và{' '}
            <Link href="/privacy" className="terms-link">
              Chính sách bảo mật
            </Link>
          </span>
        </label>
        {fieldErrors.agreeToTerms ? (
          <span id="registration-terms-error" className={styles.fieldError}>
            {fieldErrors.agreeToTerms}
          </span>
        ) : null}
      </div>

      {submissionError ? (
        <div className="auth-error" role="alert">
          {submissionError}
        </div>
      ) : null}

      <button
        type="submit"
        className="btn btn-primary auth-submit"
        disabled={loading}
        aria-busy={loading}
      >
        {loading ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
      </button>
    </form>
  )
}
