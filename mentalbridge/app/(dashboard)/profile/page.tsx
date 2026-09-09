'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'

import LightSelect from '@/components/LightSelect'
import { ApiError } from '@/lib/api/api-error'
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

import './profile.css'

type FormState = {
  displayName: string
  dateOfBirth: string
  gender: string
  locale: string
  timezone: string
  reminderEnabled: boolean
}
const emptyForm: FormState = {
  displayName: '',
  dateOfBirth: '',
  gender: '',
  locale: 'vi-VN',
  timezone: 'Asia/Ho_Chi_Minh',
  reminderEnabled: false,
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
  const [toast, setToast] = useState('')
  const initials = useMemo(
    () =>
      (
        form.displayName
          .trim()
          .split(/\s+/)
          .slice(-2)
          .map((part) => part[0])
          .join('') || 'MB'
      ).toUpperCase(),
    [form.displayName],
  )

  useEffect(() => {
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
          setForm({
            displayName: profileResult.value.displayName,
            dateOfBirth: profileResult.value.dateOfBirth ?? '',
            gender: profileResult.value.gender ?? '',
            locale: profileResult.value.locale,
            timezone: profileResult.value.timezone,
            reminderEnabled: profileResult.value.reminderEnabled,
          })
        } else if (!(
          profileResult.reason instanceof ApiError &&
          profileResult.reason.status === 404
        ))
          throw profileResult.reason
        if (disclosureResult.status === 'rejected')
          throw disclosureResult.reason
        setDisclosure(disclosureResult.value)
        if (consentResult.status === 'rejected') throw consentResult.reason
        setPrivacyGranted(
          consentResult.value.decisions.some(
            (decision) =>
              decision.policyVersion === disclosureResult.value.version &&
              decision.granted,
          ),
        )
      } catch {
        if (active)
          setError(
            'Care tạm thời chưa tải được hồ sơ hoặc trạng thái quyền riêng tư. Không có dữ liệu mẫu được hiển thị thay thế.',
          )
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2800)
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const saved = await saveCareProfile(
        {
          ...form,
          dateOfBirth: form.dateOfBirth || null,
          gender: form.gender || null,
        },
        profile?.version,
      )
      setProfile(saved)
      notify('Care đã lưu hồ sơ của bạn.')
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.status === 412
          ? 'Hồ sơ đã được cập nhật ở nơi khác. Hãy tải lại trang trước khi lưu tiếp.'
          : 'Không thể lưu hồ sơ lúc này. Thay đổi chưa được xác nhận.',
      )
    } finally {
      setSaving(false)
    }
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
          ? 'Đã ghi nhận xác nhận quyền riêng tư.'
          : 'Đã ghi nhận thu hồi cho các lần xử lý mới.',
      )
    } catch {
      setError('Không thể ghi nhận quyết định quyền riêng tư lúc này.')
    } finally {
      setPrivacySaving(false)
    }
  }

  if (loading)
    return (
      <div className="settings-page">
        <section className="settings-runtime-state" aria-live="polite">
          <h1>Đang tải hồ sơ Care</h1>
          <p>Đang lấy dữ liệu đã lưu từ backend.</p>
        </section>
      </div>
    )
  return (
    <div className="settings-page">
      <header className="settings-hero">
        <span>Tài khoản của bạn</span>
        <h1>Hồ sơ Care</h1>
        <p>
          Quản lý dữ liệu hồ sơ và quyết định quyền riêng tư được lưu bởi Care
          service.
        </p>
      </header>
      {error && (
        <p className="settings-runtime-error" role="alert">
          {error}
        </p>
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
              <h2>{form.displayName || 'Chưa tạo hồ sơ'}</h2>
              <span>CARE</span>
            </div>
            <p>
              {profile
                ? `Cập nhật ${new Date(profile.updatedAt).toLocaleString('vi-VN')}`
                : 'Hồ sơ Care chưa tồn tại'}
            </p>
            <div className="settings-badges">
              <span className="verified">
                {privacyGranted
                  ? '✓ Disclosure đã xác nhận'
                  : 'Disclosure chưa xác nhận'}
              </span>
            </div>
          </div>
        </div>
      </section>
      <div className="settings-grid">
        <section className="settings-group">
          <p className="settings-group-label">Thông tin cá nhân</p>
          <div className="settings-accordion open">
            <div className="settings-accordion-body">
              <form onSubmit={submit}>
                <div className="settings-fields">
                  <label className="full">
                    Tên hiển thị
                    <input
                      required
                      maxLength={120}
                      value={form.displayName}
                      onChange={(event) =>
                        setForm({ ...form, displayName: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Ngày sinh
                    <input
                      type="date"
                      value={form.dateOfBirth}
                      onChange={(event) =>
                        setForm({ ...form, dateOfBirth: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Giới tính
                    <LightSelect
                      id="profile-gender"
                      name="gender"
                      value={form.gender}
                      onChange={(gender) => setForm({ ...form, gender })}
                      options={[
                        { value: '', label: 'Không cung cấp' },
                        { value: 'male', label: 'Nam' },
                        { value: 'female', label: 'Nữ' },
                        { value: 'other', label: 'Khác' },
                      ]}
                    />
                  </label>
                  <label>
                    Ngôn ngữ
                    <input value={form.locale} readOnly />
                    <small>Sprint 2 hỗ trợ vi-VN.</small>
                  </label>
                  <label>
                    Múi giờ
                    <input value={form.timezone} readOnly />
                  </label>
                  <label className="full settings-reminder">
                    <input
                      type="checkbox"
                      checked={form.reminderEnabled}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          reminderEnabled: event.target.checked,
                        })
                      }
                    />
                    <span>
                      Bật tùy chọn nhắc nhở trong hồ sơ. Sprint 2 chưa tự động
                      đặt lịch nhắc lâm sàng.
                    </span>
                  </label>
                </div>
                <div className="settings-form-actions">
                  <button className="btn-primary" disabled={saving}>
                    {saving
                      ? 'Đang lưu…'
                      : profile
                        ? 'Lưu thay đổi'
                        : 'Tạo hồ sơ Care'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>
        <aside className="settings-activity">
          <h2>Trạng thái dữ liệu</h2>
          <div>
            <article>
              <span className="teal">N</span>
              <strong>{profile ? '1' : '0'}</strong>
              <small>Hồ sơ Care</small>
            </article>
            <article>
              <span className="amber">✓</span>
              <strong>{privacyGranted ? '1' : '0'}</strong>
              <small>Consent hiện hành</small>
            </article>
          </div>
        </aside>
      </div>
      <section className="settings-privacy-runtime">
        <p className="settings-group-label">Quyền riêng tư & xử lý dữ liệu</p>
        {disclosure ? (
          <div>
            <h2>{disclosure.title}</h2>
            <p>{disclosure.content}</p>
            <small>
              Phiên bản backend: {disclosure.version} · Chỉ dùng cho controlled
              Capstone/test/demo.
            </small>
            <div className="settings-form-actions">
              <button
                className={privacyGranted ? 'btn-ghost' : 'btn-primary'}
                disabled={privacySaving || !profile}
                onClick={() => void decidePrivacy(!privacyGranted)}
              >
                {privacySaving
                  ? 'Đang ghi nhận…'
                  : privacyGranted
                    ? 'Thu hồi cho lần xử lý mới'
                    : 'Tôi đã đọc và xác nhận'}
              </button>
            </div>
            {!profile && (
              <p className="settings-inline-note">
                Hãy tạo hồ sơ Care trước khi ghi nhận quyết định.
              </p>
            )}
          </div>
        ) : (
          <div className="settings-runtime-state">
            <strong>Disclosure hiện chưa khả dụng</strong>
            <p>Không thể tự tạo nội dung hoặc phiên bản thay thế ở frontend.</p>
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
        <h2>Dữ liệu & tài khoản</h2>
        <div>
          <span className="settings-row-icon terra">!</span>
          <div>
            <strong>Workflow xóa dữ liệu chưa khả dụng</strong>
            <p>
              Thu hồi PRIVACY_POLICY không xóa các assessment lịch sử. Xóa dữ
              liệu là workflow riêng và chưa được triển khai trong Sprint 2.
            </p>
          </div>
          <span className="assessment-unavailable-label">Chưa khả dụng</span>
        </div>
      </section>
      {toast && <div className="settings-toast">✓ {toast}</div>}
    </div>
  )
}
