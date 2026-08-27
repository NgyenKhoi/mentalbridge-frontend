'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import './SpecialistProfileModal.css'

export type SpecialistProfile = {
  id: number
  name: string
  initials: string
  title: string
  specialties: string[]
  experience: string
  rating: string
  reviews: number
  available: boolean
  price: string
  tone: string
  bio: string
  approach: string
  education: string[]
  languages: string[]
  formats: string[]
  nextSlot: string
  sessions: number
}

type Props = {
  specialist: SpecialistProfile | null
  onClose: () => void
}

function CheckIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m5 12 4 4L19 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

export default function SpecialistProfileModal({ specialist, onClose }: Props) {
  useEffect(() => {
    if (!specialist) return
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [onClose, specialist])

  return <AnimatePresence>
    {specialist && <>
      <motion.button
        className="specialist-profile-backdrop"
        aria-label="Đóng hồ sơ chuyên gia"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <div className="specialist-profile-shell">
        <motion.section
          className="specialist-profile-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="specialist-profile-title"
          initial={{ opacity: 0, y: 26, scale: .97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: .98 }}
          transition={{ duration: .3, ease: [0.16, 1, 0.3, 1] }}
        >
          <header className="specialist-profile-header">
            <div className="specialist-profile-identity">
              <div className={`specialist-profile-avatar ${specialist.tone}`}>
                <svg viewBox="0 0 130 70" aria-hidden="true"><path d="M7 62Q65-8 123 62" /></svg>
                <span>{specialist.initials}</span>
                <i aria-label="Hồ sơ đã xác minh"><CheckIcon /></i>
              </div>
              <div>
                <span className="specialist-profile-eyebrow">Chuyên gia đã xác minh</span>
                <h2 id="specialist-profile-title">{specialist.name}</h2>
                <p>{specialist.title}</p>
                <div className="specialist-profile-tags">{specialist.specialties.map(item => <span key={item}>{item}</span>)}</div>
              </div>
            </div>
            <button className="specialist-profile-close" onClick={onClose} aria-label="Đóng">×</button>
          </header>

          <div className="specialist-profile-scroll">
            <section className="specialist-profile-metrics" aria-label="Thông tin chuyên môn">
              <article><span>Kinh nghiệm</span><strong>{specialist.experience}</strong></article>
              <article><span>Đánh giá</span><strong><i>★</i> {specialist.rating}</strong><small>{specialist.reviews} nhận xét</small></article>
              <article><span>Phiên tư vấn</span><strong>{specialist.sessions}+</strong></article>
            </section>

            <div className="specialist-profile-layout">
              <main className="specialist-profile-main">
                <section>
                  <span className="specialist-profile-index">01</span>
                  <div><h3>Giới thiệu</h3><p>{specialist.bio}</p></div>
                </section>
                <section>
                  <span className="specialist-profile-index">02</span>
                  <div><h3>Phương pháp đồng hành</h3><p>{specialist.approach}</p></div>
                </section>
                <section>
                  <span className="specialist-profile-index">03</span>
                  <div><h3>Đào tạo & chứng chỉ</h3><ul>{specialist.education.map(item => <li key={item}><CheckIcon /><span>{item}</span></li>)}</ul></div>
                </section>
              </main>

              <aside className="specialist-profile-aside">
                <section><span>Ngôn ngữ tư vấn</span><div>{specialist.languages.map(item => <b key={item}>{item}</b>)}</div></section>
                <section><span>Hình thức</span><ul>{specialist.formats.map(item => <li key={item}>{item}</li>)}</ul></section>
                <section className={specialist.available ? 'available' : 'busy'}><span>Lịch gần nhất</span><strong>{specialist.nextSlot}</strong><small>{specialist.available ? 'Đang nhận lịch hẹn mới' : 'Chưa mở thêm lịch mới'}</small></section>
              </aside>
            </div>
          </div>

          <footer className="specialist-profile-footer">
            <div><small>Phí tư vấn từ</small><strong>{specialist.price}<span>/ phiên</span></strong></div>
            <div>
              <button className="specialist-profile-later" onClick={onClose}>Để sau</button>
              {specialist.available
                ? <Link href={`/appointments?specialist=${specialist.id}`} className="specialist-profile-book">Đặt lịch tư vấn <span>→</span></Link>
                : <button className="specialist-profile-disabled" disabled>Chưa có lịch trống</button>}
            </div>
          </footer>
        </motion.section>
      </div>
    </>}
  </AnimatePresence>
}
