'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import NewAppointmentModal, {
  type NewAppointment,
} from '@/components/NewAppointmentModal'
import AppointmentDetailModal, {
  type AppointmentDetail,
} from '@/components/AppointmentDetailModal'
import CancelAppointmentModal from '@/components/CancelAppointmentModal'
import RescheduleAppointmentModal, {
  type RescheduleUpdate,
} from '@/components/RescheduleAppointmentModal'
import VideoCallModal from '@/components/VideoCallModal'
import RateSpecialistModal, {
  type SpecialistReview,
} from '@/components/RateSpecialistModal'
import './appointments.css'

type Appointment = AppointmentDetail

const INITIAL_UPCOMING: Appointment[] = [
  {
    id: 1,
    specialistId: 1,
    specialist: 'TS. Nguyễn Thị Lan',
    avatar: '👩‍⚕️',
    date: '2026-08-15',
    time: '10:00 - 11:00',
    type: 'Video call',
    status: 'confirmed',
    price: '500.000đ',
    notes:
      'Tôi muốn trao đổi về tình trạng lo âu và khó ngủ trong vài tuần gần đây.',
    code: 'MB-0815-01',
  },
  {
    id: 2,
    specialistId: 2,
    specialist: 'ThS. Trần Văn Minh',
    avatar: '👨‍⚕️',
    date: '2026-08-20',
    time: '14:30 - 15:30',
    type: 'Tại phòng khám',
    status: 'pending',
    price: '400.000đ',
    notes: 'Áp lực công việc đang ảnh hưởng đến khả năng tập trung của tôi.',
    code: 'MB-0820-02',
  },
]

const INITIAL_PAST: Appointment[] = [
  {
    id: 3,
    specialistId: 1,
    specialist: 'TS. Nguyễn Thị Lan',
    avatar: '👩‍⚕️',
    date: '2026-08-08',
    time: '10:00 - 11:00',
    type: 'Video call',
    status: 'completed',
    price: '500.000đ',
    notes: 'Theo dõi tiến triển sau hai tuần thực hành bài tập thở.',
    code: 'MB-0808-03',
  },
  {
    id: 4,
    specialistId: 2,
    specialist: 'ThS. Trần Văn Minh',
    avatar: '👨‍⚕️',
    date: '2026-08-01',
    time: '14:00 - 15:00',
    type: 'Video call',
    status: 'completed',
    price: '400.000đ',
    notes: '',
    code: 'MB-0801-04',
  },
]

export default function AppointmentsPage() {
  const [upcoming, setUpcoming] = useState<Appointment[]>(INITIAL_UPCOMING)
  const [past, setPast] = useState<Appointment[]>(INITIAL_PAST)
  const [bookingOpen, setBookingOpen] = useState(false)
  const [initialSpecialistId, setInitialSpecialistId] = useState<number | null>(
    null,
  )
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null)
  const [appointmentToCancel, setAppointmentToCancel] =
    useState<Appointment | null>(null)
  const [appointmentToReschedule, setAppointmentToReschedule] =
    useState<Appointment | null>(null)
  const [activeVideoCall, setActiveVideoCall] = useState<Appointment | null>(
    null,
  )
  const [appointmentToRate, setAppointmentToRate] =
    useState<Appointment | null>(null)
  const [ratedAppointments, setRatedAppointments] = useState<
    Record<number, number>
  >({})
  const [toast, setToast] = useState('')

  useEffect(() => {
    const specialistId = Number(
      new URLSearchParams(window.location.search).get('specialist'),
    )
    if (!specialistId) return
    const timer = window.setTimeout(() => {
      setInitialSpecialistId(specialistId)
      setBookingOpen(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const openBooking = () => {
    setInitialSpecialistId(null)
    setBookingOpen(true)
  }

  const handleBooked = (appointment: NewAppointment) => {
    setUpcoming((current) => [
      {
        ...appointment,
        id: Date.now(),
        status: 'pending',
        code: `MB-${String(Date.now()).slice(-8)}`,
      },
      ...current,
    ])
    setBookingOpen(false)
    setToast('Yêu cầu đặt lịch đã được gửi.')
    window.setTimeout(() => setToast(''), 3200)
  }

  const openReschedule = (appointment: Appointment) => {
    setSelectedAppointment(null)
    if (
      appointment.status === 'completed' ||
      appointment.status === 'cancelled'
    ) {
      setInitialSpecialistId(appointment.specialistId)
      setBookingOpen(true)
      return
    }
    setAppointmentToReschedule(appointment)
  }

  const handleRescheduled = (update: RescheduleUpdate) => {
    if (!appointmentToReschedule) return
    setUpcoming((current) =>
      current.map((item) =>
        item.id === appointmentToReschedule.id
          ? { ...item, ...update, status: 'pending' }
          : item,
      ),
    )
    setAppointmentToReschedule(null)
    setToast('Yêu cầu đổi lịch đã được gửi và đang chờ chuyên gia xác nhận.')
    window.setTimeout(() => setToast(''), 3200)
  }

  const openCancellation = (appointment: Appointment) => {
    setSelectedAppointment(null)
    setAppointmentToCancel(appointment)
  }

  const handleCancelled = (reason: string, note: string) => {
    if (!appointmentToCancel) return
    const cancelledAppointment: Appointment = {
      ...appointmentToCancel,
      status: 'cancelled',
      notes: note
        ? `Lý do hủy: ${reason}. Ghi chú: ${note}`
        : `Lý do hủy: ${reason}`,
    }
    setUpcoming((current) =>
      current.filter((item) => item.id !== appointmentToCancel.id),
    )
    setPast((current) => [cancelledAppointment, ...current])
    setAppointmentToCancel(null)
    setToast('Lịch hẹn đã được hủy và chuyển vào lịch sử.')
    window.setTimeout(() => setToast(''), 3200)
  }

  const handleRated = (review: SpecialistReview) => {
    if (!appointmentToRate) return
    setRatedAppointments((current) => ({
      ...current,
      [appointmentToRate.id]: review.rating,
    }))
    setAppointmentToRate(null)
    setToast('Cảm ơn bạn. Đánh giá đã được ghi nhận.')
    window.setTimeout(() => setToast(''), 3200)
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(1.8rem, 4vw, 2.4rem)',
              marginBottom: '0.5rem',
            }}
          >
            Lịch hẹn
          </h1>
          <p style={{ opacity: 0.7 }}>Quản lý các buổi tư vấn của bạn</p>
        </div>

        <button className="btn-primary" onClick={openBooking}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span>Đặt lịch mới</span>
        </button>
      </div>

      {/* Upcoming */}
      <div style={{ marginBottom: '3rem' }}>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.4rem',
            marginBottom: '1.5rem',
          }}
        >
          Sắp tới
        </h2>

        {/* Timeline */}
        <div style={{ position: 'relative' }}>
          {/* Vertical line */}
          <div
            style={{
              position: 'absolute',
              left: '20px',
              top: '30px',
              bottom: 0,
              width: '2px',
              background: 'var(--line)',
              borderRadius: '2px',
            }}
          />

          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
          >
            {upcoming.map((apt, index) => (
              <motion.div
                key={apt.id}
                className="feature-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                style={{
                  marginLeft: '60px',
                  position: 'relative',
                }}
              >
                {/* Status dot */}
                <div
                  style={{
                    position: 'absolute',
                    left: '-60px',
                    top: '28px',
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'var(--bg)',
                    border: '3px solid var(--teal)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2,
                  }}
                >
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      background: 'var(--teal)',
                      animation:
                        apt.status === 'pending'
                          ? 'pulse 2s ease-in-out infinite'
                          : 'none',
                    }}
                  />
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '1.25rem',
                    alignItems: 'flex-start',
                  }}
                >
                  <div
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      background: 'var(--teal-pale)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '2rem',
                      flexShrink: 0,
                    }}
                  >
                    {apt.avatar}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '0.75rem',
                        gap: '1rem',
                      }}
                    >
                      <div>
                        <h3
                          style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: '1.2rem',
                            marginBottom: '0.25rem',
                          }}
                        >
                          {apt.specialist}
                        </h3>
                        <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>
                          {apt.type}
                        </div>
                      </div>

                      <div
                        className={`risk-tag ${apt.status === 'confirmed' ? 'teal' : 'amber'}`}
                      >
                        {apt.status === 'confirmed'
                          ? 'Đã xác nhận'
                          : 'Chờ xác nhận'}
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        gap: '1.5rem',
                        marginBottom: '1rem',
                        fontSize: '0.95rem',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                        >
                          <rect
                            x="3"
                            y="4"
                            width="18"
                            height="18"
                            rx="2"
                            ry="2"
                          />
                          <path d="M16 2v4M8 2v4M3 10h18" />
                        </svg>
                        {new Date(apt.date).toLocaleDateString('vi-VN', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <path d="M12 6v6l4 2" />
                        </svg>
                        {apt.time}
                      </div>
                    </div>

                    <div className="appointment-card-actions">
                      <button
                        className="btn-primary appointment-join-call"
                        disabled={
                          apt.type !== 'Video call' ||
                          apt.status !== 'confirmed'
                        }
                        onClick={() => setActiveVideoCall(apt)}
                      >
                        {apt.type !== 'Video call'
                          ? 'Không trực tuyến'
                          : apt.status !== 'confirmed'
                            ? 'Chờ xác nhận'
                            : 'Tham gia'}
                      </button>
                      <button
                        className="btn-outline"
                        onClick={() => openReschedule(apt)}
                      >
                        Đổi lịch
                      </button>
                      <button
                        className="btn-ghost appointment-view-detail"
                        onClick={() => setSelectedAppointment(apt)}
                      >
                        Chi tiết
                      </button>
                      <button
                        className="btn-ghost appointment-cancel-trigger"
                        onClick={() => openCancellation(apt)}
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Past */}
      <div>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.4rem',
            marginBottom: '1.5rem',
          }}
        >
          Lịch sử
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {past.map((apt, index) => (
            <motion.div
              key={apt.id}
              className="feature-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              style={{
                display: 'flex',
                gap: '1.25rem',
                alignItems: 'center',
                opacity: 0.8,
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'var(--surface-glass)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  flexShrink: 0,
                }}
              >
                {apt.avatar}
              </div>

              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontWeight: 600,
                    marginBottom: '0.25rem',
                  }}
                >
                  {apt.specialist}
                </div>
                <div
                  style={{
                    fontSize: '0.9rem',
                    opacity: 0.7,
                  }}
                >
                  {new Date(apt.date).toLocaleDateString('vi-VN')} • {apt.time}
                </div>
              </div>

              <div className="appointment-history-actions">
                <div
                  className={`risk-tag ${apt.status === 'cancelled' ? 'appointment-cancelled-tag' : 'teal'}`}
                >
                  {apt.status === 'cancelled' ? 'Đã hủy' : 'Hoàn thành'}
                </div>
                {apt.status === 'completed' &&
                  (ratedAppointments[apt.id] ? (
                    <span className="appointment-rated">
                      <b>{ratedAppointments[apt.id]}</b> ★ · Đã đánh giá
                    </span>
                  ) : (
                    <button
                      className="appointment-rate-trigger"
                      onClick={() => setAppointmentToRate(apt)}
                    >
                      <span>★</span> Đánh giá chuyên gia
                    </button>
                  ))}
                <button onClick={() => setSelectedAppointment(apt)}>
                  Xem chi tiết <span>→</span>
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {bookingOpen && (
        <NewAppointmentModal
          initialSpecialistId={initialSpecialistId}
          onClose={() => setBookingOpen(false)}
          onBooked={handleBooked}
        />
      )}
      {selectedAppointment && (
        <AppointmentDetailModal
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onReschedule={openReschedule}
          onCancel={openCancellation}
        />
      )}
      {appointmentToCancel && (
        <CancelAppointmentModal
          appointment={appointmentToCancel}
          onClose={() => setAppointmentToCancel(null)}
          onConfirm={handleCancelled}
        />
      )}
      {appointmentToReschedule && (
        <RescheduleAppointmentModal
          appointment={appointmentToReschedule}
          onClose={() => setAppointmentToReschedule(null)}
          onConfirm={handleRescheduled}
        />
      )}
      {activeVideoCall && (
        <VideoCallModal
          appointment={activeVideoCall}
          onClose={() => setActiveVideoCall(null)}
        />
      )}
      {appointmentToRate && (
        <RateSpecialistModal
          appointment={appointmentToRate}
          onClose={() => setAppointmentToRate(null)}
          onSubmit={handleRated}
        />
      )}
      {toast && (
        <motion.div
          className="appointment-booking-toast"
          role="status"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          ✓ {toast}
        </motion.div>
      )}
    </div>
  )
}
