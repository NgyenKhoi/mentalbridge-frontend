import Link from 'next/link'

import './specialist-earnings-manager.css'

export default function SpecialistEarningsManager() {
  return (
    <div className="earnings-manager">
      <header className="earnings-header">
        <div>
          <span className="earnings-eyebrow">Không gian chuyên gia</span>
          <h1>Thu nhập &amp; thanh toán</h1>
          <p>
            Theo dõi thu nhập và các lần thanh toán khi chức năng tài chính
            chính thức được đưa vào sử dụng.
          </p>
        </div>
      </header>

      <section className="earnings-panel earnings-empty" role="status">
        <span aria-hidden="true">◈</span>
        <h2>Chưa có dữ liệu tài chính để hiển thị</h2>
        <p>
          MentalBridge chưa ghi nhận thu nhập hoặc thanh toán cho chuyên gia ở
          thời điểm này. Trang sẽ hiển thị số liệu thực sau khi chức năng được
          đưa vào sử dụng; hệ thống không ước tính hoặc dùng số mẫu.
        </p>
        <Link href="/specialist/analytics">Xem phân tích vận hành</Link>
      </section>
    </div>
  )
}
