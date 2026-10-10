'use client'

import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { Info, ShieldCheck, Undo2 } from 'lucide-react'
import { useFeedback } from '@/components/ui/FeedbackProvider'
import {
  ConsultationInputError,
  type SpecialistDecisionReason,
  type SpecialistProfile,
  type SpecialistProfileInput,
} from '@/lib/consultation/consultation-validation'
import {
  browserConsultation,
  BrowserConsultationError,
} from '../api/browser-client'
import ApprovedProfileAmendmentWorkspace from './ApprovedProfileAmendmentWorkspace'
import ProfileFields from './ProfileFields'
import {
  ProfileChecklist,
  ProfileIdentityCard,
  ProfileLoading,
  ProfilePageHeader,
  ProfilePreviewCard,
} from './ProfilePresentation'
import {
  focusProfileError,
  profileFieldErrors,
  profileFormValue,
  validateProfileForm,
} from './profile-form'
import { useProfileDraftGuard } from './useProfileDraftGuard'
import styles from './ProfilePage.module.css'

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

export default function SpecialistProfileWorkspace() {
  const { confirm, showActionToast } = useFeedback()
  const [form, setForm] = useState<SpecialistProfileInput>(empty)
  const [profile, setProfile] = useState<SpecialistProfile | null>(null)
  const [etag, setEtag] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [errors, setErrors] = useState<
    Partial<Record<keyof SpecialistProfileInput, string>>
  >({})
  const lock = useRef(false)
  const panel = useRef<HTMLDivElement>(null)
  const receive = useCallback((data: SpecialistProfile, tag: string | null) => {
    setForm(profileFormValue(data))
    setProfile(data)
    setEtag(tag)
    setBlocked(false)
    setLoadFailed(false)
    setError('')
    setErrors({})
  }, [])
  useEffect(() => {
    let active = true
    browserConsultation
      .own()
      .then((result) => {
        if (active) receive(result.data, result.etag)
      })
      .catch((cause: unknown) => {
        if (!active) return
        if (cause instanceof BrowserConsultationError && cause.status === 404)
          return
        setLoadFailed(true)
        setError(
          'Chưa thể tải hồ sơ. Hãy thử kết nối lại; không cần tạo hồ sơ mới.',
        )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [receive])

  const status = !profile
    ? 'NEW'
    : profile.approvalStatus === 'PENDING'
      ? profile.submittedAt
        ? 'PENDING_REVIEW'
        : 'DRAFT'
      : profile.approvalStatus
  const locked = status === 'APPROVED' || status === 'SUSPENDED'
  const dirty =
    !locked &&
    !loadFailed &&
    JSON.stringify(profileFormValue(form)) !==
      JSON.stringify(profileFormValue(profile ?? empty))
  useProfileDraftGuard(dirty)
  const statusTitle = {
    NEW: 'Chưa tạo hồ sơ',
    DRAFT: 'Bản nháp chờ gửi',
    PENDING_REVIEW: 'Đang chờ xét duyệt',
    APPROVED: 'Hồ sơ đã được duyệt',
    REJECTED: 'Cần chỉnh sửa và gửi lại',
    SUSPENDED: 'Đang tạm ngưng',
  }[status]
  const disabled = busy || blocked || loadFailed || locked

  async function mutation(action: () => Promise<void>) {
    if (lock.current || blocked || loadFailed || locked) return
    lock.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await action()
    } catch (cause) {
      const conflict =
        cause instanceof BrowserConsultationError &&
        [409, 412].includes(cause.status)
      const uncertain =
        !(cause instanceof BrowserConsultationError) || cause.status >= 500
      setBlocked(conflict || uncertain)
      setError(
        conflict
          ? 'Hồ sơ vừa thay đổi. Nội dung bạn đang viết vẫn còn; kiểm tra trạng thái mới nhất trước khi tiếp tục.'
          : uncertain
            ? 'Chưa xác nhận được kết quả. Giữ bản đang viết và kiểm tra trạng thái trước khi gửi lại.'
            : 'Chưa thể cập nhật hồ sơ. Kiểm tra thông tin và quyền truy cập rồi thử lại.',
      )
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    if (disabled) return
    let input: SpecialistProfileInput
    try {
      input = validateProfileForm(form)
    } catch (cause) {
      const field =
        cause instanceof ConsultationInputError
          ? (cause.field as keyof SpecialistProfileInput)
          : 'displayName'
      setErrors({ [field]: profileFieldErrors[field] })
      focusProfileError(panel.current, field)
      return
    }
    if (
      status === 'PENDING_REVIEW' &&
      !(await confirm({
        title: 'Sửa hồ sơ đang chờ duyệt?',
        description:
          'Lưu thay đổi sẽ rút hồ sơ khỏi hàng đợi. Bạn cần gửi xét duyệt lại khi hoàn tất.',
        confirmLabel: 'Lưu và rút khỏi hàng đợi',
        cancelLabel: 'Tiếp tục kiểm tra',
        tone: 'warning',
      }))
    )
      return
    await mutation(async () => {
      const result = await browserConsultation.save(input, etag)
      receive(result.data, result.etag)
      const message =
        status === 'PENDING_REVIEW'
          ? 'Đã lưu thay đổi. Hồ sơ đã rời hàng đợi; hãy gửi lại khi sẵn sàng.'
          : status === 'REJECTED'
            ? 'Đã lưu thay đổi. Hãy gửi lại hồ sơ để được xét duyệt.'
            : 'Đã lưu hồ sơ.'
      setNotice(message)
      showActionToast({ title: message, tone: 'success' })
    })
  }
  async function submit() {
    if (!etag || dirty || disabled || status === 'PENDING_REVIEW') return
    await mutation(async () => {
      const result =
        status === 'REJECTED'
          ? await browserConsultation.resubmit(etag)
          : await browserConsultation.submit(etag)
      receive(result.data, result.etag)
      setNotice('Hồ sơ đã được gửi để quản trị viên xét duyệt.')
      showActionToast({ title: 'Đã gửi hồ sơ để xét duyệt', tone: 'success' })
    })
  }
  async function cancelChanges() {
    if (busy || !dirty) return
    if (
      !(await confirm({
        title: 'Hủy thay đổi chưa lưu?',
        description: profile
          ? 'Nội dung vừa nhập sẽ được bỏ. Hồ sơ đã lưu vẫn được giữ nguyên.'
          : 'Nội dung vừa nhập sẽ được bỏ. Bạn có thể điền lại khi sẵn sàng.',
        confirmLabel: 'Hủy thay đổi',
        cancelLabel: 'Tiếp tục viết',
        tone: 'warning',
      }))
    )
      return
    if (lock.current) return
    setForm(profileFormValue(profile ?? empty))
    setErrors({})
    setNotice('Đã bỏ thay đổi chưa lưu.')
    panel.current?.querySelector<HTMLInputElement>('input')?.focus()
  }

  async function reload() {
    if (lock.current) return
    if (
      dirty &&
      !(await confirm({
        title: 'Tải lại hồ sơ?',
        description:
          'Nội dung chưa lưu sẽ được thay bằng bản mới nhất. Sao chép nội dung cần giữ trước khi tiếp tục.',
        confirmLabel: 'Tải lại',
        cancelLabel: 'Giữ bản đang viết',
        tone: 'warning',
      }))
    )
      return
    lock.current = true
    setBusy(true)
    try {
      const result = await browserConsultation.own()
      receive(result.data, result.etag)
    } catch {
      setError('Chưa thể tải lại hồ sơ. Hãy thử lại khi kết nối ổn định.')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  if (profile?.approvalStatus === 'APPROVED')
    return <ApprovedProfileAmendmentWorkspace initialProfile={profile} />

  return (
    <section className={styles.workspace}>
      <ProfilePageHeader
        status={loading ? 'Đang tải hồ sơ' : statusTitle}
        warning={status === 'REJECTED' || status === 'SUSPENDED'}
      >
        {!locked && !loading && (
          <>
            {dirty && (
              <button
                type="button"
                className="btn-ghost"
                disabled={busy}
                onClick={() => void cancelChanges()}
              >
                <Undo2 size={16} aria-hidden="true" />
                Hủy thay đổi chưa lưu
              </button>
            )}
            <button
              type="submit"
              form="initial-profile-form"
              className={
                dirty || !profile
                  ? `${styles.primary} btn-primary`
                  : 'btn-outline'
              }
              disabled={disabled}
              aria-busy={busy}
            >
              Lưu hồ sơ
            </button>
            <button
              type="button"
              className={
                !dirty && profile
                  ? `${styles.primary} btn-primary`
                  : 'btn-outline'
              }
              disabled={
                disabled ||
                !etag ||
                dirty ||
                status === 'PENDING_REVIEW' ||
                status === 'NEW'
              }
              onClick={() => void submit()}
              aria-busy={busy}
            >
              {status === 'REJECTED' ? 'Gửi lại để xét duyệt' : 'Gửi xét duyệt'}
            </button>
          </>
        )}
      </ProfilePageHeader>
      <div className={styles.body}>
        {error && (
          <div className={styles.error} role="alert">
            <p>{error}</p>
            <button
              type="button"
              className="btn-outline"
              disabled={busy}
              onClick={() => void reload()}
            >
              Kiểm tra trạng thái mới nhất
            </button>
          </div>
        )}
        {notice && (
          <p className={styles.notice} role="status">
            {notice}
          </p>
        )}
        {loading ? (
          <ProfileLoading label="Đang tải hồ sơ…" />
        ) : (
          <>
            <div className={styles.noticeBanner} role="status">
              <span className={styles.noticeIcon}>
                <ShieldCheck size={21} aria-hidden="true" />
              </span>
              <div>
                <strong>{statusTitle}</strong>
                <p>
                  {status === 'PENDING_REVIEW'
                    ? 'Nếu lưu thay đổi, hồ sơ sẽ rời hàng đợi cho đến khi bạn gửi lại.'
                    : status === 'REJECTED'
                      ? 'Sửa thông tin theo góp ý rồi gửi lại để xét duyệt.'
                      : status === 'SUSPENDED'
                        ? 'Hồ sơ đang tạm ngưng. Quản trị viên cần khôi phục để bạn tiếp tục cập nhật.'
                        : 'Lưu hồ sơ, kiểm tra thông tin và gửi xét duyệt khi sẵn sàng.'}
                </p>
              </div>
            </div>
            {profile?.decisionReasonCode && (
              <div className={styles.reason} role="status">
                <strong>Lý do: </strong>
                {reasonLabels[profile.decisionReasonCode]}
              </div>
            )}
            {!loadFailed && (
              <div className={styles.columns}>
                <form
                  id="initial-profile-form"
                  noValidate
                  className={styles.form}
                  onSubmit={save}
                  aria-busy={busy}
                >
                  <ProfileIdentityCard value={form} approved={false} />
                  <div ref={panel}>
                    <ProfileFields
                      value={form}
                      onChange={(value) => {
                        setForm(value)
                        setErrors({})
                      }}
                      disabled={disabled}
                      errors={errors}
                    />
                  </div>
                  {!locked && (
                    <p className={styles.editorNote} role="status">
                      {dirty
                        ? 'Có thay đổi chưa lưu. Lưu hồ sơ trước khi gửi xét duyệt.'
                        : profile
                          ? 'Thông tin đã lưu trên hệ thống.'
                          : 'Điền thông tin để tạo hồ sơ của bạn.'}
                    </p>
                  )}
                  <p className={styles.scope}>
                    <Info size={17} aria-hidden="true" />
                    <span>
                      Luồng này không thu thập bằng cấp, giấy phép, chứng chỉ
                      hoặc tài liệu xác minh.
                    </span>
                  </p>
                </form>
                <aside
                  className={styles.previewColumn}
                  aria-label="Xem trước và hoàn thiện hồ sơ"
                >
                  <ProfilePreviewCard
                    value={form}
                    title={
                      status === 'SUSPENDED'
                        ? 'Hồ sơ đã tạm ngưng'
                        : 'Xem trước hồ sơ'
                    }
                    draft
                    status={status === 'SUSPENDED' ? 'Tạm ngưng' : undefined}
                  />
                  <ProfileChecklist value={form} />
                </aside>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}
