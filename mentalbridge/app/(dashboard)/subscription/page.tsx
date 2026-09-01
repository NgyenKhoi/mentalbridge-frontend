'use client'

import { useState } from 'react'

const plans = [
  { id: 'free', name: 'Miễn phí', price: '0đ', per: '/mãi mãi', description: 'Dùng thử các công cụ cơ bản', badge: 'Đang dùng', features: ['Bài sàng lọc PHQ-9','Nhật ký cảm xúc cơ bản','Tài nguyên tự chăm sóc giới hạn','Hỗ trợ qua email'] },
  { id: 'plus', name: 'Plus', price: '199.000đ', per: '/tháng', description: 'Cho hành trình chăm sóc đều đặn', badge: 'Phổ biến nhất', featured: true, features: ['Tất cả tính năng Miễn phí','Không giới hạn bài đánh giá','Phân tích xu hướng chi tiết','Chat AI theo nhu cầu','Tài nguyên tự chăm sóc đầy đủ','1 consultation credit/tháng'] },
  { id: 'premium', name: 'Premium', price: '499.000đ', per: '/tháng', description: 'Đồng hành sát sao cùng chuyên gia', badge: 'Toàn diện nhất', premium: true, features: ['Tất cả tính năng Plus','Đặt lịch ưu tiên','Chuyên gia ưu tiên','Tư vấn nhóm miễn phí','Tài liệu chuyên sâu','Hỗ trợ qua điện thoại'] },
]

const faqs = [
  ['Tôi có thể hủy đăng ký bất cứ lúc nào không?','Có. Bạn vẫn sử dụng tính năng đã thanh toán đến hết chu kỳ hiện tại. Việc hủy luôn yêu cầu xác nhận rõ ràng.'],
  ['Thanh toán có an toàn không?','Thanh toán được xử lý qua MoMo hoặc PayOS. MentalBridge không lưu trực tiếp thông tin thẻ hoặc thông tin đăng nhập ví của bạn.'],
  ['Có thể chuyển đổi giữa các gói không?','Bạn có thể nâng cấp hoặc hạ cấp. Hệ thống sẽ hiển thị khoản phí và thời điểm hiệu lực trước khi xác nhận.'],
]

type PaymentMethod = 'momo' | 'payos' | 'card' | 'bank'

const paymentMethods: Array<{ id: PaymentMethod; icon: string; name: string; description: string }> = [
  { id: 'payos', icon: 'QR', name: 'Quét mã QR', description: 'VietQR qua ứng dụng ngân hàng' },
  { id: 'card', icon: '▣', name: 'Thẻ ngân hàng', description: 'Visa, Mastercard hoặc thẻ nội địa' },
  { id: 'momo', icon: 'M', name: 'Ví MoMo', description: 'Thanh toán nhanh qua ứng dụng MoMo' },
  { id: 'bank', icon: '₫', name: 'Chuyển khoản', description: 'Chuyển khoản thủ công qua ngân hàng' },
]

const qrPattern = [
  '111111101010101111111', '100000101100101000001', '101110101011101011101',
  '101110100110101011101', '101110101001101011101', '100000101111001000001',
  '111111101010101111111', '000000001101100000000', '101011111001111010101',
  '010100001110001101010', '111011101011101011101', '001100011100011100010',
  '101111101011111011111', '000000001100101000100', '111111101011111010111',
  '100000100110001000101', '101110101111101110111', '101110100010100101000',
  '101110101101111101101', '100000101010001010010', '111111101101101101111',
]

function PaymentQr() {
  return <svg className="subscription-qr-code" viewBox="0 0 21 21" role="img" aria-label="Mã QR thanh toán minh họa">
    <rect width="21" height="21" rx="1.4" fill="#fff" />
    {qrPattern.flatMap((row, y) => [...row].map((cell, x) => cell === '1' ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" rx=".08" fill="#173f37" /> : null))}
  </svg>
}

export default function SubscriptionPage() {
  const [compare, setCompare] = useState(false)
  const [faq, setFaq] = useState(0)
  const [checkout, setCheckout] = useState<string | null>(null)
  const [method, setMethod] = useState<PaymentMethod>('payos')
  const [status, setStatus] = useState<'idle'|'loading'|'success'>('idle')
  const selectedPlan = plans.find(plan => plan.id === checkout)

  const pay = async () => { setStatus('loading'); await new Promise(resolve => setTimeout(resolve, 850)); if (selectedPlan) localStorage.setItem('mentalbridge_plan', selectedPlan.id); setStatus('success') }
  const closeCheckout = () => { setCheckout(null); setStatus('idle') }

  return <div className="subscription-page">
    <header className="subscription-hero"><span>Gói dịch vụ</span><h1>Chọn gói <em>phù hợp</em> với hành trình của bạn</h1><p>Bắt đầu miễn phí và nâng cấp bất cứ lúc nào. Dữ liệu cùng tiến trình hiện tại của bạn luôn được giữ nguyên.</p></header>

    <section className="subscription-balance"><div><span>Consultation credit</span><strong>0 credit</strong><small>Gói Plus cấp 1 credit mới vào đầu mỗi chu kỳ</small></div><button onClick={() => setCheckout('plus')}>Nhận credit hàng tháng →</button></section>

    <div className="subscription-spine" aria-label="Tiến trình gói dịch vụ"><div className="subscription-track"><i /></div>{plans.map((plan,index) => <div className={`subscription-node ${index === 0 ? 'current' : ''} ${plan.featured ? 'featured' : ''}`} key={plan.id}><span/><strong>{plan.name}</strong><small>{plan.badge}</small></div>)}</div>

    <section className="subscription-plans">
      {plans.map(plan => <article className={`subscription-plan ${plan.featured ? 'featured' : ''} ${plan.premium ? 'premium' : ''}`} key={plan.id}>
        <span className={`subscription-plan-badge ${plan.id}`}>{plan.badge}</span><h2>{plan.name}</h2><div className="subscription-price"><strong>{plan.price}</strong><span>{plan.per}</span></div><p>{plan.description}</p><ul>{plan.features.map(feature => <li key={feature}><span>✓</span>{feature}</li>)}</ul>
        {plan.id === 'free' ? <button className="subscription-current" disabled>Gói hiện tại</button> : <button className={`subscription-select ${plan.premium ? 'accent' : ''}`} onClick={() => setCheckout(plan.id)}>Nâng cấp lên {plan.name}</button>}
      </article>)}
    </section>

    <div className="subscription-compare-toggle"><button className={compare ? 'open' : ''} onClick={() => setCompare(!compare)}>So sánh chi tiết các gói <span>⌄</span></button></div>
    <div className={`subscription-compare ${compare ? 'open' : ''}`}><div><table><thead><tr><th>Tính năng</th><th>Miễn phí</th><th>Plus</th><th>Premium</th></tr></thead><tbody><tr><td>PHQ-9</td><td>✓</td><td>✓</td><td>✓</td></tr><tr><td>Nhật ký cảm xúc</td><td>Cơ bản</td><td>Đầy đủ</td><td>Đầy đủ</td></tr><tr><td>Phân tích xu hướng</td><td>Giới hạn</td><td>Chi tiết</td><td>Chi tiết</td></tr><tr><td>Chat AI hỗ trợ</td><td>—</td><td>Theo nhu cầu</td><td>Theo nhu cầu</td></tr><tr><td>Consultation credit</td><td>—</td><td>1/tháng</td><td>Ưu tiên</td></tr><tr><td>Hỗ trợ</td><td>Email</td><td>Email + Chat</td><td>Điện thoại</td></tr></tbody></table></div></div>

    <section className="subscription-faq"><h2>Câu hỏi thường gặp</h2>{faqs.map(([question,answer],index) => <article className={faq === index ? 'open' : ''} key={question}><button onClick={() => setFaq(faq === index ? -1 : index)} aria-expanded={faq === index}>{question}<span>+</span></button><div><p>{answer}</p></div></article>)}</section>

    {checkout && <div className="subscription-modal-wrap">
      <button className="subscription-backdrop" onClick={closeCheckout} aria-label="Đóng thanh toán" />
      <div className="subscription-modal subscription-modal-expanded" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
        {status === 'success' ? <div className="subscription-success">
          <span>✓</span><h2>Thanh toán thành công</h2>
          <p>Gói {selectedPlan?.name} đã được kích hoạt. Credit và quyền lợi mới sẽ xuất hiện ngay.</p>
          <button className="btn-primary" onClick={closeCheckout}>Hoàn tất</button>
        </div> : <>
          <div className="subscription-modal-head">
            <div><small>Thanh toán an toàn</small><h2 id="checkout-title">Nâng cấp {selectedPlan?.name}</h2></div>
            <button onClick={closeCheckout} aria-label="Đóng">×</button>
          </div>

          <div className="subscription-order">
            <span><b>Gói {selectedPlan?.name}</b><small>Gia hạn hàng tháng · Hủy bất cứ lúc nào</small></span>
            <strong>{selectedPlan?.price}</strong>
          </div>

          <div className="subscription-payment-layout">
            <div className="subscription-methods">
              <p className="subscription-method-label">Chọn phương thức</p>
              <div className="subscription-method-grid">
                {paymentMethods.map(option => <label className={method === option.id ? `selected ${option.id}` : option.id} key={option.id}>
                  <input type="radio" name="payment" value={option.id} checked={method === option.id} onChange={() => setMethod(option.id)} />
                  <span>{option.icon}</span>
                  <div><strong>{option.name}</strong><small>{option.description}</small></div>
                  <i aria-hidden="true">✓</i>
                </label>)}
              </div>
            </div>

            <section className="subscription-payment-detail" aria-live="polite">
              {method === 'payos' && <div className="subscription-qr-panel">
                <div className="subscription-qr-frame"><PaymentQr /><span>VietQR</span></div>
                <div><span className="subscription-detail-kicker">Quét để thanh toán</span><h3>{selectedPlan?.price}</h3><p>Mở ứng dụng ngân hàng, chọn quét QR và kiểm tra đúng số tiền trước khi xác nhận.</p><small>Mã giao dịch: MB-{selectedPlan?.id?.toUpperCase()}-0826</small></div>
              </div>}

              {method === 'momo' && <div className="subscription-wallet-panel">
                <span className="subscription-wallet-logo momo">M</span>
                <div><span className="subscription-detail-kicker">Thanh toán qua MoMo</span><h3>Mở ứng dụng để tiếp tục</h3><p>Sau khi xác nhận, hệ thống sẽ chuyển sang MoMo và tự động trở lại MentalBridge.</p></div>
              </div>}

              {method === 'card' && <div className="subscription-card-form">
                <label><span>Số thẻ</span><input inputMode="numeric" autoComplete="cc-number" placeholder="1234 5678 9012 3456" maxLength={19} /></label>
                <label><span>Tên chủ thẻ</span><input autoComplete="cc-name" placeholder="NGUYEN VAN A" /></label>
                <div><label><span>Ngày hết hạn</span><input inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY" maxLength={5} /></label><label><span>CVV</span><input inputMode="numeric" autoComplete="cc-csc" placeholder="•••" maxLength={4} /></label></div>
                <small>Hỗ trợ Visa, Mastercard, Napas. MentalBridge không lưu thông tin thẻ.</small>
              </div>}

              {method === 'bank' && <div className="subscription-bank-panel">
                <span className="subscription-bank-icon">MB</span>
                <div><span>Ngân hàng</span><strong>MB Bank</strong></div>
                <div><span>Số tài khoản</span><strong>0123 456 789</strong></div>
                <div><span>Nội dung</span><strong>MB {selectedPlan?.id?.toUpperCase()} 0826</strong></div>
                <p>Gói dịch vụ được kích hoạt sau khi hệ thống xác nhận giao dịch.</p>
              </div>}
            </section>
          </div>

          <div className="subscription-modal-actions">
            <button className="btn-ghost" onClick={closeCheckout}>Để sau</button>
            <button className="btn-primary" onClick={pay} disabled={status === 'loading'}>{status === 'loading' ? 'Đang xử lý…' : method === 'payos' ? 'Tôi đã thanh toán' : `Thanh toán ${selectedPlan?.price}`}</button>
          </div>
          <p className="subscription-secure">Giao diện thanh toán đang ở chế độ mô phỏng. Cổng thanh toán thật sẽ xác thực giao dịch trước khi kích hoạt gói.</p>
        </>}
      </div>
    </div>}
  </div>
}
