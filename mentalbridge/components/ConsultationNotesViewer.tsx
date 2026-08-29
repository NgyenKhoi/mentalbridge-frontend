'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ConsultationNotesModal, { type ConsultationNote } from './ConsultationNotesModal';
import './ConsultationNotesViewer.css';

interface ConsultationNotesViewerProps {
  appointmentId: string;
  clientName: string;
  date: string;
  time: string;
  notes?: ConsultationNote;
  onNotesUpdate?: (notes: ConsultationNote) => void;
}

export default function ConsultationNotesViewer({
  appointmentId,
  clientName,
  date,
  time,
  notes,
  onNotesUpdate
}: ConsultationNotesViewerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSaveNotes = (noteData: Omit<ConsultationNote, 'id' | 'createdAt' | 'updatedAt'>) => {
    const timestamp = new Date().toISOString();
    const savedNote: ConsultationNote = {
      id: `note_${appointmentId}_${Date.now()}`,
      ...noteData,
      createdAt: notes?.createdAt || timestamp,
      updatedAt: timestamp
    };

    onNotesUpdate?.(savedNote);
    setIsModalOpen(false);
  };

  const getRiskLevelDisplay = (level: string) => {
    switch (level) {
      case 'high': return { text: 'Cao - Cần can thiệp khẩn cấp', className: 'high' };
      case 'medium': return { text: 'Trung bình - Cần theo dõi', className: 'medium' };
      default: return { text: 'Thấp - Ổn định', className: 'low' };
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!notes) {
    return (
      <div className="consultation-notes-viewer">
        <div className="consultation-notes-empty">
          <div className="consultation-notes-empty-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
              <polyline points="14,2 14,8 20,8"/>
              <path d="M12 18v-6"/>
              <path d="M9 15h6"/>
            </svg>
          </div>
          <div className="consultation-notes-empty-content">
            <h3>Chưa có ghi chú tư vấn</h3>
            <p>Thêm ghi chú chuyên môn để theo dõi tiến trình của khách hàng</p>
            <button 
              className="consultation-notes-add-btn"
              onClick={() => setIsModalOpen(true)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14"/>
                <path d="M5 12h14"/>
              </svg>
              Thêm ghi chú tư vấn
            </button>
          </div>
        </div>

        {isModalOpen && (
          <ConsultationNotesModal
            appointmentId={appointmentId}
            clientName={clientName}
            date={date}
            time={time}
            onClose={() => setIsModalOpen(false)}
            onSave={handleSaveNotes}
          />
        )}
      </div>
    );
  }

  const riskLevel = getRiskLevelDisplay(notes.riskLevel);

  return (
    <div className="consultation-notes-viewer">
      <div className="consultation-notes-card">
        <div className="consultation-notes-card-header">
          <div className="consultation-notes-meta">
            <div className="consultation-notes-status">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                <polyline points="14,2 14,8 20,8"/>
                <path d="M9 15h6"/>
              </svg>
              <span>Đã có ghi chú</span>
            </div>
            <div className={`consultation-notes-risk ${riskLevel.className}`}>
              {riskLevel.text}
            </div>
          </div>
          <div className="consultation-notes-actions">
            <button 
              className="consultation-notes-expand-btn"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? 'Thu gọn' : 'Xem chi tiết'}
              <svg 
                width="14" 
                height="14" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
                style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
              >
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>
            <button 
              className="consultation-notes-edit-btn"
              onClick={() => setIsModalOpen(true)}
            >
              Chỉnh sửa
            </button>
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              className="consultation-notes-content"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="consultation-notes-sections">
                <div className="consultation-notes-section">
                  <h4>Tóm tắt phiên tư vấn</h4>
                  <p>{notes.sessionSummary}</p>
                </div>

                <div className="consultation-notes-section">
                  <h4>Quan sát và đánh giá</h4>
                  <p>{notes.keyObservations}</p>
                </div>

                {notes.recommendations && (
                  <div className="consultation-notes-section">
                    <h4>Khuyến nghị và can thiệp</h4>
                    <p>{notes.recommendations}</p>
                  </div>
                )}

                {notes.nextSteps && (
                  <div className="consultation-notes-section">
                    <h4>Kế hoạch theo dõi</h4>
                    <p>{notes.nextSteps}</p>
                  </div>
                )}

                {notes.followUpDate && (
                  <div className="consultation-notes-section">
                    <h4>Lịch hẹn tiếp theo</h4>
                    <p>{new Date(notes.followUpDate).toLocaleDateString('vi-VN', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}</p>
                  </div>
                )}

                {notes.confidentialNotes && (
                  <div className="consultation-notes-section consultation-notes-confidential">
                    <h4>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <circle cx="12" cy="16" r="1"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                      Ghi chú bảo mật
                    </h4>
                    <p>{notes.confidentialNotes}</p>
                  </div>
                )}
              </div>

              <div className="consultation-notes-footer">
                <div className="consultation-notes-timestamp">
                  <span>Tạo lúc: {formatDate(notes.createdAt)}</span>
                  {notes.updatedAt && notes.updatedAt !== notes.createdAt && (
                    <span>Cập nhật: {formatDate(notes.updatedAt)}</span>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {isModalOpen && (
        <ConsultationNotesModal
          appointmentId={appointmentId}
          clientName={clientName}
          date={date}
          time={time}
          existingNotes={notes}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveNotes}
        />
      )}
    </div>
  );
}