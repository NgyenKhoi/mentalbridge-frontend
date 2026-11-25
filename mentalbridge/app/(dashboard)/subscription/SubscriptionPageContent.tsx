'use client'

import {
  ArrowUpRight,
  CalendarDays,
  HeartHandshake,
  Leaf,
  ShieldCheck,
} from 'lucide-react'
import { useState } from 'react'

import ServiceCreditsPanel from '@/features/service-credits/components/ServiceCreditsPanel'
import PlanCheckoutPanel from '@/features/subscription/components/PlanCheckoutPanel'
import SubscriptionCancellationPanel from '@/features/subscription/components/SubscriptionCancellationPanel'

import './subscription-redesign.css'

export default function SubscriptionPageContent() {
  const [ownerStateRevision, setOwnerStateRevision] = useState(0)

  return (
    <div className="subscription-page svc-page">
      <ServiceCreditsPanel key={`credits-${ownerStateRevision}`} />

      <header
        className="svc-intro"
        data-user-page-header
        data-user-page-heading
      >
        <span className="svc-kicker" data-user-page-kicker>
          <ShieldCheck size={14} aria-hidden="true" /> MINH BẠCH &amp; TIN CẬY
        </span>
        <h1>Gói dịch vụ &amp; quyền lợi tư vấn</h1>
        <p>
          Xem số buổi tư vấn còn lại, so sánh quyền lợi các gói và thanh toán an
          toàn khi bạn muốn được đồng hành sâu hơn.
        </p>
      </header>

      <SubscriptionCancellationPanel
        onConfirmedCancellation={() =>
          setOwnerStateRevision((revision) => revision + 1)
        }
      />

      <PlanCheckoutPanel key={`checkout-${ownerStateRevision}`} />

      <section className="svc-assurance" aria-labelledby="svc-assurance-title">
        <div className="svc-assurance-copy">
          <span className="svc-kicker">
            <ShieldCheck size={14} aria-hidden="true" /> QUYỀN LỢI RÕ RÀNG
          </span>
          <h2 id="svc-assurance-title">
            Quyền lợi bạn thấy là quyền lợi bạn nhận
          </h2>
          <p>
            Giá, số buổi tư vấn và thời gian sử dụng được chốt khi bạn tạo giao
            dịch. Gói chỉ được kích hoạt sau khi thanh toán thành công.
          </p>
          <div className="svc-assurance-points">
            <div>
              <CalendarDays size={18} aria-hidden="true" />
              <strong>Thời gian sử dụng rõ ràng</strong>
              <span>
                Ngày bắt đầu, ngày kết thúc và số buổi còn lại luôn hiển thị
                trong tài khoản.
              </span>
            </div>
            <div>
              <ShieldCheck size={18} aria-hidden="true" />
              <strong>Giá rõ ràng trước khi trả</strong>
              <span>
                Bạn luôn thấy đúng số tiền cần trả trước khi xác nhận.
              </span>
            </div>
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
            Premium.
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
          Buổi chưa dùng không cộng dồn sang tháng sau. Plus có thể nâng lên
          Premium giữa tháng; hệ thống giữ phần giá trị còn lại và hiển thị
          chính xác số tiền cần thanh toán trước khi bạn trả tiền.
        </p>
      </details>
    </div>
  )
}
