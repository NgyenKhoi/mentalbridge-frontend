'use client'

import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { Eye, Info, ShieldCheck } from 'lucide-react'
import { useFeedback } from '@/components/ui/FeedbackProvider'
import {
  ConsultationInputError,
  type ProfileAmendment,
  type ProfileAmendmentDetail,
  type SpecialistProfile,
  type SpecialistProfileInput,
} from '@/lib/consultation/consultation-validation'
import {
  browserConsultation,
  BrowserConsultationError,
} from '../api/browser-client'
import ProfileFields, { amendmentReasonLabels } from './ProfileFields'
import ProfileSnapshot from './ProfileSnapshot'
import {
  ProfileChecklist,
  ProfileIdentityCard,
  ProfilePageHeader,
  ProfilePreviewCard,
  ProfilePreviewDialog,
} from './ProfilePresentation'
import {
  focusProfileError,
  profileFieldErrors,
  profileFormValue,
  validateProfileForm,
} from './profile-form'
import { useProfileDraftGuard } from './useProfileDraftGuard'
import styles from './ProfilePage.module.css'

const amendmentLabels = {
  DRAFT: 'Bản nháp riêng tư',
  PENDING_REVIEW: 'Đang chờ duyệt',
  REJECTED: 'Cần chỉnh sửa',
  APPROVED: 'Đã cập nhật công khai',
}
export default function ApprovedProfileAmendmentWorkspace({
  initialProfile,
}: {
  initialProfile: SpecialistProfile
}) {
  const { confirm, showActionToast } = useFeedback()
  const [published, setPublished] = useState(initialProfile)
  const [amendment, setAmendment] = useState<ProfileAmendment | null>(null)
  const [form, setForm] = useState<SpecialistProfileInput>(
    profileFormValue(initialProfile),
  )
  const [editing, setEditing] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewPublished, setPreviewPublished] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [errors, setErrors] = useState<
    Partial<Record<keyof SpecialistProfileInput, string>>
  >({})
  const lock = useRef(false)
  const panel = useRef<HTMLDivElement>(null)
  const dirty =
    editing &&
    amendment !== null &&
    JSON.stringify(profileFormValue(form)) !==
      JSON.stringify(profileFormValue(amendment.proposedProfile))
  const editable = published.approvalStatus === 'APPROVED'

  const receiveDetail = useCallback((data: ProfileAmendmentDetail) => {
    setPublished(data.approvedProfile)
    setAmendment(data.amendment)
    setForm(
      profileFormValue(data.amendment?.proposedProfile ?? data.approvedProfile),
    )
    setEditing(false)
    setBlocked(false)
    setError('')
    setErrors({})
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    browserConsultation
      .ownAmendment(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) receiveDetail(result.data)
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            'Chưa thể tải bản chỉnh sửa. Hồ sơ công khai vẫn được giữ nguyên.',
          )
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [receiveDetail])

  useProfileDraftGuard(dirty)

  useEffect(() => {
    if (editing)
      panel.current?.querySelector<HTMLInputElement>('input')?.focus()
  }, [editing])

  async function mutation(action: () => Promise<void>) {
    if (lock.current || blocked) return
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
          ? 'Hồ sơ đã thay đổi ở phiên khác hoặc vừa được xét duyệt. Nội dung bạn đang viết vẫn còn ở đây; tải lại để kiểm tra trước khi tiếp tục.'
          : uncertain
            ? 'Chưa xác nhận được kết quả. Nội dung đang viết vẫn còn ở đây; kiểm tra trạng thái trước khi gửi lại.'
            : cause instanceof BrowserConsultationError && cause.status === 400
              ? 'Một số thông tin chưa hợp lệ. Kiểm tra các trường và múi giờ rồi thử lại.'
              : 'Chưa thể hoàn tất yêu cầu. Kiểm tra quyền truy cập và thử lại.',
      )
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  function receive(value: ProfileAmendment) {
    setAmendment(value)
    setForm(profileFormValue(value.proposedProfile))
    setErrors({})
  }
  function success(message: string) {
    setNotice(message)
    showActionToast({ title: message, tone: 'success' })
  }

  async function begin() {
    setPreviewPublished(false)
    if (amendment && amendment.status !== 'APPROVED') {
      setEditing(true)
      return
    }
    await mutation(async () => {
      const result = await browserConsultation.startAmendment(
        `"${published.version}"`,
      )
      receive(result.data)
      setEditing(true)
    })
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!amendment || busy || blocked || !editable) return
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
      amendment.status === 'PENDING_REVIEW' &&
      !(await confirm({
        title: 'Sửa bản đang chờ duyệt?',
        description:
          'Lưu thay đổi sẽ rút bản này khỏi hàng đợi. Bạn cần gửi duyệt lại khi hoàn tất.',
        confirmLabel: 'Lưu và rút khỏi hàng đợi',
        tone: 'warning',
      }))
    )
      return
    await mutation(async () => {
      const result = await browserConsultation.saveAmendment(
        amendment.id,
        input,
        `"${amendment.version}"`,
      )
      receive(result.data)
      success('Đã lưu bản chỉnh sửa riêng tư. Hồ sơ công khai chưa thay đổi.')
    })
  }

  async function submit() {
    if (!amendment || dirty || busy || blocked || !editable) return
    await mutation(async () => {
      const result = await browserConsultation.submitAmendment(
        amendment.id,
        amendment.status === 'REJECTED' ? 'resubmit' : 'submit',
        `"${amendment.version}"`,
      )
      receive(result.data)
      setEditing(false)
      success(
        'Đã gửi bản chỉnh sửa để xét duyệt. Hồ sơ hiện tại vẫn công khai.',
      )
    })
  }

  async function reload() {
    if (lock.current) return
    if (
      dirty &&
      !(await confirm({
        title: 'Tải lại bản mới nhất?',
        description:
          'Bản đang viết chưa lưu sẽ được thay bằng nội dung mới nhất trên hệ thống. Sao chép nội dung cần giữ trước khi tiếp tục.',
        confirmLabel: 'Tải lại',
        cancelLabel: 'Giữ bản đang viết',
        tone: 'warning',
      }))
    )
      return
    lock.current = true
    setBusy(true)
    try {
      const result = await browserConsultation.ownAmendment()
      receiveDetail(result.data)
      setNotice('Đã tải trạng thái mới nhất.')
    } catch {
      setError('Chưa thể tải lại. Hãy thử lại khi kết nối ổn định.')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  const open = amendment && amendment.status !== 'APPROVED'
  const previewValue =
    previewPublished || !open
      ? published
      : editing
        ? form
        : amendment.proposedProfile
  const submitDisabled =
    busy ||
    blocked ||
    dirty ||
    !editable ||
    amendment?.status === 'PENDING_REVIEW'
  return (
    <section className={styles.workspace}>
      <ProfilePageHeader
        status={editable ? 'Hồ sơ đã được duyệt' : 'Đang tạm ngưng'}
        warning={!editable}
      >
        <button
          type="button"
          className="btn-outline"
          onClick={() => setPreviewOpen(true)}
        >
          <Eye size={16} aria-hidden="true" />
          {editable ? 'Xem hồ sơ đang công khai' : 'Xem hồ sơ đã duyệt'}
        </button>
        {!editing && editable ? (
          <button
            type="button"
            className={`${styles.primary} btn-primary`}
            disabled={loading || busy || blocked || !!error}
            onClick={() => void begin()}
          >
            {busy
              ? 'Đang mở…'
              : open
                ? 'Tiếp tục chỉnh sửa'
                : 'Chỉnh sửa hồ sơ'}
          </button>
        ) : (
          editing && (
            <>
              <button
                type="submit"
                form="profile-amendment-form"
                className={
                  dirty ? `${styles.primary} btn-primary` : 'btn-outline'
                }
                disabled={busy || blocked || !editable || !dirty}
                aria-busy={busy}
              >
                Lưu bản nháp
              </button>
              <button
                type="button"
                className={
                  !dirty ? `${styles.primary} btn-primary` : 'btn-outline'
                }
                disabled={submitDisabled}
                onClick={() => void submit()}
                aria-busy={busy}
              >
                {amendment?.status === 'REJECTED'
                  ? 'Gửi lại để xét duyệt'
                  : 'Gửi xét duyệt'}
              </button>
            </>
          )
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
        <div className={styles.noticeBanner} role="status">
          <span className={styles.noticeIcon}>
            <ShieldCheck size={21} aria-hidden="true" />
          </span>
          <div>
            <strong>
              {!editable
                ? 'Hồ sơ đang tạm ngưng'
                : open
                  ? amendmentLabels[amendment.status]
                  : 'Hồ sơ đã được duyệt'}
            </strong>
            <p>
              {!editable
                ? 'Chỉ có thể chỉnh sửa sau khi quản trị viên khôi phục.'
                : open
                  ? 'Hồ sơ hiện tại vẫn công khai. Lịch hẹn và khung giờ đã tạo được giữ nguyên.'
                  : 'Bạn có thể cập nhật thông tin. Nội dung mới chỉ công khai sau khi được xét duyệt.'}
            </p>
          </div>
        </div>
        {amendment?.reasonCode && (
          <div className={styles.reason}>
            <strong>Lý do cần chỉnh sửa</strong>
            <p>{amendmentReasonLabels[amendment.reasonCode]}</p>
          </div>
        )}
        <div className={styles.columns}>
          <form
            id="profile-amendment-form"
            noValidate
            className={styles.form}
            onSubmit={save}
            aria-busy={busy}
          >
            <ProfileIdentityCard value={published} approved={editable} />
            {loading ? (
              <div className={styles.loading} role="status" aria-busy="true">
                Đang tải bản chỉnh sửa…
              </div>
            ) : !editing && open ? (
              <ProfileSnapshot
                value={amendment.proposedProfile}
                title={
                  amendment.status === 'PENDING_REVIEW'
                    ? 'Bản đã gửi · Chưa công khai'
                    : 'Bản chỉnh sửa · Chưa công khai'
                }
              />
            ) : !error || editing ? (
              <div ref={panel}>
                <ProfileFields
                  value={form}
                  onChange={(value) => {
                    setForm(value)
                    setErrors({})
                  }}
                  disabled={!editing || busy || blocked || !editable}
                  errors={errors}
                />
              </div>
            ) : null}
            <p className={styles.editorNote} role="status">
              {editing
                ? dirty
                  ? 'Có thay đổi chưa lưu. Lưu bản nháp trước khi gửi xét duyệt.'
                  : 'Bản nháp đã lưu trên hệ thống.'
                : open
                  ? 'Tiếp tục chỉnh sửa để bổ sung hoặc gửi lại bản này.'
                  : 'Chọn Chỉnh sửa hồ sơ để bắt đầu một bản cập nhật riêng tư.'}
            </p>
            <p className={styles.scope}>
              <Info size={17} aria-hidden="true" />
              <span>
                Chỉ cập nhật thông tin công khai. Luồng này không thu thập bằng
                cấp, giấy phép hoặc chứng chỉ.
              </span>
            </p>
          </form>
          <aside
            className={styles.previewColumn}
            aria-label="Xem trước và hoàn thiện hồ sơ"
          >
            {open && (
              <div
                className={styles.previewModes}
                role="group"
                aria-label="Chọn bản xem trước"
              >
                <button
                  type="button"
                  className="btn-outline"
                  aria-pressed={!previewPublished}
                  onClick={() => setPreviewPublished(false)}
                >
                  Bản chỉnh sửa
                </button>
                <button
                  type="button"
                  className="btn-outline"
                  aria-pressed={previewPublished}
                  onClick={() => setPreviewPublished(true)}
                >
                  {editable ? 'Đang công khai' : 'Bản đã duyệt'}
                </button>
              </div>
            )}
            <ProfilePreviewCard
              value={previewValue}
              title={
                previewPublished || !open
                  ? editable
                    ? 'Hồ sơ đang công khai'
                    : 'Hồ sơ đã duyệt gần nhất'
                  : 'Xem trước bản chỉnh sửa'
              }
              draft={!previewPublished && !!open}
              status={
                !editable && (previewPublished || !open)
                  ? 'Tạm ngưng'
                  : undefined
              }
            />
            <ProfileChecklist
              value={
                editing ? form : open ? amendment.proposedProfile : published
              }
            />
          </aside>
        </div>
        {amendment?.reviewedAt && (
          <details className={styles.history}>
            <summary>Thông tin kỹ thuật · Xét duyệt gần nhất</summary>
            <p>
              {amendmentLabels[amendment.status]} ·{' '}
              {new Date(amendment.reviewedAt).toLocaleString('vi-VN', {
                timeZone: published.timezone,
              })}
            </p>
            <p>Người xét duyệt: {amendment.reviewedBy}</p>
          </details>
        )}
      </div>
      <ProfilePreviewDialog
        value={published}
        open={previewOpen}
        published={editable}
        onOpenChange={setPreviewOpen}
      />
    </section>
  )
}
