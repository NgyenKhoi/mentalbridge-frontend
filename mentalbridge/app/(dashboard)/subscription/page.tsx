'use client'

import { useState } from 'react'

const plans = [
  { id: 'free', name: 'Miễn phí', price: '0đ', per: '/mãi mãi', description: 'Dùng thử các công cụ cơ bản', badge: 'Đang dùng', features: ['Bài sàng lọc PHQ-9 & GAD-7','Nhật ký cảm xúc cơ bản','Tài nguyên tự chăm sóc giới hạn','Hỗ trợ qua email'] },
  { id: 'plus', name: 'Plus', price: '199.000đ', per: '/tháng', description: 'Cho hành trình chăm sóc đều đặn', badge: 'Phổ biến nhất', featured: true, features: ['Tất cả tính năng Miễn phí','Không giới hạn bài đánh giá','Phân tích xu hướng chi tiết','Chat AI hỗ trợ 24/7','Tài nguyên tự chăm sóc đầy đủ','1 consultation credit/tháng'] },
  { id: 'premium', name: 'Premium', price: '499.000đ', per: '/tháng', description: 'Đồng hành sát sao cùng chuyên gia', badge: 'Toàn diện nhất', premium: true, features: ['Tất cả tính năng Plus','Đặt lịch ưu tiên','Chuyên gia ưu tiên','Tư vấn nhóm miễn phí','Tài liệu chuyên sâu','Hỗ trợ qua điện thoại'] },
]

const faqs = [
  ['Tôi có thể hủy đăng ký bất cứ lúc nào không?','Có. Bạn vẫn sử dụng tính năng đã thanh toán đến hết chu kỳ hiện tại. Việc hủy luôn yêu cầu xác nhận rõ ràng.'],
  ['Thanh toán có an toàn không?','Thanh toán được xử lý qua MoMo hoặc PayOS. MentalBridge không lưu trực tiếp thông tin thẻ hoặc thông tin đăng nhập ví của bạn.'],
  ['Có thể chuyển đổi giữa các gói không?','Bạn có thể nâng cấp hoặc hạ cấp. Hệ thống sẽ hiển thị khoản phí và thời điểm hiệu lực trước khi xác nhận.'],
]

export default function SubscriptionPage() {
  const [compare, setCompare] = useState(false)
  const [faq, setFaq] = useState(0)
  const [checkout, setCheckout] = useState<string | null>(null)
  const [method, setMethod] = useState('momo')
  const [status, setStatus] = useState<'idle'|'loading'|'success'>('idle')
  const selectedPlan = plans.find(plan => plan.id === checkout)

  const pay = async () => { setStatus('loading'); await new Promise(resolve => setTimeout(resolve, 850)); setStatus('success') }
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
    <div className={`subscription-compare ${compare ? 'open' : ''}`}><div><table><thead><tr><th>Tính năng</th><th>Miễn phí</th><th>Plus</th><th>Premium</th></tr></thead><tbody><tr><td>PHQ-9 & GAD-7</td><td>✓</td><td>✓</td><td>✓</td></tr><tr><td>Nhật ký cảm xúc</td><td>Cơ bản</td><td>Đầy đủ</td><td>Đầy đủ</td></tr><tr><td>Phân tích xu hướng</td><td>Giới hạn</td><td>Chi tiết</td><td>Chi tiết</td></tr><tr><td>Chat AI hỗ trợ</td><td>—</td><td>24/7</td><td>24/7</td></tr><tr><td>Consultation credit</td><td>—</td><td>1/tháng</td><td>Ưu tiên</td></tr><tr><td>Hỗ trợ</td><td>Email</td><td>Email + Chat</td><td>Điện thoại</td></tr></tbody></table></div></div>

    <section className="subscription-faq"><h2>Câu hỏi thường gặp</h2>{faqs.map(([question,answer],index) => <article className={faq === index ? 'open' : ''} key={question}><button onClick={() => setFaq(faq === index ? -1 : index)} aria-expanded={faq === index}>{question}<span>+</span></button><div><p>{answer}</p></div></article>)}</section>

    {checkout && <div className="subscription-modal-wrap"><button className="subscription-backdrop" onClick={closeCheckout} aria-label="Đóng thanh toán"/><div className="subscription-modal">{status === 'success' ? <div className="subscription-success"><span>✓</span><h2>Thanh toán thành công</h2><p>Gói {selectedPlan?.name} đã được kích hoạt. Credit và quyền lợi mới sẽ xuất hiện ngay.</p><button className="btn-primary" onClick={closeCheckout}>Hoàn tất</button></div> : <><div className="subscription-modal-head"><div><small>Xác nhận nâng cấp</small><h2>Gói {selectedPlan?.name}</h2></div><button onClick={closeCheckout}>×</button></div><div className="subscription-order"><span>Thanh toán hàng tháng</span><strong>{selectedPlan?.price}</strong></div><p className="subscription-method-label">Phương thức thanh toán</p><label className={method === 'momo' ? 'selected' : ''}><input type="radio" name="payment" value="momo" checked={method === 'momo'} onChange={e => setMethod(e.target.value)} /><span className="momo">M</span><div><strong>Ví MoMo</strong><small>Thanh toán qua ứng dụng MoMo</small></div></label><label className={method === 'payos' ? 'selected' : ''}><input type="radio" name="payment" value="payos" checked={method === 'payos'} onChange={e => setMethod(e.target.value)} /><span className="payos">P</span><div><strong>PayOS</strong><small>Chuyển khoản ngân hàng hoặc QR</small></div></label><div className="subscription-modal-actions"><button className="btn-ghost" onClick={closeCheckout}>Để sau</button><button className="btn-primary" onClick={pay} disabled={status === 'loading'}>{status === 'loading' ? 'Đang xử lý…' : `Thanh toán ${selectedPlan?.price}`}</button></div><p className="subscription-secure">Bạn sẽ xem lại đầy đủ thông tin trước khi giao dịch thực được gửi tới cổng thanh toán.</p></>}</div></div>}
  </div>
}
