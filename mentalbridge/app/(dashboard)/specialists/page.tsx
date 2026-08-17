'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import './specialists.css'

const specialties = ['Tất cả', 'Trầm cảm', 'Lo âu', 'Stress', 'Gia đình', 'Tình cảm', 'Nghiện']
const specialists = [
  { id: 1, name: 'TS. Nguyễn Thị Lan', initials: 'NL', title: 'Bác sĩ tâm lý lâm sàng', specialties: ['Trầm cảm', 'Lo âu'], experience: '12 năm', rating: '4.9', reviews: 156, available: true, price: '500.000đ', tone: 'sage' },
  { id: 2, name: 'ThS. Trần Văn Minh', initials: 'TM', title: 'Chuyên gia tư vấn tâm lý', specialties: ['Stress', 'Công việc'], experience: '8 năm', rating: '4.8', reviews: 89, available: true, price: '400.000đ', tone: 'amber' },
  { id: 3, name: 'TS. Lê Hoàng Anh', initials: 'HA', title: 'Nhà trị liệu gia đình', specialties: ['Gia đình', 'Tình cảm'], experience: '15 năm', rating: '5.0', reviews: 203, available: false, price: '600.000đ', tone: 'lavender' },
  { id: 4, name: 'ThS. Phạm Thu Hà', initials: 'TH', title: 'Chuyên gia trị liệu CBT', specialties: ['Lo âu', 'OCD'], experience: '6 năm', rating: '4.7', reviews: 67, available: true, price: '450.000đ', tone: 'terra' },
]

export default function SpecialistsPage() {
  const [selected, setSelected] = useState('Tất cả')
  const filtered = useMemo(() => selected === 'Tất cả' ? specialists : specialists.filter(item => item.specialties.includes(selected)), [selected])

  return <div className="specialists-page">
    <header className="specialists-hero">
      <svg viewBox="0 0 420 110" aria-hidden="true"><path d="M0 100C90 10 330 10 420 100" /></svg>
      <span>Kết nối & đồng hành</span>
      <h1>Chuyên gia tư vấn</h1>
      <p>Kết nối với các chuyên gia tâm lý được xác minh, phù hợp với hành trình và nhu cầu của riêng bạn.</p>
    </header>

    <div className="specialist-filters" role="group" aria-label="Lọc theo chuyên môn">
      {specialties.map(item => <button key={item} className={selected === item ? 'active' : ''} aria-pressed={selected === item} onClick={() => setSelected(item)}>{item}</button>)}
    </div>

    {filtered.length ? <div className="specialist-grid">
      {filtered.map((specialist, index) => <article key={specialist.id} className={`specialist-card ${!specialist.available ? 'unavailable' : ''}`} style={{ '--delay': `${index * 70}ms` } as React.CSSProperties}>
        {!specialist.available && <span className="specialist-busy">Đang bận</span>}
        <div className="specialist-avatar-wrap">
          <svg viewBox="0 0 120 60" aria-hidden="true"><path d="M10 50Q60-6 110 50" /></svg>
          <div className={`specialist-avatar ${specialist.tone}`}>{specialist.initials}</div>
          {specialist.available && <span className="specialist-online" title="Đang nhận lịch" />}
        </div>
        <h2>{specialist.name}</h2>
        <p className="specialist-role">{specialist.title}</p>
        <div className="specialist-tags">{specialist.specialties.map((tag, tagIndex) => <span className={tagIndex % 2 ? 'alt' : ''} key={tag}>{tag}</span>)}</div>
        <div className="specialist-stats">
          <div><small>Kinh nghiệm</small><strong>{specialist.experience}</strong></div>
          <div><small>Đánh giá</small><strong><span>★</span> {specialist.rating} <em>({specialist.reviews})</em></strong></div>
        </div>
        <div className="specialist-footer">
          {specialist.available ? <><div><small>Phí tư vấn</small><strong>{specialist.price}</strong></div><Link href={`/appointments?specialist=${specialist.id}`} className="specialist-book">Đặt lịch <span>→</span></Link></> : <button disabled>Chưa có lịch trống</button>}
        </div>
      </article>)}
    </div> : <div className="specialist-empty"><span>⌕</span><h2>Chưa có chuyên gia phù hợp</h2><p>Hãy thử một chuyên môn khác hoặc xem lại sau.</p><button className="btn-outline" onClick={() => setSelected('Tất cả')}>Xem tất cả chuyên gia</button></div>}

    <aside className="specialist-banner"><span>15′</span><p><strong>Buổi làm quen miễn phí:</strong> Phiên đầu tiên có 15 phút để bạn trao đổi nhu cầu và cảm nhận mức độ phù hợp với chuyên gia.</p></aside>
  </div>
}
