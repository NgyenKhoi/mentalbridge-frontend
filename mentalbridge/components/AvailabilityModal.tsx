'use client'

import LightSelect from './LightSelect'

export type AvailabilityForm = {
  date: string
  startTime: string
  endTime: string
  duration: string
  notes: string
}

type AvailabilityModalProps = {
  open: boolean
  form: AvailabilityForm
  onChange: (patch: Partial<AvailabilityForm>) => void
  onClose: () => void
  onSubmit: () => void
}

const durationOptions = [
  { value: '30', label: '30 phút' },
  { value: '45', label: '45 phút' },
  { value: '60', label: '60 phút' },
  { value: '90', label: '90 phút' },
]

export default function AvailabilityModal({
  open,
  form,
  onChange,
  onClose,
  onSubmit,
}: AvailabilityModalProps) {
  if (!open) return null
  const sessionCount =
    form.startTime && form.endTime
      ? Math.max(
          0,
          Math.floor(
            (new Date(`1970-01-01T${form.endTime}`).getTime() -
              new Date(`1970-01-01T${form.startTime}`).getTime()) /
              60000 /
              Number(form.duration),
          ),
        )
      : 0

  return (
    <div className="role-modal-wrap availability-modal-wrap availability-modal-custom-wrap">
      <button
        className="role-drawer-backdrop"
        aria-label="Đóng"
        onClick={onClose}
      />
      <div className="availability-modal">
        <div className="availability-modal-header">
          <div>
            <span className="availability-modal-eyebrow">TẠO LỊCH TRỐNG</span>
            <h2>Thiết lập khung giờ</h2>
            <p>
              Xác định phạm vi nhận tư vấn - chỉ bạn có quyền xem và cập nhật.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="availability-modal-close"
          >
            ×
          </button>
        </div>
        <div className="availability-modal-content">
          <div className="availability-form-grid">
            <div className="availability-form-field">
              <label htmlFor="availability-date-custom">Ngày khả dụng</label>
              <input
                type="date"
                id="availability-date-custom"
                value={form.date}
                onChange={(event) => onChange({ date: event.target.value })}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="availability-form-row">
              <div className="availability-form-field">
                <label htmlFor="availability-start-custom">Giờ bắt đầu</label>
                <input
                  type="time"
                  id="availability-start-custom"
                  value={form.startTime}
                  onChange={(event) =>
                    onChange({ startTime: event.target.value })
                  }
                />
              </div>
              <div className="availability-form-field">
                <label htmlFor="availability-end-custom">Giờ kết thúc</label>
                <input
                  type="time"
                  id="availability-end-custom"
                  value={form.endTime}
                  onChange={(event) =>
                    onChange({ endTime: event.target.value })
                  }
                />
              </div>
            </div>
            <div className="availability-form-field">
              <label htmlFor="availability-duration-custom">
                Thời lượng mỗi phiên (phút)
              </label>
              <LightSelect
                id="availability-duration-custom"
                value={form.duration}
                onChange={(duration) => onChange({ duration })}
                options={durationOptions}
              />
            </div>
            <div className="availability-form-field">
              <label htmlFor="availability-notes-custom">
                Ghi chú (tùy chọn)
              </label>
              <textarea
                id="availability-notes-custom"
                value={form.notes}
                onChange={(event) => onChange({ notes: event.target.value })}
                placeholder="Ghi chú nội bộ về khung giờ này..."
                rows={3}
              />
            </div>
          </div>
          <div className="availability-info-box">
            <span className="availability-info-icon">ⓘ</span>
            <div>
              <strong>
                Khung giờ chỉ hiển thị với khách hàng khi được lưu
              </strong>
              <p>Bạn có thể cập nhật hoặc xóa các khung giờ chưa được đặt.</p>
            </div>
          </div>
          <div className="availability-summary">
            <h3>Tóm tắt ngày làm việc</h3>
            <div className="availability-summary-grid">
              <div className="availability-summary-item">
                <small>Khung giờ</small>
                <strong>
                  {form.startTime && form.endTime
                    ? `${form.startTime} - ${form.endTime}`
                    : 'Chưa chọn'}
                </strong>
              </div>
              <div className="availability-summary-item">
                <small>Số phiên có thể tạo</small>
                <strong>{sessionCount} phiên</strong>
              </div>
            </div>
          </div>
        </div>
        <div className="availability-modal-footer">
          <button className="btn-ghost" onClick={onClose}>
            Hủy
          </button>
          <button
            className="btn-primary"
            onClick={onSubmit}
            disabled={!form.date || !form.startTime || !form.endTime}
          >
            Tạo lịch trống
          </button>
        </div>
      </div>
    </div>
  )
}
