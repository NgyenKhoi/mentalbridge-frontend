'use client'

import { useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { useFeedback } from '@/components/ui/FeedbackProvider'
import { ApiError } from '@/lib/api/api-error'
import type {
  Appointment,
  AppointmentRating,
} from '@/lib/consultation/consultation-validation'
import { appointmentBrowserClient } from '../api/browser-client'
import styles from './AppointmentRatingDialog.module.css'

type Props = Readonly<{
  appointment: Appointment
}>

function errorMessage(error: unknown) {
  if (!(error instanceof ApiError))
    return 'Chưa thể lưu đánh giá. Vui lòng thử lại.'
  if (error.code === 'RATING_VERSION_MISMATCH')
    return 'Đánh giá đã thay đổi ở nơi khác. Hãy tải lại trước khi lưu.'
  if (error.code === 'APPOINTMENT_NOT_RATEABLE')
    return 'Buổi hẹn này chưa đủ điều kiện để đánh giá.'
  return 'Chưa thể lưu đánh giá. Vui lòng thử lại.'
}

export function AppointmentRatingDialog({ appointment }: Props) {
  const { showActionToast } = useFeedback()
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState<AppointmentRating | null>(null)
  const [selected, setSelected] = useState(0)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setReady(false)
    setError('')
    try {
      const rating = await appointmentBrowserClient.rating(appointment.id)
      setCurrent(rating)
      setSelected(rating.rating)
      setReady(true)
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 404) {
        setCurrent(null)
        setSelected(0)
        setReady(true)
      } else {
        setError('Chưa thể tải đánh giá hiện tại. Vui lòng thử lại.')
      }
    } finally {
      setLoading(false)
    }
  }

  function show() {
    setOpen(true)
    void load()
  }

  async function save() {
    if (selected < 1 || selected > 5) return
    setSaving(true)
    setError('')
    try {
      const saved = await appointmentBrowserClient.saveRating(
        appointment.id,
        selected,
        current?.version,
      )
      setCurrent(saved)
      setOpen(false)
      showActionToast({
        title: current ? 'Đã cập nhật đánh giá' : 'Đã gửi đánh giá',
        description: `Bạn đã đánh giá ${saved.rating}/5 cho buổi tư vấn này.`,
        tone: 'success',
      })
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button type="button" className={styles.trigger} onClick={show}>
        <span aria-hidden="true">★</span>
        {current ? `Đã đánh giá · ${current.rating}/5` : 'Đánh giá chuyên gia'}
      </button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        labelledBy={`rating-title-${appointment.id}`}
        describedBy={`rating-description-${appointment.id}`}
        className={styles.dialog}
      >
        <div className={styles.content}>
          <header>
            <div className={styles.eyebrow}>Sau buổi tư vấn</div>
            <h2 id={`rating-title-${appointment.id}`}>
              Đánh giá trải nghiệm của bạn
            </h2>
            <p id={`rating-description-${appointment.id}`}>
              Điểm của bạn giúp phản ánh trải nghiệm thực tế với{' '}
              {appointment.specialistDisplayName}.
            </p>
          </header>

          {loading ? (
            <div className={styles.loading} role="status">
              Đang tải đánh giá…
            </div>
          ) : (
            <fieldset className={styles.rating} disabled={saving}>
              <legend>Chọn từ 1 đến 5 sao</legend>
              <div className={styles.stars}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    data-selected={value <= selected}
                    aria-pressed={selected === value}
                    aria-label={`${value} sao`}
                    onClick={() => setSelected(value)}
                  >
                    ★
                  </button>
                ))}
              </div>
              <output aria-live="polite">
                {selected > 0
                  ? `${selected}/5 · ${selected >= 4 ? 'Trải nghiệm tích cực' : selected === 3 ? 'Trải nghiệm ổn' : 'Cần cải thiện'}`
                  : 'Chưa chọn điểm'}
              </output>
            </fieldset>
          )}

          {error && (
            <div className={styles.error} role="alert">
              <p>{error}</p>
              {!ready && !loading && (
                <button type="button" onClick={() => void load()}>
                  Thử lại
                </button>
              )}
            </div>
          )}

          <footer>
            <button
              type="button"
              className={styles.cancel}
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Để sau
            </button>
            <button
              type="button"
              className={styles.submit}
              onClick={() => void save()}
              disabled={!ready || loading || saving || selected === 0}
            >
              {saving
                ? 'Đang lưu…'
                : current
                  ? 'Cập nhật đánh giá'
                  : 'Gửi đánh giá'}
            </button>
          </footer>
        </div>
      </Dialog>
    </>
  )
}
