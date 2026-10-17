'use client'

import { useState } from 'react'
import {
  Activity,
  Check,
  FileText,
  Info,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Target,
  X,
} from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { ApiError } from '@/lib/api/api-error'
import type { SpecialistConsultationBrief as Brief } from '../api/consultation-brief-contract'
import { consultationBriefBrowserClient } from '../api/consultation-brief-browser-client'
import styles from './ConsultationBriefPanel.module.css'

function denied(error: unknown) {
  if (!(error instanceof ApiError)) return 'Chưa thể tải tóm tắt lúc này.'
  const values: Record<string, string> = {
    CONSULTATION_BRIEF_ACCESS_TOO_EARLY:
      'Tóm tắt chỉ mở trong 24 giờ trước lịch hẹn.',
    CONSULTATION_BRIEF_ACCESS_EXPIRED:
      'Khung thời gian đọc tóm tắt đã kết thúc.',
    CONSULTATION_BRIEF_ACCESS_DENIED:
      'Người dùng chưa phê duyệt hoặc đã thu hồi quyền truy cập.',
    CONSULTATION_BRIEF_APPOINTMENT_CHANGED:
      'Lịch hẹn đã thay đổi. Người dùng cần xem lại và phê duyệt một bản tóm tắt mới.',
    CONSULTATION_BRIEF_UNAVAILABLE: 'Bản tóm tắt hoặc nguồn đã bị xóa.',
  }
  return (
    values[error.code] ?? 'Bạn không có quyền đọc tóm tắt của lịch hẹn này.'
  )
}

export function SpecialistConsultationBrief({
  appointmentId,
  compact = false,
}: Readonly<{ appointmentId: string; compact?: boolean }>) {
  const [open, setOpen] = useState(false)
  const [brief, setBrief] = useState<Brief | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    setBrief(null)
    try {
      setBrief(await consultationBriefBrowserClient.specialist(appointmentId))
    } catch (caught) {
      setError(denied(caught))
    } finally {
      setLoading(false)
    }
  }

  async function handleToggle() {
    if (open) {
      setOpen(false)
      setBrief(null)
      setError('')
      setLoading(false)
    } else {
      setOpen(true)
      await load()
    }
  }

  function handleClose() {
    setOpen(false)
    setBrief(null)
    setError('')
    setLoading(false)
  }

  return (
    <section
      className={`${styles.specialist}${compact ? ` ${styles.compact}` : ''}`}
      aria-label="Tóm tắt được người dùng phê duyệt"
    >
      <div className={styles.heading}>
        {!compact && (
          <div>
            <h4>Tóm tắt trước buổi tư vấn</h4>
            <p>Chỉ đọc bản chụp người dùng đã phê duyệt cho lịch hẹn này.</p>
          </div>
        )}
        <button
          data-appointment-ui={compact ? '' : undefined}
          type="button"
          onClick={() => void handleToggle()}
          disabled={loading && !open}
          className={styles.triggerButton}
        >
          <FileText size={14} aria-hidden="true" />
          {loading && !open
            ? 'Đang tải…'
            : open
              ? 'Thu gọn tóm tắt'
              : compact
                ? 'Xem tóm tắt chuẩn bị'
                : 'Xem tóm tắt'}
        </button>
      </div>
      {error && !open && (
        <p className={styles.notice} role="status">
          {error}
        </p>
      )}

      <Dialog
        open={open}
        onOpenChange={(val) => !val && handleClose()}
        labelledBy={`brief-title-${appointmentId}`}
        describedBy={`brief-desc-${appointmentId}`}
        className={styles.briefDialog}
      >
        <div className={styles.modalContainer}>
          <header className={styles.modalHeader}>
            <div className={styles.modalMeta}>
              <span className={styles.modalTag}>
                <ShieldCheck size={13} className={styles.modalTagIcon} aria-hidden="true" />
                Hồ sơ tiếp nhận lâm sàng
              </span>
              {brief && (
                <span className={styles.versionBadge}>
                  Bản chụp v{brief.snapshotVersion}
                </span>
              )}
            </div>
            <button
              type="button"
              className={styles.modalCloseBtn}
              onClick={handleClose}
              aria-label="Đóng popup"
            >
              <X size={17} aria-hidden="true" />
            </button>
          </header>

          <div className={styles.modalTitleBlock}>
            <h2 id={`brief-title-${appointmentId}`} className={styles.modalTitle}>
              Tóm tắt trước buổi tư vấn
            </h2>
            <p id={`brief-desc-${appointmentId}`} className={styles.modalSubtitle}>
              Bản chụp thông tin do thân chủ phê duyệt chia sẻ riêng cho phiên hẹn này.
            </p>
          </div>

          {loading && (
            <div className={styles.modalLoading} role="status">
              <RefreshCw size={26} className={styles.spin} aria-hidden="true" />
              <p>Đang tải tóm tắt lâm sàng từ hồ sơ thân chủ…</p>
            </div>
          )}

          {!loading && error && (
            <div className={styles.modalError}>
              <div className={styles.modalErrorIcon}>
                <Info size={18} aria-hidden="true" />
              </div>
              <div className={styles.modalErrorContent}>
                <h4>Thông báo quyền truy cập</h4>
                <p className={styles.notice} role="status">
                  {error}
                </p>
              </div>
            </div>
          )}

          {!loading && brief && (
            <div className={styles.modalSections}>
              <div className={styles.cardSection}>
                <div className={styles.sectionHeading}>
                  <div className={styles.iconCircle}>
                    <FileText size={15} aria-hidden="true" />
                  </div>
                  <h3>Tình hình hiện tại</h3>
                </div>
                <div className={styles.situationBox}>
                  <p>{brief.currentSituation}</p>
                </div>
              </div>

              <div className={styles.cardSection}>
                <div className={styles.sectionHeading}>
                  <div className={styles.iconCircle}>
                    <Target size={15} aria-hidden="true" />
                  </div>
                  <h3>Mục tiêu trao đổi</h3>
                  <span className={styles.countBadge}>
                    {brief.userGoals.length} mục tiêu
                  </span>
                </div>
                <ul className={styles.goalsList}>
                  {brief.userGoals.map((goal, idx) => (
                    <li key={idx} className={styles.goalItem}>
                      <span className={styles.goalBullet}>
                        <Check size={12} strokeWidth={2.5} aria-hidden="true" />
                      </span>
                      <span>{goal}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className={styles.cardSection}>
                <div className={styles.sectionHeading}>
                  <div className={styles.iconCircle}>
                    <Activity size={15} aria-hidden="true" />
                  </div>
                  <h3>Bối cảnh sàng lọc ban đầu</h3>
                </div>
                <div className={styles.screeningGrid}>
                  {brief.screeningContext.map((item) => (
                    <div key={item.instrument} className={styles.screeningCard}>
                      <span className={styles.screeningInstrument}>
                        {item.instrument}
                      </span>
                      <span
                        className={styles.screeningBadge}
                        data-level={item.screeningLevel}
                      >
                        {item.screeningLevel}
                      </span>
                    </div>
                  ))}
                </div>
                <div className={styles.disclaimerNote}>
                  <Info size={15} className={styles.disclaimerIcon} aria-hidden="true" />
                  <p>Kết quả sàng lọc không phải chẩn đoán y khoa. Dữ liệu mang tính chất tham khảo chuẩn bị cho phiên tư vấn.</p>
                </div>
              </div>
            </div>
          )}

          <footer className={styles.modalFooter}>
            <div className={styles.confidentialityNote}>
              <LockKeyhole size={13} aria-hidden="true" />
              <span>Bảo mật y tế · Quyền truy cập theo phiên hẹn</span>
            </div>
            <div className={styles.footerActions}>
              <button
                type="button"
                className={styles.btnReload}
                onClick={() => void load()}
                disabled={loading}
              >
                <RefreshCw size={13} className={loading ? styles.spin : ''} aria-hidden="true" />
                Tải lại
              </button>
              <button
                type="button"
                className={styles.btnClose}
                onClick={handleClose}
              >
                Đóng
              </button>
            </div>
          </footer>
        </div>
      </Dialog>
    </section>
  )
}
