'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import SpecialistProfileModal, { type SpecialistProfile } from '@/components/SpecialistProfileModal'
import './specialists.css'

const specialties = ['Tất cả', 'Trầm cảm', 'Lo âu', 'Stress', 'Gia đình', 'Tình cảm', 'Nghiện']
const specialists: SpecialistProfile[] = [
  { id: 1, name: 'TS. Nguyễn Thị Lan', initials: 'NL', title: 'Bác sĩ tâm lý lâm sàng', specialties: ['Trầm cảm', 'Lo âu'], experience: '12 năm', rating: '4.9', reviews: 156, available: true, price: '500.000đ', tone: 'sage', sessions: 820, nextSlot: '09:30 · Thứ Tư, 26/08', languages: ['Tiếng Việt', 'English'], formats: ['Video call', 'Tại phòng tư vấn'], bio: 'Tôi đồng hành cùng người trưởng thành đang trải qua trầm cảm, lo âu và những giai đoạn chuyển tiếp khó khăn. Mỗi phiên tư vấn được xây dựng như một không gian an toàn, tôn trọng nhịp độ và câu chuyện riêng của bạn.', approach: 'Kết hợp trị liệu nhận thức hành vi (CBT), chánh niệm và phỏng vấn tạo động lực. Chúng ta sẽ cùng nhận diện khuôn mẫu đang gây khó khăn, thử những thay đổi nhỏ và theo dõi điều thực sự có ích trong đời sống hằng ngày.', education: ['Tiến sĩ Tâm lý học lâm sàng — Đại học Quốc gia Hà Nội', 'Chứng nhận Trị liệu nhận thức hành vi nâng cao', 'Thành viên Hội Tâm lý trị liệu Việt Nam'] },
  { id: 2, name: 'ThS. Trần Văn Minh', initials: 'TM', title: 'Chuyên gia tư vấn tâm lý', specialties: ['Stress', 'Công việc'], experience: '8 năm', rating: '4.8', reviews: 89, available: true, price: '400.000đ', tone: 'amber', sessions: 465, nextSlot: '14:00 · Thứ Năm, 27/08', languages: ['Tiếng Việt'], formats: ['Video call', 'Điện thoại'], bio: 'Tôi tập trung hỗ trợ người đi làm đang đối mặt với kiệt sức, áp lực thành tích và mất cân bằng giữa công việc với cuộc sống. Mục tiêu là giúp bạn tìm lại cảm giác chủ động mà không tạo thêm áp lực phải thay đổi thật nhanh.', approach: 'Sử dụng tư vấn tập trung vào giải pháp, kỹ thuật quản lý stress và xây dựng ranh giới lành mạnh. Các bài thực hành ngắn được điều chỉnh để phù hợp với lịch làm việc thực tế của từng người.', education: ['Thạc sĩ Tâm lý học — Đại học Sư phạm TP.HCM', 'Chứng nhận tư vấn stress và kiệt sức nghề nghiệp', '8 năm tư vấn cá nhân và tổ chức'] },
  { id: 3, name: 'TS. Lê Hoàng Anh', initials: 'HA', title: 'Nhà trị liệu gia đình', specialties: ['Gia đình', 'Tình cảm'], experience: '15 năm', rating: '5.0', reviews: 203, available: false, price: '600.000đ', tone: 'lavender', sessions: 1040, nextSlot: 'Dự kiến mở lịch tháng 9', languages: ['Tiếng Việt', 'English'], formats: ['Video call', 'Tại phòng tư vấn'], bio: 'Tôi làm việc với cá nhân, cặp đôi và gia đình đang gặp khó khăn trong giao tiếp, xung đột hoặc thay đổi vai trò. Phiên trị liệu hướng tới việc giúp mỗi người được lắng nghe rõ ràng và xây dựng lại cảm giác kết nối.', approach: 'Tiếp cận theo hệ thống gia đình và trị liệu tập trung vào cảm xúc (EFT), quan sát vấn đề trong mối quan hệ thay vì quy lỗi cho một cá nhân. Lộ trình được thống nhất minh bạch ngay từ những buổi đầu.', education: ['Tiến sĩ Tâm lý học gia đình và hôn nhân', 'Chứng nhận Emotionally Focused Therapy', 'Thành viên Hiệp hội Trị liệu Gia đình Quốc tế'] },
  { id: 4, name: 'ThS. Phạm Thu Hà', initials: 'TH', title: 'Chuyên gia trị liệu CBT', specialties: ['Lo âu', 'OCD'], experience: '6 năm', rating: '4.7', reviews: 67, available: true, price: '450.000đ', tone: 'terra', sessions: 318, nextSlot: '16:30 · Thứ Sáu, 28/08', languages: ['Tiếng Việt'], formats: ['Video call', 'Tại phòng tư vấn'], bio: 'Tôi hỗ trợ người trưởng thành có lo âu kéo dài, suy nghĩ ám ảnh và hành vi cưỡng chế. Tôi ưu tiên một mối quan hệ trị liệu rõ ràng, không phán xét và giúp bạn hiểu điều gì đang duy trì vòng lặp khó khăn.', approach: 'Làm việc chủ yếu với CBT và phòng ngừa phản ứng tiếp xúc (ERP), theo từng bước nhỏ có thể đo lường. Mọi bài tập đều được trao đổi và đồng thuận, không ép bạn vượt quá giới hạn an toàn.', education: ['Thạc sĩ Tâm lý học lâm sàng', 'Đào tạo chuyên sâu CBT và ERP', 'Chứng nhận sơ cứu sức khỏe tâm thần'] },
]

export default function SpecialistsPage() {
  const [selected, setSelected] = useState('Tất cả')
  const [profile, setProfile] = useState<SpecialistProfile | null>(null)
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
        <button className="specialist-view-profile" onClick={() => setProfile(specialist)}>Xem hồ sơ <span>↗</span></button>
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
    <SpecialistProfileModal specialist={profile} onClose={() => setProfile(null)} />
  </div>
}
