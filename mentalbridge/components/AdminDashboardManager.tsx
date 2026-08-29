'use client'

import Link from 'next/link'
import { useState } from 'react'
import './admin-dashboard-manager.css'

type Range = '7 ngày' | '30 ngày' | 'Quý III'

const CHARTS: Record<Range, number[]> = {
  '7 ngày': [46, 58, 52, 69, 64, 78, 86],
  '30 ngày': [51, 63, 59, 72, 68, 82, 91],
  'Quý III': [43, 56, 61, 70, 76, 84, 94],
}

export default function AdminDashboardManager({ onNotice }: { onNotice: (message: string) => void }) {
  const [range, setRange] = useState<Range>('30 ngày')

  return <div className="admin-dashboard-manager">
    <div className="role-heading adm-heading">
      <div><span className="eyebrow">Quản trị nền tảng</span><h1>Tổng quan hệ thống</h1><p>Các chỉ số vận hành và hạng mục cần xử lý.</p></div>
      <div className="adm-heading-actions"><span><i />Hệ thống hoạt động ổn định</span><button className="btn-primary" onClick={() => onNotice('Đã cập nhật dữ liệu tổng quan lúc 09:18.')}>↻ Làm mới dữ liệu</button></div>
    </div>

    <section className="adm-metrics" aria-label="Chỉ số vận hành chính">
      <article className="primary"><span>Người dùng hoạt động</span><strong>12.480</strong><p><b>↑ 8,4%</b> trong 30 ngày</p><i style={{'--progress':'84%'} as React.CSSProperties} /></article>
      <article><span>Chuyên gia đang hoạt động</span><strong>128</strong><p>6 hồ sơ đang chờ duyệt</p><i style={{'--progress':'72%'} as React.CSSProperties} /></article>
      <article><span>Phiên tư vấn tháng này</span><strong>1.284</strong><p>92,6% đã hoàn thành</p><i style={{'--progress':'92.6%'} as React.CSSProperties} /></article>
      <article className="attention"><span>Việc cần xử lý</span><strong>11</strong><p>6 xác minh · 5 kiểm duyệt</p><i style={{'--progress':'36%'} as React.CSSProperties} /></article>
    </section>

    <section className="adm-command-grid">
      <article className="adm-activity-chart">
        <header><div><span>NHỊP VẬN HÀNH</span><h2>Hoạt động trên MentalBridge</h2><p>Người dùng có hoạt động hợp lệ trong khoảng thời gian đã chọn.</p></div><select value={range} onChange={event => setRange(event.target.value as Range)} aria-label="Khoảng thời gian"><option>7 ngày</option><option>30 ngày</option><option>Quý III</option></select></header>
        <div className="adm-chart"><div className="adm-axis"><span>12k</span><span>8k</span><span>4k</span><span>0</span></div><div className="adm-bars">{CHARTS[range].map((value,index) => <div key={`${range}-${index}`}><span style={{'--bar':`${value}%`} as React.CSSProperties}><i>{(value * 0.13).toFixed(1)}k</i></span><small>{['21/08','22/08','23/08','24/08','25/08','26/08','27/08'][index]}</small></div>)}</div></div>
        <footer><p><span><i />Người dùng hoạt động</span><b>Trung bình 8.742/ngày</b></p><Link href="/admin/reports">Xem báo cáo đầy đủ <span>→</span></Link></footer>
      </article>

      <aside className="adm-priority">
        <header><span>CẦN ƯU TIÊN</span><h2>Việc đang chờ bạn</h2><b>11</b></header>
        <Link href="/admin/specialists"><i className="amber">✦</i><div><strong>Xác minh chuyên gia</strong><p>6 hồ sơ đang chờ, lâu nhất 3 ngày</p></div><span>6</span><b>→</b></Link>
        <Link href="/admin/moderation"><i className="rose">◉</i><div><strong>Báo cáo nội dung</strong><p>5 báo cáo cần kiểm duyệt hôm nay</p></div><span>5</span><b>→</b></Link>
        <Link href="/admin/payments"><i>↔</i><div><strong>Thanh toán cần theo dõi</strong><p>3 giao dịch thất bại trong 24 giờ</p></div><span>3</span><b>→</b></Link>
        <footer><i>i</i><p>Ưu tiên theo mức độ ảnh hưởng và thời gian chờ.</p></footer>
      </aside>
    </section>

    <section className="adm-health">
      <header><div><span>SỨC KHỎE HỆ THỐNG</span><h2>Dịch vụ đang vận hành</h2></div><small>Cập nhật 2 phút trước</small></header>
      <div>
        <article><span className="adm-health-icon">◌</span><div><strong>API & đăng nhập</strong><small>99,98% uptime</small></div><b><i />Ổn định</b></article>
        <article><span className="adm-health-icon">↔</span><div><strong>Payments</strong><small>Đối soát lúc 09:10</small></div><b><i />Ổn định</b></article>
        <article><span className="adm-health-icon">◇</span><div><strong>Tin nhắn tư vấn</strong><small>Độ trễ trung bình 184ms</small></div><b><i />Ổn định</b></article>
        <article><span className="adm-health-icon">▣</span><div><strong>Dữ liệu & sao lưu</strong><small>Sao lưu gần nhất 03:00</small></div><b><i />An toàn</b></article>
      </div>
    </section>

    <section className="adm-lower-grid">
      <article className="adm-journey">
        <header><div><span>HÀNH TRÌNH NGƯỜI DÙNG</span><h2>Từ đăng ký đến chăm sóc</h2></div><small>30 ngày gần nhất</small></header>
        <div className="adm-journey-flow">
          <p><span>01</span><strong>4.286</strong><small>Đăng ký mới</small><i /></p>
          <p><span>02</span><strong>3.712</strong><small>Hoàn thành đánh giá</small><i /></p>
          <p><span>03</span><strong>2.948</strong><small>Duy trì hoạt động</small><i /></p>
          <p><span>04</span><strong>684</strong><small>Đặt lịch tư vấn</small></p>
        </div>
        <footer><span>Tỷ lệ chuyển đổi sang chăm sóc chuyên gia</span><strong>16,0%</strong></footer>
      </article>

      <aside className="adm-privacy">
        <header><span>QUYỀN RIÊNG TƯ</span><h2>Kiểm soát dữ liệu</h2></header>
        <div className="adm-privacy-score"><strong>96</strong><span>/100</span><i><b /></i></div>
        <p>Không phát hiện truy cập bất thường trong 24 giờ qua.</p>
        <ul><li><i>✓</i>Audit log đang ghi nhận</li><li><i>✓</i>Sao lưu đã mã hóa</li><li><i>✓</i>Phân quyền đúng vai trò</li></ul>
        <Link href="/admin/audit">Xem Audit &amp; Privacy <span>→</span></Link>
      </aside>
    </section>

    <section className="adm-recent">
      <header><div><span>HOẠT ĐỘNG GẦN ĐÂY</span><h2>Cập nhật vận hành mới nhất</h2></div><Link href="/admin/audit">Xem audit log →</Link></header>
      <div>
        <article><span className="tone-green">✓</span><div><strong>Hồ sơ BS. Nguyễn Thu Hà đã được xác minh</strong><small>Quản trị viên Nguyễn Hoài An · 09:02</small></div><b>VERIFICATION_APPROVED</b></article>
        <article><span className="tone-blue">↔</span><div><strong>Kỳ đối soát payments hoàn tất</strong><small>Hệ thống tự động · 08:46</small></div><b>PAYMENT_RECONCILED</b></article>
        <article><span className="tone-amber">▤</span><div><strong>Báo cáo hoạt động tháng 08 đã sẵn sàng</strong><small>Hệ thống báo cáo · 08:15</small></div><b>REPORT_READY</b></article>
      </div>
    </section>
  </div>
}
