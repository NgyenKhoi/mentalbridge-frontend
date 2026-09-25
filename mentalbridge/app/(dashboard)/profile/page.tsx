'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'

import LightSelect from '@/components/LightSelect'
import type {
  CareProfile,
  PrivacyDisclosure,
} from '@/features/assessment/api/care-contract'
import {
  getCareProfile,
  getCurrentConsents,
  getPrivacyDisclosure,
  recordPrivacyDecision,
  saveCareProfile,
} from '@/features/assessment/api/browser-care'
import PasswordChangeForm from '@/features/auth/components/PasswordChangeForm'
import { ApiError } from '@/lib/api/api-error'
import { validateProfileUpdate } from '@/lib/care/care-validation'

import './profile.css'

type FormState = {
  displayName: string
  dateOfBirth: string
  gender: string
}

type FieldErrors = Partial<Record<keyof FormState, string>>

const emptyForm: FormState = { displayName: '', dateOfBirth: '', gender: '' }

const fieldMessages: Record<string, string> = {
  INVALID_DATE: 'Ngày sinh phải là một ngày hợp lệ.',
  DATE_OF_BIRTH_IN_FUTURE: 'Ngày sinh không được ở trong tương lai.',
  MINIMUM_AGE_NOT_MET: 'Bạn cần đủ 18 tuổi để tạo hồ sơ.',
  INVALID_LENGTH: 'Vui lòng nhập tên hiển thị từ 1 đến 120 ký tự.',
}

function profileForm(profile: CareProfile): FormState {
  return {
    displayName: profile.displayName,
    dateOfBirth: profile.dateOfBirth ?? '',
    gender: profile.gender ?? '',
  }
}

function disclosureParagraphs(content: string) {
  const sentences =
    content
      .match(/[^.!?]+[.!?]+|[^.!?]+$/g)
      ?.map((sentence) => sentence.trim())
      .filter(Boolean) ?? []

  return sentences.reduce<string[]>((paragraphs, sentence, index) => {
    if (index % 2 === 0) paragraphs.push(sentence)
    else paragraphs[paragraphs.length - 1] += ` ${sentence}`
    return paragraphs
  }, [])
}

function errorsFromViolations(
  violations: readonly { field: string; code: string }[],
): FieldErrors {
  return Object.fromEntries(
    violations
      .filter((violation) =>
        ['displayName', 'dateOfBirth', 'gender'].includes(violation.field),
      )
      .map((violation) => [
        violation.field,
        fieldMessages[violation.code] ?? 'Giá trị này chưa hợp lệ.',
      ]),
  )
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<CareProfile | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [disclosure, setDisclosure] = useState<PrivacyDisclosure | null>(null)
  const [privacyGranted, setPrivacyGranted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [privacySaving, setPrivacySaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [toast, setToast] = useState('')
  const [returnToInitialCheck, setReturnToInitialCheck] = useState(false)
  const displayNameRef = useRef<HTMLInputElement>(null)
  const dateOfBirthRef = useRef<HTMLInputElement>(null)

  const initials = useMemo(
    () =>
      (
        profile?.displayName
          .trim()
          .split(/\s+/)
          .slice(-2)
          .map((part) => part[0])
          .join('') || 'MB'
      ).toUpperCase(),
    [profile],
  )
  const originalForm = profile ? profileForm(profile) : emptyForm
  const hasDraftChanges = JSON.stringify(form) !== JSON.stringify(originalForm)

  useEffect(() => {
    const returnTimer = window.setTimeout(
      () =>
        setReturnToInitialCheck(
          new URLSearchParams(window.location.search).get('returnTo') ===
            '/initial-check',
        ),
      0,
    )
    let active = true
    void (async () => {
      try {
        const [profileResult, disclosureResult, consentResult] =
          await Promise.allSettled([
            getCareProfile(),
            getPrivacyDisclosure(),
            getCurrentConsents(),
          ])
        if (!active) return

        if (profileResult.status === 'fulfilled') {
          setProfile(profileResult.value)
          setForm(profileForm(profileResult.value))
        } else if (!(
          profileResult.reason instanceof ApiError &&
          profileResult.reason.code === 'PROFILE_NOT_FOUND'
        )) {
          throw profileResult.reason
        }

        if (disclosureResult.status === 'rejected') {
          throw disclosureResult.reason
        }
        setDisclosure(disclosureResult.value)

        if (consentResult.status === 'fulfilled') {
          setPrivacyGranted(
            consentResult.value.decisions.some(
              (decision) =>
                decision.policyVersion === disclosureResult.value.version &&
                decision.granted,
            ),
          )
        } else if (!(
          consentResult.reason instanceof ApiError &&
          consentResult.reason.code === 'PROFILE_NOT_FOUND'
        )) {
          throw consentResult.reason
        }
      } catch {
        if (active) {
          setError(
            'Không thể tải đầy đủ thông tin tài khoản lúc này. Vui lòng thử lại sau.',
          )
        }
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
      window.clearTimeout(returnTimer)
    }
  }, [])

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 6000)
  }

  const updateField = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
  }

  const focusFirstError = (errors: FieldErrors) => {
    window.setTimeout(() => {
      if (errors.displayName) displayNameRef.current?.focus()
      else if (errors.dateOfBirth) dateOfBirthRef.current?.focus()
    })
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    const validation = validateProfileUpdate({
      displayName: form.displayName,
      dateOfBirth: form.dateOfBirth || null,
      gender: form.gender || null,
    })
    if (!validation.success) {
      const errors = errorsFromViolations(validation.violations)
      setFieldErrors(errors)
      focusFirstError(errors)
      return
    }

    setSaving(true)
    try {
      const saved = await saveCareProfile(validation.value, profile?.version)
      setProfile(saved)
      setForm(profileForm(saved))
      setFieldErrors({})
      notify(profile ? 'Đã lưu thay đổi hồ sơ.' : 'Đã tạo hồ sơ của bạn.')
    } catch (cause) {
      if (cause instanceof ApiError && cause.problem?.violations) {
        const errors = errorsFromViolations(cause.problem.violations)
        if (Object.keys(errors).length > 0) {
          setFieldErrors(errors)
          focusFirstError(errors)
        }
      }
      setError(
        cause instanceof ApiError && cause.status === 412
          ? 'Hồ sơ đã thay đổi ở một nơi khác. Hãy tải lại trang trước khi lưu tiếp.'
          : 'Không thể lưu hồ sơ lúc này. Nội dung bạn vừa nhập vẫn được giữ lại.',
      )
    } finally {
      setSaving(false)
    }
  }

  const resetDraft = () => {
    setForm(originalForm)
    setFieldErrors({})
    setError(null)
  }

  const decidePrivacy = async (granted: boolean) => {
    if (!disclosure) return
    setPrivacySaving(true)
    setError(null)
    try {
      await recordPrivacyDecision(granted, disclosure.version)
      setPrivacyGranted(granted)
      notify(
        granted
          ? 'Đã bật xử lý dữ liệu cho các lần sàng lọc mới.'
          : 'Đã dừng xử lý dữ liệu cho các lần sàng lọc mới.',
      )
    } catch {
      setError('Không thể ghi nhận lựa chọn về quyền riêng tư lúc này.')
    } finally {
      setPrivacySaving(false)
    }
  }

  if (loading) {
    return (
      <div className="settings-page">
        <section className="settings-runtime-state" aria-live="polite">
          <h1>Đang tải hồ sơ</h1>
          <p>Thông tin đã lưu của bạn đang được tải.</p>
        </section>
      </div>
    )
  }

  return (
    <div className="settings-page">
      <header className="settings-hero">
        <span>Tài khoản của bạn</span>
        <h1>Hồ sơ và quyền riêng tư</h1>
        <p>Quản lý thông tin cá nhân và lựa chọn xử lý dữ liệu của bạn.</p>
      </header>

      {error && (
        <p className="settings-runtime-error" role="alert">
          {error}
        </p>
      )}

      {returnToInitialCheck && profile && privacyGranted && (
        <section
          className="settings-onboarding"
          aria-labelledby="initial-check-ready-title"
        >
          <div>
            <span>Sẵn sàng</span>
            <h2 id="initial-check-ready-title">
              Bạn có thể tiếp tục kiểm tra ban đầu
            </h2>
            <p>Hồ sơ và lựa chọn quyền riêng tư hiện đã đầy đủ.</p>
          </div>
          <Link className="btn-primary" href="/initial-check">
            Tiếp tục bước chưa hoàn tất
          </Link>
        </section>
      )}

      {!profile && (
        <section
          className="settings-onboarding"
          aria-labelledby="profile-onboarding-title"
        >
          <div>
            <span>Bắt đầu</span>
            <h2 id="profile-onboarding-title">Bạn chưa có hồ sơ</h2>
            <p>Tạo hồ sơ để lưu kết quả sàng lọc và quản lý quyền riêng tư.</p>
          </div>
          <button
            className="btn-primary"
            type="button"
            onClick={() => displayNameRef.current?.focus()}
          >
            Tạo hồ sơ
          </button>
        </section>
      )}

      <section className="settings-profile-summary">
        <div className="settings-summary-left">
          <div className="settings-avatar-wrap">
            <svg viewBox="0 0 110 56" aria-hidden="true">
              <path d="M10 48Q55-4 100 48" />
            </svg>
            <div className="settings-avatar">{initials}</div>
          </div>
          <div>
            <div className="settings-name-row">
              <h2>{profile?.displayName ?? 'Chưa tạo hồ sơ'}</h2>
            </div>
            <p>
              {profile
                ? `Cập nhật ${new Date(profile.updatedAt).toLocaleString('vi-VN')}`
                : 'Thông tin bạn nhập chỉ được hiển thị ở biểu mẫu cho đến khi lưu.'}
            </p>
            <div className="settings-badges">
              <span className="verified">
                {privacyGranted
                  ? '✓ Đã đồng ý xử lý dữ liệu sàng lọc'
                  : 'Chưa đồng ý xử lý dữ liệu sàng lọc'}
              </span>
            </div>
          </div>
        </div>
      </section>

      <p className="settings-scope-note">
        MentalBridge cung cấp công cụ hỗ trợ tự nhìn lại và sàng lọc, không thay
        thế chẩn đoán y khoa.
      </p>

      <div className="settings-grid">
        <section className="settings-group">
          <p className="settings-group-label">Thông tin cá nhân</p>
          <div className="settings-accordion open">
            <div className="settings-accordion-body">
              <form onSubmit={submit} noValidate>
                <div className="settings-fields">
                  <label className="full">
                    Tên hiển thị
                    <input
                      ref={displayNameRef}
                      maxLength={120}
                      autoComplete="name"
                      value={form.displayName}
                      aria-invalid={Boolean(fieldErrors.displayName)}
                      aria-describedby={
                        fieldErrors.displayName
                          ? 'display-name-error'
                          : undefined
                      }
                      onChange={(event) =>
                        updateField('displayName', event.target.value)
                      }
                    />
                    {fieldErrors.displayName && (
                      <small
                        id="display-name-error"
                        className="settings-field-error"
                      >
                        {fieldErrors.displayName}
                      </small>
                    )}
                  </label>
                  <label>
                    Ngày sinh
                    <input
                      ref={dateOfBirthRef}
                      type="date"
                      autoComplete="bday"
                      value={form.dateOfBirth}
                      aria-invalid={Boolean(fieldErrors.dateOfBirth)}
                      aria-describedby={
                        fieldErrors.dateOfBirth
                          ? 'date-of-birth-error'
                          : undefined
                      }
                      onChange={(event) =>
                        updateField('dateOfBirth', event.target.value)
                      }
                    />
                    {fieldErrors.dateOfBirth && (
                      <small
                        id="date-of-birth-error"
                        className="settings-field-error"
                      >
                        {fieldErrors.dateOfBirth}
                      </small>
                    )}
                  </label>
                  <label>
                    Giới tính
                    <LightSelect
                      id="profile-gender"
                      name="gender"
                      value={form.gender}
                      onChange={(gender) => updateField('gender', gender)}
                      options={[
                        { value: '', label: 'Không cung cấp' },
                        { value: 'male', label: 'Nam' },
                        { value: 'female', label: 'Nữ' },
                        { value: 'other', label: 'Khác' },
                      ]}
                    />
                  </label>
                </div>
                <div className="settings-form-actions">
                  <button className="btn-primary" disabled={saving}>
                    {saving
                      ? 'Đang lưu…'
                      : profile
                        ? 'Lưu thay đổi'
                        : 'Tạo hồ sơ'}
                  </button>
                  {hasDraftChanges && (
                    <button
                      className="btn-ghost"
                      type="button"
                      onClick={resetDraft}
                    >
                      Hủy thay đổi
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </section>

        <aside className="settings-activity">
          <h2>Trạng thái</h2>
          <div>
            <article>
              <span className={profile ? 'teal' : 'neutral'}>N</span>
              <strong>{profile ? 'Đã lưu' : 'Chưa có'}</strong>
              <small>Trạng thái hồ sơ</small>
            </article>
            <article>
              <span className={privacyGranted ? 'teal' : 'neutral'}>✓</span>
              <strong>{privacyGranted ? 'Đang bật' : 'Đang tắt'}</strong>
              <small>Xử lý dữ liệu sàng lọc</small>
            </article>
          </div>
        </aside>
      </div>

      <section className="settings-privacy-runtime">
        <p className="settings-group-label">Quyền riêng tư và xử lý dữ liệu</p>
        {disclosure ? (
          <div>
            <h2>{disclosure.title}</h2>
            <div className="settings-consent-summary">
              <p>
                MentalBridge dùng câu trả lời PHQ-9 hoặc GAD-7 để tính kết quả
                sàng lọc và cung cấp thông tin hỗ trợ phù hợp. Khi đăng nhập,
                kết quả được lưu cùng tài khoản để bạn có thể xem lại.
              </p>
              <p>
                Phiên ẩn danh chỉ xử lý dữ liệu trong phiên hiện tại và không
                gắn kết quả vào hồ sơ tài khoản. Phiên có tài khoản cho phép lưu
                lịch sử khi bạn đã đồng ý.
              </p>
              <p>
                Lựa chọn này chỉ áp dụng cho xử lý dữ liệu sàng lọc. Nó không
                bao gồm sử dụng AI, nghiên cứu hoặc marketing; các mục đích đó
                cần lựa chọn riêng.
              </p>
              <p>
                Bạn có thể dừng xử lý cho các lần sàng lọc mới bất cứ lúc nào.
                Việc rút lại đồng ý không tự động xóa kết quả đã lưu.
              </p>
            </div>
            <details className="settings-consent-details">
              <summary>Xem thêm</summary>
              <div>
                {disclosureParagraphs(disclosure.content).map(
                  (paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ),
                )}
              </div>
            </details>
            <div className="settings-consent-control">
              <div>
                <strong>Xử lý dữ liệu cho các lần sàng lọc mới</strong>
                <span>
                  {privacyGranted
                    ? 'Đang bật — kết quả mới có thể được lưu vào tài khoản.'
                    : 'Đang tắt — các lần sàng lọc mới sẽ không được xử lý theo lựa chọn này.'}
                </span>
              </div>
              <button
                className="settings-privacy-switch"
                type="button"
                role="switch"
                aria-checked={privacyGranted}
                aria-label={
                  privacyGranted
                    ? 'Dừng xử lý dữ liệu cho các lần sàng lọc mới'
                    : 'Bật xử lý dữ liệu cho các lần sàng lọc mới'
                }
                disabled={privacySaving || !profile}
                onClick={() => void decidePrivacy(!privacyGranted)}
              >
                <span aria-hidden="true" />
              </button>
            </div>
            <p className="settings-inline-note">
              {privacySaving
                ? 'Đang ghi nhận lựa chọn của bạn…'
                : 'Thay đổi chỉ áp dụng cho các lần sàng lọc mới.'}
            </p>
            {!profile && (
              <p className="settings-inline-note">
                Bạn cần tạo hồ sơ trước khi ghi nhận sự đồng ý này.
              </p>
            )}
          </div>
        ) : (
          <div className="settings-runtime-state">
            <strong>Thông báo quyền riêng tư tạm thời chưa tải được.</strong>
            <p>Chưa có lựa chọn nào bị thay đổi. Vui lòng thử lại sau.</p>
          </div>
        )}
      </section>

      <section className="settings-danger">
        <h2>Bảo mật tài khoản</h2>
        <div className="settings-password-info">
          <div>
            <strong>Đổi mật khẩu</strong>
            <small>Mật khẩu mới sẽ thu hồi mọi phiên đăng nhập hiện tại.</small>
            <PasswordChangeForm />
          </div>
        </div>
      </section>

      <section className="settings-danger">
        <h2>Quản lý dữ liệu</h2>
        <div>
          <span className="settings-row-icon terra">!</span>
          <div>
            <strong>Xóa dữ liệu hiện chưa khả dụng</strong>
            <p>
              Rút lại sự đồng ý sẽ ngăn các lần xử lý mới nhưng không tự động
              xóa lịch sử đã lưu.
            </p>
          </div>
          <span className="assessment-unavailable-label">Chưa khả dụng</span>
        </div>
      </section>

      {toast && (
        <div className="settings-toast" role="status">
          ✓ {toast}
        </div>
      )}
    </div>
  )
}
