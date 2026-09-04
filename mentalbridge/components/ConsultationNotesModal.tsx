'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import './ConsultationNotesModal.css'

export interface ConsultationNote {
  id: string
  appointmentId: string
  clientName: string
  date: string
  time: string
  sessionSummary: string
  keyObservations: string
  recommendations: string
  nextSteps: string
  riskLevel: 'low' | 'medium' | 'high'
  followUpDate?: string
  confidentialNotes: string
  createdAt: string
  updatedAt?: string
}

interface ConsultationNotesModalProps {
  appointmentId: string
  clientName: string
  date: string
  time: string
  existingNotes?: ConsultationNote
  onClose: () => void
  onSave: (
    notes: Omit<ConsultationNote, 'id' | 'createdAt' | 'updatedAt'>,
  ) => void
}

export default function ConsultationNotesModal({
  appointmentId,
  clientName,
  date,
  time,
  existingNotes,
  onClose,
  onSave,
}: ConsultationNotesModalProps) {
  const [formData, setFormData] = useState({
    sessionSummary: existingNotes?.sessionSummary || '',
    keyObservations: existingNotes?.keyObservations || '',
    recommendations: existingNotes?.recommendations || '',
    nextSteps: existingNotes?.nextSteps || '',
    riskLevel: existingNotes?.riskLevel || ('low' as const),
    followUpDate: existingNotes?.followUpDate || '',
    confidentialNotes: existingNotes?.confidentialNotes || '',
  })

  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))

    const noteData = {
      appointmentId,
      clientName,
      date,
      time,
      ...formData,
    }

    onSave(noteData)
    setIsSaving(false)
  }

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const isEditing = !!existingNotes

  return (
    <>
      <motion.div
        className="consultation-notes-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
      />

      <div className="consultation-notes-container">
        <motion.div
          className="consultation-notes-modal"
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <header className="consultation-notes-header">
            <div className="consultation-notes-title">
              <div className="consultation-notes-badge">
                {isEditing ? 'CHỈNH SỬA GHI CHÚ' : 'THÊM GHI CHÚ TƯ VẤN'}
              </div>
              <h2>{clientName}</h2>
              <p>
                {date} • {time}
              </p>
            </div>
            <button
              className="consultation-notes-close"
              onClick={onClose}
              disabled={isSaving}
            >
              ×
            </button>
          </header>

          <form onSubmit={handleSubmit} className="consultation-notes-form">
            <div className="consultation-notes-content">
              <div className="consultation-notes-section">
                <label className="consultation-notes-label">
                  <span>Tóm tắt phiên tư vấn</span>
                  <textarea
                    className="consultation-notes-textarea"
                    rows={4}
                    placeholder="Mô tả tổng quan về phiên tư vấn, chủ đề chính được thảo luận..."
                    value={formData.sessionSummary}
                    onChange={(e) =>
                      handleChange('sessionSummary', e.target.value)
                    }
                    required
                  />
                </label>
              </div>

              <div className="consultation-notes-section">
                <label className="consultation-notes-label">
                  <span>Quan sát và đánh giá</span>
                  <textarea
                    className="consultation-notes-textarea"
                    rows={4}
                    placeholder="Ghi chú về tình trạng tâm lý, hành vi, cảm xúc của khách hàng..."
                    value={formData.keyObservations}
                    onChange={(e) =>
                      handleChange('keyObservations', e.target.value)
                    }
                    required
                  />
                </label>
              </div>

              <div className="consultation-notes-section">
                <label className="consultation-notes-label">
                  <span>Khuyến nghị và can thiệp</span>
                  <textarea
                    className="consultation-notes-textarea"
                    rows={3}
                    placeholder="Các phương pháp can thiệp, bài tập, kỹ thuật được đề xuất..."
                    value={formData.recommendations}
                    onChange={(e) =>
                      handleChange('recommendations', e.target.value)
                    }
                  />
                </label>
              </div>

              <div className="consultation-notes-section">
                <label className="consultation-notes-label">
                  <span>Kế hoạch theo dõi</span>
                  <textarea
                    className="consultation-notes-textarea"
                    rows={3}
                    placeholder="Mục tiêu cho phiên tiếp theo, nhiệm vụ về nhà, kế hoạch điều trị..."
                    value={formData.nextSteps}
                    onChange={(e) => handleChange('nextSteps', e.target.value)}
                  />
                </label>
              </div>

              <div className="consultation-notes-row">
                <div className="consultation-notes-section">
                  <label className="consultation-notes-label">
                    <span>Mức độ rủi ro</span>
                    <select
                      className="consultation-notes-select"
                      value={formData.riskLevel}
                      onChange={(e) =>
                        handleChange('riskLevel', e.target.value)
                      }
                    >
                      <option value="low">Thấp - Ổn định</option>
                      <option value="medium">Trung bình - Cần theo dõi</option>
                      <option value="high">Cao - Cần can thiệp khẩn cấp</option>
                    </select>
                  </label>
                </div>

                <div className="consultation-notes-section">
                  <label className="consultation-notes-label">
                    <span>Lịch hẹn tiếp theo (tùy chọn)</span>
                    <input
                      type="date"
                      className="consultation-notes-input"
                      value={formData.followUpDate}
                      onChange={(e) =>
                        handleChange('followUpDate', e.target.value)
                      }
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </label>
                </div>
              </div>

              <div className="consultation-notes-section">
                <label className="consultation-notes-label">
                  <span>Ghi chú bảo mật</span>
                  <textarea
                    className="consultation-notes-textarea"
                    rows={2}
                    placeholder="Thông tin nhạy cảm, chi tiết cá nhân chỉ dành cho chuyên gia..."
                    value={formData.confidentialNotes}
                    onChange={(e) =>
                      handleChange('confidentialNotes', e.target.value)
                    }
                  />
                </label>
              </div>
            </div>

            <footer className="consultation-notes-footer">
              <div className="consultation-notes-privacy">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <circle cx="12" cy="16" r="1" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span>Ghi chú này được mã hóa và chỉ bạn có thể truy cập</span>
              </div>

              <div className="consultation-notes-actions">
                <button
                  type="button"
                  className="consultation-notes-btn consultation-notes-btn-cancel"
                  onClick={onClose}
                  disabled={isSaving}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="consultation-notes-btn consultation-notes-btn-save"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <div className="consultation-notes-spinner" />
                      Đang lưu...
                    </>
                  ) : (
                    <>
                      {isEditing ? 'Cập nhật ghi chú' : 'Lưu ghi chú'}
                      <span>→</span>
                    </>
                  )}
                </button>
              </div>
            </footer>
          </form>
        </motion.div>
      </div>
    </>
  )
}
