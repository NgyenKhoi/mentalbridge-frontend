import ServiceCreditsPanel from '@/features/service-credits/components/ServiceCreditsPanel'

const plans = [
  {
    id: 'FREE',
    name: 'Miễn phí',
    credits: 0,
    description: 'Các công cụ tự chăm sóc và sàng lọc cơ bản.',
  },
  {
    id: 'PLUS',
    name: 'Plus',
    credits: 1,
    description: 'Một consultation credit trong mỗi kỳ dịch vụ đang hoạt động.',
  },
  {
    id: 'PREMIUM',
    name: 'Premium',
    credits: 3,
    description: 'Ba consultation credit trong mỗi kỳ dịch vụ đang hoạt động.',
  },
] as const

export default function SubscriptionPage() {
  return (
    <div className="subscription-page">
      <header className="subscription-hero">
        <span>Gói dịch vụ</span>
        <h1>
          Quyền lợi tư vấn <em>minh bạch</em>
        </h1>
        <p>
          Số dư bên dưới được tải trực tiếp từ Consultation. Ứng dụng không tự
          suy ra credit từ tên gói.
        </p>
      </header>

      <ServiceCreditsPanel />

      <section
        className="subscription-plans"
        aria-label="Chính sách credit theo gói"
      >
        {plans.map((plan) => (
          <article
            className={`subscription-plan ${plan.id === 'PLUS' ? 'featured' : ''} ${plan.id === 'PREMIUM' ? 'premium' : ''}`}
            key={plan.id}
          >
            <h2>{plan.name}</h2>
            <div className="subscription-price">
              <strong>{plan.credits}</strong>
              <span> credit/kỳ</span>
            </div>
            <p>{plan.description}</p>
            <ul>
              <li>
                <span>✓</span>Credit không chuyển sang kỳ sau
              </li>
              <li>
                <span>✓</span>Một phiên hoàn tất dùng một credit đang giữ
              </li>
            </ul>
            <button className="subscription-current" disabled>
              {plan.id === 'PREMIUM'
                ? 'Gói cao nhất'
                : 'Thanh toán sẽ được mở ở luồng riêng'}
            </button>
          </article>
        ))}
      </section>

      <section className="subscription-faq">
        <h2>Chính sách hiện tại</h2>
        <article className="open">
          <button type="button" aria-expanded="true">
            Nâng cấp ảnh hưởng thế nào đến credit?<span>+</span>
          </button>
          <div>
            <p>
              Trong cùng kỳ, nâng cấp Plus lên Premium chỉ cấp thêm phần chênh
              lệch để tổng allocation là ba. Luồng này không hỗ trợ hạ gói hoặc
              hoàn tiền.
            </p>
          </div>
        </article>
      </section>
    </div>
  )
}
