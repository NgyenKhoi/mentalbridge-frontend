'use client'

import { useMemo, useState } from 'react'
import './admin-payouts-manager.css'

type PayoutTab = 'overview' | 'requests' | 'history'

const REQUESTS = [
  { id: 'PO-0826-042', name: 'Nguyễn Thu Hà', specialty: 'Tâm lý lâm sàng', amount: '8.400.000đ', sessions: '21 phiên', bank: 'Vietcombank · •••• 2846', requested: '27/08 · 08:42', status: 'Sẵn sàng duyệt' },
  { id: 'PO-0826-041', name: 'Trần Minh Đức', specialty: 'Tham vấn tâm lý', amount: '6.200.000đ', sessions: '16 phiên', bank: 'Techcombank · •••• 9018', requested: '26/08 · 17:25', status: 'Cần kiểm tra' },
  { id: 'PO-0826-039', name: 'Lê Minh Phương', specialty: 'Tâm lý trẻ em', amount: '5.650.000đ', sessions: '14 phiên', bank: 'ACB · •••• 4412', requested: '26/08 · 10:08', status: 'Sẵn sàng duyệt' },
  { id: 'PO-0826-037', name: 'Phạm Ngọc Anh', specialty: 'Tâm lý học đường', amount: '4.800.000đ', sessions: '12 phiên', bank: 'MB Bank · •••• 7530', requested: '25/08 · 15:36', status: 'Đang đối soát' },
]

const HISTORY = [
  { id: 'PO-0726-184', name: 'Nguyễn Thu Hà', period: '16–31/07/2026', amount: '6.800.000đ', transfer: 'VCB2608031842', date: '03/08/2026', status: 'Đã thanh toán' },
  { id: 'PO-0726-176', name: 'Trần Minh Đức', period: '16–31/07/2026', amount: '5.400.000đ', transfer: 'TCB2608031761', date: '03/08/2026', status: 'Đã thanh toán' },
  { id: 'PO-0726-151', name: 'Lê Minh Phương', period: '01–15/07/2026', amount: '4.950.000đ', transfer: 'ACB2607181518', date: '18/07/2026', status: 'Đã thanh toán' },
  { id: 'PO-0726-143', name: 'Phạm Ngọc Anh', period: '01–15/07/2026', amount: '3.750.000đ', transfer: 'MBB2607181434', date: '18/07/2026', status: 'Đã thanh toán' },
]

export default function AdminPayoutsManager({ onNotice }: { onNotice: (message: string) => void }) {
  const [tab, setTab] = useState<PayoutTab>('overview')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('Tất cả')
  const visibleRequests = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('vi')
    return REQUESTS.filter(item => (status === 'Tất cả' || item.status === status) && (!keyword || `${item.id} ${item.name} ${item.bank}`.toLocaleLowerCase('vi').includes(keyword)))
  }, [query, status])

  return <div className="admin-payouts-manager">
    <div className="role-heading apo-heading">
      <div><span className="eyebrow">Quản trị nền tảng</span><h1>Đối soát chuyên gia</h1><p>Xử lý payout dựa trên thu nhập từ lịch hẹn hoàn thành.</p></div>
      <div className="apo-heading-actions"><span><i />Đối soát tự động lúc 09:10</span><button className="btn-primary" onClick={() => onNotice('Đã bắt đầu xuất bảng đối soát chuyên gia.')}>↓ Xuất đối soát</button></div>
    </div>

    <section className="apo-metrics" aria-label="Tổng quan đối soát">
      <article className="primary"><span>Sẵn sàng chi trả</span><strong>20,25 triệu</strong><p>3 yêu cầu đã đủ điều kiện</p></article>
      <article><span>Đang đối soát</span><strong>11,0 triệu</strong><p>2 yêu cầu · 28 phiên tư vấn</p></article>
      <article><span>Đã chi trong tháng</span><strong>128,4 triệu</strong><p>32 chuyên gia · 326 phiên</p></article>
      <article className="attention"><span>Cần kiểm tra</span><strong>1</strong><p>Thông tin ngân hàng chưa khớp</p></article>
    </section>

    <nav className="apo-tabs" aria-label="Khu vực đối soát">
      <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}><span>⌁</span><div><strong>Tổng quan</strong><small>Kỳ đối soát hiện tại</small></div></button>
      <button className={tab === 'requests' ? 'active' : ''} onClick={() => setTab('requests')}><span>↗</span><div><strong>Yêu cầu chi trả</strong><small>Duyệt và chuyển payout</small></div><b>{REQUESTS.length}</b></button>
      <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}><span>▤</span><div><strong>Lịch sử thanh toán</strong><small>Biên nhận và mã chuyển khoản</small></div><b>{HISTORY.length}</b></button>
    </nav>

    {tab === 'overview' && <section className="apo-overview">
      <article className="apo-current-batch">
        <header><div><span>KỲ ĐỐI SOÁT HIỆN TẠI</span><h2>16–31 tháng 8, 2026</h2><p>Chốt dữ liệu vào 23:59 ngày 31/08/2026.</p></div><b><i />Đang mở</b></header>
        <div className="apo-batch-total"><div><small>Tổng phí tư vấn</small><strong>36.500.000đ</strong><span>87 phiên đã hoàn thành</span></div><span>−</span><div><small>Phí nền tảng</small><strong>3.650.000đ</strong><span>10% tổng doanh thu</span></div><span>=</span><div className="net"><small>Thực chi dự kiến</small><strong>32.850.000đ</strong><span>Cho 5 chuyên gia</span></div></div>
        <section className="apo-progress"><div><span><b>01</b>Ghi nhận phiên</span><i className="done" /></div><div><span><b>02</b>Đối soát</span><i className="active" /></div><div><span><b>03</b>Phê duyệt</span><i /></div><div><span><b>04</b>Chuyển khoản</span><i /></div></section>
        <footer><p><i>✓</i><span><strong>87/87 phiên đã có trạng thái hợp lệ</strong><small>Không ghi nhận phiên bị hủy hoặc hoàn tiền trong số tiền thực chi.</small></span></p><button onClick={() => setTab('requests')}>Xem yêu cầu chi trả <span>→</span></button></footer>
      </article>

      <aside className="apo-checks">
        <header><span>KIỂM TRA TRƯỚC CHI TRẢ</span><h2>Tình trạng dữ liệu</h2></header>
        <div><p><i>✓</i><span><strong>Phiên tư vấn</strong><small>87 phiên đã hoàn thành</small></span><b>Khớp</b></p><p><i>✓</i><span><strong>Phí nền tảng</strong><small>Áp dụng đúng tỷ lệ 10%</small></span><b>Khớp</b></p><p><i className="warn">!</i><span><strong>Tài khoản ngân hàng</strong><small>1 chuyên gia cần xác minh</small></span><b className="warn">Kiểm tra</b></p><p><i>✓</i><span><strong>Yêu cầu rút tiền</strong><small>Không có yêu cầu trùng lặp</small></span><b>Khớp</b></p></div>
        <button onClick={() => onNotice('Đã chạy lại quy trình kiểm tra đối soát.')}>↻ Chạy lại kiểm tra</button>
      </aside>

      <section className="apo-distribution">
        <header><div><span>PHÂN BỔ THỰC CHI</span><h2>Chi trả theo chuyên gia</h2></div><small>Kỳ hiện tại</small></header>
        <div>{[['Nguyễn Thu Hà','8,4 tr',82],['Trần Minh Đức','6,2 tr',61],['Lê Minh Phương','5,65 tr',55],['Phạm Ngọc Anh','4,8 tr',47],['Hoàng Minh Tâm','7,8 tr',76]].map(([name,amount,value],index) => <article key={name}><span className={`apo-avatar tone-${index}`}>{String(name).split(' ').slice(-2).map(word => word[0]).join('')}</span><div><p><strong>{name}</strong><b>{amount}</b></p><i><span style={{width:`${value}%`}} /></i></div></article>)}</div>
      </section>
    </section>}

    {tab === 'requests' && <section className="apo-requests">
      <header><div><span>YÊU CẦU CHI TRẢ</span><h2>Payout đang chờ xử lý</h2><p>Đối chiếu phiên tư vấn và tài khoản nhận trước khi phê duyệt.</p></div><div className="apo-filters"><label><span>⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tên chuyên gia hoặc mã payout..." /></label><select value={status} onChange={event => setStatus(event.target.value)}><option>Tất cả</option><option>Sẵn sàng duyệt</option><option>Đang đối soát</option><option>Cần kiểm tra</option></select></div></header>
      <div className="apo-request-head"><span>Chuyên gia</span><span>Tài khoản nhận</span><span>Yêu cầu lúc</span><span>Trạng thái</span><span>Thực nhận</span><span /></div>
      <div className="apo-request-list">{visibleRequests.map((item,index) => <article key={item.id}><span className={`apo-avatar tone-${index}`}>{item.name.split(' ').slice(-2).map(word => word[0]).join('')}</span><div><strong>{item.name}</strong><small>{item.specialty} · {item.sessions}</small><em>{item.id}</em></div><span>{item.bank}</span><span>{item.requested}</span><b className={item.status === 'Cần kiểm tra' ? 'warning' : item.status === 'Đang đối soát' ? 'processing' : ''}><i />{item.status}</b><strong>{item.amount}</strong><button onClick={() => onNotice(`Đã mở hồ sơ đối soát ${item.id}.`)} aria-label={`Xem ${item.id}`}>→</button></article>)}</div>
      {!visibleRequests.length && <div className="apo-empty"><span>⌕</span><strong>Không tìm thấy yêu cầu</strong><small>Thử thay đổi từ khóa hoặc trạng thái.</small></div>}
      <footer><p><i>i</i><span><strong>Phê duyệt payout là thao tác tài chính có lưu audit.</strong><small>Không phê duyệt nếu số phiên, phí hoặc tài khoản nhận chưa khớp.</small></span></p><button onClick={() => onNotice('Đã chọn các payout đủ điều kiện để phê duyệt.')}>Duyệt các mục hợp lệ</button></footer>
    </section>}

    {tab === 'history' && <section className="apo-history">
      <header><div><span>LỊCH SỬ THANH TOÁN</span><h2>Các kỳ đã hoàn tất</h2><p>Tra cứu số tiền, mã chuyển khoản và biên nhận payout.</p></div><button onClick={() => onNotice('Đã bắt đầu xuất lịch sử payout.')}>↓ Xuất lịch sử</button></header>
      <div className="apo-history-head"><span>Kỳ thanh toán</span><span>Chuyên gia</span><span>Mã chuyển khoản</span><span>Ngày thanh toán</span><span>Số tiền</span><span /></div>
      <div className="apo-history-list">{HISTORY.map((item,index) => <article key={item.id}><span className={`apo-history-icon tone-${index}`}>✓</span><div><strong>{item.period}</strong><small>{item.id}</small></div><span>{item.name}</span><code>{item.transfer}</code><span>{item.date}</span><strong>{item.amount}</strong><button onClick={() => onNotice(`Biên nhận ${item.id} đã sẵn sàng.`)} aria-label={`Tải biên nhận ${item.id}`}>↓</button></article>)}</div>
      <aside><i>✓</i><p><strong>Tất cả khoản chi trong danh sách đã được xác nhận.</strong><span>Biên nhận và audit log được lưu theo chính sách lưu giữ dữ liệu của MentalBridge.</span></p></aside>
    </section>}
  </div>
}
