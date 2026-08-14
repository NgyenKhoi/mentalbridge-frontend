'use client';
import { motion } from 'framer-motion';

const UPCOMING = [
  {
    id: 1,
    specialist: 'TS. Nguyễn Thị Lan',
    avatar: '👩‍⚕️',
    date: '2026-08-15',
    time: '10:00 - 11:00',
    type: 'Video call',
    status: 'confirmed'
  },
  {
    id: 2,
    specialist: 'ThS. Trần Văn Minh',
    avatar: '👨‍⚕️',
    date: '2026-08-20',
    time: '14:30 - 15:30',
    type: 'Tại phòng khám',
    status: 'pending'
  }
];

const PAST = [
  {
    id: 3,
    specialist: 'TS. Nguyễn Thị Lan',
    avatar: '👩‍⚕️',
    date: '2026-08-08',
    time: '10:00 - 11:00',
    type: 'Video call',
    status: 'completed'
  },
  {
    id: 4,
    specialist: 'ThS. Trần Văn Minh',
    avatar: '👨‍⚕️',
    date: '2026-08-01',
    time: '14:00 - 15:00',
    type: 'Video call',
    status: 'completed'
  }
];

export default function AppointmentsPage() {
  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ 
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2.5rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <h1 style={{ 
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.8rem, 4vw, 2.4rem)',
            marginBottom: '0.5rem'
          }}>
            Lịch hẹn
          </h1>
          <p style={{ opacity: 0.7 }}>Quản lý các buổi tư vấn của bạn</p>
        </div>

        <button className="btn-primary">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          <span>Đặt lịch mới</span>
        </button>
      </div>

      {/* Upcoming */}
      <div style={{ marginBottom: '3rem' }}>
        <h2 style={{ 
          fontFamily: 'var(--font-display)',
          fontSize: '1.4rem',
          marginBottom: '1.5rem'
        }}>
          Sắp tới
        </h2>

        {/* Timeline */}
        <div style={{ position: 'relative' }}>
          {/* Vertical line */}
          <div style={{
            position: 'absolute',
            left: '20px',
            top: '30px',
            bottom: 0,
            width: '2px',
            background: 'var(--line)',
            borderRadius: '2px'
          }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {UPCOMING.map((apt, index) => (
              <motion.div
                key={apt.id}
                className="feature-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                style={{ 
                  marginLeft: '60px',
                  position: 'relative'
                }}
              >
                {/* Status dot */}
                <div style={{
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
                  zIndex: 2
                }}>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: 'var(--teal)',
                    animation: apt.status === 'pending' ? 'pulse 2s ease-in-out infinite' : 'none'
                  }} />
                </div>

                <div style={{ 
                  display: 'flex',
                  gap: '1.25rem',
                  alignItems: 'flex-start'
                }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'var(--teal-pale)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '2rem',
                    flexShrink: 0
                  }}>
                    {apt.avatar}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '0.75rem',
                      gap: '1rem'
                    }}>
                      <div>
                        <h3 style={{ 
                          fontFamily: 'var(--font-display)',
                          fontSize: '1.2rem',
                          marginBottom: '0.25rem'
                        }}>
                          {apt.specialist}
                        </h3>
                        <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>
                          {apt.type}
                        </div>
                      </div>

                      <div className={`risk-tag ${apt.status === 'confirmed' ? 'teal' : 'amber'}`}>
                        {apt.status === 'confirmed' ? 'Đã xác nhận' : 'Chờ xác nhận'}
                      </div>
                    </div>

                    <div style={{ 
                      display: 'flex',
                      gap: '1.5rem',
                      marginBottom: '1rem',
                      fontSize: '0.95rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                          <path d="M16 2v4M8 2v4M3 10h18"/>
                        </svg>
                        {new Date(apt.date).toLocaleDateString('vi-VN', { 
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                          <circle cx="12" cy="12" r="10"/>
                          <path d="M12 6v6l4 2"/>
                        </svg>
                        {apt.time}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button className="btn-primary">
                        Tham gia
                      </button>
                      <button className="btn-outline">
                        Đổi lịch
                      </button>
                      <button className="btn-ghost">
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
        <h2 style={{ 
          fontFamily: 'var(--font-display)',
          fontSize: '1.4rem',
          marginBottom: '1.5rem'
        }}>
          Lịch sử
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {PAST.map((apt, index) => (
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
                opacity: 0.8
              }}
            >
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'var(--surface-glass)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                flexShrink: 0
              }}>
                {apt.avatar}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ 
                  fontWeight: 600,
                  marginBottom: '0.25rem'
                }}>
                  {apt.specialist}
                </div>
                <div style={{ 
                  fontSize: '0.9rem',
                  opacity: 0.7
                }}>
                  {new Date(apt.date).toLocaleDateString('vi-VN')} • {apt.time}
                </div>
              </div>

              <div className="risk-tag teal">
                Hoàn thành
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
