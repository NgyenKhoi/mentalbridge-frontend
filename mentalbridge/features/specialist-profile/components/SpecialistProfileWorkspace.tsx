'use client'

import {
  type CSSProperties,
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from 'react'
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
  timezone: 'Asia/Ho_Chi_Minh',
}

const reasonLabels: Record<SpecialistDecisionReason, string> = {
  PROFILE_INFORMATION_INCOMPLETE: 'Thông tin hồ sơ chưa đầy đủ.',
  PROFILE_CONTENT_NOT_APPROVED: 'Nội dung hồ sơ chưa phù hợp để công khai.',
  OUTSIDE_SUPPORTED_SCOPE: 'Phạm vi hỗ trợ nằm ngoài phạm vi của nền tảng.',
  POLICY_VIOLATION: 'Tài khoản đang bị tạm ngưng do vi phạm chính sách.',
  QUALITY_REVIEW_REQUIRED: 'Tài khoản đang được rà soát chất lượng.',
  ACCOUNT_REVIEW_REQUIRED: 'Tài khoản đang được rà soát vận hành.',
}

const supportAreaLabels: Record<SupportArea, string> = {
  DEPRESSIVE_SYMPTOMS: 'Cảm xúc trầm buồn',
  ANXIETY_SYMPTOMS: 'Lo âu',
}

const languageLabels: Record<string, string> = {
  vi: 'Tiếng Việt',
  en: 'English',
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

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return `${parts.at(-1)?.[0] ?? ''}${parts[0]?.[0] ?? ''}`.toLocaleUpperCase(
    'vi-VN',
  )
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
  const statusTitle: Record<ViewStatus, string> = {
    NEW: 'Chưa tạo hồ sơ',
    PENDING_DRAFT: 'Bản nháp chờ gửi',
    PENDING_REVIEW: 'Đang chờ xét duyệt',
    APPROVED: 'Đã phê duyệt',
    REJECTED: 'Cần chỉnh sửa và gửi lại',
    SUSPENDED: 'Đang tạm ngưng',
  }
  const completionChecks = useMemo(
    () => [
      { label: 'Tên hiển thị', done: form.displayName.trim().length > 0 },
      { label: 'Phần giới thiệu', done: form.bio.trim().length > 0 },
      { label: 'Lĩnh vực hỗ trợ', done: form.supportAreas.length > 0 },
      { label: 'Ngôn ngữ', done: form.languages.length > 0 },
      { label: 'Số năm kinh nghiệm', done: form.yearsOfExperience > 0 },
    ],
    [form],
  )
  const completion = Math.round(
    (completionChecks.filter((item) => item.done).length /
      completionChecks.length) *
      100,
  )
  const canSave =
    !busy &&
    !locked &&
    form.displayName.trim().length > 0 &&
    form.bio.trim().length > 0 &&
    form.supportAreas.length > 0 &&
    form.languages.length > 0

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
      showActionToast({ title: 'Đã gửi hồ sơ để xét duyệt', tone: 'success' })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể gửi hồ sơ.')
    } finally {
      setBusy(false)
    }
  }

  if (loading)
    return (
      <section className={styles.loading} aria-busy="true">
        Đang tải hồ sơ…
      </section>
    )

  return (
    <section className={styles.workspace}>
      <header className={styles.heading}>
        <h1>Hồ sơ chuyên gia</h1>
        <p>
          Điền thông tin hỗ trợ phi lâm sàng sẽ hiển thị cho người dùng sau khi
          được phê duyệt.
        </p>
      </header>

      <div className={styles.columns}>
        <form className={styles.form} onSubmit={save}>
          <section className={`${styles.card} ${styles.profileHero}`}>
            <div className={styles.banner} aria-hidden="true" />
            <div className={styles.profileSummary}>
              <div className={styles.avatar} aria-hidden="true">
                {initials(form.displayName)}
              </div>
              <div className={styles.profileIdentity}>
                <h2>{form.displayName || 'Tên hiển thị của bạn'}</h2>
                <p>
                  Chuyên gia tâm lý ·{' '}
                  <span data-state={status}>{statusTitle[status]}</span>
                </p>
              </div>
            </div>
            <p className={styles.heroHint}>
              Hồ sơ công khai dùng tên viết tắt làm ảnh đại diện trong phiên bản
              hiện tại.
            </p>
          </section>

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

          <section className={`${styles.card} ${styles.section}`}>
            <h3>
              <i aria-hidden="true">✎</i> Thông tin cơ bản
            </h3>
            <label className={styles.field}>
              <span>Tên hiển thị</span>
              <input
                required
                maxLength={120}
                disabled={locked}
                value={form.displayName}
                placeholder="Ví dụ: ThS. Nguyễn Thu Hà"
                onChange={(event) =>
                  setForm({ ...form, displayName: event.target.value })
                }
              />
            </label>
            <label className={styles.field}>
              <span>Giới thiệu</span>
              <textarea
                required
                maxLength={2000}
                rows={5}
                disabled={locked}
                value={form.bio}
                placeholder="Bạn hỗ trợ ai, theo cách nào, và bạn có kinh nghiệm gì?"
                onChange={(event) =>
                  setForm({ ...form, bio: event.target.value })
                }
              />
              <small>{form.bio.length}/2000</small>
            </label>
          </section>

          <section className={`${styles.card} ${styles.section}`}>
            <h3>
              <i className={styles.amberIcon} aria-hidden="true">
                ◌
              </i>{' '}
              Lĩnh vực hỗ trợ
            </h3>
            <fieldset className={styles.optionGrid} disabled={locked}>
              {(
                [
                  ['DEPRESSIVE_SYMPTOMS', 'Sàng lọc PHQ-9'],
                  ['ANXIETY_SYMPTOMS', 'Sàng lọc GAD-7'],
                ] as const
              ).map(([area, hint]) => (
                <label className={styles.option} key={area}>
                  <input
                    type="checkbox"
                    checked={form.supportAreas.includes(area)}
                    onChange={() => toggleArea(area)}
                  />
                  <span>
                    <i aria-hidden="true" />
                    <span>
                      <strong>{supportAreaLabels[area]}</strong>
                      <small>{hint}</small>
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          </section>

          <section className={`${styles.card} ${styles.section}`}>
            <h3>
              <i aria-hidden="true">◎</i> Ngôn ngữ và kinh nghiệm
            </h3>
            <fieldset className={styles.optionGrid} disabled={locked}>
              {['vi', 'en'].map((language) => (
                <label className={styles.option} key={language}>
                  <input
                    type="checkbox"
                    checked={form.languages.includes(language)}
                    onChange={() => toggleLanguage(language)}
                  />
                  <span>
                    <i aria-hidden="true" />
                    <strong>{languageLabels[language]}</strong>
                  </span>
                </label>
              ))}
            </fieldset>
            <label className={styles.field}>
              <span>Số năm kinh nghiệm</span>
              <div className={styles.stepper}>
                <button
                  type="button"
                  aria-label="Giảm số năm kinh nghiệm"
                  disabled={locked || form.yearsOfExperience <= 0}
                  onClick={() =>
                    setForm({
                      ...form,
                      yearsOfExperience: Math.max(
                        0,
                        form.yearsOfExperience - 1,
                      ),
                    })
                  }
                >
                  −
                </button>
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
                <button
                  type="button"
                  aria-label="Tăng số năm kinh nghiệm"
                  disabled={locked || form.yearsOfExperience >= 80}
                  onClick={() =>
                    setForm({
                      ...form,
                      yearsOfExperience: Math.min(
                        80,
                        form.yearsOfExperience + 1,
                      ),
                    })
                  }
                >
                  +
                </button>
              </div>
            </label>
          </section>

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
            <div className={styles.actionBar}>
              <span>
                {busy
                  ? 'Đang xử lý thay đổi…'
                  : notice
                    ? 'Trạng thái hồ sơ đã được cập nhật'
                    : 'Các thay đổi chưa lưu'}
              </span>
              <button type="submit" disabled={!canSave}>
                {busy ? 'Đang xử lý…' : 'Lưu hồ sơ'}
              </button>
              <button
                type="button"
                className={styles.primary}
                disabled={
                  busy ||
                  !etag ||
                  status === 'PENDING_REVIEW' ||
                  status === 'NEW'
                }
                onClick={() => void submit()}
              >
                {status === 'REJECTED'
                  ? 'Gửi lại để xét duyệt'
                  : 'Gửi xét duyệt'}
              </button>
            </div>
          )}
        </form>

        <aside className={styles.previewColumn}>
          <section className={`${styles.card} ${styles.preview}`}>
            <span>Người dùng sẽ thấy hồ sơ như thế này</span>
            <div className={styles.previewAvatar} aria-hidden="true">
              {initials(form.displayName)}
            </div>
            <h2>{form.displayName || 'Tên hiển thị của bạn'}</h2>
            <p className={styles.previewRole}>Chuyên gia tâm lý</p>
            <p className={styles.previewBio}>
              {form.bio || 'Phần giới thiệu của bạn sẽ hiển thị ở đây.'}
            </p>
            <div className={styles.previewTags}>
              {form.supportAreas.map((area) => (
                <span key={area}>{supportAreaLabels[area]}</span>
              ))}
              {form.languages.map((language) => (
                <span key={language}>{languageLabels[language]}</span>
              ))}
            </div>
            <small>{form.yearsOfExperience} năm kinh nghiệm</small>
          </section>

          <section className={`${styles.card} ${styles.completion}`}>
            <h2>Mức độ hoàn thiện</h2>
            <div className={styles.completionSummary}>
              <div
                className={styles.completionRing}
                style={{ '--completion': completion } as CSSProperties}
              >
                <strong>{completion}%</strong>
              </div>
              <p>Hồ sơ đầy đủ giúp người dùng tin tưởng và dễ chọn bạn hơn.</p>
            </div>
            <ul>
              {completionChecks.map((item) => (
                <li key={item.label} data-done={item.done}>
                  <i aria-hidden="true">{item.done ? '✓' : ''}</i>
                  {item.label}
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </section>
  )
}
