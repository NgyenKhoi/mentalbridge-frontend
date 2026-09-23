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
    description: 'Một lượt tư vấn trong mỗi kỳ dịch vụ đang hoạt động.',
  },
  {
    id: 'PREMIUM',
    name: 'Premium',
    credits: 3,
    description: 'Ba lượt tư vấn trong mỗi kỳ dịch vụ đang hoạt động.',
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
          Xem số lượt tư vấn còn lại, đã dành cho lịch hẹn và đã sử dụng trong
          kỳ dịch vụ hiện tại.
        </p>
      </header>

      <ServiceCreditsPanel />

      <section
        className="subscription-plans"
        aria-label="Số lượt tư vấn theo gói"
      >
        {plans.map((plan) => (
          <article
            className={`subscription-plan ${plan.id === 'PLUS' ? 'featured' : ''} ${plan.id === 'PREMIUM' ? 'premium' : ''}`}
            key={plan.id}
          >
            <h2>{plan.name}</h2>
            <div className="subscription-price">
              <strong>{plan.credits}</strong>
              <span> lượt tư vấn mỗi kỳ</span>
            </div>
            <p>{plan.description}</p>
            <ul>
              <li>
                <span>✓</span>Lượt tư vấn không chuyển sang kỳ sau
              </li>
              <li>
                <span>✓</span>Một phiên hoàn tất dùng một lượt đã dành trước
              </li>
            </ul>
            <p className="subscription-current">
              {plan.id === 'PREMIUM'
                ? 'Gói cao nhất'
                : 'Thanh toán sẽ được mở ở luồng riêng'}
            </p>
          </article>
        ))}
      </section>

      <section className="subscription-faq">
        <h2>Chính sách hiện tại</h2>
        <article className="open">
          <button type="button" aria-expanded="true">
            Nâng cấp ảnh hưởng thế nào đến lượt tư vấn?<span>+</span>
          </button>
          <div>
            <p>
              Trong cùng kỳ, nâng cấp Plus lên Premium chỉ cấp thêm phần chênh
              lệch để tổng số lượt tư vấn trong kỳ là ba. Hiện chưa hỗ trợ hạ
              gói hoặc hoàn tiền trong kỳ.
            </p>
          </div>
        </article>
      </section>
    </div>
  )
}
