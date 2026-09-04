'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import type { AppointmentDetail } from './AppointmentDetailModal'
import './VideoCallModal.css'

type Props = {
  appointment: AppointmentDetail
  onClose: () => void
}

type CallStage = 'lobby' | 'connecting' | 'call' | 'ended'

function MicIcon({ off = false }: { off?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  )
}

function CameraIcon({ off = false }: { off?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="6" width="13" height="12" rx="3" />
      <path d="m16 10 5-3v10l-5-3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M5 15.5c4.5-3.3 9.5-3.3 14 0l-2.2 3.1-3.2-1.4v-2.5h-3.2v2.5l-3.2 1.4L5 15.5Z" />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 5h16v11H8l-4 4V5Z" />
    </svg>
  )
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </svg>
  )
}

const formatDuration = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

export default function VideoCallModal({ appointment, onClose }: Props) {
  const [stage, setStage] = useState<CallStage>('lobby')
  const [micOn, setMicOn] = useState(true)
  const [cameraOn, setCameraOn] = useState(true)
  const [chatOpen, setChatOpen] = useState(false)
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && stage !== 'call' && stage !== 'connecting')
        onClose()
    }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [onClose, stage])

  useEffect(() => {
    if (stage !== 'call') return
    const timer = window.setInterval(
      () => setSeconds((value) => value + 1),
      1000,
    )
    return () => window.clearInterval(timer)
  }, [stage])

  const startCall = () => {
    setStage('connecting')
    window.setTimeout(() => setStage('call'), 900)
  }

  if (stage === 'call')
    return (
      <div
        className="video-room"
        role="dialog"
        aria-modal="true"
        aria-label="Phòng tư vấn video"
      >
        <header className="video-room-header">
          <div className="video-room-brand">
            <i>MB</i>
            <div>
              <strong>Phiên tư vấn riêng tư</strong>
              <span>Mã #{appointment.code} · Mã hóa đầu cuối</span>
            </div>
          </div>
          <div className="video-room-status">
            <i />
            <span>Đã kết nối</span>
            <b>{formatDuration(seconds)}</b>
          </div>
          <button
            onClick={() => setChatOpen((value) => !value)}
            className={chatOpen ? 'active' : ''}
          >
            <ChatIcon />
            <span>Trò chuyện</span>
          </button>
        </header>

        <main className={`video-room-stage ${chatOpen ? 'with-chat' : ''}`}>
          <section className="video-room-specialist">
            <div className="video-room-ambient" />
            <div className="video-room-person">
              <span>{appointment.avatar}</span>
              <h2>{appointment.specialist}</h2>
              <p>Chuyên gia tâm lý</p>
              <small>
                <i /> Đang nghe bạn
              </small>
            </div>
            <div className="video-room-name">
              <i>
                <MicIcon />
              </i>
              {appointment.specialist}
            </div>
            <aside
              className={`video-room-self ${cameraOn ? '' : 'camera-off'}`}
            >
              <div>{cameraOn ? <span>N</span> : <CameraIcon off />}</div>
              <p>
                Bạn{' '}
                {!micOn && (
                  <i>
                    <MicIcon off />
                  </i>
                )}
              </p>
            </aside>
          </section>

          {chatOpen && (
            <motion.aside
              className="video-room-chat"
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <header>
                <div>
                  <strong>Trò chuyện trong phiên</strong>
                  <span>Chỉ bạn và chuyên gia có thể xem</span>
                </div>
                <button onClick={() => setChatOpen(false)}>×</button>
              </header>
              <div className="video-room-chat-empty">
                <i>
                  <ChatIcon />
                </i>
                <strong>Chưa có tin nhắn</strong>
                <p>Bạn có thể gửi ghi chú ngắn trong khi tư vấn.</p>
              </div>
              <label>
                <input placeholder="Nhập tin nhắn..." />
                <button aria-label="Gửi tin nhắn">→</button>
              </label>
            </motion.aside>
          )}
        </main>

        <footer className="video-room-controls">
          <div>
            <button
              className={!micOn ? 'off' : ''}
              onClick={() => setMicOn((value) => !value)}
              aria-label={micOn ? 'Tắt micro' : 'Bật micro'}
            >
              {micOn ? <MicIcon /> : <MicIcon off />}
              <span>{micOn ? 'Micro' : 'Đã tắt'}</span>
            </button>
            <button
              className={!cameraOn ? 'off' : ''}
              onClick={() => setCameraOn((value) => !value)}
              aria-label={cameraOn ? 'Tắt camera' : 'Bật camera'}
            >
              {cameraOn ? <CameraIcon /> : <CameraIcon off />}
              <span>{cameraOn ? 'Camera' : 'Đã tắt'}</span>
            </button>
          </div>
          <button className="video-room-end" onClick={() => setStage('ended')}>
            <PhoneIcon />
            <span>Kết thúc</span>
          </button>
          <div>
            <button onClick={() => setChatOpen((value) => !value)}>
              <ChatIcon />
              <span>Tin nhắn</span>
            </button>
            <button>
              <MoreIcon />
              <span>Thêm</span>
            </button>
          </div>
        </footer>
      </div>
    )

  return (
    <>
      <motion.div
        className="video-call-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      />
      <div className="video-call-shell">
        <motion.section
          className={`video-call-modal ${stage}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="video-call-title"
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          {stage === 'ended' ? (
            <div className="video-call-ended">
              <div className="video-call-ended-icon">
                <div className="video-call-ended-icon-inner">✓</div>
              </div>
              <span className="video-call-ended-badge">
                PHIÊN TƯ VẤN ĐÃ HOÀN TẤT
              </span>
              <h2 id="video-call-title">Cảm ơn bạn đã tham gia</h2>
              <p>
                Cuộc gọi tư vấn với <strong>{appointment.specialist}</strong> đã
                kết thúc thành công. Thông tin phiên tư vấn của bạn được bảo mật
                hoàn toàn.
              </p>
              <div className="video-call-ended-info">
                <div className="video-call-ended-info-item">
                  <span className="video-call-ended-info-label">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    CHUYÊN GIA TƯ VẤN
                  </span>
                  <strong className="video-call-ended-info-value">
                    {appointment.specialist}
                  </strong>
                </div>
                <div className="video-call-ended-info-item">
                  <span className="video-call-ended-info-label">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                    THỜI LƯỢNG CUỘC GỌI
                  </span>
                  <strong className="video-call-ended-info-value">
                    {formatDuration(seconds)}
                  </strong>
                </div>
              </div>
              <button className="video-call-ended-btn" onClick={onClose}>
                Trở về lịch hẹn <span>→</span>
              </button>
              <button className="video-call-ended-link">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M9 3v18" />
                </svg>
                Được mã hoá đầu cuối
              </button>
            </div>
          ) : (
            <>
              <header className="video-call-header">
                <div>
                  <span>Start video call</span>
                  <h2 id="video-call-title">Sẵn sàng cho phiên tư vấn?</h2>
                  <p>Kiểm tra thiết bị trước khi vào phòng cùng chuyên gia.</p>
                </div>
                <button
                  onClick={onClose}
                  disabled={stage === 'connecting'}
                  aria-label="Đóng"
                >
                  ×
                </button>
              </header>
              <div className="video-call-content">
                <section
                  className={`video-call-preview ${cameraOn ? '' : 'camera-off'}`}
                >
                  <div className="video-preview-grid" />
                  <div className="video-preview-person">
                    {cameraOn ? (
                      <>
                        <span>N</span>
                        <strong>Camera của bạn</strong>
                      </>
                    ) : (
                      <>
                        <i>
                          <CameraIcon off />
                        </i>
                        <strong>Camera đang tắt</strong>
                      </>
                    )}
                  </div>
                  <div className="video-preview-controls">
                    <button
                      className={!micOn ? 'off' : ''}
                      onClick={() => setMicOn((value) => !value)}
                      aria-label={micOn ? 'Tắt micro' : 'Bật micro'}
                    >
                      {micOn ? <MicIcon /> : <MicIcon off />}
                    </button>
                    <button
                      className={!cameraOn ? 'off' : ''}
                      onClick={() => setCameraOn((value) => !value)}
                      aria-label={cameraOn ? 'Tắt camera' : 'Bật camera'}
                    >
                      {cameraOn ? <CameraIcon /> : <CameraIcon off />}
                    </button>
                  </div>
                  <span className="video-preview-label">
                    <i /> Xem trước thiết bị
                  </span>
                </section>

                <aside className="video-call-info">
                  <section className="video-call-specialist">
                    <div>{appointment.avatar}</div>
                    <span>Phiên tư vấn với</span>
                    <h3>{appointment.specialist}</h3>
                    <p>
                      {appointment.date} · {appointment.time}
                    </p>
                  </section>
                  <section className="video-device-check">
                    <span>Kiểm tra thiết bị</span>
                    <ul>
                      <li>
                        <i className={micOn ? 'ready' : ''}>
                          {micOn ? '✓' : '!'}
                        </i>
                        <p>
                          <strong>Microphone</strong>
                          <small>{micOn ? 'Đã sẵn sàng' : 'Đang tắt'}</small>
                        </p>
                      </li>
                      <li>
                        <i className={cameraOn ? 'ready' : ''}>
                          {cameraOn ? '✓' : '!'}
                        </i>
                        <p>
                          <strong>Camera</strong>
                          <small>{cameraOn ? 'Đã sẵn sàng' : 'Đang tắt'}</small>
                        </p>
                      </li>
                      <li>
                        <i className="ready">✓</i>
                        <p>
                          <strong>Kết nối mạng</strong>
                          <small>Ổn định</small>
                        </p>
                      </li>
                    </ul>
                  </section>
                  <aside className="video-call-privacy">
                    <i>⌁</i>
                    <p>
                      <strong>Không gian riêng tư</strong>
                      <span>
                        Cuộc gọi này được thiết kế cho phiên tư vấn riêng giữa
                        bạn và chuyên gia.
                      </span>
                    </p>
                  </aside>
                </aside>
              </div>
              <footer className="video-call-footer">
                <p>Bạn có thể thay đổi micro và camera bất cứ lúc nào.</p>
                <div>
                  <button onClick={onClose} disabled={stage === 'connecting'}>
                    Để sau
                  </button>
                  <button onClick={startCall} disabled={stage === 'connecting'}>
                    {stage === 'connecting' ? (
                      <>
                        <i /> Đang kết nối...
                      </>
                    ) : (
                      <>
                        Vào phòng tư vấn <span>→</span>
                      </>
                    )}
                  </button>
                </div>
              </footer>
            </>
          )}
        </motion.section>
      </div>
    </>
  )
}
