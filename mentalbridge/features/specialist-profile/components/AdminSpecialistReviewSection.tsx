'use client'

import { useEffect, useState } from 'react'
import { Info, Search, Sparkles, X } from 'lucide-react'
import { useFeedback } from '@/components/ui/FeedbackProvider'
import type {
  ProfileAmendment,
  ProfileAmendmentDetail,
  SpecialistApprovalStatus,
  SpecialistProfile,
  SpecialistRejectionReason,
  SpecialistSuspensionReason,
} from '@/lib/consultation/consultation-validation'
import {
  BrowserConsultationError,
  browserConsultation,
} from '../api/browser-client'
import AdminCredentialReviewSection from './AdminCredentialReviewSection'
import styles from './AdminSpecialistReviewSection.module.css'

const supportLabels = {
  DEPRESSIVE_SYMPTOMS: 'Cảm xúc trầm buồn',
  ANXIETY_SYMPTOMS: 'Lo âu',
} as const

export type SpecialistFilterTab =
  'PENDING' | 'AMENDMENTS' | 'APPROVED' | 'REJECTED' | 'SUSPENDED'

const filterTabLabels: Record<SpecialistFilterTab, string> = {
  PENDING: 'Chờ xét duyệt',
  AMENDMENTS: 'Có bản sửa đổi',
  APPROVED: 'Đã phê duyệt',
  REJECTED: 'Đã từ chối',
  SUSPENDED: 'Đang tạm ngưng',
}

const rejectionLabels: Record<SpecialistRejectionReason, string> = {
  PROFILE_INFORMATION_INCOMPLETE: 'Thông tin hồ sơ chưa đầy đủ',
  PROFILE_CONTENT_NOT_APPROVED: 'Nội dung hồ sơ chưa phù hợp',
  OUTSIDE_SUPPORTED_SCOPE: 'Ngoài phạm vi hỗ trợ',
}

const suspensionLabels: Record<SpecialistSuspensionReason, string> = {
  POLICY_VIOLATION: 'Vi phạm chính sách',
  QUALITY_REVIEW_REQUIRED: 'Cần rà soát chất lượng',
  ACCOUNT_REVIEW_REQUIRED: 'Cần rà soát tài khoản',
}

type ProfileFields = Pick<
  SpecialistProfile,
  | 'displayName'
  | 'bio'
  | 'supportAreas'
  | 'languages'
  | 'yearsOfExperience'
  | 'timezone'
>

const amendmentFields: ReadonlyArray<{
  label: string
  value: (profile: ProfileFields) => string
}> = [
  { label: 'Tên hiển thị', value: (p) => p.displayName },
  { label: 'Giới thiệu', value: (p) => p.bio },
  {
    label: 'Lĩnh vực hỗ trợ',
    value: (p) => p.supportAreas.map((area) => supportLabels[area]).join(', '),
  },
  { label: 'Ngôn ngữ', value: (p) => p.languages.join(', ').toUpperCase() },
  { label: 'Kinh nghiệm', value: (p) => `${p.yearsOfExperience} năm` },
  { label: 'Múi giờ', value: (p) => p.timezone },
]

const initialsOf = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()

const dateOf = (value: string | null) =>
  value ? new Date(value).toLocaleDateString('vi-VN') : null

const messageOf = (cause: unknown, fallback: string) =>
  cause instanceof Error ? cause.message : fallback

function statusPillClass(status: SpecialistApprovalStatus) {
  switch (status) {
    case 'PENDING':
      return styles.statusPillPending
    case 'APPROVED':
      return styles.statusPill
    case 'REJECTED':
      return styles.statusPillRejected
    case 'SUSPENDED':
      return styles.statusPillSuspended
  }
}

function QueueSearch({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (value: string) => void
  label: string
}) {
  return (
    <div className={styles.searchBox}>
      <Search size={14} className={styles.searchIcon} aria-hidden="true" />
      <input
        type="text"
        className={styles.searchInput}
        placeholder="Tìm tên chuyên gia…"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
      />
      {value && (
        <button
          type="button"
          className={styles.clearSearchBtn}
          onClick={() => onChange('')}
          aria-label="Xóa tìm kiếm"
        >
          <X size={13} />
        </button>
      )}
    </div>
  )
}

export default function AdminSpecialistReviewSection() {
  const { confirm, showActionToast } = useFeedback()
  const [filter, setFilter] = useState<SpecialistFilterTab>('PENDING')
  const [searchQuery, setSearchQuery] = useState('')
  const [items, setItems] = useState<SpecialistProfile[]>([])
  const [selected, setSelected] = useState<SpecialistProfile | null>(null)
  const [etag, setEtag] = useState<string | null>(null)
  const [amendments, setAmendments] = useState<ProfileAmendment[]>([])
  const [amendmentCount, setAmendmentCount] = useState<number | null>(null)
  const [amendment, setAmendment] = useState<{
    detail: ProfileAmendmentDetail
    etag: string | null
  } | null>(null)
  const [rejectionReason, setRejectionReason] =
    useState<SpecialistRejectionReason>('PROFILE_INFORMATION_INCOMPLETE')
  const [suspensionReason, setSuspensionReason] =
    useState<SpecialistSuspensionReason>('QUALITY_REVIEW_REQUIRED')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [stale, setStale] = useState(false)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true
    const done = () => {
      if (active) setLoading(false)
    }
    if (filter === 'AMENDMENTS') {
      browserConsultation
        .profileAmendments()
        .then((result) => {
          if (!active) return
          setAmendments(result.data.items)
          setAmendmentCount(result.data.count)
        })
        .catch((cause: unknown) => {
          if (active) setError(messageOf(cause, 'Không thể tải bản sửa đổi.'))
        })
        .finally(done)
    } else {
      browserConsultation
        .profiles(filter)
        .then((result) => {
          if (!active) return
          const list = result.data.items
          setItems(list)
          const targetId = new URLSearchParams(window.location.search).get('id')
          setSelected(
            list.find((item) => item.accountId === targetId) ?? list[0] ?? null,
          )
        })
        .catch((cause: unknown) => {
          if (active) setError(messageOf(cause, 'Không thể tải hồ sơ.'))
        })
        .finally(done)
    }
    return () => {
      active = false
    }
  }, [filter, reload])

  useEffect(() => {
    if (loading) return
    const url = new URL(window.location.href)
    const id = filter === 'AMENDMENTS' ? null : selected?.accountId
    if (id && url.searchParams.get('id') !== id) {
      url.searchParams.set('id', id)
      window.history.replaceState(null, '', url.toString())
    } else if (!id && url.searchParams.has('id')) {
      url.searchParams.delete('id')
      window.history.replaceState(null, '', url.toString())
    }
  }, [filter, loading, selected?.accountId])

  function changeFilter(tab: SpecialistFilterTab) {
    if (tab === filter) return
    setFilter(tab)
    setItems([])
    setSelected(null)
    setAmendment(null)
    setLoading(true)
    setEtag(null)
    setError('')
    setNotice('')
    setStale(false)
  }

  async function inspect(id: string) {
    setError('')
    setNotice('')
    try {
      const result = await browserConsultation.detail(id)
      setSelected(result.data)
      setEtag(result.etag)
    } catch (cause) {
      setError(messageOf(cause, 'Không thể tải hồ sơ.'))
    }
  }

  async function inspectAmendment(id: string) {
    setError('')
    setNotice('')
    setStale(false)
    try {
      const result = await browserConsultation.amendmentDetail(id)
      setAmendment({ detail: result.data, etag: result.etag })
    } catch (cause) {
      setError(messageOf(cause, 'Không thể tải bản sửa đổi.'))
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
    showActionToast({ title: message, tone: 'success' })
  }

  async function decide(action: 'APPROVE' | 'REJECT' | 'SUSPEND' | 'RESTORE') {
    if (!selected) return
    const activeEtag = etag ?? `"${selected.version}"`
    if (action === 'REJECT' || action === 'SUSPEND') {
      const confirmed = await confirm({
        title:
          action === 'REJECT'
            ? 'Từ chối hồ sơ chuyên gia?'
            : 'Tạm ngưng chuyên gia?',
        description:
          action === 'REJECT'
            ? 'Lý do đã chọn sẽ được lưu để chuyên gia chỉnh sửa và gửi lại hồ sơ.'
            : 'Các khung giờ khả dụng sẽ bị rút, cuộc hẹn liên quan bị hủy và buổi tư vấn được hoàn theo chính sách.',
        confirmLabel: action === 'REJECT' ? 'Từ chối hồ sơ' : 'Tạm ngưng',
        tone: 'danger',
      })
      if (!confirmed) return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (action === 'APPROVE') {
        await browserConsultation.approve(selected.accountId, activeEtag)
        completed('Đã phê duyệt và kích hoạt hồ sơ chuyên gia.')
      } else if (action === 'REJECT') {
        await browserConsultation.reject(
          selected.accountId,
          activeEtag,
          rejectionReason,
        )
        completed('Đã từ chối hồ sơ và lưu lý do để chuyên gia chỉnh sửa.')
      } else if (action === 'SUSPEND') {
        const result = await browserConsultation.suspend(
          selected.accountId,
          activeEtag,
          suspensionReason,
        )
        completed(
          `Đã tạm ngưng: rút ${result.data.effects.withdrawnAvailabilitySlots} lịch, hủy ${result.data.effects.cancelledAppointments} cuộc hẹn và hoàn ${result.data.effects.releasedCredits} buổi tư vấn.`,
        )
      } else {
        await browserConsultation.restore(selected.accountId, activeEtag)
        completed('Đã khôi phục trạng thái hoạt động của chuyên gia.')
      }
    } catch (cause) {
      setError(messageOf(cause, 'Không thể cập nhật hồ sơ.'))
    } finally {
      setBusy(false)
    }
  }

  async function decideAmendment(action: 'approve' | 'reject') {
    const current = amendment?.detail.amendment
    if (!amendment || !current) return
    const name = current.proposedProfile.displayName
    const confirmed = await confirm({
      title:
        action === 'approve'
          ? 'Phê duyệt và công khai bản chỉnh sửa?'
          : 'Từ chối bản chỉnh sửa hồ sơ?',
      description:
        action === 'approve'
          ? `Nội dung mới của ${name} sẽ thay thế hồ sơ đang công khai. Lịch hẹn và khung giờ tiếp nhận không bị thay đổi.`
          : `Lý do: ${rejectionLabels[rejectionReason]}. Bản hồ sơ đang công khai được giữ nguyên.`,
      confirmLabel:
        action === 'approve' ? 'Phê duyệt & Công khai' : 'Từ chối bản sửa đổi',
      tone: action === 'approve' ? 'warning' : 'danger',
    })
    if (!confirmed) return
    setBusy(true)
    setError('')
    try {
      await browserConsultation.decideAmendment(
        current.id,
        action,
        amendment.etag ?? `"${current.version}"`,
        action === 'reject' ? rejectionReason : undefined,
      )
      setAmendments((list) => list.filter((item) => item.id !== current.id))
      setAmendmentCount((count) => (count === null ? null : count - 1))
      setAmendment(null)
      const message =
        action === 'approve'
          ? `Đã công khai hồ sơ mới của ${name}.`
          : `Đã từ chối bản chỉnh sửa của ${name}.`
      setNotice(message)
      showActionToast({ title: message, tone: 'success' })
    } catch (cause) {
      if (cause instanceof BrowserConsultationError && cause.status === 412) {
        setStale(true)
        setError('Bản chỉnh sửa vừa thay đổi. Hãy tải lại danh sách.')
      } else {
        setError(messageOf(cause, 'Không thể cập nhật bản sửa đổi.'))
      }
    } finally {
      setBusy(false)
    }
  }

  const query = searchQuery.toLowerCase().trim()
  const filteredItems = items.filter(
    (item) =>
      !query ||
      item.displayName.toLowerCase().includes(query) ||
      item.supportAreas.some((area) =>
        supportLabels[area].toLowerCase().includes(query),
      ),
  )
  const filteredAmendments = amendments.filter(
    (item) =>
      !query || item.proposedProfile.displayName.toLowerCase().includes(query),
  )

  const tabCount = (tab: SpecialistFilterTab) => {
    if (tab === 'AMENDMENTS') return amendmentCount
    return tab === filter && !loading ? items.length : null
  }

  const rejectionSelect = (label: string) => (
    <div className={styles.rejectionFieldGroup}>
      <span className={styles.actionLabel}>Lý do nếu từ chối:</span>
      <select
        className={styles.rejectionSelect}
        aria-label={label}
        value={rejectionReason}
        onChange={(event) =>
          setRejectionReason(event.target.value as SpecialistRejectionReason)
        }
      >
        {Object.entries(rejectionLabels).map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </div>
  )

  const proposed = amendment?.detail.amendment?.proposedProfile
  const approved = amendment?.detail.approvedProfile

  return (
    <section className={styles.workspace}>
      <header className={styles.header}>
        <span>QUẢN LÝ CHUYÊN GIA</span>
        <h1>Vòng đời hồ sơ</h1>
        <p>
          Xét duyệt, từ chối, tạm ngưng và khôi phục bằng lý do vận hành đã được
          chuẩn hóa. Các yêu cầu cập nhật hồ sơ từ chuyên gia đang hoạt động
          được đối soát trực tiếp trong hàng chờ bên dưới.
        </p>
      </header>

      <nav className={styles.filters} aria-label="Lọc trạng thái hồ sơ">
        {(Object.keys(filterTabLabels) as SpecialistFilterTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            aria-pressed={filter === tab}
            onClick={() => changeFilter(tab)}
          >
            <span>{filterTabLabels[tab]}</span>
            {tabCount(tab) !== null && (
              <span className={styles.chipCount} aria-hidden="true">
                {tabCount(tab)}
              </span>
            )}
          </button>
        ))}
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
      {stale && (
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={() => {
            setStale(false)
            setError('')
            setAmendment(null)
            setLoading(true)
            setReload((value) => value + 1)
          }}
        >
          Tải lại danh sách
        </button>
      )}

      {filter === 'AMENDMENTS' ? (
        <div className={styles.layout}>
          <div className={styles.queue}>
            <div className={styles.queueHead}>
              <h2>Bản sửa đổi chờ duyệt</h2>
              <b>{filteredAmendments.length}</b>
            </div>
            <QueueSearch
              value={searchQuery}
              onChange={setSearchQuery}
              label="Tìm kiếm bản sửa đổi"
            />
            {loading ? (
              <p className={styles.queueEmpty}>Đang tải…</p>
            ) : filteredAmendments.length === 0 ? (
              <p className={styles.queueEmpty}>
                {query
                  ? 'Không tìm thấy bản sửa đổi phù hợp.'
                  : 'Không có bản chỉnh sửa nào chờ duyệt.'}
              </p>
            ) : (
              <div className={styles.queueList}>
                {filteredAmendments.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={styles.queueCard}
                    onClick={() => void inspectAmendment(item.id)}
                    aria-pressed={amendment?.detail.amendment?.id === item.id}
                  >
                    <div className={styles.cardTop}>
                      <div className={styles.avatarBox}>
                        {initialsOf(item.proposedProfile.displayName)}
                      </div>
                      <div className={styles.cardHeaderInfo}>
                        <strong>{item.proposedProfile.displayName}</strong>
                        {item.submittedAt && (
                          <span className={styles.affiliationText}>
                            Gửi {dateOf(item.submittedAt)}
                          </span>
                        )}
                      </div>
                      <span
                        className={`${styles.statusPill} ${styles.badgeAmendment}`}
                      >
                        Có bản sửa đổi
                      </span>
                    </div>
                    <div className={styles.tagRow}>
                      {item.proposedProfile.supportAreas.map((area) => (
                        <span key={area} className={styles.specTag}>
                          {supportLabels[area]}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className={styles.regulatoryCallout}>
              <div className={styles.regulatoryIcon}>
                <Info size={20} />
              </div>
              <div className={styles.regulatoryContent}>
                <h4>QUY CHUẨN DUYỆT SỬA ĐỔI THÔNG TIN</h4>
                <p>
                  Chuyên gia vẫn tiếp nhận phiên tư vấn bình thường theo hồ sơ
                  cũ. Bản sửa đổi chỉ có hiệu lực sau khi được duyệt và công
                  khai.
                </p>
              </div>
            </div>
          </div>

          <article className={styles.detail}>
            {amendment && proposed && approved ? (
              <>
                <div className={styles.detailHead}>
                  <div className={styles.headTitles}>
                    <h2>{proposed.displayName}</h2>
                    {amendment.detail.amendment?.submittedAt && (
                      <p>
                        Gửi bản sửa đổi{' '}
                        {dateOf(amendment.detail.amendment.submittedAt)}
                      </p>
                    )}
                  </div>
                  <span
                    className={`${styles.statusPill} ${styles.badgeAmendment}`}
                  >
                    Chờ duyệt sửa đổi
                  </span>
                </div>

                <div className={styles.diffList}>
                  {amendmentFields.map((field) => {
                    const before = field.value(approved)
                    const after = field.value(proposed)
                    const changed = before !== after
                    return (
                      <div key={field.label} className={styles.diffCard}>
                        <div className={styles.diffHeader}>
                          <h4>{field.label}</h4>
                          {changed ? (
                            <span className={styles.diffChangedBadge}>
                              <Sparkles size={11} aria-hidden="true" /> Có thay
                              đổi
                            </span>
                          ) : (
                            <span className={styles.diffUnchangedBadge}>
                              Giữ nguyên
                            </span>
                          )}
                        </div>
                        {changed ? (
                          <div className={styles.diffGrid}>
                            <div className={styles.diffColOld}>
                              <span className={styles.diffColLabel}>
                                Đang công khai
                              </span>
                              <p className={styles.diffText}>{before}</p>
                            </div>
                            <div className={styles.diffColNew}>
                              <span
                                className={`${styles.diffColLabel} ${styles.diffColLabelNew}`}
                              >
                                Đề xuất cập nhật mới
                              </span>
                              <p className={styles.diffText}>{after}</p>
                            </div>
                          </div>
                        ) : (
                          <p className={styles.diffText}>{after}</p>
                        )}
                      </div>
                    )
                  })}
                </div>

                <AdminCredentialReviewSection
                  specialistId={approved.accountId}
                />

                <div className={styles.decisionCard}>
                  <div className={styles.sectionHeading}>
                    <h3>QUYẾT ĐỊNH XÉT DUYỆT BẢN SỬA ĐỔI</h3>
                  </div>
                  <div className={styles.decisionActionsRow}>
                    {rejectionSelect('Lý do từ chối bản chỉnh sửa')}
                    <div className={styles.actionButtonsGroup}>
                      <button
                        type="button"
                        className={styles.btnDanger}
                        disabled={busy || stale}
                        onClick={() => void decideAmendment('reject')}
                      >
                        Từ chối bản sửa đổi
                      </button>
                      <button
                        type="button"
                        className={styles.btnApprove}
                        disabled={busy || stale}
                        onClick={() => void decideAmendment('approve')}
                      >
                        Phê duyệt & Công khai bản mới
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.emptyState}>
                <strong>Chọn một bản sửa đổi để đối soát</strong>
                <p>
                  Chọn một chuyên gia từ danh sách bên trái để so sánh bản đang
                  công khai với bản đề xuất mới.
                </p>
              </div>
            )}
          </article>
        </div>
      ) : (
        <div className={styles.layout}>
          <div className={styles.queue}>
            <div className={styles.queueHead}>
              <h2>{filterTabLabels[filter]}</h2>
              <b>{filteredItems.length}</b>
            </div>
            <QueueSearch
              value={searchQuery}
              onChange={setSearchQuery}
              label="Tìm kiếm trong danh sách hồ sơ chuyên gia"
            />
            {loading ? (
              <p className={styles.queueEmpty}>Đang tải…</p>
            ) : filteredItems.length === 0 ? (
              <p className={styles.queueEmpty}>
                {query
                  ? 'Không tìm thấy hồ sơ phù hợp.'
                  : 'Không có hồ sơ ở trạng thái này.'}
              </p>
            ) : (
              <div className={styles.queueList}>
                {filteredItems.map((item) => (
                  <button
                    key={item.accountId}
                    type="button"
                    className={styles.queueCard}
                    onClick={() => void inspect(item.accountId)}
                    aria-pressed={selected?.accountId === item.accountId}
                  >
                    <div className={styles.cardTop}>
                      <div className={styles.avatarBox}>
                        {initialsOf(item.displayName)}
                      </div>
                      <div className={styles.cardHeaderInfo}>
                        <strong>{item.displayName}</strong>
                        {item.submittedAt && (
                          <span className={styles.affiliationText}>
                            Gửi {dateOf(item.submittedAt)}
                          </span>
                        )}
                      </div>
                      <span
                        className={`${styles.statusPill} ${statusPillClass(
                          item.approvalStatus,
                        )}`}
                      >
                        {filterTabLabels[item.approvalStatus]}
                      </span>
                    </div>
                    <div className={styles.tagRow}>
                      {item.supportAreas.map((area) => (
                        <span key={area} className={styles.specTag}>
                          {supportLabels[area]}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <article className={styles.detail}>
            {selected ? (
              <>
                <div className={styles.detailHead}>
                  <div className={styles.headTitles}>
                    <h2>{selected.displayName}</h2>
                    {selected.submittedAt && (
                      <p>Gửi hồ sơ {dateOf(selected.submittedAt)}</p>
                    )}
                  </div>
                  <span
                    className={`${styles.statusPill} ${statusPillClass(
                      selected.approvalStatus,
                    )}`}
                  >
                    {filterTabLabels[selected.approvalStatus]}
                  </span>
                </div>

                <p className={styles.detailBio}>&ldquo;{selected.bio}&rdquo;</p>

                <dl className={styles.metaGrid}>
                  <div className={styles.metaCard}>
                    <dt>Lĩnh vực hỗ trợ</dt>
                    <dd>
                      {selected.supportAreas
                        .map((area) => supportLabels[area])
                        .join(', ')}
                    </dd>
                  </div>
                  <div className={styles.metaCard}>
                    <dt>Ngôn ngữ</dt>
                    <dd>{selected.languages.join(', ').toUpperCase()}</dd>
                  </div>
                  <div className={styles.metaCard}>
                    <dt>Kinh nghiệm</dt>
                    <dd>{selected.yearsOfExperience} năm</dd>
                  </div>
                  <div className={styles.metaCard}>
                    <dt>Múi giờ</dt>
                    <dd>{selected.timezone}</dd>
                  </div>
                </dl>

                <AdminCredentialReviewSection
                  specialistId={selected.accountId}
                />

                {selected.approvalStatus !== 'REJECTED' && (
                  <div className={styles.decisionCard}>
                    <div className={styles.sectionHeading}>
                      <h3>QUYẾT ĐỊNH XÉT DUYỆT</h3>
                    </div>

                    {selected.approvalStatus === 'PENDING' && (
                      <div className={styles.decisionActionsRow}>
                        {rejectionSelect('Lý do từ chối')}
                        <div className={styles.actionButtonsGroup}>
                          <button
                            type="button"
                            className={styles.btnDanger}
                            disabled={busy}
                            onClick={() => void decide('REJECT')}
                          >
                            Từ chối hồ sơ
                          </button>
                          <button
                            type="button"
                            className={styles.btnApprove}
                            disabled={busy}
                            aria-label="Phê duyệt hồ sơ"
                            onClick={() => void decide('APPROVE')}
                          >
                            Phê duyệt & Kích hoạt
                          </button>
                        </div>
                      </div>
                    )}

                    {selected.approvalStatus === 'APPROVED' && (
                      <div className={styles.decisionActionsRow}>
                        <div className={styles.rejectionFieldGroup}>
                          <span className={styles.actionLabel}>
                            Lý do tạm ngưng:
                          </span>
                          <select
                            className={styles.rejectionSelect}
                            aria-label="Lý do tạm ngưng"
                            value={suspensionReason}
                            onChange={(event) =>
                              setSuspensionReason(
                                event.target
                                  .value as SpecialistSuspensionReason,
                              )
                            }
                          >
                            {Object.entries(suspensionLabels).map(
                              ([value, text]) => (
                                <option key={value} value={value}>
                                  {text}
                                </option>
                              ),
                            )}
                          </select>
                        </div>
                        <div className={styles.actionButtonsGroup}>
                          <button
                            type="button"
                            className={styles.btnDanger}
                            disabled={busy}
                            onClick={() => void decide('SUSPEND')}
                          >
                            Tạm ngưng chuyên gia
                          </button>
                        </div>
                      </div>
                    )}

                    {selected.approvalStatus === 'SUSPENDED' && (
                      <div className={styles.decisionActionsRow}>
                        <button
                          type="button"
                          className={styles.btnApprove}
                          disabled={busy}
                          onClick={() => void decide('RESTORE')}
                        >
                          Khôi phục chuyên gia
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className={styles.emptyState}>
                <strong>Chọn một hồ sơ chuyên gia</strong>
                <p>
                  Chọn một chuyên gia từ danh sách bên trái để xem hồ sơ và giấy
                  tờ đã tải lên.
                </p>
              </div>
            )}
          </article>
        </div>
      )}
    </section>
  )
}
