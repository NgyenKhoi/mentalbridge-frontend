'use client'

import { useMemo, useState } from 'react'
import './admin-reports-manager.css'

type ReportTab = 'overview' | 'reports' | 'schedules'
type Period = '7 ngày' | '30 ngày' | 'Quý III'

const ACTIVITY = {
  '7 ngày': [62, 74, 68, 91, 86, 103, 118],
  '30 ngày': [71, 84, 79, 96, 91, 112, 124],
  'Quý III': [54, 72, 67, 88, 94, 108, 121],
} as const

const REPORTS = [
  { id: 'RPT-0826-04', name: 'Báo cáo hoạt động tháng 08', scope: 'Người dùng · Chuyên gia · Lịch hẹn', created: '27/08/2026 · 09:15', owner: 'Nguyễn Hoài An', status: 'Sẵn sàng', size: '2,4 MB' },
  { id: 'RPT-0826-03', name: 'Hiệu quả vận hành tư vấn', scope: 'Lịch hẹn · Tỷ lệ hoàn thành', created: '26/08/2026 · 17:40', owner: 'Hệ thống', status: 'Sẵn sàng', size: '1,8 MB' },
  { id: 'RPT-0826-02', name: 'Tăng trưởng người dùng tuần 34', scope: 'Đăng ký · Mức độ hoạt động', created: '25/08/2026 · 08:00', owner: 'Hệ thống', status: 'Sẵn sàng', size: '940 KB' },
  { id: 'RPT-0826-01', name: 'Phân tích xu hướng quý III', scope: 'Toàn nền tảng', created: 'Đang tổng hợp', owner: 'Trần Phương Vy', status: 'Đang xử lý', size: '—' },
]

const SCHEDULES = [
  { name: 'Tổng hợp vận hành tuần', cadence: 'Thứ Hai · 08:00', recipient: 'Vận hành & quản trị', next: '31/08/2026', active: true },
  { name: 'Đối soát lịch hẹn tháng', cadence: 'Ngày 01 hàng tháng', recipient: 'Tài chính', next: '01/09/2026', active: true },
  { name: 'Báo cáo tăng trưởng quý', cadence: 'Ngày cuối quý', recipient: 'Ban quản trị', next: '30/09/2026', active: false },
]

export default function AdminReportsManager({ onNotice }: { onNotice: (message: string) => void }) {
  const [tab, setTab] = useState<ReportTab>('overview')
  const [period, setPeriod] = useState<Period>('30 ngày')
  const [query, setQuery] = useState('')
  const bars = ACTIVITY[period]
  const max = Math.max(...bars)
  const visibleReports = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('vi')
    return keyword ? REPORTS.filter(report => `${report.name} ${report.scope} ${report.status}`.toLocaleLowerCase('vi').includes(keyword)) : REPORTS
  }, [query])

  return <div className="admin-reports-manager">
    <div className="role-heading arm-heading">
      <div><span className="eyebrow">Quản trị nền tảng</span><h1>Báo cáo nền tảng</h1><p>Xu hướng sử dụng, lịch hẹn, subscription và thanh toán.</p></div>
      <div className="arm-heading-actions"><span><i />Dữ liệu cập nhật 09:15 hôm nay</span><button className="btn-primary" onClick={() => onNotice('Đã mở thiết lập tạo báo cáo mới.')}>+ Tạo báo cáo</button></div>
    </div>

    <section className="arm-metrics" aria-label="Chỉ số nền tảng">
      <article className="primary"><span>Người dùng hoạt động</span><strong>8.742</strong><p><b>↑ 8,4%</b> so với kỳ trước</p></article>
      <article><span>Phiên tư vấn hoàn thành</span><strong>1.284</strong><p>92,6% tổng lịch đã xác nhận</p></article>
      <article><span>Doanh thu ghi nhận</span><strong>486,2 tr</strong><p><b>↑ 12,1%</b> trong 30 ngày</p></article>
      <article><span>Tỷ lệ giữ chân</span><strong>68,7%</strong><p>Người dùng quay lại trong tháng</p></article>
    </section>

    <nav className="arm-tabs" aria-label="Khu vực báo cáo">
      <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}><span>⌁</span><div><strong>Tổng quan</strong><small>Xu hướng vận hành</small></div></button>
      <button className={tab === 'reports' ? 'active' : ''} onClick={() => setTab('reports')}><span>▤</span><div><strong>Kho báo cáo</strong><small>Tệp đã tạo và đang xử lý</small></div><b>{REPORTS.length}</b></button>
      <button className={tab === 'schedules' ? 'active' : ''} onClick={() => setTab('schedules')}><span>◷</span><div><strong>Lịch tự động</strong><small>Báo cáo định kỳ</small></div><b>{SCHEDULES.filter(item => item.active).length}</b></button>
    </nav>

    {tab === 'overview' && <section className="arm-overview">
      <article className="arm-chart-card">
        <header><div><span>XU HƯỚNG HOẠT ĐỘNG</span><h2>Nhịp sử dụng nền tảng</h2><p>Số lượt hoạt động hợp lệ được ghi nhận theo thời gian.</p></div><select value={period} onChange={event => setPeriod(event.target.value as Period)} aria-label="Khoảng thời gian"><option>7 ngày</option><option>30 ngày</option><option>Quý III</option></select></header>
        <div className="arm-chart" aria-label="Biểu đồ hoạt động nền tảng">
          <div className="arm-axis"><span>120k</span><span>80k</span><span>40k</span><span>0</span></div>
          <div className="arm-bars">{bars.map((value, index) => <div key={`${period}-${index}`}><span style={{ '--height': `${Math.max(20, value / max * 100)}%` } as React.CSSProperties}><i>{value}k</i></span><small>{['21/08','22/08','23/08','24/08','25/08','26/08','27/08'][index]}</small></div>)}</div>
        </div>
        <footer><span><i />Lượt hoạt động</span><strong>Trung bình 86,1 nghìn/ngày</strong></footer>
      </article>

      <aside className="arm-insights">
        <header><span>ĐIỂM ĐÁNG CHÚ Ý</span><h2>Tín hiệu vận hành</h2></header>
        <article><i className="up">↗</i><div><strong>Lịch hẹn tăng ổn định</strong><p>Tăng 14,2% so với 30 ngày trước, chủ yếu ở khung 19:00–21:00.</p></div></article>
        <article><i>✓</i><div><strong>Tỷ lệ hoàn thành tốt</strong><p>92,6% phiên đã xác nhận được hoàn thành đúng trạng thái.</p></div></article>
        <article><i className="attention">!</i><div><strong>6 hồ sơ cần xử lý</strong><p>Hồ sơ chuyên gia chờ duyệt lâu nhất đã sang ngày thứ ba.</p></div></article>
        <button onClick={() => setTab('reports')}>Xem báo cáo chi tiết <span>→</span></button>
      </aside>

      <section className="arm-breakdown">
        <header><div><span>PHÂN BỔ HOẠT ĐỘNG</span><h2>Các khu vực được sử dụng nhiều</h2></div><small>30 ngày gần nhất</small></header>
        <div>
          {[['Đánh giá tâm lý','32%','assessment'],['Nhật ký cảm xúc','27%','journal'],['Tài nguyên tự chăm sóc','23%','resources'],['Tư vấn chuyên gia','18%','consultation']].map(([label,value,tone]) => <article key={label}><div><strong>{label}</strong><span>{value}</span></div><p><i className={tone} style={{ width: value }} /></p></article>)}
        </div>
      </section>
    </section>}

    {tab === 'reports' && <section className="arm-reports">
      <header><div><span>KHO BÁO CÁO</span><h2>Báo cáo đã tạo</h2><p>Tải xuống hoặc theo dõi trạng thái tổng hợp dữ liệu.</p></div><label><span>⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm tên hoặc phạm vi báo cáo..." /></label></header>
      <div className="arm-report-head"><span>Báo cáo</span><span>Người tạo</span><span>Trạng thái</span><span>Dung lượng</span><span /></div>
      <div className="arm-report-list">{visibleReports.map((report, index) => <article key={report.id}><span className={`arm-report-icon tone-${index}`}>▤</span><div><strong>{report.name}</strong><small>{report.scope}</small><em>{report.id} · {report.created}</em></div><span>{report.owner}</span><b className={report.status === 'Đang xử lý' ? 'processing' : ''}><i />{report.status}</b><span>{report.size}</span><button disabled={report.status === 'Đang xử lý'} onClick={() => onNotice(`Đang tải xuống ${report.name}.`)} aria-label={`Tải ${report.name}`}>{report.status === 'Đang xử lý' ? '…' : '↓'}</button></article>)}</div>
      {!visibleReports.length && <div className="arm-empty"><span>⌕</span><strong>Không tìm thấy báo cáo</strong><small>Hãy thử từ khóa khác.</small></div>}
    </section>}

    {tab === 'schedules' && <section className="arm-schedules">
      <header><div><span>LỊCH TỰ ĐỘNG</span><h2>Báo cáo định kỳ</h2><p>Tạo báo cáo đúng lịch và gửi đến nhóm phụ trách.</p></div><button onClick={() => onNotice('Đã mở biểu mẫu tạo lịch báo cáo.')}>+ Thêm lịch</button></header>
      <div>{SCHEDULES.map((schedule, index) => <article key={schedule.name}><span className="arm-schedule-number">0{index + 1}</span><div><strong>{schedule.name}</strong><small>{schedule.cadence}</small></div><p><small>Người nhận</small><strong>{schedule.recipient}</strong></p><p><small>Lần tạo tiếp theo</small><strong>{schedule.next}</strong></p><label><input type="checkbox" defaultChecked={schedule.active} onChange={event => onNotice(event.target.checked ? 'Đã bật lịch báo cáo.' : 'Đã tạm dừng lịch báo cáo.')} /><i /></label><button onClick={() => onNotice(`Đã mở thiết lập ${schedule.name}.`)}>→</button></article>)}</div>
      <aside><i>i</i><p><strong>Dữ liệu nhạy cảm không được gửi trong báo cáo tự động.</strong><span>Các báo cáo định kỳ chỉ chứa số liệu tổng hợp, đã giới hạn theo vai trò người nhận.</span></p></aside>
    </section>}
  </div>
}
