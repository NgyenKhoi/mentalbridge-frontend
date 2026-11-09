'use client'

import { useEffect, useState } from 'react'
import {
  Check,
  CheckCircle2,
  Download,
  Flag,
  FileBadge2,
  Minus,
  Plus,
  RotateCw,
  Sparkles,
  X,
} from 'lucide-react'
import styles from './CchnFullscreenModal.module.css'

export type CchnModalProps = Readonly<{
  open: boolean
  onClose: () => void
  onConfirmVerified?: () => void
  onRequestReshoot?: () => void
  specialistName?: string
  specialistCode?: string
  cchnNumber?: string
  issueDate?: string
  expiryDate?: string
  remainingText?: string
  issuer?: string
  scope?: string
  sha256?: string
}>

export default function CchnFullscreenModal({
  open,
  onClose,
  onConfirmVerified,
  onRequestReshoot,
  specialistName = 'ThS. BS. Hồ Thị Hồng',
  specialistCode = '#MB-482',
  cchnNumber = '019283/BYT',
  issueDate = '12/04/2021',
  expiryDate = '15/04/2029',
  remainingText = 'Còn 4 năm 8 tháng',
  issuer = 'Sở Y Tế TP.HCM',
  scope = 'Khám bệnh, chữa bệnh chuyên khoa Tâm thần',
  sha256 = 'd9f824b7a12e84c9034fbe7193bca9810f27b1a8',
}: CchnModalProps) {
  const [zoom, setZoom] = useState(125)
  const [rotation, setRotation] = useState(0)
  const [checklist, setChecklist] = useState({
    cks: true,
    noAi: true,
    vneid: true,
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
      aria-labelledby="cchn-modal-title"
    >
      <div className={styles.modal}>
        {/* Top Header */}
        <header className={styles.topBar}>
          <div className={styles.titleArea}>
            <div className={styles.iconBox}>
              <FileBadge2 size={22} />
            </div>
            <div className={styles.titles}>
              <div className={styles.titleLine}>
                <h2 id="cchn-modal-title">
                  Chứng chỉ hành nghề KCB #{cchnNumber}
                </h2>
                <span className={styles.verifiedBadge}>
                  <CheckCircle2 size={12} />
                  Đối chiếu CSDL Quốc gia - Khớp 100%
                </span>
                <span className={styles.cksChip}>
                  <Check size={12} />
                  CKS: TS.BS. Trần Văn An (GĐ Sở Y Tế)
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
                {specialistCode}) • {issuer} cấp ngày {issueDate}
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
          {/* Left: Document Canvas */}
          <div className={styles.canvasArea}>
            <div
              className={styles.documentPaper}
              style={{
                transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
              }}
            >
              <span className={styles.matchRegionPill}>
                <Sparkles size={11} />
                VÙNG KHỚP DỮ LIỆU: BÁC SĨ TÂM LÝ LÂM SÀNG
              </span>

              <div className={styles.docInnerBorder}>
                <div className={styles.watermark}>
                  BẢN THẨM ĐỊNH • MENTALBRIDGE
                </div>

                <div className={styles.docHeader}>
                  <p className={styles.docNation}>
                    CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                  </p>
                  <p className={styles.docMotto}>Độc lập - Tự do - Hạnh phúc</p>
                  <div className={styles.emblemBox}>
                    <div className={styles.emblemCircle}>★</div>
                  </div>
                  <h3 className={styles.docMainTitle}>
                    CHỨNG CHỈ HÀNH NGHỀ KHÁM BỆNH, CHỮA BỆNH
                  </h3>
                </div>

                <div className={styles.docFields}>
                  <div className={styles.docRow}>
                    <span className={styles.docLabel}>Họ và tên:</span>
                    <span className={styles.docValue}>
                      {specialistName
                        .toUpperCase()
                        .replace(/^THS\.\s*BS\.\s*/i, '')}
                    </span>
                  </div>
                  <div className={styles.docRow}>
                    <span className={styles.docLabel}>Ngày sinh:</span>
                    <span className={styles.docValue}>
                      15/05/1978 • Nơi sinh: TP. Hồ Chí Minh
                    </span>
                  </div>
                  <div className={styles.docRow}>
                    <span className={styles.docLabel}>
                      Số CMND / Căn cước công dân:
                    </span>
                    <span className={styles.docValue}>079178002931</span>
                  </div>
                  <div className={styles.docRow}>
                    <span className={styles.docLabel}>
                      Trình độ chuyên môn:
                    </span>
                    <span className={styles.docValue}>
                      Bác sĩ Chuyên khoa Nội tổng quát / Tâm lý Lâm sàng
                    </span>
                  </div>
                  <div className={styles.docRow}>
                    <span className={styles.docLabel}>
                      Phạm vi hoạt động chuyên môn:
                    </span>
                    <span className={styles.docValue}>{scope}</span>
                  </div>
                  <div className={styles.docRow}>
                    <span className={styles.docLabel}>Số chứng chỉ:</span>
                    <span className={styles.docValue}>
                      {cchnNumber}-CCHN/BYT
                    </span>
                  </div>
                </div>

                <div className={styles.docFooterSign}>
                  <div className={styles.stampSignatureArea}>
                    <div className={styles.stampCircle}>
                      <span>★ SỞ Y TẾ ★</span>
                      <span>TP. HỒ CHÍ MINH</span>
                      <span>ĐÃ XÁC THỰC CKS</span>
                    </div>
                    <div className={styles.signatureLine}>Trần Văn An</div>
                    <div className={styles.signerTitle}>
                      Giám đốc Sở Y Tế (Đã ký số)
                    </div>
                  </div>
                </div>
              </div>

              <span className={styles.sealPill}>
                <CheckCircle2 size={13} color="#059669" />
                Dấu mộc & chữ ký số nguyên bản hợp lệ
              </span>
            </div>
          </div>

          {/* Right: 1:1 Verification Panel */}
          <aside
            className={styles.sidePanel}
            aria-label="Bảng đối soát thông tin CCHN"
          >
            <div className={styles.sideHeader}>
              <h3>Đối soát thông tin 1:1</h3>
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
                  <small>CSDL Bộ Y Tế:</small>
                  <strong>
                    {specialistName.replace(/^THS\.\s*BS\.\s*/i, '')}
                  </strong>
                </div>
              </div>
            </div>

            <div className={styles.checkCard}>
              <div className={styles.checkCardHeader}>
                <span className={styles.checkCardTitle}>
                  SỐ CCHN & NGÀY CẤP
                </span>
                <span
                  className={`${styles.statusTag} ${styles.statusTagGreen}`}
                >
                  Khớp 100%
                </span>
              </div>
              <div className={styles.comparisonRow}>
                <div className={styles.compCol}>
                  <small>Số CCHN:</small>
                  <strong>{cchnNumber}</strong>
                </div>
                <div className={styles.compCol}>
                  <small>Ngày cấp:</small>
                  <strong>{issueDate}</strong>
                </div>
              </div>
            </div>

            <div className={styles.checkCard}>
              <div className={styles.checkCardHeader}>
                <span className={styles.checkCardTitle}>PHẠM VI HÀNH NGHỀ</span>
                <span
                  className={`${styles.statusTag} ${styles.statusTagGreen}`}
                >
                  Đạt chuẩn
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#1e293b' }}>
                <strong>{scope}</strong>
                <p
                  style={{
                    margin: '4px 0 0',
                    color: '#64748b',
                    fontSize: '0.72rem',
                  }}
                >
                  Đủ điều kiện tiếp nhận ca lâm sàng có thu phí & hỗ trợ kê đơn.
                </p>
              </div>
            </div>

            <div className={styles.checkCard}>
              <div className={styles.checkCardHeader}>
                <span className={styles.checkCardTitle}>THỜI HẠN HIỆU LỰC</span>
                <span
                  className={`${styles.statusTag} ${styles.statusTagGreen}`}
                >
                  Hợp lệ
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#1e293b' }}>
                Đến <strong>{expiryDate}</strong> ({remainingText})
              </div>
            </div>

            <div className={styles.checkCard}>
              <div className={styles.checklistTitle}>
                TIÊU CHÍ KIỂM ĐỊNH PHÁP LÝ (FOUR-EYES CHECKLIST)
              </div>
              <div className={styles.checklist}>
                <label className={styles.checkItem}>
                  <input
                    type="checkbox"
                    checked={checklist.cks}
                    onChange={(e) =>
                      setChecklist((c) => ({ ...c, cks: e.target.checked }))
                    }
                  />
                  <span>Chữ ký số cơ quan cấp hợp lệ & còn hiệu lực</span>
                </label>
                <label className={styles.checkItem}>
                  <input
                    type="checkbox"
                    checked={checklist.noAi}
                    onChange={(e) =>
                      setChecklist((c) => ({ ...c, noAi: e.target.checked }))
                    }
                  />
                  <span>Không phát hiện dấu hiệu can thiệp ảnh/AI</span>
                </label>
                <label className={styles.checkItem}>
                  <input
                    type="checkbox"
                    checked={checklist.vneid}
                    onChange={(e) =>
                      setChecklist((c) => ({ ...c, vneid: e.target.checked }))
                    }
                  />
                  <span>Khớp dữ liệu định danh VNeID mức 2</span>
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
                alert(
                  'Đã ghi nhận báo cáo nghi vấn CCHN để Hội đồng Pháp chế kiểm tra.',
                )
              }}
            >
              <Flag size={14} /> Báo cáo nghi vấn
            </button>
          </div>

          <div className={styles.footerRight}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => {
                onRequestReshoot?.()
                onClose()
              }}
            >
              Yêu cầu chụp lại bản gốc
            </button>
            <button
              type="button"
              className={styles.btnPrimaryGreen}
              onClick={() => {
                onConfirmVerified?.()
                onClose()
              }}
            >
              <Check size={16} /> Xác nhận CCHN hợp lệ
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
