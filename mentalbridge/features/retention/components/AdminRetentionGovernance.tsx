'use client'

import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/lib/api/api-error'
import type {
  ApplyHoldRequest,
  DeletionRequest,
  RetentionPolicy,
} from '@/features/auth/api/identity-contract'
import { browserAdminRetention } from '../api/browser-admin-retention'
import {
  DELETION_HOLD_REASON_CODES,
  APPROVED_IDENTITY_EVIDENCE_PATTERN,
  APPROVED_RETENTION_FAILURE_CODES,
  APPROVED_DELETION_FAILURE_REASONS,
} from '@/lib/auth/identity-validation'
import styles from './AdminRetentionGovernance.module.css'

const HOLD_REASON_LABELS: Record<ApplyHoldRequest['holdReason'], string> = {
  STATUTORY_INQUIRY: 'Yêu cầu điều tra theo luật định',
  PENDING_DISPUTE: 'Đang trong quá trình giải quyết khiếu nại',
  ACTIVE_SAFETY_REVIEW: 'Đang đánh giá an toàn người dùng',
  SCHEDULED_APPOINTMENT_ACTIVE: 'Có lịch hẹn tư vấn sắp diễn ra',
  USER_CONTESTED: 'Người dùng khiếu nại yêu cầu xóa',
  AUDIT_COMPLIANCE_HOLD: 'Bảo lưu phục vụ kiểm toán tuân thủ',
}

function retryUnavailableReason(request: DeletionRequest): string | null {
  if (request.status === 'COMPLETED') {
    return 'Yêu cầu xóa đã hoàn tất.'
  }
  if (request.holdType !== 'NONE') {
    return 'Không thể thử lại khi có lệnh Hold đang áp dụng.'
  }
  if (request.retryCount >= request.maxRetries) {
    return 'Đã đạt giới hạn thử lại; yêu cầu cần được xử lý thủ công.'
  }
  if (new Date(request.scheduledExecutionAt).getTime() > Date.now()) {
    return 'Chưa đến thời điểm thực thi đã được phê duyệt.'
  }

  const identityFact = request.ownerFacts.find(
    (fact) => fact.ownerService === 'IDENTITY',
  )
  if (request.ownerFacts.length === 0 || !identityFact) {
    return 'Thiếu bằng chứng chủ sở hữu bắt buộc nên chưa thể thử lại.'
  }
  if (identityFact.status === 'COMPLETED') {
    return 'Phần dữ liệu tài khoản đã hoàn tất; hiện chưa hỗ trợ thử lại tự động cho các phần còn chờ ở dịch vụ khác.'
  }
  return null
}

function sweepUnavailableReason(policy: RetentionPolicy): string | null {
  if (!policy.automatedExecutionSupported) {
    return (
      policy.unsupportedCapabilityNotice ??
      'Chức năng quét dọn dẹp tự động không khả dụng từ giao diện quản trị (Explicitly Unavailable).'
    )
  }
  if (
    policy.jobStatus === 'RUNNING' ||
    policy.lastExecution?.jobStatus === 'RUNNING'
  ) {
    return 'Tiến trình dọn dẹp đang được thực thi (RUNNING). Vui lòng đợi hoàn tất trước khi kích hoạt lại.'
  }
  if (policy.jobStatus === 'FAILED') {
    return 'Tiến trình dọn dẹp đã thất bại liên tiếp và cần xử lý leo thang thủ công (MANUAL_ESCALATION_REQUIRED).'
  }
  return null
}

export default function AdminRetentionGovernance() {
  const [activeTab, setActiveTab] = useState<'policies' | 'deletions'>(
    'policies',
  )

  // Policies state
  const [policies, setPolicies] = useState<RetentionPolicy[]>([])
  const [policiesLoading, setPoliciesLoading] = useState(true)
  const [policiesError, setPoliciesError] = useState<string | null>(null)
  const [sweepActionLoading, setSweepActionLoading] = useState<string | null>(
    null,
  )
  const [sweepFeedback, setSweepFeedback] = useState<string | null>(null)

  // Deletions state
  const [deletions, setDeletions] = useState<DeletionRequest[]>([])
  const [deletionsLoading, setDeletionsLoading] = useState(false)
  const [deletionsError, setDeletionsError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [holdFilter, setHoldFilter] = useState<string>('')
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(
    null,
  )
  const [currentPage, setCurrentPage] = useState<number>(0)
  const [totalItems, setTotalItems] = useState<number>(0)
  const [hasNextPage, setHasNextPage] = useState<boolean>(false)
  const pageSize = 20

  // Hold Modal state
  const [selectedHoldRequestId, setSelectedHoldRequestId] = useState<
    string | null
  >(null)
  const [selectedHoldType, setSelectedHoldType] =
    useState<ApplyHoldRequest['holdType']>('LEGAL_HOLD')
  const [selectedHoldReason, setSelectedHoldReason] =
    useState<ApplyHoldRequest['holdReason']>('STATUTORY_INQUIRY')

  const loadPolicies = useCallback(async () => {
    setPoliciesLoading(true)
    setPoliciesError(null)
    try {
      const data = await browserAdminRetention.getPolicies()
      setPolicies(data)
    } catch (err) {
      setPoliciesError(
        err instanceof ApiError
          ? err.message
          : 'Không thể tải danh sách chính sách bảo lưu.',
      )
    } finally {
      setPoliciesLoading(false)
    }
  }, [])

  const loadDeletions = useCallback(
    async (pageToLoad = currentPage) => {
      setDeletionsLoading(true)
      setDeletionsError(null)
      try {
        const data = await browserAdminRetention.getDeletions({
          status: statusFilter || undefined,
          holdType: holdFilter || undefined,
          limit: pageSize,
          page: pageToLoad,
        })
        setDeletions(data.items)
        setTotalItems(data.total)
        setHasNextPage(Boolean(data.nextCursor))
      } catch (err) {
        setDeletionsError(
          err instanceof ApiError
            ? err.message
            : 'Không thể tải danh sách yêu cầu xóa dữ liệu.',
        )
      } finally {
        setDeletionsLoading(false)
      }
    },
    [statusFilter, holdFilter, currentPage, pageSize],
  )

  useEffect(() => {
    let active = true
    browserAdminRetention
      .getPolicies()
      .then((data) => {
        if (active) setPolicies(data)
      })
      .catch((err: unknown) => {
        if (active) {
          setPoliciesError(
            err instanceof ApiError
              ? err.message
              : 'Không thể tải danh sách chính sách bảo lưu.',
          )
        }
      })
      .finally(() => {
        if (active) setPoliciesLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (activeTab !== 'deletions') return
    let active = true
    browserAdminRetention
      .getDeletions({
        status: statusFilter || undefined,
        holdType: holdFilter || undefined,
        limit: pageSize,
        page: currentPage,
      })
      .then((data) => {
        if (active) {
          setDeletions(data.items)
          setTotalItems(data.total)
          setHasNextPage(Boolean(data.nextCursor))
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setDeletionsError(
            err instanceof ApiError
              ? err.message
              : 'Không thể tải danh sách yêu cầu xóa dữ liệu.',
          )
        }
      })
      .finally(() => {
        if (active) setDeletionsLoading(false)
      })
    return () => {
      active = false
    }
  }, [activeTab, statusFilter, holdFilter, currentPage, pageSize])

  const handleTriggerSweep = async (policyId: string) => {
    setSweepActionLoading(policyId)
    setSweepFeedback(null)
    try {
      const result = await browserAdminRetention.triggerSweep(policyId)
      setSweepFeedback(
        `Thực thi dọn dẹp thành công cho ${policyId}. Đã dọn dẹp ${result.recordsPurged} bản ghi hết hạn.`,
      )
      await loadPolicies()
    } catch (err) {
      setSweepFeedback(
        err instanceof ApiError
          ? err.message
          : 'Không thể kích hoạt dọn dẹp cho chính sách này.',
      )
    } finally {
      setSweepActionLoading(null)
    }
  }

  const handleRetryDeletion = async (requestId: string) => {
    setActionLoadingId(requestId)
    try {
      await browserAdminRetention.retryDeletion(requestId)
      await loadDeletions()
    } catch (err) {
      alert(
        err instanceof ApiError ? err.message : 'Thử lại xóa dữ liệu thất bại.',
      )
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleApplyHold = async () => {
    if (!selectedHoldRequestId) return
    setActionLoadingId(selectedHoldRequestId)
    try {
      await browserAdminRetention.applyHold(selectedHoldRequestId, {
        holdType: selectedHoldType,
        holdReason: selectedHoldReason,
      })
      setSelectedHoldRequestId(null)
      await loadDeletions()
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Áp dụng Hold thất bại.')
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleReleaseHold = async (requestId: string) => {
    if (!confirm('Bạn có chắc chắn muốn gỡ bỏ lệnh Hold cho yêu cầu này?'))
      return
    setActionLoadingId(requestId)
    try {
      await browserAdminRetention.releaseHold(requestId)
      await loadDeletions()
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Gỡ bỏ Hold thất bại.')
    } finally {
      setActionLoadingId(null)
    }
  }

  return (
    <div
      className={styles.workspace}
      data-testid="retention-governance-workspace"
    >
      <header className={styles.header}>
        <div>
          <span>Bảo mật & Quản trị dữ liệu</span>
          <h1>Quản trị bảo lưu & xóa dữ liệu</h1>
          <p>
            Giám sát các chính sách bảo lưu đã được phê duyệt, theo dõi tiến
            trình thực thi xóa và bảo đảm bằng chứng kiểm toán an toàn
            (audit-safe) mà không xâm phạm quyền riêng tư.
          </p>
        </div>
      </header>

      <div
        className={styles.privacyNotice}
        data-testid="audit-safe-guarantee-notice"
      >
        <span className={styles.privacyBadge}>BẢO ĐẢM AUDIT-SAFE</span>
        <span>
          Không hiển thị nội dung thô Nhật ký, câu trả lời đánh giá tâm lý, nội
          dung tư vấn chat hay bí mật hệ thống. Mỗi dịch vụ chủ sở hữu tự thực
          thi chính sách bảo lưu của mình; không hỗ trợ nút xóa cứng toàn cục vi
          phạm ranh giới dịch vụ.
        </span>
      </div>

      <nav className={styles.tabs} aria-label="Phân mục quản trị bảo lưu">
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === 'policies' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('policies')}
          data-testid="tab-policies"
        >
          Chính sách bảo lưu & Thực thi định kỳ
        </button>
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === 'deletions' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('deletions')}
          data-testid="tab-deletions"
        >
          Yêu cầu xóa & Dấu vết hoàn tất
        </button>
      </nav>

      {activeTab === 'policies' && (
        <section
          className={styles.panel}
          aria-label="Danh sách chính sách bảo lưu"
        >
          {sweepFeedback && (
            <div
              className={styles.privacyNotice}
              role="alert"
              style={{
                background: sweepFeedback.includes('thành công')
                  ? 'rgba(34, 197, 94, 0.08)'
                  : 'rgba(239, 68, 68, 0.08)',
                borderColor: sweepFeedback.includes('thành công')
                  ? 'rgba(34, 197, 94, 0.3)'
                  : 'rgba(239, 68, 68, 0.3)',
              }}
            >
              {sweepFeedback}
            </div>
          )}

          {policiesLoading ? (
            <div className={styles.emptyState}>
              Đang tải danh sách chính sách bảo lưu...
            </div>
          ) : policiesError ? (
            <div className={styles.emptyState} style={{ color: '#dc2626' }}>
              {policiesError}
            </div>
          ) : (
            policies.map((policy) => (
              <article
                key={policy.policyId}
                className={styles.card}
                data-testid={`policy-card-${policy.policyId}`}
              >
                <div className={styles.cardHeader}>
                  <div>
                    <h2 className={styles.cardTitle}>{policy.name}</h2>
                    <span className={styles.cardVersion}>
                      {policy.policyId} · Phiên bản: {policy.version} · Chủ sở
                      hữu: {policy.ownerService}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span className={`${styles.badge} ${styles.badgeApproved}`}>
                      {policy.status}
                    </span>
                    <span
                      className={`${styles.badge} ${
                        policy.jobStatus === 'ACTIVE'
                          ? styles.badgeActive
                          : styles.badgeUnavailable
                      }`}
                    >
                      JOB: {policy.jobStatus}
                    </span>
                  </div>
                </div>

                <p className={styles.cardDesc}>{policy.description}</p>

                <div className={styles.metaGrid}>
                  <div className={styles.metaItem}>
                    <strong>Thời hạn bảo lưu</strong>
                    <span>
                      {policy.retentionDays
                        ? `${policy.retentionDays} ngày`
                        : 'Theo quy định vòng đời'}
                    </span>
                  </div>
                  <div className={styles.metaItem}>
                    <strong>Tên tác vụ dọn dẹp</strong>
                    <span>{policy.jobName}</span>
                  </div>
                  <div className={styles.metaItem}>
                    <strong>Kết quả lần thực thi gần nhất</strong>
                    <span>
                      {policy.lastExecution ? (
                        <>
                          <span>
                            {policy.lastExecution.jobStatus}{' '}
                            {policy.lastExecution.failureCode &&
                            APPROVED_RETENTION_FAILURE_CODES.has(
                              policy.lastExecution.failureCode.trim(),
                            )
                              ? `(${policy.lastExecution.failureCode.trim()})`
                              : `(${policy.lastExecution.recordsPurged} bản ghi dọn dẹp)`}
                          </span>
                          <span
                            style={{
                              display: 'block',
                              fontSize: '11.5px',
                              color: 'var(--ink-soft)',
                            }}
                          >
                            {policy.lastExecution.completedAt
                              ? `Thời gian: ${policy.lastExecution.completedAt}`
                              : `Bắt đầu: ${policy.lastExecution.startedAt}`}
                          </span>
                        </>
                      ) : (
                        'Chưa có nhật ký gần đây'
                      )}
                    </span>
                  </div>
                  <div className={styles.metaItem}>
                    <strong>Hỗ trợ lệnh Hold</strong>
                    <span>
                      {policy.manualHoldSupported
                        ? 'Có hỗ trợ'
                        : 'Không áp dụng'}
                    </span>
                  </div>
                </div>

                <div className={styles.actionRow}>
                  {policy.automatedExecutionSupported ? (
                    <>
                      <span
                        style={{ fontSize: '12.5px', color: 'var(--ink-soft)' }}
                      >
                        Hỗ trợ thực thi định kỳ tự động và quét thủ công có kiểm
                        toán từ Identity Service.
                      </span>
                      <button
                        type="button"
                        className={styles.btnPrimary}
                        onClick={() => handleTriggerSweep(policy.policyId)}
                        disabled={
                          sweepActionLoading === policy.policyId ||
                          sweepUnavailableReason(policy) !== null
                        }
                        title={sweepUnavailableReason(policy) ?? undefined}
                        aria-describedby={
                          sweepUnavailableReason(policy)
                            ? `sweep-blocked-${policy.policyId}`
                            : undefined
                        }
                        data-testid={`sweep-btn-${policy.policyId}`}
                      >
                        {sweepActionLoading === policy.policyId
                          ? 'Đang thực thi...'
                          : policy.jobStatus === 'RUNNING' ||
                              policy.lastExecution?.jobStatus === 'RUNNING'
                            ? 'Đang chạy (RUNNING)'
                            : policy.jobStatus === 'FAILED'
                              ? 'Cần xử lý thủ công'
                              : 'Kích hoạt dọn dẹp ngay'}
                      </button>
                    </>
                  ) : (
                    <>
                      <span
                        className={styles.unavailableNotice}
                        data-testid={`unavailable-notice-${policy.policyId}`}
                      >
                        {policy.unsupportedCapabilityNotice ??
                          'Chức năng quét dọn dẹp tự động không khả dụng từ giao diện quản trị (Explicitly Unavailable).'}
                      </span>
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        disabled
                        title="Dịch vụ này không hỗ trợ kích hoạt trực tiếp từ quản trị viên"
                        data-testid={`sweep-disabled-${policy.policyId}`}
                      >
                        Thực thi không khả dụng
                      </button>
                    </>
                  )}
                </div>

                {policy.automatedExecutionSupported &&
                  sweepUnavailableReason(policy) && (
                    <p
                      id={`sweep-blocked-${policy.policyId}`}
                      className={styles.actionHint}
                      data-testid={`sweep-blocked-${policy.policyId}`}
                    >
                      {sweepUnavailableReason(policy)}
                    </p>
                  )}
              </article>
            ))
          )}
        </section>
      )}

      {activeTab === 'deletions' && (
        <section
          className={styles.panel}
          aria-label="Danh sách yêu cầu xóa dữ liệu"
        >
          <div className={styles.filterBar}>
            <label
              htmlFor="status-filter"
              style={{ fontSize: '13px', fontWeight: 600 }}
            >
              Trạng thái yêu cầu:
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setCurrentPage(0)
              }}
              data-testid="filter-status"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="PENDING">PENDING (Chờ xử lý)</option>
              <option value="IN_PROGRESS">IN_PROGRESS (Đang thực hiện)</option>
              <option value="HELD">HELD (Đang bị Hold)</option>
              <option value="COMPLETED">COMPLETED (Đã hoàn tất)</option>
              <option value="FAILED">FAILED (Thất bại)</option>
            </select>

            <label
              htmlFor="hold-filter"
              style={{ fontSize: '13px', fontWeight: 600, marginLeft: '12px' }}
            >
              Trạng thái Hold:
            </label>
            <select
              id="hold-filter"
              value={holdFilter}
              onChange={(e) => {
                setHoldFilter(e.target.value)
                setCurrentPage(0)
              }}
              data-testid="filter-hold"
            >
              <option value="">Tất cả lệnh Hold</option>
              <option value="NONE">NONE (Không có Hold)</option>
              <option value="LEGAL_HOLD">LEGAL_HOLD (Yêu cầu pháp lý)</option>
              <option value="OPERATIONAL_HOLD">
                OPERATIONAL_HOLD (Giữ lại vận hành)
              </option>
              <option value="DISPUTE_HOLD">
                DISPUTE_HOLD (Tranh chấp phiên tư vấn)
              </option>
            </select>

            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => {
                loadDeletions(currentPage)
              }}
              style={{ marginLeft: 'auto' }}
              data-testid="btn-refresh-deletions"
            >
              Làm mới
            </button>
          </div>

          {deletionsLoading ? (
            <div className={styles.emptyState}>
              Đang tải danh sách yêu cầu xóa dữ liệu...
            </div>
          ) : deletionsError ? (
            <div className={styles.emptyState} style={{ color: '#dc2626' }}>
              {deletionsError}
            </div>
          ) : deletions.length === 0 ? (
            <div className={styles.emptyState}>
              Không có yêu cầu xóa dữ liệu nào phù hợp với bộ lọc.
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table} data-testid="deletions-table">
                <thead>
                  <tr>
                    <th>Định danh tối thiểu</th>
                    <th>Trạng thái tài khoản</th>
                    <th>Trạng thái xóa</th>
                    <th>Lệnh Hold</th>
                    <th>Số lần thử lại</th>
                    <th>Thời điểm yêu cầu</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {deletions.map((req) => (
                    <tr
                      key={req.requestId}
                      data-testid={`deletion-row-${req.requestId}`}
                    >
                      <td>
                        <strong
                          style={{ fontFamily: 'monospace', fontSize: '12px' }}
                        >
                          {req.subjectReference}
                        </strong>
                      </td>
                      <td>
                        <span className={styles.badge}>
                          {req.accountStatus ?? 'UNKNOWN'}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`${styles.badge} ${
                            req.status === 'COMPLETED'
                              ? styles.badgeCompleted
                              : req.status === 'HELD'
                                ? styles.badgeHeld
                                : req.status === 'FAILED'
                                  ? styles.badgeFailed
                                  : styles.badgeActive
                          }`}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td>
                        {req.holdType !== 'NONE' ? (
                          <span
                            className={`${styles.badge} ${styles.badgeHeld}`}
                            data-testid={`hold-badge-${req.requestId}`}
                          >
                            {req.holdType}
                            {req.holdReason ? `: ${req.holdReason}` : ''}
                          </span>
                        ) : (
                          <span
                            style={{
                              color: 'var(--ink-soft)',
                              fontSize: '12px',
                            }}
                          >
                            Không có
                          </span>
                        )}
                      </td>
                      <td>
                        <span>
                          {req.retryCount} / {req.maxRetries}
                        </span>
                        {req.escalationState !== 'NONE' && (
                          <span
                            className={`${styles.badge} ${styles.badgeFailed}`}
                            style={{ marginLeft: '6px' }}
                            data-testid={`escalation-badge-${req.requestId}`}
                          >
                            {req.escalationState}
                          </span>
                        )}
                      </td>
                      <td
                        style={{ fontSize: '12px', color: 'var(--ink-soft)' }}
                      >
                        {new Date(req.requestedAt).toLocaleString('vi-VN')}
                      </td>
                      <td>
                        <div
                          style={{
                            display: 'flex',
                            gap: '6px',
                            alignItems: 'center',
                          }}
                        >
                          <button
                            type="button"
                            className={styles.btnSecondary}
                            style={{
                              padding: '4px 8px',
                              minHeight: '30px',
                              fontSize: '12px',
                            }}
                            onClick={() =>
                              setExpandedRequestId(
                                expandedRequestId === req.requestId
                                  ? null
                                  : req.requestId,
                              )
                            }
                            data-testid={`btn-expand-${req.requestId}`}
                          >
                            {expandedRequestId === req.requestId
                              ? 'Ẩn chi tiết'
                              : 'Chi tiết'}
                          </button>

                          {req.holdType === 'NONE' ? (
                            <button
                              type="button"
                              className={styles.btnSecondary}
                              style={{
                                padding: '4px 8px',
                                minHeight: '30px',
                                fontSize: '12px',
                              }}
                              onClick={() =>
                                setSelectedHoldRequestId(req.requestId)
                              }
                              disabled={
                                actionLoadingId === req.requestId ||
                                req.status === 'COMPLETED'
                              }
                              data-testid={`btn-apply-hold-${req.requestId}`}
                            >
                              Đặt Hold
                            </button>
                          ) : (
                            <button
                              type="button"
                              className={styles.btnDanger}
                              style={{
                                padding: '4px 8px',
                                minHeight: '30px',
                                fontSize: '12px',
                              }}
                              onClick={() => handleReleaseHold(req.requestId)}
                              disabled={actionLoadingId === req.requestId}
                              data-testid={`btn-release-hold-${req.requestId}`}
                            >
                              Gỡ Hold
                            </button>
                          )}

                          <button
                            type="button"
                            className={styles.btnPrimary}
                            style={{
                              padding: '4px 8px',
                              minHeight: '30px',
                              fontSize: '12px',
                            }}
                            onClick={() => handleRetryDeletion(req.requestId)}
                            disabled={
                              actionLoadingId === req.requestId ||
                              retryUnavailableReason(req) !== null
                            }
                            title={retryUnavailableReason(req) ?? undefined}
                            aria-describedby={
                              retryUnavailableReason(req)
                                ? `retry-unavailable-${req.requestId}`
                                : undefined
                            }
                            data-testid={`btn-retry-${req.requestId}`}
                          >
                            Thử lại
                          </button>
                        </div>

                        {retryUnavailableReason(req) && (
                          <p
                            id={`retry-unavailable-${req.requestId}`}
                            className={styles.actionHint}
                            data-testid={`retry-unavailable-${req.requestId}`}
                          >
                            {retryUnavailableReason(req)}
                          </p>
                        )}

                        {expandedRequestId === req.requestId && (
                          <div
                            className={styles.factList}
                            data-testid={`facts-panel-${req.requestId}`}
                          >
                            <strong
                              style={{
                                fontSize: '11.5px',
                                color: 'var(--ink-soft)',
                              }}
                            >
                              BẰNG CHỨNG HOÀN TẤT THEO DỊCH VỤ CHỦ SỞ HỮU (OWNER
                              FACTS):
                            </strong>
                            {req.ownerFacts.map((fact, factIndex) => (
                              <div
                                key={`${fact.ownerService}-${factIndex}`}
                                className={styles.factRow}
                              >
                                <div>
                                  <strong>{fact.ownerService}</strong>:
                                  <span
                                    className={`${styles.badge} ${
                                      fact.status === 'COMPLETED'
                                        ? styles.badgeCompleted
                                        : fact.status === 'HELD'
                                          ? styles.badgeHeld
                                          : fact.status === 'FAILED'
                                            ? styles.badgeFailed
                                            : styles.badgeUnavailable
                                    }`}
                                    style={{ marginLeft: '6px' }}
                                  >
                                    {fact.status}
                                  </span>
                                </div>
                                <div className={styles.factCode}>
                                  {fact.ownerService === 'IDENTITY' &&
                                  fact.evidenceReference &&
                                  APPROVED_IDENTITY_EVIDENCE_PATTERN.test(
                                    fact.evidenceReference.trim(),
                                  ) ? (
                                    <span>
                                      Bằng chứng:{' '}
                                      {fact.evidenceReference.trim()}
                                    </span>
                                  ) : fact.failureReason &&
                                    APPROVED_DELETION_FAILURE_REASONS.has(
                                      fact.failureReason.trim(),
                                    ) ? (
                                    <span style={{ color: '#dc2626' }}>
                                      Lý do: {fact.failureReason.trim()}
                                    </span>
                                  ) : (
                                    'Chưa có'
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div
                className={styles.paginationControls}
                data-testid="pagination-controls"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderTop: '1px solid var(--border-soft)',
                }}
              >
                <span
                  style={{ fontSize: '13px', color: 'var(--ink-soft)' }}
                  data-testid="pagination-info"
                >
                  Trang {currentPage + 1} (Tổng cộng: {totalItems} yêu cầu)
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => {
                      const prev = Math.max(0, currentPage - 1)
                      setCurrentPage(prev)
                    }}
                    disabled={currentPage === 0 || deletionsLoading}
                    data-testid="btn-prev-page"
                  >
                    Trang trước
                  </button>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => {
                      if (hasNextPage) {
                        setCurrentPage((p) => p + 1)
                      }
                    }}
                    disabled={!hasNextPage || deletionsLoading}
                    data-testid="btn-next-page"
                  >
                    Trang sau
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Modal Áp dụng Hold */}
      {selectedHoldRequestId && (
        <div className={styles.modalBackdrop} data-testid="hold-modal">
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2>Áp dụng lệnh Hold bảo lưu</h2>
              <button
                type="button"
                className={styles.btnSecondary}
                style={{ minHeight: '30px', padding: '0 8px' }}
                onClick={() => setSelectedHoldRequestId(null)}
              >
                ✕
              </button>
            </div>
            <p
              style={{
                fontSize: '13.5px',
                color: 'var(--ink-soft)',
                margin: 0,
              }}
            >
              Lệnh Hold cấp điều phối viên (Coordinator) chặn xử lý xóa tại
              Identity và từ chối các lượt retry tiếp theo cho đến khi quản trị
              viên chủ động gỡ bỏ. Lưu ý: Lệnh Hold này không can thiệp trực
              tiếp vào cơ sở dữ liệu riêng của các dịch vụ bên ngoài chưa có
              hợp đồng thực thi.
            </p>

            <div className={styles.formGroup}>
              <label htmlFor="modal-hold-type">Loại lệnh Hold:</label>
              <select
                id="modal-hold-type"
                value={selectedHoldType}
                onChange={(e) =>
                  setSelectedHoldType(
                    e.target.value as ApplyHoldRequest['holdType'],
                  )
                }
                data-testid="select-hold-type"
              >
                <option value="LEGAL_HOLD">
                  LEGAL_HOLD (Yêu cầu pháp lý / Cơ quan quản lý)
                </option>
                <option value="OPERATIONAL_HOLD">
                  OPERATIONAL_HOLD (Giữ lại phục vụ vận hành / kiểm toán)
                </option>
                <option value="DISPUTE_HOLD">
                  DISPUTE_HOLD (Tranh chấp phiên tư vấn đang mở)
                </option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="modal-hold-reason">Lý do Hold:</label>
              <select
                id="modal-hold-reason"
                value={selectedHoldReason}
                onChange={(e) =>
                  setSelectedHoldReason(
                    e.target.value as ApplyHoldRequest['holdReason'],
                  )
                }
                data-testid="select-hold-reason"
              >
                {DELETION_HOLD_REASON_CODES.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason} ({HOLD_REASON_LABELS[reason]})
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setSelectedHoldRequestId(null)}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={handleApplyHold}
                data-testid="btn-confirm-apply-hold"
              >
                Xác nhận áp dụng Hold
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
