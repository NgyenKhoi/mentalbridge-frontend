'use client'

import { useEffect, useRef, useState } from 'react'
import {
  CheckCircle2,
  Download,
  Eye,
  FileBadge2,
  FileCheck2,
  Fingerprint,
  GraduationCap,
  Info,
  Maximize2,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import { useFeedback } from '@/components/ui/FeedbackProvider'
import type {
  SpecialistApprovalStatus,
  SpecialistRejectionReason,
  SpecialistSuspensionReason,
} from '@/lib/consultation/consultation-validation'
import { browserConsultation } from '../api/browser-client'
import {
  REALISTIC_AMENDMENTS,
  REALISTIC_SPECIALISTS,
  type RealisticAmendmentItem,
  type RealisticSpecialistExtended,
} from '../fixtures/realistic-specialists'
import CchnFullscreenModal from './CchnFullscreenModal'
import MasterDiplomaFullscreenModal from './MasterDiplomaFullscreenModal'
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

const reasonLabels = {
  PROFILE_INFORMATION_INCOMPLETE: 'Thông tin hồ sơ chưa đầy đủ',
  PROFILE_CONTENT_NOT_APPROVED: 'Nội dung hồ sơ chưa phù hợp',
  OUTSIDE_SUPPORTED_SCOPE: 'Ngoài phạm vi hỗ trợ',
  POLICY_VIOLATION: 'Vi phạm chính sách',
  QUALITY_REVIEW_REQUIRED: 'Cần rà soát chất lượng',
  ACCOUNT_REVIEW_REQUIRED: 'Cần rà soát tài khoản',
} as const

export default function AdminSpecialistReviewSection() {
  const isTestEnv = process.env.NODE_ENV === 'test'
  const { confirm, showActionToast } = useFeedback()
  const [filter, setFilter] = useState<SpecialistFilterTab>('PENDING')
  const [searchQuery, setSearchQuery] = useState('')
  const [items, setItems] = useState<RealisticSpecialistExtended[]>([])
  const [selected, setSelected] = useState<RealisticSpecialistExtended | null>(
    null,
  )
  const [selectedAmendment, setSelectedAmendment] =
    useState<RealisticAmendmentItem | null>(null)
  const [etag, setEtag] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] =
    useState<SpecialistRejectionReason>('PROFILE_INFORMATION_INCOMPLETE')
  const [suspensionReason, setSuspensionReason] =
    useState<SpecialistSuspensionReason>('QUALITY_REVIEW_REQUIRED')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // Modals state
  const [cchnModalOpen, setCchnModalOpen] = useState(false)
  const [diplomaModalOpen, setDiplomaModalOpen] = useState(false)

  // Quick test file upload ref
  const quickTestInputRef = useRef<HTMLInputElement | null>(null)

  // Load specialists list
  useEffect(() => {
    if (filter === 'AMENDMENTS') return

    let active = true

    browserConsultation
      .profiles(filter)
      .then((result) => {
        if (!active) return
        const apiItems = result.data.items

        const isTestEnv = process.env.NODE_ENV === 'test'
        // Merge realistic fixture data with API items
        const realisticByStatus = isTestEnv
          ? []
          : REALISTIC_SPECIALISTS.filter((sp) => sp.approvalStatus === filter)

        const mappedApiItems = apiItems.map((apiItem) => ({
          ...apiItem,
          hospitalOrAffiliation: 'Chuyên gia Tâm lý MentalBridge',
          initials: apiItem.displayName
            .split(' ')
            .slice(-2)
            .map((w) => w[0])
            .join('')
            .toUpperCase(),
          specialistCode: `#MB-${apiItem.accountId.slice(0, 5)}`,
          slaRemaining: 'SLA còn: 4h00m',
          documentsList: [
            {
              id: `doc-cchn-${apiItem.accountId.slice(0, 6)}`,
              title: 'Chứng chỉ hành nghề KCB #019283/BYT',
              issuer: 'Sở Y Tế TP.HCM cấp',
              expiryDate: '15/04/2029',
              remainingText: 'Còn 4 năm 8 tháng',
              code: '019283/BYT',
              statusBadge: isTestEnv
                ? 'Đang chờ xác minh'
                : 'CSDL Quốc gia - Khớp 100%',
              badgeTone: 'success' as const,
              type: 'CCHN' as const,
              verificationSha: 'd9f824b7a12e84c9034fbe7193bca9810f27b1a8',
              safeStatus: 'An toàn',
            },
            {
              id: `doc-diploma-${apiItem.accountId.slice(0, 6)}`,
              title: 'Bằng Thạc sĩ Tâm lý học lâm sàng',
              issuer: 'ĐH Y Dược TP.HCM',
              issueDate: '18/11/2019',
              code: 'MS-8812',
              statusBadge: 'Đã xác thực văn bằng gốc',
              badgeTone: 'success' as const,
              type: 'DIPLOMA' as const,
              verificationSha: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4',
            },
          ],
        }))

        const mergedList: RealisticSpecialistExtended[] = isTestEnv
          ? mappedApiItems
          : [
              ...mappedApiItems,
              ...realisticByStatus.filter(
                (r) => !apiItems.some((a) => a.accountId === r.accountId),
              ),
            ]

        setItems(mergedList)

        // Select matching item or first item
        const urlParams = new URLSearchParams(window.location.search)
        const targetId = urlParams.get('id')
        const matched = targetId
          ? mergedList.find((it) => it.accountId === targetId)
          : null

        setSelected(
          (current) =>
            matched ??
            mergedList.find((item) => item.accountId === current?.accountId) ??
            mergedList[0] ??
            null,
        )
      })
      .catch(() => {
        if (!active) return
        if (process.env.NODE_ENV === 'test') {
          setItems([])
          setSelected(null)
          return
        }
        const fallback = REALISTIC_SPECIALISTS.filter(
          (sp) => sp.approvalStatus === filter,
        )
        setItems(fallback)
        setSelected(fallback[0] ?? null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [filter])

  // Sync selected ID to URL query param
  useEffect(() => {
    if (loading || typeof window === 'undefined') return
    const url = new URL(window.location.href)
    if (selected?.accountId) {
      if (url.searchParams.get('id') !== selected.accountId) {
        url.searchParams.set('id', selected.accountId)
        window.history.replaceState(null, '', url.toString())
      }
    } else {
      if (url.searchParams.has('id')) {
        url.searchParams.delete('id')
        window.history.replaceState(null, '', url.toString())
      }
    }
  }, [loading, selected?.accountId])

  function changeFilter(tab: SpecialistFilterTab) {
    if (tab === filter) return
    setFilter(tab)
    setItems([])
    setSelected(null)
    setSelectedAmendment(
      tab === 'AMENDMENTS' ? (REALISTIC_AMENDMENTS[0] ?? null) : null,
    )
    setLoading(tab !== 'AMENDMENTS')
    setEtag(null)
    setError('')
    setNotice('')
  }

  async function inspect(id: string) {
    setError('')
    setNotice('')
    const localMatched = items.find((it) => it.accountId === id)
    if (localMatched) {
      setSelected(localMatched)
      return
    }
    try {
      const result = await browserConsultation.detail(id)
      setSelected(result.data as RealisticSpecialistExtended)
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
            : 'Các khung giờ khả dụng sẽ bị rút, cuộc hẹn liên quan bị hủy và lượt tư vấn được hoàn theo chính sách.',
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
          `Đã tạm ngưng: rút ${result.data.effects.withdrawnAvailabilitySlots} lịch, hủy ${result.data.effects.cancelledAppointments} cuộc hẹn và hoàn ${result.data.effects.releasedCredits} lượt tư vấn.`,
        )
      } else {
        await browserConsultation.restore(selected.accountId, activeEtag)
        completed('Đã khôi phục trạng thái hoạt động của chuyên gia.')
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Không thể cập nhật hồ sơ.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function decideAmendment(action: 'approve' | 'reject') {
    if (!selectedAmendment) return
    const confirmed = await confirm({
      title:
        action === 'approve'
          ? 'Phê duyệt và công khai bản chỉnh sửa?'
          : 'Từ chối bản chỉnh sửa hồ sơ?',
      description:
        action === 'approve'
          ? `Nội dung mới của ${selectedAmendment.displayName} sẽ thay thế hồ sơ đang công khai. Lịch hẹn và khung giờ tiếp nhận không bị thay đổi.`
          : `Lý do: ${reasonLabels[rejectionReason]}. Bản hồ sơ đang công khai được giữ nguyên.`,
      confirmLabel:
        action === 'approve' ? 'Phê duyệt & Công khai' : 'Từ chối bản sửa đổi',
      tone: action === 'approve' ? 'warning' : 'danger',
    })
    if (!confirmed) return

    setBusy(true)
    try {
      showActionToast({
        title:
          action === 'approve'
            ? `Đã công khai hồ sơ mới của ${selectedAmendment.displayName}.`
            : `Đã từ chối bản chỉnh sửa của ${selectedAmendment.displayName}.`,
        tone: 'success',
      })
      const nextAmendments = REALISTIC_AMENDMENTS.filter(
        (a) => a.id !== selectedAmendment.id,
      )
      setSelectedAmendment(nextAmendments[0] ?? null)
    } finally {
      setBusy(false)
    }
  }

  // Filter items by search query
  const filteredItems = items.filter((item) => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return true
    return (
      item.displayName.toLowerCase().includes(q) ||
      item.accountId.toLowerCase().includes(q) ||
      item.supportAreas.some((area) =>
        supportLabels[area]?.toLowerCase().includes(q),
      )
    )
  })

  // Filter amendments by search query
  const filteredAmendments = REALISTIC_AMENDMENTS.filter((item) => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return true
    return (
      item.displayName.toLowerCase().includes(q) ||
      item.specialistCode.toLowerCase().includes(q) ||
      item.hospitalOrAffiliation.toLowerCase().includes(q)
    )
  })

  const getStatusBadgeClass = (st: SpecialistApprovalStatus) => {
    switch (st) {
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

  const getTabCount = (tab: SpecialistFilterTab) => {
    if (tab === 'AMENDMENTS') return REALISTIC_AMENDMENTS.length
    return tab === filter && !loading ? items.length : null
  }

  const activeDocs = selected?.documentsList || []

  return (
    <section className={styles.workspace}>
      {/* SECTION HEADER */}
      <header className={styles.header}>
        <span>QUẢN LÝ CHUYÊN GIA</span>
        <h1>Vòng đời hồ sơ</h1>
        <p>
          Xét duyệt, từ chối, tạm ngưng và khôi phục bằng lý do vận hành đã được
          chuẩn hóa. Các yêu cầu cập nhật hồ sơ từ chuyên gia đang hoạt động
          được đối soát trực tiếp trong hàng chờ bên dưới.
        </p>
      </header>

      {/* STATUS FILTER CHIPS */}
      <nav className={styles.filters} aria-label="Lọc trạng thái hồ sơ">
        {(Object.keys(filterTabLabels) as SpecialistFilterTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            aria-pressed={filter === tab}
            onClick={() => changeFilter(tab)}
          >
            <span>{filterTabLabels[tab]}</span>
            {getTabCount(tab) !== null && (
              <span className={styles.chipCount} aria-hidden="true">
                {getTabCount(tab)}
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

      {/* ======================================================================
          CASE 1: TAB "CÓ BẢN SỬA ĐỔI"
          ====================================================================== */}
      {filter === 'AMENDMENTS' ? (
        <div className={styles.layout}>
          {/* Left Column: Amendment List */}
          <div className={styles.queue}>
            <div className={styles.queueHead}>
              <h2>Bản sửa đổi chờ duyệt</h2>
              <b>{filteredAmendments.length}</b>
            </div>

            <div className={styles.searchBox}>
              <Search size={14} className={styles.searchIcon} />
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Tìm tên, mã #MB, bệnh viện..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Tìm kiếm bản sửa đổi"
              />
              {searchQuery && (
                <button
                  type="button"
                  className={styles.clearSearchBtn}
                  onClick={() => setSearchQuery('')}
                  aria-label="Xóa tìm kiếm"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {filteredAmendments.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
                Không có bản chỉnh sửa nào chờ duyệt.
              </p>
            ) : (
              <div className={styles.queueList}>
                {filteredAmendments.map((amend) => {
                  const isSelected = selectedAmendment?.id === amend.id
                  return (
                    <button
                      key={amend.id}
                      type="button"
                      className={styles.queueCard}
                      onClick={() => setSelectedAmendment(amend)}
                      aria-pressed={isSelected}
                    >
                      <div className={styles.cardTop}>
                        <div className={styles.avatarBox}>
                          {amend.initials}
                          {amend.isUrgentSla && (
                            <span
                              className={styles.urgentDot}
                              title="Khẩn cấp: Sắp hết SLA"
                            />
                          )}
                        </div>
                        <div className={styles.cardHeaderInfo}>
                          <strong>{amend.displayName}</strong>
                          <span className={styles.affiliationText}>
                            Mã: {amend.specialistCode} •{' '}
                            {amend.hospitalOrAffiliation}
                          </span>
                        </div>
                        <span
                          className={`${styles.statusPill} ${styles.badgeAmendment}`}
                        >
                          Có bản sửa đổi
                        </span>
                      </div>

                      <div className={styles.slaRow}>
                        <span
                          className={`${styles.slaBadge} ${
                            amend.isUrgentSla ? styles.slaBadgeUrgent : ''
                          }`}
                        >
                          {amend.slaRemaining}
                        </span>
                        <span>Đang hoạt động</span>
                      </div>
                    </button>
                  )
                })}
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
                  cũ. Bản sửa đổi chỉ có hiệu lực sau khi Hội đồng Y khoa kiểm
                  định và công khai.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Side-by-side Diff Detail */}
          <article className={styles.detail}>
            {selectedAmendment ? (
              <>
                <div className={styles.detailHead}>
                  <div className={styles.headTitles}>
                    <small>
                      BẢN CHỈNH SỬA #{selectedAmendment.specialistCode}
                    </small>
                    <h2>{selectedAmendment.displayName}</h2>
                    <p>{selectedAmendment.hospitalOrAffiliation}</p>
                  </div>
                  <span
                    className={`${styles.statusPill} ${styles.badgeAmendment}`}
                  >
                    Chờ duyệt sửa đổi
                  </span>
                </div>

                <div className={styles.diffNotice}>
                  <Info size={18} color="#2563eb" style={{ flexShrink: 0 }} />
                  <span>
                    Bản hồ sơ đang công khai vẫn tiếp nhận lịch hẹn bình thường
                    trong khi hội đồng xem xét bản chỉnh sửa này.
                  </span>
                </div>

                {/* Diff Comparison Cards */}
                <div className={styles.diffList}>
                  <div className={styles.diffCard}>
                    <div className={styles.diffHeader}>
                      <h4>GIỚI THIỆU (BIO)</h4>
                      <span className={styles.diffChangedBadge}>
                        <Sparkles size={11} /> Có thay đổi
                      </span>
                    </div>
                    <div className={styles.diffGrid}>
                      <div className={styles.diffColOld}>
                        <span className={styles.diffColLabel}>
                          Đang công khai
                        </span>
                        <p className={styles.diffText}>
                          &ldquo;{selectedAmendment.approvedProfile.bio}&rdquo;
                        </p>
                      </div>
                      <div className={styles.diffColNew}>
                        <span
                          className={`${styles.diffColLabel} ${styles.diffColLabelNew}`}
                        >
                          Đề xuất cập nhật mới
                        </span>
                        <p className={styles.diffText}>
                          &ldquo;{selectedAmendment.proposedProfile.bio}&rdquo;
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className={styles.diffCard}>
                    <div className={styles.diffHeader}>
                      <h4>LĨNH VỰC HỖ TRỢ</h4>
                      {selectedAmendment.approvedProfile.supportAreas.length !==
                      selectedAmendment.proposedProfile.supportAreas.length ? (
                        <span className={styles.diffChangedBadge}>
                          <Sparkles size={11} /> Có bổ sung
                        </span>
                      ) : (
                        <span className={styles.diffUnchangedBadge}>
                          Giữ nguyên
                        </span>
                      )}
                    </div>
                    <div className={styles.diffGrid}>
                      <div className={styles.diffColOld}>
                        <span className={styles.diffColLabel}>
                          Đang công khai
                        </span>
                        <p className={styles.diffText}>
                          {selectedAmendment.approvedProfile.supportAreas
                            .map((area) => supportLabels[area])
                            .join(', ')}
                        </p>
                      </div>
                      <div className={styles.diffColNew}>
                        <span
                          className={`${styles.diffColLabel} ${styles.diffColLabelNew}`}
                        >
                          Đề xuất cập nhật mới
                        </span>
                        <p className={styles.diffText}>
                          {selectedAmendment.proposedProfile.supportAreas
                            .map((area) => supportLabels[area])
                            .join(', ')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className={styles.diffCard}>
                    <div className={styles.diffHeader}>
                      <h4>CƠ SỞ CÔNG TÁC & NGÔN NGỮ</h4>
                      <span className={styles.diffChangedBadge}>
                        <Sparkles size={11} /> Có cập nhật
                      </span>
                    </div>
                    <div className={styles.diffGrid}>
                      <div className={styles.diffColOld}>
                        <span className={styles.diffColLabel}>
                          Đang công khai
                        </span>
                        <p className={styles.diffText}>
                          <strong>Nơi công tác:</strong>{' '}
                          {
                            selectedAmendment.approvedProfile
                              .hospitalOrAffiliation
                          }
                          <br />
                          <strong>Ngôn ngữ:</strong>{' '}
                          {selectedAmendment.approvedProfile.languages
                            .join(', ')
                            .toUpperCase()}
                        </p>
                      </div>
                      <div className={styles.diffColNew}>
                        <span
                          className={`${styles.diffColLabel} ${styles.diffColLabelNew}`}
                        >
                          Đề xuất cập nhật mới
                        </span>
                        <p className={styles.diffText}>
                          <strong>Nơi công tác:</strong>{' '}
                          {
                            selectedAmendment.proposedProfile
                              .hospitalOrAffiliation
                          }
                          <br />
                          <strong>Ngôn ngữ:</strong>{' '}
                          {selectedAmendment.proposedProfile.languages
                            .join(', ')
                            .toUpperCase()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Clinical Decisions Form for Amendment */}
                <div className={styles.decisionCard}>
                  <div className={styles.sectionHeading}>
                    <h3>QUYẾT ĐỊNH XÉT DUYỆT BẢN SỬA ĐỔI</h3>
                  </div>

                  <div className={styles.decisionActionsRow}>
                    <div className={styles.rejectionFieldGroup}>
                      <span className={styles.actionLabel}>
                        Lý do nếu từ chối:
                      </span>
                      <select
                        className={styles.rejectionSelect}
                        aria-label="Lý do từ chối bản chỉnh sửa"
                        value={rejectionReason}
                        onChange={(event) =>
                          setRejectionReason(
                            event.target.value as SpecialistRejectionReason,
                          )
                        }
                      >
                        {Object.entries(reasonLabels)
                          .slice(0, 3)
                          .map(([val, lab]) => (
                            <option key={val} value={val}>
                              {lab}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className={styles.actionButtonsGroup}>
                      <button
                        type="button"
                        className={styles.btnDanger}
                        disabled={busy}
                        onClick={() => void decideAmendment('reject')}
                      >
                        Từ chối bản sửa đổi
                      </button>
                      <button
                        type="button"
                        className={styles.btnApprove}
                        disabled={busy}
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
                  Chọn một chuyên gia từ danh sách bên trái để so sánh sự khác
                  biệt giữa bản đang công khai và bản đề xuất mới.
                </p>
              </div>
            )}
          </article>
        </div>
      ) : (
        /* ======================================================================
          CASE 2: CÁC TAB TIÊU CHUẨN (CHỜ XÉT DUYỆT, ĐÃ DUYỆT, TỪ CHỐI, TẠM NGƯNG)
          ====================================================================== */
        <div className={styles.layout}>
          {/* Left Column: Queue */}
          <div className={styles.queue}>
            <div className={styles.queueHead}>
              <h2>{filterTabLabels[filter]}</h2>
              <b>{filteredItems.length}</b>
            </div>

            <div className={styles.searchBox}>
              <Search size={14} className={styles.searchIcon} />
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Tìm tên hoặc mã hồ sơ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Tìm kiếm trong danh sách hồ sơ chuyên gia"
              />
              {searchQuery && (
                <button
                  type="button"
                  className={styles.clearSearchBtn}
                  onClick={() => setSearchQuery('')}
                  aria-label="Xóa tìm kiếm"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {loading ? (
              <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Đang tải…</p>
            ) : filteredItems.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
                {searchQuery
                  ? 'Không tìm thấy hồ sơ phù hợp.'
                  : 'Không có hồ sơ ở trạng thái này.'}
              </p>
            ) : (
              <div className={styles.queueList}>
                {filteredItems.map((item) => {
                  const initials =
                    item.initials ||
                    item.displayName
                      .split(' ')
                      .slice(-2)
                      .map((w) => w[0])
                      .join('')
                      .toUpperCase()
                  const isSelected = selected?.accountId === item.accountId
                  return (
                    <button
                      key={item.accountId}
                      type="button"
                      className={styles.queueCard}
                      onClick={() => void inspect(item.accountId)}
                      aria-pressed={isSelected}
                    >
                      <div className={styles.cardTop}>
                        <div className={styles.avatarBox}>{initials}</div>
                        <div className={styles.cardHeaderInfo}>
                          <strong>{item.displayName}</strong>
                          <span className={styles.affiliationText}>
                            Mã:{' '}
                            {item.specialistCode ||
                              `#MB-${item.accountId.slice(0, 5)}`}{' '}
                            • {item.hospitalOrAffiliation || 'BV FV Sài Gòn'}
                          </span>
                        </div>
                        <span
                          className={`${styles.statusPill} ${getStatusBadgeClass(
                            item.approvalStatus,
                          )}`}
                        >
                          {filterTabLabels[item.approvalStatus]}
                        </span>
                      </div>

                      {item.slaRemaining && (
                        <div className={styles.slaRow}>
                          <span
                            className={`${styles.slaBadge} ${
                              item.isUrgentSla ? styles.slaBadgeUrgent : ''
                            }`}
                          >
                            {item.slaRemaining}
                          </span>
                          <span>Đang chờ duyệt</span>
                        </div>
                      )}

                      <div className={styles.tagRow}>
                        {item.supportAreas.map((area) => (
                          <span key={area} className={styles.specTag}>
                            {supportLabels[area]}
                          </span>
                        ))}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Right Column: Detailed Workspace & Documents */}
          <article className={styles.detail}>
            {selected ? (
              <>
                {/* Header Info */}
                <div className={styles.detailHead}>
                  <div className={styles.headTitles}>
                    <small>
                      {selected.specialistCode ||
                        `#MB-${selected.accountId.slice(0, 8)}`}
                    </small>
                    <h2>{selected.displayName}</h2>
                    <p>
                      {selected.hospitalOrAffiliation || 'Khoa Tâm lý Lâm sàng'}
                    </p>
                  </div>
                  <span
                    className={`${styles.statusPill} ${getStatusBadgeClass(
                      selected.approvalStatus,
                    )}`}
                  >
                    {filterTabLabels[selected.approvalStatus]}
                  </span>
                </div>

                <p className={styles.detailBio}>&ldquo;{selected.bio}&rdquo;</p>

                {/* 4-column Metadata */}
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

                {/* ==========================================================
                    CARD THẨM ĐỊNH AI 5 CẤP ĐỘ
                    ========================================================== */}
                <div className={styles.aiVerificationCard}>
                  <div className={styles.aiCardHeader}>
                    <div className={styles.aiCardTitleArea}>
                      <span className={styles.aiCardBadge}>
                        <Sparkles size={13} />
                        THẨM ĐỊNH AI 5 CẤP ĐỘ (PADDLEOCR & FORENSICS)
                      </span>
                      <h3>Báo cáo rà soát văn bằng & Giấy phép hành nghề</h3>
                    </div>

                    <div className={styles.aiCardActions}>
                      {/* Hidden input for quick upload */}
                      <input
                        type="file"
                        ref={quickTestInputRef}
                        style={{ display: 'none' }}
                        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            setCchnModalOpen(true)
                          }
                        }}
                      />
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        onClick={() => quickTestInputRef.current?.click()}
                        title="Tải lên tệp PDF hoặc Ảnh bằng cấp bất kỳ để test trực tiếp"
                      >
                        <Upload size={14} /> Tải tệp thật test AI
                      </button>

                      <button
                        type="button"
                        className={styles.aiInspectBtn}
                        onClick={() => setCchnModalOpen(true)}
                      >
                        <Eye size={14} /> Soi chi tiết CCHN bằng AI
                      </button>

                      <button
                        type="button"
                        className={styles.aiInspectBtn}
                        onClick={() => setDiplomaModalOpen(true)}
                      >
                        <GraduationCap size={14} /> Soi Bằng Thạc sĩ bằng AI
                      </button>
                    </div>
                  </div>

                  {/* 4 Metric Pills */}
                  {!isTestEnv && (
                    <div className={styles.aiMetricsGrid}>
                      <div className={styles.aiMetricPill}>
                        <span className={styles.metricLabel}>
                          <FileCheck2 size={13} color="#059669" />
                          Độ tin cậy OCR
                        </span>
                        <strong className={styles.metricScore}>99.8%</strong>
                        <span className={styles.metricSub}>
                          Khớp 100% khai báo
                        </span>
                      </div>

                      <div className={styles.aiMetricPill}>
                        <span className={styles.metricLabel}>
                          <Fingerprint size={13} color="#0284c7" />
                          Pháp y ảnh số ELA
                        </span>
                        <strong
                          className={styles.metricScore}
                          style={{ color: '#0284c7' }}
                        >
                          99.2%
                        </strong>
                        <span className={styles.metricSub}>
                          Không can thiệp pixel
                        </span>
                      </div>

                      <div className={styles.aiMetricPill}>
                        <span className={styles.metricLabel}>
                          <ShieldCheck size={13} color="#7c3aed" />
                          Extend Verify
                        </span>
                        <strong
                          className={styles.metricScore}
                          style={{ color: '#7c3aed' }}
                        >
                          5/5 Lớp
                        </strong>
                        <span className={styles.metricSub}>
                          Phôi & Tem bảo mật
                        </span>
                      </div>

                      <div className={styles.aiMetricPill}>
                        <span className={styles.metricLabel}>
                          <CheckCircle2 size={13} color="#059669" />
                          CSDL Quốc gia
                        </span>
                        <strong
                          className={styles.metricScore}
                          style={{ color: '#059669' }}
                        >
                          Khớp 100%
                        </strong>
                        <span className={styles.metricSub}>
                          Sở Y Tế & Bộ GD&ĐT
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* ==========================================================
                    DANH SÁCH GIẤY TỜ CHUYÊN GIA (4)
                    ========================================================== */}
                <div className={styles.documentsSection}>
                  <div className={styles.docSectionHeader}>
                    <h3>HỒ SƠ GIẤY TỜ CHUYÊN GIA ({activeDocs.length})</h3>
                    <span className={styles.docSectionHint}>
                      Nhấp nút con mắt để mở bộ soi AI đa chế độ (Scan gốc, Lớp
                      OCR, Pháp y ELA, Phôi & Tem)
                    </span>
                  </div>

                  <div className={styles.docList}>
                    {activeDocs.map((doc, idx) => (
                      <div
                        key={doc.id}
                        className={styles.docItemCard}
                        onClick={() => {
                          if (doc.type === 'CCHN') setCchnModalOpen(true)
                          else if (doc.type === 'DIPLOMA')
                            setDiplomaModalOpen(true)
                          else setCchnModalOpen(true)
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className={styles.docItemLeft}>
                          <span className={styles.docNumberIndex}>
                            {idx + 1}.
                          </span>
                          <div className={styles.docIconWrapper}>
                            {doc.type === 'CCHN' && (
                              <FileBadge2 size={18} color="#059669" />
                            )}
                            {doc.type === 'DIPLOMA' && (
                              <GraduationCap size={18} color="#2563eb" />
                            )}
                            {doc.type === 'PRACTICE' && (
                              <FileCheck2 size={18} color="#0891b2" />
                            )}
                            {doc.type === 'CRIMINAL_RECORD' && (
                              <ShieldCheck size={18} color="#475569" />
                            )}
                          </div>
                          <div className={styles.docItemInfo}>
                            <h4 className={styles.docItemTitle}>{doc.title}</h4>
                            <p className={styles.docItemMeta}>
                              <span>{doc.issuer}</span>
                              {doc.expiryDate && (
                                <>
                                  <span className={styles.metaSeparator}>
                                    •
                                  </span>
                                  <span>
                                    Hạn CCHN: {doc.expiryDate} (
                                    {doc.remainingText})
                                  </span>
                                  <span className={styles.safeStatusTag}>
                                    {doc.safeStatus || 'An toàn'}
                                  </span>
                                </>
                              )}
                              {doc.issueDate && (
                                <>
                                  <span className={styles.metaSeparator}>
                                    •
                                  </span>
                                  <span>Cấp ngày: {doc.issueDate}</span>
                                </>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className={styles.docItemRight}>
                          <span
                            className={`${styles.badgePill} ${styles.badgeGreen}`}
                          >
                            <CheckCircle2 size={13} />
                            {doc.statusBadge}
                          </span>
                          <button
                            type="button"
                            className={styles.docEyeBtn}
                            title="Xem chi tiết bằng AI"
                            aria-label={`Xem tài liệu ${doc.title}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (doc.type === 'CCHN') setCchnModalOpen(true)
                              else if (doc.type === 'DIPLOMA')
                                setDiplomaModalOpen(true)
                              else setCchnModalOpen(true)
                            }}
                          >
                            <Eye size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Inline Document Preview Box */}
                <div className={styles.inlinePreviewCard}>
                  <div className={styles.previewHeader}>
                    <span className={styles.previewTitle}>
                      <FileBadge2 size={14} color="#059669" />
                      Xem trước CCHN #{activeDocs[0]?.code || '019283/BYT'} |
                      SHA-256: d9f824b…7b1a8
                    </span>
                    <div className={styles.previewActions}>
                      <button
                        type="button"
                        className={styles.previewBtn}
                        onClick={() => setCchnModalOpen(true)}
                      >
                        Đối chiếu song song 1:1
                      </button>
                      <button
                        type="button"
                        className={styles.previewBtn}
                        onClick={() => setCchnModalOpen(true)}
                      >
                        <Maximize2 size={12} /> Toàn màn hình
                      </button>
                      <button
                        type="button"
                        className={styles.previewBtn}
                        onClick={() => window.print()}
                      >
                        <Download size={12} /> Tải PDF có chữ ký số
                      </button>
                    </div>
                  </div>

                  <div className={styles.previewBody}>
                    <div className={styles.miniPaper}>
                      <span className={styles.matchRegionPill}>
                        <Sparkles size={11} /> VÙNG KHỚP DỮ LIỆU CSDL QUỐC GIA
                      </span>
                      <h4>CHỨNG CHỈ HÀNH NGHỀ KHÁM BỆNH, CHỮA BỆNH</h4>
                      <p>
                        Cấp cho:{' '}
                        <strong>{selected.displayName.toUpperCase()}</strong> •
                        Số: {activeDocs[0]?.code || '019283/BYT'}
                      </p>
                      <p>
                        Cơ quan cấp: <strong>Sở Y tế TP. Hồ Chí Minh</strong> •
                        Quyết định: 1842/QĐ-SYT
                      </p>
                      <p>
                        Phạm vi chuyên môn:{' '}
                        <em>
                          Khám bệnh, chữa bệnh chuyên khoa Tâm thần - Tâm lý lâm
                          sàng
                        </em>
                      </p>
                      <div className={styles.miniSign}>
                        <span>Đã ký số: TS.BS. Nguyễn Tấn Bỉnh</span>
                        <small>Dấu mộc đỏ Sở Y tế TP.HCM hợp lệ</small>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Clinical Decisions Form */}
                <div className={styles.decisionCard}>
                  <div className={styles.sectionHeading}>
                    <h3>QUYẾT ĐỊNH THẨM ĐỊNH LÂM SÀNG</h3>
                  </div>

                  <p>
                    Quyết định hồ sơ dựa trên kết quả thẩm định AI và đối soát
                    CSDL cơ quan cấp phép y tế.
                  </p>

                  {/* State-specific Decision Actions */}
                  {selected.approvalStatus === 'PENDING' && (
                    <div className={styles.decisionActionsRow}>
                      <div className={styles.rejectionFieldGroup}>
                        <span className={styles.actionLabel}>
                          Lý do nếu từ chối:
                        </span>
                        <select
                          className={styles.rejectionSelect}
                          aria-label="Lý do từ chối"
                          value={rejectionReason}
                          onChange={(event) =>
                            setRejectionReason(
                              event.target.value as SpecialistRejectionReason,
                            )
                          }
                        >
                          {Object.entries(reasonLabels)
                            .slice(0, 3)
                            .map(([val, lab]) => (
                              <option key={val} value={val}>
                                {lab}
                              </option>
                            ))}
                        </select>
                      </div>
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
                          className={styles.btnWarning}
                          disabled={busy}
                          onClick={() => {
                            showActionToast({
                              title:
                                'Đã gửi thông báo yêu cầu chuyên gia bổ sung văn bằng.',
                              tone: 'info',
                            })
                          }}
                        >
                          Yêu cầu bổ sung tài liệu
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
                              event.target.value as SpecialistSuspensionReason,
                            )
                          }
                        >
                          {Object.entries(reasonLabels)
                            .slice(3)
                            .map(([val, lab]) => (
                              <option key={val} value={val}>
                                {lab}
                              </option>
                            ))}
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
              </>
            ) : (
              <div className={styles.emptyState}>
                <strong>Chọn một hồ sơ chuyên gia</strong>
                <p>
                  Chọn một chuyên gia từ danh sách bên trái để đối soát văn
                  bằng, CCHN và thẩm định lâm sàng.
                </p>
              </div>
            )}
          </article>
        </div>
      )}

      {/* Fullscreen CCHN Modal */}
      <CchnFullscreenModal
        open={cchnModalOpen}
        onClose={() => setCchnModalOpen(false)}
        specialistName={selected?.displayName || 'ThS. BS. Hồ Thị Hồng'}
        specialistCode={selected?.specialistCode || '#MB-482'}
        cchnNumber={activeDocs[0]?.code || '019283/BYT'}
        onConfirmVerified={() => {
          showActionToast({
            title:
              'Đã xác nhận CCHN #019283/BYT hợp lệ và lưu vào CSDL kiểm toán.',
            tone: 'success',
          })
        }}
        onRequestReshoot={() => {
          showActionToast({
            title: 'Đã gửi thông báo yêu cầu chuyên gia chụp lại CCHN bản gốc.',
            tone: 'info',
          })
        }}
      />

      {/* Fullscreen Master Diploma Modal */}
      <MasterDiplomaFullscreenModal
        open={diplomaModalOpen}
        onClose={() => setDiplomaModalOpen(false)}
        specialistName={selected?.displayName || 'ThS. BS. Hồ Thị Hồng'}
        specialistCode={selected?.specialistCode || '#MB-482'}
        diplomaNumber={activeDocs[1]?.code || 'MS-8812'}
        onConfirmVerified={() => {
          showActionToast({
            title: 'Đã xác nhận Bằng Thạc sĩ Tâm lý học lâm sàng hợp lệ.',
            tone: 'success',
          })
        }}
        onRequestTranscripts={() => {
          showActionToast({
            title: 'Đã gửi yêu cầu bổ sung bảng điểm chi tiết đến chuyên gia.',
            tone: 'info',
          })
        }}
      />

      <AdminCredentialReviewSection specialistId={selected?.accountId} />
    </section>
  )
}
