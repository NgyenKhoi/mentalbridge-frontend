'use client'

import React, { useEffect, useState } from 'react'
import type { AdminOperationsDashboardResponse } from '@/features/dashboard/types/admin-operations'
import styles from './AdminOperationsDashboard.module.css'

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString)
    return d.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return isoString
  }
}

export interface AdminOperationsDashboardProps {
  onNotice?: (message: string) => void
}

export function AdminOperationsDashboard({
  onNotice,
}: AdminOperationsDashboardProps = {}) {
  const [data, setData] = useState<AdminOperationsDashboardResponse | null>(
    null,
  )
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [isStale, setIsStale] = useState<boolean>(false)

  useEffect(() => {
    let ignore = false

    fetch('/api/admin/operations/dashboard', {
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `Yêu cầu thất bại với mã trạng thái ${response.status}`,
          )
        }
        return response.json() as Promise<AdminOperationsDashboardResponse>
      })
      .then((result) => {
        if (!ignore) {
          setData(result)
          setIsStale(false)
          setError(null)
          setLoading(false)
          onNotice?.('Đã đồng bộ dữ liệu vận hành thành công.')
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          const msg =
            err instanceof Error ? err.message : 'Lỗi kết nối tới máy chủ'
          setError(msg)
          setLoading(false)
          onNotice?.(`Lỗi: Không thể tải bảng điều khiển vận hành (${msg}).`)
        }
      })

    return () => {
      ignore = true
    }
  }, [onNotice])

  const handleRefresh = () => {
    setLoading(true)
    fetch('/api/admin/operations/dashboard', {
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `Yêu cầu thất bại với mã trạng thái ${response.status}`,
          )
        }
        return response.json() as Promise<AdminOperationsDashboardResponse>
      })
      .then((result) => {
        setData(result)
        setIsStale(false)
        setError(null)
        setLoading(false)
        onNotice?.('Đã đồng bộ dữ liệu vận hành thành công.')
      })
      .catch((err: unknown) => {
        const msg =
          err instanceof Error ? err.message : 'Lỗi kết nối tới máy chủ'
        if (data) {
          setIsStale(true)
          onNotice?.(
            `Cảnh báo: Không thể làm mới dữ liệu (${msg}). Đang hiển thị dữ liệu cũ.`,
          )
        } else {
          setError(msg)
          onNotice?.(`Lỗi: Không thể tải bảng điều khiển vận hành (${msg}).`)
        }
        setLoading(false)
      })
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>Bảng điều khiển vận hành hệ thống</h1>
          <p className={styles.subtitle}>
            Dữ liệu vận hành thời gian thực từ các nguồn thẩm quyền
            (Authoritative Operational Projections)
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={handleRefresh}
            disabled={loading}
          >
            {loading ? 'Đang làm mới...' : '↻ Làm mới dữ liệu'}
          </button>
        </div>
      </div>

      <section
        className={`${styles.banner} ${styles.bannerAdmin}`}
        aria-label="Xác thực quản trị"
      >
        <h2>Quyền ADMIN đã được xác minh</h2>
        <p>
          Báo cáo vận hành tổng hợp thời gian thực từ các nguồn thẩm quyền,
          fail-closed đối với các truy cập trái phép. Tuyệt đối không chứa số
          liệu giả hoặc thông tin cá nhân nhạy cảm.
        </p>
      </section>

      {isStale && (
        <div className={`${styles.banner} ${styles.bannerStale}`}>
          ⚠ Cảnh báo: Kết nối máy chủ bị gián đoạn. Dữ liệu đang hiển thị có thể
          bị cũ (STALE) so với trạng thái mới nhất.
        </div>
      )}

      {error && !data && (
        <div className={`${styles.banner} ${styles.bannerError}`}>
          ✕ Không thể tải dữ liệu: {error}
        </div>
      )}

      {loading && !data && (
        <div className={styles.loadingWrapper}>
          Đang tải dữ liệu vận hành từ các dịch vụ thẩm quyền...
        </div>
      )}

      {data && (
        <>
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                Chỉ số vận hành hệ thống thẩm quyền
              </h2>
              {data.asOf && (
                <span className={styles.asOf}>
                  Quan sát tổng thể lúc: {formatDate(data.asOf)}
                </span>
              )}
            </div>

            <div className={styles.grid}>
              {/* Identity Block */}
              {data.identity.status === 'AVAILABLE' && data.identity.data ? (
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.cardTitle}>Tài khoản người dùng</h3>
                    <div className={styles.cardMeta}>
                      <span className={styles.sourceBadge}>
                        {data.identity.source}
                      </span>
                      <span
                        className={
                          isStale ? styles.badgeStale : styles.badgeAvailable
                        }
                      >
                        {isStale ? 'STALE' : 'AVAILABLE'}
                      </span>
                    </div>
                  </div>
                  <div className={styles.asOf}>
                    Ghi nhận: {formatDate(data.identity.asOf)}
                  </div>
                  <div className={styles.statRow}>
                    <div className={styles.statBox}>
                      <span className={styles.statValue}>
                        {data.identity.data.total}
                      </span>
                      <span className={styles.statLabel}>Tổng tài khoản</span>
                    </div>
                    <div className={styles.statBox}>
                      <span className={styles.statValue}>
                        {data.identity.data.active}
                      </span>
                      <span className={styles.statLabel}>Đang hoạt động</span>
                    </div>
                    <div className={styles.statBox}>
                      <span className={styles.statValue}>
                        {data.identity.data.pendingActivation}
                      </span>
                      <span className={styles.statLabel}>Chờ kích hoạt</span>
                    </div>
                    <div className={styles.statBox}>
                      <span className={styles.statValue}>
                        {data.identity.data.disabled}
                      </span>
                      <span className={styles.statLabel}>Đã vô hiệu hóa</span>
                    </div>
                  </div>
                  <div className={styles.metricList}>
                    <div className={styles.metricItem}>
                      <span className={styles.metricName}>
                        Người dùng (User):
                      </span>
                      <span className={styles.metricValue}>
                        {data.identity.data.roles.users}
                      </span>
                    </div>
                    <div className={styles.metricItem}>
                      <span className={styles.metricName}>
                        Chuyên gia (Specialist):
                      </span>
                      <span className={styles.metricValue}>
                        {data.identity.data.roles.specialists}
                      </span>
                    </div>
                    <div className={styles.metricItem}>
                      <span className={styles.metricName}>
                        Quản trị viên (Admin):
                      </span>
                      <span className={styles.metricValue}>
                        {data.identity.data.roles.administrators}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={styles.unavailableCard}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.cardTitle}>Tài khoản người dùng</h3>
                    <span className={styles.badgeUnavailable}>UNAVAILABLE</span>
                  </div>
                  <p className={styles.unintegratedRationale}>
                    {data.identity.error ||
                      'Nguồn dữ liệu Identity Service hiện không khả dụng.'}
                  </p>
                </div>
              )}

              {/* Consultation - Specialists Block */}
              {data.consultation.status === 'AVAILABLE' &&
              data.consultation.data ? (
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.cardTitle}>Hồ sơ chuyên gia</h3>
                    <div className={styles.cardMeta}>
                      <span className={styles.sourceBadge}>
                        {data.consultation.source}
                      </span>
                      <span
                        className={
                          isStale ? styles.badgeStale : styles.badgeAvailable
                        }
                      >
                        {isStale ? 'STALE' : 'AVAILABLE'}
                      </span>
                    </div>
                  </div>
                  <div className={styles.asOf}>
                    Ghi nhận: {formatDate(data.consultation.asOf)}
                  </div>
                  <div className={styles.statRow}>
                    <div className={styles.statBox}>
                      <span className={styles.statValue}>
                        {data.consultation.data.specialists.total}
                      </span>
                      <span className={styles.statLabel}>Tổng hồ sơ</span>
                    </div>
                    <div className={styles.statBox}>
                      <span className={styles.statValue}>
                        {data.consultation.data.specialists.pendingReview}
                      </span>
                      <span className={styles.statLabel}>Chờ duyệt</span>
                    </div>
                    <div className={styles.statBox}>
                      <span className={styles.statValue}>
                        {data.consultation.data.specialists.active}
                      </span>
                      <span className={styles.statLabel}>Đã duyệt</span>
                    </div>
                  </div>
                  <div className={styles.metricList}>
                    <div className={styles.metricItem}>
                      <span className={styles.metricName}>Bị từ chối:</span>
                      <span className={styles.metricValue}>
                        {data.consultation.data.specialists.rejected}
                      </span>
                    </div>
                    <div className={styles.metricItem}>
                      <span className={styles.metricName}>
                        Đang bị tạm đình chỉ:
                      </span>
                      <span className={styles.metricValue}>
                        {data.consultation.data.specialists.suspended}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={styles.unavailableCard}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.cardTitle}>Hồ sơ chuyên gia</h3>
                    <span className={styles.badgeUnavailable}>UNAVAILABLE</span>
                  </div>
                  <p className={styles.unintegratedRationale}>
                    {data.consultation.error ||
                      'Nguồn dữ liệu Consultation Service hiện không khả dụng.'}
                  </p>
                </div>
              )}

              {/* Consultation - Appointments Block */}
              {data.consultation.status === 'AVAILABLE' &&
              data.consultation.data ? (
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.cardTitle}>Lịch hẹn tư vấn</h3>
                    <div className={styles.cardMeta}>
                      <span className={styles.sourceBadge}>
                        {data.consultation.source}
                      </span>
                      <span
                        className={
                          isStale ? styles.badgeStale : styles.badgeAvailable
                        }
                      >
                        {isStale ? 'STALE' : 'AVAILABLE'}
                      </span>
                    </div>
                  </div>
                  <div className={styles.asOf}>
                    Ghi nhận: {formatDate(data.consultation.asOf)}
                  </div>
                  <div className={styles.statRow}>
                    <div className={styles.statBox}>
                      <span className={styles.statValue}>
                        {data.consultation.data.appointments.total}
                      </span>
                      <span className={styles.statLabel}>Tổng lịch hẹn</span>
                    </div>
                    <div className={styles.statBox}>
                      <span className={styles.statValue}>
                        {data.consultation.data.appointments.confirmed}
                      </span>
                      <span className={styles.statLabel}>Đã xác nhận</span>
                    </div>
                    <div className={styles.statBox}>
                      <span className={styles.statValue}>
                        {data.consultation.data.appointments.completed}
                      </span>
                      <span className={styles.statLabel}>Đã hoàn thành</span>
                    </div>
                  </div>
                  <div className={styles.metricList}>
                    <div className={styles.metricItem}>
                      <span className={styles.metricName}>
                        Chờ phản hồi (Requested):
                      </span>
                      <span className={styles.metricValue}>
                        {data.consultation.data.appointments.requested}
                      </span>
                    </div>
                    <div className={styles.metricItem}>
                      <span className={styles.metricName}>
                        Đang diễn ra (In Progress):
                      </span>
                      <span className={styles.metricValue}>
                        {data.consultation.data.appointments.inProgress}
                      </span>
                    </div>
                    <div className={styles.metricItem}>
                      <span className={styles.metricName}>
                        Đã kết thúc phiên (Session Ended):
                      </span>
                      <span className={styles.metricValue}>
                        {data.consultation.data.appointments.sessionEnded}
                      </span>
                    </div>
                    <div className={styles.metricItem}>
                      <span className={styles.metricName}>Đã hủy:</span>
                      <span className={styles.metricValue}>
                        {data.consultation.data.appointments.cancelled}
                      </span>
                    </div>
                    <div className={styles.metricItem}>
                      <span className={styles.metricName}>Bị từ chối:</span>
                      <span className={styles.metricValue}>
                        {data.consultation.data.appointments.rejected}
                      </span>
                    </div>
                    <div className={styles.metricItem}>
                      <span className={styles.metricName}>
                        Hết hạn (Expired):
                      </span>
                      <span className={styles.metricValue}>
                        {data.consultation.data.appointments.expired}
                      </span>
                    </div>
                    <div className={styles.metricItem}>
                      <span className={styles.metricName}>
                        Người dùng vắng mặt (User No-show):
                      </span>
                      <span className={styles.metricValue}>
                        {data.consultation.data.appointments.userNoShow}
                      </span>
                    </div>
                    <div className={styles.metricItem}>
                      <span className={styles.metricName}>
                        Chuyên gia vắng mặt (Specialist No-show):
                      </span>
                      <span className={styles.metricValue}>
                        {data.consultation.data.appointments.specialistNoShow}
                      </span>
                    </div>
                    <div className={styles.metricItem}>
                      <span className={styles.metricName}>
                        Cả hai vắng mặt (Both No-show):
                      </span>
                      <span className={styles.metricValue}>
                        {data.consultation.data.appointments.bothNoShow}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={styles.unavailableCard}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.cardTitle}>Lịch hẹn tư vấn</h3>
                    <span className={styles.badgeUnavailable}>UNAVAILABLE</span>
                  </div>
                  <p className={styles.unintegratedRationale}>
                    {data.consultation.error ||
                      'Nguồn dữ liệu Consultation Service hiện không khả dụng.'}
                  </p>
                </div>
              )}

              {/* Notification Delivery Health Block */}
              {data.notifications.status === 'AVAILABLE' &&
              data.notifications.data ? (
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.cardTitle}>
                      Giao nhận thông báo & Nhắc hẹn
                    </h3>
                    <div className={styles.cardMeta}>
                      <span className={styles.sourceBadge}>
                        {data.notifications.source}
                      </span>
                      <span
                        className={
                          isStale ? styles.badgeStale : styles.badgeAvailable
                        }
                      >
                        {isStale ? 'STALE' : 'AVAILABLE'}
                      </span>
                    </div>
                  </div>
                  <div className={styles.asOf}>
                    Ghi nhận: {formatDate(data.notifications.asOf)}
                  </div>
                  <div className={styles.statRow}>
                    <div className={styles.statBox}>
                      <span className={styles.statValue}>
                        {data.notifications.data.inApp.total}
                      </span>
                      <span className={styles.statLabel}>Thông báo In-app</span>
                    </div>
                    <div className={styles.statBox}>
                      <span className={styles.statValue}>
                        {data.notifications.data.inApp.delivered}
                      </span>
                      <span className={styles.statLabel}>Đã gửi In-app</span>
                    </div>
                    <div className={styles.statBox}>
                      <span className={styles.statValue}>
                        {data.notifications.data.emailReminders.delivered}
                      </span>
                      <span className={styles.statLabel}>
                        Email nhắc gửi thành công
                      </span>
                    </div>
                  </div>
                  <div className={styles.metricList}>
                    <div className={styles.metricItem}>
                      <span className={styles.metricName}>
                        In-app chưa đọc:
                      </span>
                      <span className={styles.metricValue}>
                        {data.notifications.data.inApp.unread}
                      </span>
                    </div>
                    <div className={styles.metricItem}>
                      <span className={styles.metricName}>
                        In-app gửi thất bại:
                      </span>
                      <span className={styles.metricValue}>
                        {data.notifications.data.inApp.failed}
                      </span>
                    </div>
                    <div className={styles.metricItem}>
                      <span className={styles.metricName}>
                        Email nhắc đang xử lý/chờ:
                      </span>
                      <span className={styles.metricValue}>
                        {data.notifications.data.emailReminders.pending +
                          data.notifications.data.emailReminders.processing}
                      </span>
                    </div>
                    <div className={styles.metricItem}>
                      <span className={styles.metricName}>
                        Email nhắc thất bại:
                      </span>
                      <span className={styles.metricValue}>
                        {data.notifications.data.emailReminders.failed}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={styles.unavailableCard}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.cardTitle}>
                      Giao nhận thông báo & Nhắc hẹn
                    </h3>
                    <span className={styles.badgeUnavailable}>UNAVAILABLE</span>
                  </div>
                  <p className={styles.unintegratedRationale}>
                    {data.notifications.error ||
                      'Nguồn dữ liệu Notification Service hiện không khả dụng.'}
                  </p>
                </div>
              )}

              {/* Community Reports Block */}
              {data.community.status === 'AVAILABLE' && data.community.data ? (
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.cardTitle}>Kiểm duyệt cộng đồng</h3>
                    <div className={styles.cardMeta}>
                      <span className={styles.sourceBadge}>
                        {data.community.source}
                      </span>
                      <span
                        className={
                          isStale ? styles.badgeStale : styles.badgeAvailable
                        }
                      >
                        {isStale ? 'STALE' : 'AVAILABLE'}
                      </span>
                    </div>
                  </div>
                  <div className={styles.asOf}>
                    Ghi nhận: {formatDate(data.community.asOf)}
                  </div>
                  <div className={styles.statRow}>
                    <div className={styles.statBox}>
                      <span className={styles.statValue}>
                        {data.community.data.openModerationCases}
                      </span>
                      <span className={styles.statLabel}>
                        Vụ việc kiểm duyệt đang mở
                      </span>
                    </div>
                    <div className={styles.statBox}>
                      <span className={styles.statValue}>
                        {data.community.data.totalModerationCases}
                      </span>
                      <span className={styles.statLabel}>
                        Tổng vụ việc kiểm duyệt
                      </span>
                    </div>
                  </div>
                  <div className={styles.metricList}>
                    <div className={styles.metricItem}>
                      <span className={styles.metricName}>
                        Trạng thái hàng đợi kiểm duyệt:
                      </span>
                      <span className={styles.metricValue}>
                        {data.community.data.openModerationCases > 0
                          ? 'Cần xử lý'
                          : 'Đang ổn định'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={styles.unavailableCard}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.cardTitle}>Kiểm duyệt cộng đồng</h3>
                    <span className={styles.badgeUnavailable}>UNAVAILABLE</span>
                  </div>
                  <p className={styles.unintegratedRationale}>
                    {data.community.error ||
                      'Nguồn dữ liệu Community Service hiện không khả dụng.'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Unintegrated Metrics Section */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                Chỉ số chưa tích hợp / Chưa có nguồn xác thực
              </h2>
            </div>
            <div className={styles.grid}>
              {data.unintegrated.map((metric) => (
                <div key={metric.id} className={styles.unintegratedCard}>
                  <div className={styles.unintegratedHeader}>
                    <h3 className={styles.unintegratedTitle}>{metric.title}</h3>
                    <span className={styles.badgeUnavailable}>UNAVAILABLE</span>
                  </div>
                  <p className={styles.unintegratedRationale}>
                    {metric.rationale}
                  </p>
                  <p className={styles.unintegratedOwner}>
                    Yêu cầu nguồn xác thực: {metric.authoritativeOwnerNeeded} (
                    {metric.targetDomain})
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default AdminOperationsDashboard
