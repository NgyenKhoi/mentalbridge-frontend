'use client'

import { useMemo, useState } from 'react'
import './admin-appointments-manager.css'

type AppointmentStatus = 'Đã xác nhận' | 'Chờ xác nhận' | 'Hoàn thành' | 'Đã hủy'
type AppointmentTab = 'all' | 'upcoming' | 'pending' | 'completed'

const APPOINTMENTS = [
  { id: 'APT-20841', client: 'Nguyễn Minh Anh', specialist: 'TS. Nguyễn Thu Hà', date: '27/08/2026', time: '10:30–11:15', channel: 'Video call', payment: '1 credit', status: 'Đã xác nhận' as AppointmentStatus, tone: 'confirmed', note: 'Phòng tư vấn sẵn sàng · Nhắc lịch đã gửi' },
  { id: 'APT-20839', client: 'Trần Gia Hân', specialist: 'ThS. Lê Minh Phương', date: '27/08/2026', time: '14:00–14:45', channel: 'Tại phòng tư vấn', payment: '420.000đ', status: 'Chờ xác nhận' as AppointmentStatus, tone: 'pending', note: 'Chuyên gia cần phản hồi trước 12:00' },
  { id: 'APT-20835', client: 'Phạm Thảo Vy', specialist: 'BS. Trần Minh Đức', date: '28/08/2026', time: '09:00–10:00', channel: 'Video call', payment: '500.000đ', status: 'Đã xác nhận' as AppointmentStatus, tone: 'confirmed', note: 'Nhắc lịch sẽ gửi trước 24 giờ' },
  { id: 'APT-20822', client: 'Lê Hoàng Nam', specialist: 'TS. Nguyễn Thu Hà', date: '26/08/2026', time: '09:00–09:45', channel: 'Video call', payment: '1 credit', status: 'Hoàn thành' as AppointmentStatus, tone: 'completed', note: 'Earnings đã ghi nhận tự động' },
  { id: 'APT-20817', client: 'Vũ Thanh An', specialist: 'ThS. Lê Minh Phương', date: '25/08/2026', time: '16:00–16:45', channel: 'Tại phòng tư vấn', payment: '420.000đ', status: 'Đã hủy' as AppointmentStatus, tone: 'cancelled', note: 'Khách hàng hủy trong thời hạn cho phép' },
]

const tabs: { key: AppointmentTab; label: string; description: string }[] = [
  { key: 'all', label: 'Tất cả lịch hẹn', description: 'Toàn bộ trạng thái' },
  { key: 'upcoming', label: 'Sắp diễn ra', description: 'Phiên đã xác nhận' },
  { key: 'pending', label: 'Cần phản hồi', description: 'Chờ chuyên gia xác nhận' },
  { key: 'completed', label: 'Lịch sử', description: 'Hoàn thành hoặc đã hủy' },
]

export default function AdminAppointmentsManager({ onNotice }: { onNotice: (message: string) => void }) {
  const [tab, setTab] = useState<AppointmentTab>('all')
  const [query, setQuery] = useState('')
  const [channel, setChannel] = useState('Tất cả kênh')
  const [selectedId, setSelectedId] = useState(APPOINTMENTS[0].id)

  const visible = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('vi')
    return APPOINTMENTS.filter(item => {
      const tabMatch = tab === 'all' || (tab === 'upcoming' && item.tone === 'confirmed') || (tab === 'pending' && item.tone === 'pending') || (tab === 'completed' && (item.tone === 'completed' || item.tone === 'cancelled'))
      const channelMatch = channel === 'Tất cả kênh' || item.channel === channel
      const queryMatch = !keyword || `${item.id} ${item.client} ${item.specialist}`.toLocaleLowerCase('vi').includes(keyword)
      return tabMatch && channelMatch && queryMatch
    })
  }, [channel, query, tab])

  const selected = APPOINTMENTS.find(item => item.id === selectedId) ?? APPOINTMENTS[0]
  const countFor = (key: AppointmentTab) => APPOINTMENTS.filter(item => key === 'all' || (key === 'upcoming' && item.tone === 'confirmed') || (key === 'pending' && item.tone === 'pending') || (key === 'completed' && (item.tone === 'completed' || item.tone === 'cancelled'))).length

  return <div className="admin-appointments-manager">
    <div className="role-heading aap-heading">
      <div><span className="eyebrow">Quản trị nền tảng</span><h1>Lịch hẹn toàn nền tảng</h1><p>Theo dõi khả năng vận hành của các phiên tư vấn mà không truy cập nội dung chuyên môn.</p></div>
      <div className="aap-heading-actions"><span><i />Dịch vụ đặt lịch ổn định</span><button onClick={() => onNotice('Đã bắt đầu xuất dữ liệu lịch hẹn.')}>\u2193 Xuất báo cáo</button></div>
    </div>

    <section className="aap-metrics" aria-label="Tổng quan lịch hẹn">
      <article className="primary"><span>Phiên hôm nay</span><strong>26</strong><p>18 video call · 8 tại phòng tư vấn</p></article>
      <article><span>Đang chờ xác nhận</span><strong>4</strong><p>1 phiên sắp quá thời hạn phản hồi</p></article>
      <article><span>Tỷ lệ hoàn thành</span><strong>92,6%</strong><p>Trong 30 ngày gần nhất</p></article>
      <article><span>Phiên bị hủy</span><strong>3,8%</strong><p>Giảm 0,7% so với tháng trước</p></article>
    </section>

    <nav className="aap-tabs" aria-label="Lọc lịch hẹn theo trạng thái">
      {tabs.map((item, index) => <button key={item.key} className={tab === item.key ? 'active' : ''} onClick={() => setTab(item.key)}><span>{['◉','◷','◇','▤'][index]}</span><div><strong>{item.label}</strong><small>{item.description}</small></div><b>{countFor(item.key)}</b></button>)}
    </nav>

    <section className="aap-board">
      <header className="aap-toolbar">
        <div><span>VẬN HÀNH LỊCH HẸN</span><h2>Danh sách phiên tư vấn</h2></div>
        <div><label><span>⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Mã lịch, khách hàng hoặc chuyên gia..." /></label><select value={channel} onChange={event => setChannel(event.target.value)}><option>Tất cả kênh</option><option>Video call</option><option>Tại phòng tư vấn</option></select><button onClick={() => onNotice('Bộ lọc thời gian đã sẵn sàng.')}>27–31 tháng 8 ⌄</button></div>
      </header>

      <div className="aap-layout">
        <section className="aap-list">
          <div className="aap-list-head"><span>Khách hàng & chuyên gia</span><span>Thời gian</span><span>Hình thức</span><span>Thanh toán</span><span>Trạng thái</span><span /></div>
          {visible.map(item => <button key={item.id} className={selected.id === item.id ? 'selected' : ''} onClick={() => setSelectedId(item.id)}>
            <span className="aap-avatar">{item.client.split(' ').slice(-2).map(word => word[0]).join('')}</span><span className="aap-people"><strong>{item.client}</strong><small>{item.specialist}</small><em>{item.id}</em></span><time><strong>{item.time}</strong><small>{item.date}</small></time><span className="aap-channel">{item.channel}</span><span className="aap-payment">{item.payment}</span><b className={item.tone}><i />{item.status}</b><span className="aap-arrow">→</span>
          </button>)}
          {!visible.length && <div className="aap-empty"><span>⌕</span><strong>Không tìm thấy lịch hẹn</strong><small>Thử thay đổi từ khóa, kênh hoặc nhóm trạng thái.</small></div>}
        </section>

        <aside className="aap-inspector">
          <header><span>CHI TIẾT VẬN HÀNH</span><h2>{selected.id}</h2><b className={selected.tone}><i />{selected.status}</b></header>
          <div className="aap-time-card"><span>{selected.date}</span><strong>{selected.time}</strong><p>{selected.channel}</p></div>
          <dl><div><dt>Khách hàng</dt><dd>{selected.client}</dd></div><div><dt>Chuyên gia</dt><dd>{selected.specialist}</dd></div><div><dt>Thanh toán</dt><dd>{selected.payment}</dd></div><div><dt>Tình trạng hệ thống</dt><dd>{selected.note}</dd></div></dl>
          <div className="aap-privacy"><i>✓</i><p><strong>Chỉ hiển thị dữ liệu vận hành</strong><span>Admin không thể xem ghi chú, tin nhắn hoặc nội dung phiên tư vấn.</span></p></div>
          <footer><button onClick={() => onNotice(`Đã mở audit log của ${selected.id}.`)}>Xem audit log</button><button onClick={() => onNotice(`Đã gửi yêu cầu hỗ trợ cho ${selected.id}.`)}>Hỗ trợ vận hành →</button></footer>
        </aside>
      </div>
      <footer className="aap-board-footer"><p><i>i</i><span><strong>Thay đổi trạng thái được ghi vào audit log.</strong><small>Admin chỉ can thiệp khi có sự cố vận hành, thanh toán hoặc tranh chấp lịch.</small></span></p><span>{visible.length} lịch đang hiển thị</span></footer>
    </section>
  </div>
}
