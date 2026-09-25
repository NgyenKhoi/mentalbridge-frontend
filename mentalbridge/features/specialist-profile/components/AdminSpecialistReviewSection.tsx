'use client'

import { useEffect, useState } from 'react'
import type {
  SpecialistApprovalStatus,
  SpecialistProfile,
  SpecialistRejectionReason,
  SpecialistSuspensionReason,
} from '@/lib/consultation/consultation-validation'
import { browserConsultation } from '../api/browser-client'
import styles from './AdminSpecialistReviewSection.module.css'

const supportLabels = {
  DEPRESSIVE_SYMPTOMS: 'Cảm xúc trầm buồn',
  ANXIETY_SYMPTOMS: 'Lo âu',
} as const

const statusLabels: Record<SpecialistApprovalStatus, string> = {
  PENDING: 'Chờ xét duyệt',
  APPROVED: 'Đã phê duyệt',
  REJECTED: 'Đã từ chối',
  SUSPENDED: 'Đang tạm ngưng',
}

const reasonLabels = {
  PROFILE_INFORMATION_INCOMPLETE: 'Thông tin hồ sơ chưa đầy đủ',
  PROFILE_CONTENT_NOT_APPROVED: 'Nội dung hồ sơ chưa phù hợp',
  OUTSIDE_SUPPORTED_SCOPE: 'Ngoài phạm vi hỗ trợ',
  POLICY_VIOLATION: 'Vi phạm chính sách',
  QUALITY_REVIEW_REQUIRED: 'Cần rà soát chất lượng',
  ACCOUNT_REVIEW_REQUIRED: 'Cần rà soát tài khoản',
} as const

export default function AdminSpecialistReviewSection() {
  const [filter, setFilter] = useState<SpecialistApprovalStatus>('PENDING')
  const [items, setItems] = useState<SpecialistProfile[]>([])
  const [selected, setSelected] = useState<SpecialistProfile | null>(null)
  const [etag, setEtag] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] =
    useState<SpecialistRejectionReason>('PROFILE_INFORMATION_INCOMPLETE')
  const [suspensionReason, setSuspensionReason] =
    useState<SpecialistSuspensionReason>('QUALITY_REVIEW_REQUIRED')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    browserConsultation
      .profiles(filter)
      .then((result) => {
        if (active) setItems(result.data.items)
      })
      .catch((cause: unknown) => {
        if (active)
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
  }, [filter])

  function changeFilter(status: SpecialistApprovalStatus) {
    if (status === filter) return
    setFilter(status)
    setLoading(true)
    setSelected(null)
    setEtag(null)
    setError('')
    setNotice('')
  }

  async function inspect(id: string) {
    setError('')
    setNotice('')
    try {
      const result = await browserConsultation.detail(id)
      setSelected(result.data)
      setEtag(result.etag)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể tải hồ sơ.')
    }
  }

  function completed(message: string) {
    if (!selected) return
    setItems((current) =>
      current.filter((item) => item.accountId !== selected.accountId),
    )
    setSelected(null)
    setEtag(null)
    setNotice(message)
  }

  async function decide(action: 'APPROVE' | 'REJECT' | 'SUSPEND' | 'RESTORE') {
    if (!selected || !etag) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (action === 'APPROVE') {
        await browserConsultation.approve(selected.accountId, etag)
        completed('Đã phê duyệt hồ sơ chuyên gia.')
      } else if (action === 'REJECT') {
        await browserConsultation.reject(
          selected.accountId,
          etag,
          rejectionReason,
        )
        completed('Đã từ chối hồ sơ và lưu lý do để chuyên gia chỉnh sửa.')
      } else if (action === 'SUSPEND') {
        const result = await browserConsultation.suspend(
          selected.accountId,
          etag,
          suspensionReason,
        )
        completed(
          `Đã tạm ngưng: rút ${result.data.effects.withdrawnAvailabilitySlots} lịch, hủy ${result.data.effects.cancelledAppointments} cuộc hẹn và hoàn ${result.data.effects.releasedCredits} lượt tư vấn.`,
        )
      } else {
        await browserConsultation.restore(selected.accountId, etag)
        completed(
          'Đã khôi phục hồ sơ. Lịch và cuộc hẹn đã hủy không được tự động mở lại.',
        )
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Không thể cập nhật hồ sơ.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={styles.workspace}>
      <header>
        <span>QUẢN LÝ CHUYÊN GIA</span>
        <h1>Vòng đời hồ sơ</h1>
        <p>
          Xét duyệt, từ chối, tạm ngưng và khôi phục bằng lý do vận hành đã được
          chuẩn hóa. Luồng này không xử lý giấy phép hay tài liệu xác minh.
        </p>
      </header>
      <nav className={styles.filters} aria-label="Lọc trạng thái hồ sơ">
        {(Object.keys(statusLabels) as SpecialistApprovalStatus[]).map(
          (status) => (
            <button
              key={status}
              aria-pressed={filter === status}
              onClick={() => changeFilter(status)}
            >
              {statusLabels[status]}
            </button>
          ),
        )}
      </nav>
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
      <div className={styles.layout}>
        <div className={styles.queue}>
          <h2>
            {statusLabels[filter]} <b>{items.length}</b>
          </h2>
          {loading ? (
            <p>Đang tải…</p>
          ) : items.length === 0 ? (
            <p>Không có hồ sơ ở trạng thái này.</p>
          ) : (
            items.map((item) => (
              <button
                key={item.accountId}
                onClick={() => void inspect(item.accountId)}
                aria-pressed={selected?.accountId === item.accountId}
              >
                <strong>{item.displayName}</strong>
                <span>
                  {item.supportAreas
                    .map((area) => supportLabels[area])
                    .join(' · ')}
                </span>
                <small>{statusLabels[item.approvalStatus]}</small>
              </button>
            ))
          )}
        </div>
        <article className={styles.detail}>
          {selected ? (
            <>
              <div className={styles.detailHead}>
                <div>
                  <small>HỒ SƠ #{selected.accountId.slice(0, 8)}</small>
                  <h2>{selected.displayName}</h2>
                </div>
                <span>{statusLabels[selected.approvalStatus]}</span>
              </div>
              <p>{selected.bio}</p>
              {selected.decisionReasonCode && (
                <p className={styles.reason}>
                  <strong>Lý do hiện tại:</strong>{' '}
                  {reasonLabels[selected.decisionReasonCode]}
                </p>
              )}
              <dl>
                <div>
                  <dt>Lĩnh vực hỗ trợ</dt>
                  <dd>
                    {selected.supportAreas
                      .map((area) => supportLabels[area])
                      .join(', ')}
                  </dd>
                </div>
                <div>
                  <dt>Ngôn ngữ</dt>
                  <dd>{selected.languages.join(', ')}</dd>
                </div>
                <div>
                  <dt>Kinh nghiệm</dt>
                  <dd>{selected.yearsOfExperience} năm</dd>
                </div>
                <div>
                  <dt>Múi giờ</dt>
                  <dd>{selected.timezone}</dd>
                </div>
              </dl>
              {selected.approvalStatus === 'PENDING' && (
                <div className={styles.decisionGrid}>
                  <button
                    className={styles.approve}
                    disabled={busy}
                    onClick={() => void decide('APPROVE')}
                  >
                    Phê duyệt hồ sơ
                  </button>
                  <label>
                    Lý do từ chối
                    <select
                      value={rejectionReason}
                      onChange={(event) =>
                        setRejectionReason(
                          event.target.value as SpecialistRejectionReason,
                        )
                      }
                    >
                      {Object.entries(reasonLabels)
                        .slice(0, 3)
                        .map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                    </select>
                  </label>
                  <button
                    className={styles.danger}
                    disabled={busy}
                    onClick={() => void decide('REJECT')}
                  >
                    Từ chối hồ sơ
                  </button>
                </div>
              )}
              {selected.approvalStatus === 'APPROVED' && (
                <div className={styles.decisionGrid}>
                  <label>
                    Lý do tạm ngưng
                    <select
                      value={suspensionReason}
                      onChange={(event) =>
                        setSuspensionReason(
                          event.target.value as SpecialistSuspensionReason,
                        )
                      }
                    >
                      {Object.entries(reasonLabels)
                        .slice(3)
                        .map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                    </select>
                  </label>
                  <p className={styles.warning}>
                    Tạm ngưng sẽ rút lịch tương lai, hủy cuộc hẹn chưa bắt đầu
                    và hoàn đúng lượt tư vấn đang giữ.
                  </p>
                  <button
                    className={styles.danger}
                    disabled={busy}
                    onClick={() => void decide('SUSPEND')}
                  >
                    Tạm ngưng chuyên gia
                  </button>
                </div>
              )}
              {selected.approvalStatus === 'SUSPENDED' && (
                <div className={styles.decisionGrid}>
                  <p className={styles.warning}>
                    Khôi phục không tự mở lại lịch hoặc cuộc hẹn đã hủy.
                  </p>
                  <button
                    className={styles.approve}
                    disabled={busy}
                    onClick={() => void decide('RESTORE')}
                  >
                    Khôi phục chuyên gia
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className={styles.empty}>
              <strong>Chọn một hồ sơ</strong>
              <p>
                Thông tin và hành động phù hợp trạng thái sẽ hiển thị tại đây.
              </p>
            </div>
          )}
        </article>
      </div>
    </section>
  )
}
