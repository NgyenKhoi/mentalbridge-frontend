'use client'

import LightSelect from './LightSelect'

export type AppointmentForm = {
  client: string
  date: string
  startTime: string
  duration: string
  format: string
  notes: string
}

type AppointmentModalProps = {
  open: boolean
  form: AppointmentForm
  onChange: (patch: Partial<AppointmentForm>) => void
  onClose: () => void
  onSubmit: () => void
}

const durationOptions = [
  { value: '30', label: '30 phút' },
  { value: '45', label: '45 phút' },
  { value: '60', label: '60 phút' },
  { value: '90', label: '90 phút' },
]

const formatOptions = [
  { value: 'Video call', label: 'Video call' },
  { value: 'Tại phòng tư vấn', label: 'Tại phòng tư vấn' },
  { value: 'Điện thoại', label: 'Điện thoại' },
]

const clientOptions = [
  { value: 'Nguyễn Minh Anh', label: 'Nguyễn Minh Anh' },
  { value: 'Trần Gia Hân', label: 'Trần Gia Hân' },
  { value: 'Lê Hoàng Nam', label: 'Lê Hoàng Nam' },
]

export default function AppointmentModal({
  open,
  form,
  onChange,
  onClose,
  onSubmit,
}: AppointmentModalProps) {
  if (!open) return null

  return (
    <div className="role-modal-wrap availability-modal-wrap appointment-modal-custom-wrap">
      <button
        className="role-drawer-backdrop"
        aria-label="Đóng"
        onClick={onClose}
      />
      <div className="availability-modal appointment-modal">
        <div className="availability-modal-header">
          <div>
            <span className="availability-modal-eyebrow">TẠO LỊCH HẸN</span>
            <h2>Đặt một phiên tư vấn</h2>
            <p>
              Chọn khách hàng và thời gian cụ thể cho cuộc hẹn đã được thống
              nhất.
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
              <label htmlFor="appointment-client-custom">Khách hàng</label>
              <LightSelect
                id="appointment-client-custom"
                value={form.client}
                onChange={(client) => onChange({ client })}
                placeholder="Chọn khách hàng"
                options={clientOptions}
              />
            </div>
            <div className="availability-form-row">
              <div className="availability-form-field">
                <label htmlFor="appointment-date-custom">Ngày hẹn</label>
                <input
                  type="date"
                  id="appointment-date-custom"
                  value={form.date}
                  onChange={(event) => onChange({ date: event.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="availability-form-field">
                <label htmlFor="appointment-start-custom">Giờ bắt đầu</label>
                <input
                  type="time"
                  id="appointment-start-custom"
                  value={form.startTime}
                  onChange={(event) =>
                    onChange({ startTime: event.target.value })
                  }
                />
              </div>
            </div>
            <div className="availability-form-row">
              <div className="availability-form-field">
                <label htmlFor="appointment-duration-custom">Thời lượng</label>
                <LightSelect
                  id="appointment-duration-custom"
                  value={form.duration}
                  onChange={(duration) => onChange({ duration })}
                  options={durationOptions}
                />
              </div>
              <div className="availability-form-field">
                <label htmlFor="appointment-format-custom">
                  Hình thức tư vấn
                </label>
                <LightSelect
                  id="appointment-format-custom"
                  value={form.format}
                  onChange={(format) => onChange({ format })}
                  options={formatOptions}
                />
              </div>
            </div>
            <div className="availability-form-field">
              <label htmlFor="appointment-notes-custom">
                Ghi chú (tùy chọn)
              </label>
              <textarea
                id="appointment-notes-custom"
                value={form.notes}
                onChange={(event) => onChange({ notes: event.target.value })}
                placeholder="Thêm ghi chú chuẩn bị cho phiên tư vấn..."
                rows={3}
              />
            </div>
          </div>
          <div className="availability-info-box appointment-info-box">
            <span className="availability-info-icon">ⓘ</span>
            <div>
              <strong>Cuộc hẹn sẽ được thêm vào lịch làm việc</strong>
              <p>
                Khách hàng có thể nhận thông báo sau khi cuộc hẹn được xác nhận.
              </p>
            </div>
          </div>
          <div className="availability-summary">
            <h3>Tóm tắt cuộc hẹn</h3>
            <div className="availability-summary-grid">
              <div className="availability-summary-item">
                <small>Khách hàng</small>
                <strong>{form.client || 'Chưa chọn'}</strong>
              </div>
              <div className="availability-summary-item">
                <small>Thời gian</small>
                <strong>
                  {form.startTime
                    ? `${form.startTime} · ${form.duration} phút`
                    : 'Chưa chọn'}
                </strong>
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
            disabled={!form.client || !form.date || !form.startTime}
          >
            Tạo lịch hẹn
          </button>
        </div>
      </div>
    </div>
  )
}
