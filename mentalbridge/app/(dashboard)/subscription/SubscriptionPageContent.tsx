import {
  ArrowUpRight,
  CalendarDays,
  HeartHandshake,
  Leaf,
  ShieldCheck,
} from 'lucide-react'

import ServiceCreditsPanel from '@/features/service-credits/components/ServiceCreditsPanel'
import PlanCheckoutPanel from '@/features/subscription/components/PlanCheckoutPanel'

import './subscription-redesign.css'

export default function SubscriptionPageContent() {
  return (
    <div className="subscription-page svc-page">
      <ServiceCreditsPanel />

      <header className="svc-intro">
        <span className="svc-kicker">
          <ShieldCheck size={14} aria-hidden="true" /> MINH BẠCH &amp; TIN CẬY
        </span>
        <h1>GÓI DỊCH VỤ &amp; QUYỀN LỢI TƯ VẤN</h1>
        <p>
          Theo dõi lượt tư vấn hiện có, so sánh quyền lợi từ catalogue chính
          thức và thanh toán an toàn qua MoMo khi bạn muốn đồng hành sâu hơn.
        </p>
      </header>

      <PlanCheckoutPanel />

      <section className="svc-assurance" aria-labelledby="svc-assurance-title">
        <div className="svc-assurance-copy">
          <span className="svc-kicker">
            <ShieldCheck size={14} aria-hidden="true" /> QUYỀN LỢI RÕ RÀNG
          </span>
          <h2 id="svc-assurance-title">
            Mỗi giao dịch gắn với đúng một phiên bản gói
          </h2>
          <p>
            Giá, số lượt tư vấn, giới hạn lịch và thời gian hiệu lực được chốt
            khi bạn tạo giao dịch. Hệ thống chỉ kích hoạt gói sau khi nhận xác
            nhận hợp lệ từ MoMo.
          </p>
          <div className="svc-assurance-points">
            <div>
              <CalendarDays size={18} aria-hidden="true" />
              <strong>Kỳ dịch vụ rõ ràng</strong>
              <span>
                Ngày bắt đầu, kết thúc và số lượt còn lại luôn hiển thị trong
                tài khoản.
              </span>
            </div>
            <div>
              <ShieldCheck size={18} aria-hidden="true" />
              <strong>Xác nhận từ máy chủ</strong>
              <span>
                Trình duyệt không tự tính giá, quyền lợi hay số lượt tư vấn.
              </span>
            </div>
          </div>
        </div>
        <div className="svc-preview" aria-hidden="true">
          <div className="svc-preview-sidebar">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="svc-preview-main">
            <div className="svc-preview-top">
              <span />
              <i />
              <i />
            </div>
            <div className="svc-preview-title">Quyền lợi tư vấn minh bạch</div>
            <div className="svc-preview-summary">
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="svc-preview-line" />
            <div className="svc-preview-cards">
              <span />
              <span />
              <span />
            </div>
            <div className="svc-preview-table">
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
          <div className="svc-preview-caption">
            Thông tin quyền lợi của bạn luôn rõ ràng
          </div>
        </div>
      </section>

      <section
        className="svc-commitment"
        aria-label="Thông tin hỗ trợ và chính sách"
      >
        <span className="svc-commitment-icon">
          <HeartHandshake size={23} aria-hidden="true" />
        </span>
        <div>
          <h2>Chủ động chọn mức hỗ trợ phù hợp</h2>
          <p>
            Bạn có thể mua Plus hoặc Premium từ gói Miễn phí và nâng Plus lên
            Premium. Mọi giao dịch trong luồng này đều đi qua MoMo.
          </p>
        </div>
        <a
          href="#subscription-plans"
          className="svc-round-link svc-round-primary"
        >
          <Leaf size={16} aria-hidden="true" /> Xem các gói
        </a>
        <a href="#subscription-policy" className="svc-round-link">
          <ArrowUpRight size={16} aria-hidden="true" /> Chính sách gói
        </a>
      </section>

      <details id="subscription-policy" className="svc-policy">
        <summary>Chính sách hiện tại</summary>
        <p>
          Lượt tư vấn không cộng dồn sang kỳ tiếp theo. Plus có thể nâng lên
          Premium trong kỳ; hệ thống giữ phần giá trị đủ điều kiện và hiển thị
          chính xác số tiền cần thanh toán trước khi chuyển sang MoMo.
        </p>
      </details>
    </div>
  )
}
