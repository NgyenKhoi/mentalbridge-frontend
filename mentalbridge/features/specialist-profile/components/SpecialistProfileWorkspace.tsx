'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useFeedback } from '@/components/ui/FeedbackProvider'
import type {
  SpecialistDecisionReason,
  SpecialistProfile,
  SpecialistProfileInput,
  SupportArea,
} from '@/lib/consultation/consultation-validation'
import {
  browserConsultation,
  BrowserConsultationError,
} from '../api/browser-client'
import styles from './SpecialistProfileWorkspace.module.css'

const empty: SpecialistProfileInput = {
  displayName: '',
  bio: '',
  supportAreas: [],
  languages: ['vi'],
  yearsOfExperience: 0,
  timezone:
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh',
}

const reasonLabels: Record<SpecialistDecisionReason, string> = {
  PROFILE_INFORMATION_INCOMPLETE: 'Thông tin hồ sơ chưa đầy đủ.',
  PROFILE_CONTENT_NOT_APPROVED: 'Nội dung hồ sơ chưa phù hợp để công khai.',
  OUTSIDE_SUPPORTED_SCOPE: 'Phạm vi hỗ trợ nằm ngoài phạm vi của nền tảng.',
  POLICY_VIOLATION: 'Tài khoản đang bị tạm ngưng do vi phạm chính sách.',
  QUALITY_REVIEW_REQUIRED: 'Tài khoản đang được rà soát chất lượng.',
  ACCOUNT_REVIEW_REQUIRED: 'Tài khoản đang được rà soát vận hành.',
}

type ViewStatus =
  | 'NEW'
  | 'PENDING_DRAFT'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUSPENDED'

function viewStatus(profile: SpecialistProfile | null): ViewStatus {
  if (!profile) return 'NEW'
  if (profile.approvalStatus !== 'PENDING') return profile.approvalStatus
  return profile.submittedAt ? 'PENDING_REVIEW' : 'PENDING_DRAFT'
}

export default function SpecialistProfileWorkspace() {
  const { showActionToast } = useFeedback()
  const [form, setForm] = useState<SpecialistProfileInput>(empty)
  const [profile, setProfile] = useState<SpecialistProfile | null>(null)
  const [etag, setEtag] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    browserConsultation
      .own()
      .then((result) => {
        if (!active) return
        setForm(result.data)
        setProfile(result.data)
        setEtag(result.etag)
      })
      .catch((cause: unknown) => {
        if (
          active &&
          (!(cause instanceof BrowserConsultationError) || cause.status !== 404)
        )
          setError(
            cause instanceof Error ? cause.message : 'Không thể tải hồ sơ.',
          )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const status = viewStatus(profile)
  const locked = status === 'APPROVED' || status === 'SUSPENDED'

  function toggleArea(area: SupportArea) {
    setForm((current) => ({
      ...current,
      supportAreas: current.supportAreas.includes(area)
        ? current.supportAreas.filter((item) => item !== area)
        : [...current.supportAreas, area],
    }))
  }

  function toggleLanguage(language: string) {
    setForm((current) => ({
      ...current,
      languages: current.languages.includes(language)
        ? current.languages.filter((item) => item !== language)
        : [...current.languages, language],
    }))
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const previous = status
      const result = await browserConsultation.save(form, etag)
      setForm(result.data)
      setProfile(result.data)
      setEtag(result.etag)
      const successMessage =
        previous === 'PENDING_REVIEW'
          ? 'Đã lưu thay đổi. Hồ sơ đã rời hàng đợi; hãy gửi lại khi sẵn sàng.'
          : previous === 'REJECTED'
            ? 'Đã lưu thay đổi. Hãy gửi lại hồ sơ để được xét duyệt.'
            : 'Đã lưu hồ sơ.'
      setNotice(successMessage)
      showActionToast({ title: successMessage, tone: 'success' })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể lưu hồ sơ.')
    } finally {
      setBusy(false)
    }
  }

  async function submit() {
    if (!etag) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result =
        status === 'REJECTED'
          ? await browserConsultation.resubmit(etag)
          : await browserConsultation.submit(etag)
      setForm(result.data)
      setProfile(result.data)
      setEtag(result.etag)
      setNotice('Hồ sơ đã được gửi để quản trị viên xét duyệt.')
      showActionToast({
        title: 'Đã gửi hồ sơ để xét duyệt',
        tone: 'success',
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể gửi hồ sơ.')
    } finally {
      setBusy(false)
    }
  }

  if (loading)
    return (
      <section className={styles.card} aria-busy="true">
        Đang tải hồ sơ…
      </section>
    )

  const statusTitle: Record<ViewStatus, string> = {
    NEW: 'Chưa tạo hồ sơ',
    PENDING_DRAFT: 'Bản nháp chờ gửi',
    PENDING_REVIEW: 'Đang chờ xét duyệt',
    APPROVED: 'Đã phê duyệt',
    REJECTED: 'Cần chỉnh sửa và gửi lại',
    SUSPENDED: 'Đang tạm ngưng',
  }

  return (
    <section className={styles.workspace}>
      <header>
        <span>HỒ SƠ CÔNG KHAI</span>
        <h1>Hồ sơ chuyên gia</h1>
        <p>
          Điền thông tin hỗ trợ phi lâm sàng sẽ hiển thị cho người dùng sau khi
          được phê duyệt.
        </p>
      </header>
      <div className={styles.status} data-state={status}>
        <strong>{statusTitle[status]}</strong>
        <span>
          {status === 'PENDING_REVIEW'
            ? 'Nếu sửa, hồ sơ sẽ rời hàng đợi cho đến khi bạn gửi lại.'
            : status === 'REJECTED'
              ? 'Bạn có thể sửa cùng hồ sơ này rồi gửi lại để xét duyệt.'
              : status === 'SUSPENDED'
                ? 'Hồ sơ và lịch tương lai đã bị khóa. Quản trị viên cần khôi phục tài khoản.'
                : status === 'APPROVED'
                  ? 'Hồ sơ đang hoạt động và chỉ đọc.'
                  : 'Lưu bản nháp, kiểm tra lại rồi gửi duyệt.'}
        </span>
      </div>
      {profile?.decisionReasonCode && (
        <p className={styles.reason} role="status">
          <strong>Lý do:</strong> {reasonLabels[profile.decisionReasonCode]}
        </p>
      )}
      <form className={styles.card} onSubmit={save}>
        <label>
          Tên hiển thị
          <input
            required
            maxLength={120}
            disabled={locked}
            value={form.displayName}
            onChange={(event) =>
              setForm({ ...form, displayName: event.target.value })
            }
          />
        </label>
        <label>
          Giới thiệu
          <textarea
            required
            maxLength={2000}
            rows={6}
            disabled={locked}
            value={form.bio}
            onChange={(event) => setForm({ ...form, bio: event.target.value })}
          />
        </label>
        <fieldset disabled={locked}>
          <legend>Lĩnh vực hỗ trợ</legend>
          <label>
            <input
              type="checkbox"
              checked={form.supportAreas.includes('DEPRESSIVE_SYMPTOMS')}
              onChange={() => toggleArea('DEPRESSIVE_SYMPTOMS')}
            />
            Cảm xúc trầm buồn (PHQ-9)
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.supportAreas.includes('ANXIETY_SYMPTOMS')}
              onChange={() => toggleArea('ANXIETY_SYMPTOMS')}
            />
            Lo âu (GAD-7)
          </label>
        </fieldset>
        <fieldset disabled={locked}>
          <legend>Ngôn ngữ</legend>
          <label>
            <input
              type="checkbox"
              checked={form.languages.includes('vi')}
              onChange={() => toggleLanguage('vi')}
            />
            Tiếng Việt
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.languages.includes('en')}
              onChange={() => toggleLanguage('en')}
            />
            English
          </label>
        </fieldset>
        <div className={styles.row}>
          <label>
            Số năm kinh nghiệm
            <input
              type="number"
              min={0}
              max={80}
              required
              disabled={locked}
              value={form.yearsOfExperience}
              onChange={(event) =>
                setForm({
                  ...form,
                  yearsOfExperience: Number(event.target.value),
                })
              }
            />
          </label>
          <label>
            Múi giờ
            <input
              required
              disabled={locked}
              value={form.timezone}
              onChange={(event) =>
                setForm({ ...form, timezone: event.target.value })
              }
            />
          </label>
        </div>
        <p className={styles.scope}>
          Không thu thập bằng cấp, giấy phép, chứng chỉ hoặc tài liệu xác minh
          trong luồng này.
        </p>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className={styles.notice} role="status">
            {notice}
          </p>
        )}
        {!locked && (
          <div className={styles.actions}>
            <button
              type="submit"
              disabled={
                busy ||
                form.supportAreas.length === 0 ||
                form.languages.length === 0
              }
            >
              {busy ? 'Đang xử lý…' : 'Lưu hồ sơ'}
            </button>
            <button
              type="button"
              className={styles.primary}
              disabled={
                busy || !etag || status === 'PENDING_REVIEW' || status === 'NEW'
              }
              onClick={() => void submit()}
            >
              {status === 'REJECTED' ? 'Gửi lại để xét duyệt' : 'Gửi xét duyệt'}
            </button>
          </div>
        )}
      </form>
    </section>
  )
}
