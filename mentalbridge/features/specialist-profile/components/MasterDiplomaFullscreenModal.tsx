'use client'

import { useEffect, useState } from 'react'
import {
  Check,
  CheckCircle2,
  Download,
  Flag,
  GraduationCap,
  Minus,
  Plus,
  RotateCw,
  Sparkles,
  X,
} from 'lucide-react'
import styles from './MasterDiplomaFullscreenModal.module.css'

export type MasterDiplomaModalProps = Readonly<{
  open: boolean
  onClose: () => void
  onConfirmVerified?: () => void
  onRequestTranscripts?: () => void
  specialistName?: string
  specialistCode?: string
  diplomaNumber?: string
  issueDate?: string
  university?: string
  major?: string
  graduationRank?: string
  registrationNumber?: string
  sha256?: string
}>

export default function MasterDiplomaFullscreenModal({
  open,
  onClose,
  onConfirmVerified,
  onRequestTranscripts,
  specialistName = 'ThS. BS. Hồ Thị Hồng',
  specialistCode = '#MB-482',
  diplomaNumber = 'MS-8812',
  issueDate = '18/11/2019',
  university = 'ĐH Y Dược TP.HCM',
  major = 'Tâm lý học lâm sàng (Clinical Psychology)',
  graduationRank = 'Giỏi',
  registrationNumber = '812/YDS-SĐH',
  sha256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4',
}: MasterDiplomaModalProps) {
  const [zoom, setZoom] = useState(125)
  const [rotation, setRotation] = useState(0)
  const [checklist, setChecklist] = useState({
    registry: true,
    clinicalFrame: true,
    securityPattern: true,
  })

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    if (open) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 15, 200))
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 15, 75))
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360)

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="diploma-modal-title"
    >
      <div className={styles.modal}>
        {/* Top Header */}
        <header className={styles.topBar}>
          <div className={styles.titleArea}>
            <div className={styles.iconBox}>
              <GraduationCap size={22} />
            </div>
            <div className={styles.titles}>
              <div className={styles.titleLine}>
                <h2 id="diploma-modal-title">
                  Bằng Thạc sĩ Tâm lý học lâm sàng #{diplomaNumber}
                </h2>
                <span className={styles.verifiedBadge}>
                  <CheckCircle2 size={12} />
                  Đã xác thực văn bằng gốc - Cổng Tra cứu Văn bằng ĐHQG / ĐHYD
                </span>
                <span className={styles.cksChip}>
                  <Check size={12} />
                  CKS: PGS.TS. Trần Diệp Tuấn (Hiệu trưởng ĐH Y Dược TP.HCM)
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                    }}
                    aria-label="Đóng huy hiệu CKS"
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      display: 'flex',
                    }}
                  >
                    <X size={12} />
                  </button>
                </span>
              </div>
              <p className={styles.subtitle}>
                Bác sĩ sở hữu: <strong>{specialistName}</strong> (
                {specialistCode}) • {university} • Cấp ngày {issueDate}
              </p>
            </div>
          </div>

          <div className={styles.toolbar}>
            <button
              type="button"
              className={styles.toolBtn}
              onClick={handleZoomOut}
              title="Thu nhỏ"
              aria-label="Thu nhỏ"
            >
              <Minus size={14} />
            </button>
            <span className={styles.zoomDisplay}>{zoom}%</span>
            <button
              type="button"
              className={styles.toolBtn}
              onClick={handleZoomIn}
              title="Phóng to"
              aria-label="Phóng to"
            >
              <Plus size={14} />
            </button>
            <button
              type="button"
              className={styles.toolBtn}
              onClick={handleRotate}
              title="Xoay 90 độ"
            >
              <RotateCw size={14} />
            </button>
            <button
              type="button"
              className={styles.toolBtn}
              onClick={() => {
                setZoom(100)
                setRotation(0)
              }}
            >
              Song song 1:1
            </button>
            <button
              type="button"
              className={styles.toolBtn}
              onClick={() => {
                window.print()
              }}
            >
              <Download size={14} /> Tải PDF có CKS
            </button>
          </div>
        </header>

        {/* Body Grid */}
        <div className={styles.bodyGrid}>
          {/* Left: Diploma Canvas */}
          <div className={styles.canvasArea}>
            <div
              className={styles.diplomaPaper}
              style={{
                transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
              }}
            >
              <span className={styles.matchRegionPill}>
                <Sparkles size={11} />
                VÙNG KHỚP DỮ LIỆU: NGÀNH TÂM LÝ HỌC LÂM SÀNG
              </span>

              <div className={styles.diplomaInner}>
                <div className={styles.watermark}>
                  BẢN THẨM ĐỊNH • MENTALBRIDGE
                </div>

                <div className={styles.diplomaHeader}>
                  <p className={styles.ministryLine}>
                    BỘ GIÁO DỤC VÀ ĐÀO TẠO • BỘ Y TẾ
                  </p>
                  <p className={styles.universityLine}>
                    ĐẠI HỌC Y DƯỢC THÀNH PHỐ HỒ CHÍ MINH
                  </p>
                  <h3 className={styles.diplomaTitle}>BẰNG THẠC SĨ</h3>
                  <div className={styles.diplomaSubtitle}>(MASTER DIPLOMA)</div>
                  <p className={styles.recognizeLine}>
                    HIỆU TRƯỞNG TRƯỜNG ĐẠI HỌC Y DƯỢC TP. HỒ CHÍ MINH CÔNG NHẬN:
                  </p>
                  <div className={styles.recipientName}>
                    {specialistName
                      .toUpperCase()
                      .replace(/^THS\.\s*BS\.\s*/i, '')}
                  </div>
                  <div className={styles.personalInfo}>
                    Ngày sinh: 15/05/1978 • Nơi sinh: TP. Hồ Chí Minh
                  </div>
                  <div className={styles.majorStatement}>
                    Đã hoàn thành chương trình đào tạo Thạc sĩ ngành:
                  </div>
                  <div className={styles.majorName}>{major}</div>
                  <div className={styles.graduationRank}>
                    Hình thức đào tạo: <strong>Chính quy tập trung</strong> •
                    Xếp loại tốt nghiệp: <strong>{graduationRank}</strong>
                  </div>
                </div>

                <div className={styles.diplomaFooter}>
                  <div className={styles.codeBlock}>
                    <div>Số hiệu văn bằng: {diplomaNumber}/YDS-2019</div>
                    <div>Số vào sổ cấp bằng: {registrationNumber}</div>
                    <div>Phôi bằng số: BGD-2019/8812Y</div>
                  </div>

                  <div className={styles.signatureBlock}>
                    <div className={styles.dateCity}>
                      TP. Hồ Chí Minh, ngày {issueDate}
                    </div>
                    <div className={styles.rectorTitle}>HIỆU TRƯỞNG</div>
                    <div className={styles.stampUniversityCircle}>
                      <span>★ BỘ Y TẾ ★</span>
                      <span>ĐẠI HỌC Y DƯỢC</span>
                      <span>TP.HCM</span>
                      <span>★ ĐÃ XÁC THỰC CKS ★</span>
                    </div>
                    <div className={styles.signatureScript}>Trần Diệp Tuấn</div>
                  </div>
                </div>
              </div>

              <span className={styles.sealPill}>
                <CheckCircle2 size={13} color="#059669" />
                Phôi bằng Bộ GD&ĐT & Tem chống giả nguyên vẹn
              </span>
            </div>
          </div>

          {/* Right: 1:1 Verification Panel */}
          <aside
            className={styles.sidePanel}
            aria-label="Bảng đối soát thông tin văn bằng Thạc sĩ"
          >
            <div className={styles.sideHeader}>
              <h3>Đối soát văn bằng 1:1</h3>
              <span className={styles.shaBadge} title={`SHA-256: ${sha256}`}>
                SHA-256: {sha256.slice(0, 8)}…{sha256.slice(-5)}
              </span>
            </div>

            <div className={styles.checkCard}>
              <div className={styles.checkCardHeader}>
                <span className={styles.checkCardTitle}>HỌ VÀ TÊN BÁC SĨ</span>
                <span
                  className={`${styles.statusTag} ${styles.statusTagGreen}`}
                >
                  Khớp 100%
                </span>
              </div>
              <div className={styles.comparisonRow}>
                <div className={styles.compCol}>
                  <small>Khai báo MentalBridge:</small>
                  <strong>{specialistName}</strong>
                </div>
                <div className={styles.compCol}>
                  <small>CSDL Đào tạo SĐH:</small>
                  <strong>
                    {specialistName.replace(/^THS\.\s*BS\.\s*/i, '')}
                  </strong>
                </div>
              </div>
            </div>

            <div className={styles.checkCard}>
              <div className={styles.checkCardHeader}>
                <span className={styles.checkCardTitle}>
                  BẰNG CẤP & CHUYÊN NGÀNH
                </span>
                <span
                  className={`${styles.statusTag} ${styles.statusTagGreen}`}
                >
                  Đạt chuẩn chuyên môn
                </span>
              </div>
              <div className={styles.comparisonRow}>
                <div className={styles.compCol}>
                  <small>Đăng ký hồ sơ:</small>
                  <strong>Thạc sĩ Tâm lý học lâm sàng</strong>
                </div>
                <div className={styles.compCol}>
                  <small>Văn bằng gốc:</small>
                  <strong>{major}</strong>
                </div>
              </div>
            </div>

            <div className={styles.checkCard}>
              <div className={styles.checkCardHeader}>
                <span className={styles.checkCardTitle}>CƠ SỞ ĐÀO TẠO</span>
                <span
                  className={`${styles.statusTag} ${styles.statusTagGreen}`}
                >
                  Khớp 100%
                </span>
              </div>
              <div className={styles.comparisonRow}>
                <div className={styles.compCol}>
                  <small>Khai báo:</small>
                  <strong>{university}</strong>
                </div>
                <div className={styles.compCol}>
                  <small>Cơ sở cấp văn bằng:</small>
                  <strong>Đại học Y Dược TP.HCM (Chính quy)</strong>
                </div>
              </div>
            </div>

            <div className={styles.checkCard}>
              <div className={styles.checkCardHeader}>
                <span className={styles.checkCardTitle}>
                  SỐ HIỆU & SỐ VÀO SỔ
                </span>
                <span
                  className={`${styles.statusTag} ${styles.statusTagGreen}`}
                >
                  Hợp lệ & Đã tra cứu
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#1e293b' }}>
                <strong>
                  {diplomaNumber} • Số: {registrationNumber}
                </strong>
                <p
                  style={{
                    margin: '4px 0 0',
                    color: '#64748b',
                    fontSize: '0.72rem',
                  }}
                >
                  Cấp: {issueDate} • Đã đối chiếu Cổng Tra cứu Sau đại học ĐHYD.
                </p>
              </div>
            </div>

            <div className={styles.checkCard}>
              <div className={styles.checklistTitle}>
                TIÊU CHÍ KIỂM ĐỊNH HỌC THUẬT (FOUR-EYES CHECKLIST)
              </div>
              <div className={styles.checklist}>
                <label className={styles.checkItem}>
                  <input
                    type="checkbox"
                    checked={checklist.registry}
                    onChange={(e) =>
                      setChecklist((c) => ({
                        ...c,
                        registry: e.target.checked,
                      }))
                    }
                  />
                  <span>
                    Tra cứu khớp số hiệu trên Cổng thông tin văn bằng Sau đại
                    học ĐHYD
                  </span>
                </label>
                <label className={styles.checkItem}>
                  <input
                    type="checkbox"
                    checked={checklist.clinicalFrame}
                    onChange={(e) =>
                      setChecklist((c) => ({
                        ...c,
                        clinicalFrame: e.target.checked,
                      }))
                    }
                  />
                  <span>
                    Đúng khung đào tạo lâm sàng 2 năm tập trung theo quy định
                  </span>
                </label>
                <label className={styles.checkItem}>
                  <input
                    type="checkbox"
                    checked={checklist.securityPattern}
                    onChange={(e) =>
                      setChecklist((c) => ({
                        ...c,
                        securityPattern: e.target.checked,
                      }))
                    }
                  />
                  <span>
                    Phôi bằng đạt chuẩn Bộ GD&ĐT, hoa văn bảo an và chữ ký số
                    hợp lệ
                  </span>
                </label>
              </div>
            </div>

            <p className={styles.auditDisclaimer}>
              Mọi thao tác phóng to, đối chiếu và lưu duyệt được ghi lại trong
              nhật ký kiểm toán hệ thống.
            </p>
          </aside>
        </div>

        {/* Footer Bar */}
        <footer className={styles.footerBar}>
          <div className={styles.footerLeft}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={onClose}
            >
              Đóng xem trước (ESC)
            </button>
            <button
              type="button"
              className={styles.btnDangerText}
              onClick={() => {
                alert('Đã ghi nhận báo cáo nghi vấn văn bằng học thuật.')
              }}
            >
              <Flag size={14} /> Báo cáo nghi vấn văn bằng
            </button>
          </div>

          <div className={styles.footerRight}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => {
                onRequestTranscripts?.()
                onClose()
              }}
            >
              Yêu cầu cung cấp bảng điểm gốc
            </button>
            <button
              type="button"
              className={styles.btnPrimaryGreen}
              onClick={() => {
                onConfirmVerified?.()
                onClose()
              }}
            >
              <Check size={16} /> Xác nhận Bằng Thạc sĩ hợp lệ
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
