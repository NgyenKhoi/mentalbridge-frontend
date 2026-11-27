'use client'

import { useEffect, useRef, useState } from 'react'
import LightSelect from '@/components/LightSelect'
import { useFeedback } from '@/components/ui/FeedbackProvider'
import type {
  ProfileAmendment,
  ProfileAmendmentDetail,
  SpecialistProfileInput,
  SpecialistRejectionReason,
} from '@/lib/consultation/consultation-validation'
import {
  browserConsultation,
  BrowserConsultationError,
} from '../api/browser-client'
import {
  amendmentReasonLabels,
  profileAreaLabels,
  profileLanguageLabels,
} from './ProfileFields'
import styles from './ProfileAmendment.module.css'

const fields: { key: keyof SpecialistProfileInput; label: string }[] = [
  { key: 'displayName', label: 'Tên hiển thị' },
  { key: 'bio', label: 'Giới thiệu' },
  { key: 'supportAreas', label: 'Lĩnh vực hỗ trợ' },
  { key: 'languages', label: 'Ngôn ngữ' },
  { key: 'yearsOfExperience', label: 'Kinh nghiệm' },
  { key: 'timezone', label: 'Múi giờ' },
]

function display(
  value: SpecialistProfileInput,
  key: keyof SpecialistProfileInput,
) {
  if (key === 'supportAreas')
    return value.supportAreas.map((area) => profileAreaLabels[area]).join(', ')
  if (key === 'languages')
    return value.languages
      .map((language) => profileLanguageLabels[language] ?? language)
      .join(', ')
  if (key === 'yearsOfExperience') return `${value.yearsOfExperience} năm`
  return String(value[key])
}

export default function AdminProfileAmendmentReview() {
  const { confirm, showActionToast } = useFeedback()
  const [page, setPage] = useState(0)
  const [revision, setRevision] = useState(0)
  const [items, setItems] = useState<ProfileAmendment[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ProfileAmendmentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [error, setError] = useState('')
  const [reason, setReason] = useState<SpecialistRejectionReason>(
    'PROFILE_INFORMATION_INCOMPLETE',
  )
  const lock = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const refresh = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (detail && !detailLoading) heading.current?.focus()
  }, [detail, detailLoading])

  useEffect(() => {
    const controller = new AbortController()
    browserConsultation
      .profileAmendments(page, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return
        if (page > 0 && !result.data.items.length) {
          setPage((current) => current - 1)
          return
        }
        setItems(result.data.items)
        setHasMore(result.data.hasMore)
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError('Chưa thể tải các bản chỉnh sửa. Hãy thử tải lại.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [page, revision])

  useEffect(() => {
    if (!selectedId) return
    const controller = new AbortController()
    browserConsultation
      .amendmentDetail(selectedId, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return
        setDetail(result.data)
        setBlocked(false)
        heading.current?.focus()
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            'Chưa thể tải nội dung so sánh. Tải lại trước khi quyết định.',
          )
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false)
      })
    return () => controller.abort()
  }, [selectedId, revision])

  function reload() {
    if (lock.current) return
    setError('')
    setLoading(true)
    setDetail(null)
    setDetailLoading(!!selectedId)
    setRevision((current) => current + 1)
  }
  function inspect(id: string) {
    if (lock.current) return
    setError('')
    setDetail(null)
    setDetailLoading(true)
    setSelectedId(id)
    if (id === selectedId) setRevision((current) => current + 1)
  }

  async function decide(action: 'approve' | 'reject') {
    const amendment = detail?.amendment
    if (
      !amendment ||
      lock.current ||
      blocked ||
      amendment.status !== 'PENDING_REVIEW' ||
      detail?.approvedProfile.approvalStatus !== 'APPROVED'
    )
      return
    lock.current = true
    setBusy(true)
    try {
      const accepted = await confirm({
        title:
          action === 'approve'
            ? 'Công khai bản chỉnh sửa?'
            : 'Yêu cầu chỉnh sửa lại?',
        description:
          action === 'approve'
            ? `Nội dung mới của ${detail.approvedProfile.displayName} sẽ thay thế hồ sơ đang công khai. Lịch hẹn và khung giờ đã tạo không thay đổi.`
            : `Lý do: ${amendmentReasonLabels[reason]}. Hồ sơ đang công khai được giữ nguyên.`,
        confirmLabel:
          action === 'approve'
            ? 'Phê duyệt và công khai'
            : 'Từ chối bản chỉnh sửa',
        tone: 'warning',
      })
      if (!accepted) return
      setError('')
      await browserConsultation.decideAmendment(
        amendment.id,
        action,
        `"${amendment.version}"`,
        action === 'reject' ? reason : undefined,
      )
      setSelectedId(null)
      setDetail(null)
      setLoading(true)
      setRevision((current) => current + 1)
      showActionToast({
        title:
          action === 'approve'
            ? 'Đã công khai hồ sơ mới.'
            : 'Đã lưu lý do để chuyên gia chỉnh sửa và gửi lại.',
        tone: 'success',
      })
      refresh.current?.focus()
    } catch (cause) {
      setBlocked(true)
      setError(
        cause instanceof BrowserConsultationError &&
          [409, 412].includes(cause.status)
          ? 'Bản chỉnh sửa vừa thay đổi hoặc đã được xét duyệt. Tải lại nội dung để kiểm tra; quyết định này chưa được áp dụng.'
          : 'Chưa xác nhận được kết quả. Tải lại trạng thái trước khi quyết định tiếp.',
      )
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  const amendment = detail?.amendment
  const reviewable =
    amendment?.status === 'PENDING_REVIEW' &&
    detail?.approvedProfile.approvalStatus === 'APPROVED'
  return (
    <section className={styles.workspace}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>QUẢN LÝ CHUYÊN GIA</span>
          <h1>Duyệt cập nhật hồ sơ</h1>
          <p>
            So sánh bản đang công khai với nội dung chuyên gia muốn thay đổi.
          </p>
        </div>
        <button
          ref={refresh}
          type="button"
          disabled={busy || loading || detailLoading}
          onClick={reload}
        >
          Tải lại danh sách
        </button>
      </header>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.reviewLayout}>
        <aside
          className={styles.queue}
          aria-label="Bản chỉnh sửa chờ duyệt"
          aria-busy={loading}
        >
          <h2>Bản chỉnh sửa chờ duyệt</h2>
          {loading ? (
            <p role="status">Đang tải…</p>
          ) : items.length === 0 ? (
            <p>Không có bản chỉnh sửa chờ duyệt.</p>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={busy}
                aria-pressed={selectedId === item.id}
                onClick={() => inspect(item.id)}
              >
                <strong>{item.proposedProfile.displayName}</strong>
                <span>Cập nhật hồ sơ</span>
                <small>
                  {item.submittedAt
                    ? new Date(item.submittedAt).toLocaleString('vi-VN', {
                        timeZone: 'Asia/Ho_Chi_Minh',
                      })
                    : ''}
                </small>
              </button>
            ))
          )}
          <div className={styles.actions}>
            <button
              type="button"
              disabled={busy || loading || page === 0}
              onClick={() => {
                setLoading(true)
                setPage((current) => current - 1)
              }}
            >
              Trang trước
            </button>
            <span>Trang {page + 1}</span>
            <button
              type="button"
              disabled={busy || loading || !hasMore}
              onClick={() => {
                setLoading(true)
                setPage((current) => current + 1)
              }}
            >
              Trang sau
            </button>
          </div>
        </aside>
        <article className={styles.snapshot} aria-busy={detailLoading}>
          {detailLoading ? (
            <p role="status">Đang tải nội dung so sánh…</p>
          ) : detail && amendment ? (
            <>
              <h2 ref={heading} tabIndex={-1}>
                {detail.approvedProfile.displayName}
              </h2>
              <p className={styles.help}>
                Hồ sơ hiện tại vẫn công khai trong khi chờ quyết định.
              </p>
              <div className={styles.comparison}>
                {fields.map(({ key, label }) => (
                  <section
                    className={styles.difference}
                    key={key}
                    data-changed={
                      display(detail.approvedProfile, key) !==
                      display(amendment.proposedProfile, key)
                    }
                  >
                    <h3>{label}</h3>
                    <div>
                      <div>
                        <small>Đang công khai</small>
                        <p>{display(detail.approvedProfile, key)}</p>
                      </div>
                      <div>
                        <small>Đề xuất cập nhật</small>
                        <p>{display(amendment.proposedProfile, key)}</p>
                      </div>
                    </div>
                  </section>
                ))}
              </div>
              {reviewable ? (
                <fieldset
                  className={styles.decision}
                  disabled={busy || blocked}
                >
                  <legend>Quyết định xét duyệt</legend>
                  <button
                    className={`${styles.primary} btn-primary`}
                    type="button"
                    onClick={() => void decide('approve')}
                  >
                    Phê duyệt và công khai
                  </button>
                  <label htmlFor="amendment-rejection-reason">
                    Lý do từ chối
                  </label>
                  <LightSelect
                    id="amendment-rejection-reason"
                    value={reason}
                    options={Object.entries(amendmentReasonLabels).map(
                      ([value, label]) => ({ value, label }),
                    )}
                    onChange={(value) =>
                      setReason(value as SpecialistRejectionReason)
                    }
                  />
                  <button type="button" onClick={() => void decide('reject')}>
                    Từ chối bản chỉnh sửa
                  </button>
                </fieldset>
              ) : (
                <p role="status">
                  Bản này không còn chờ duyệt hoặc chuyên gia đang tạm ngưng.
                  Tải lại danh sách để tiếp tục.
                </p>
              )}
            </>
          ) : (
            <p>Chọn một bản chỉnh sửa để so sánh và xét duyệt.</p>
          )}
        </article>
      </div>
    </section>
  )
}
