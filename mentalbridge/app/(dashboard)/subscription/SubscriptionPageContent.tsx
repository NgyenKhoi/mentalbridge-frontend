import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Headphones,
  HeartHandshake,
  Leaf,
  ListChecks,
  ShieldCheck,
  TrendingUp,
  Video,
} from 'lucide-react'

import ServiceCreditsPanel from '@/features/service-credits/components/ServiceCreditsPanel'

import './subscription-redesign.css'

const plans = [
  {
    id: 'FREE',
    eyebrow: 'CƠ BẢN',
    name: 'Gói Miễn Phí',
    note: 'Bắt đầu ngay',
    description: 'Dành cho người mới bắt đầu làm quen với chăm sóc sức khỏe tinh thần và tự sàng lọc.',
    price: '0đ',
    action: 'Gói mặc định',
  },
  {
    id: 'PLUS',
    eyebrow: 'ĐỒNG HÀNH',
    name: 'Gói Plus',
    note: 'Đề xuất cao',
    description: 'Đồng hành định kỳ, có sự tham vấn chuyên môn chuyên sâu từ chuyên gia tâm lý học.',
    price: '490.000đ',
    action: 'Nâng cấp gói Plus',
  },
  {
    id: 'PREMIUM',
    eyebrow: 'TOÀN DIỆN',
    name: 'Gói Premium',
    note: 'Chuyên sâu',
    description: 'Lộ trình hỗ trợ chuyên sâu toàn diện, theo sát từng bước tiến trên cảm xúc.',
    price: '1.250.000đ',
    action: 'Đăng ký Premium',
  },
] as const

const benefits = [
  {
    Icon: ListChecks,
    name: 'Bộ test sàng lọc tâm lý (PHQ-9, GAD-7, DASS-21)',
    description: 'Đánh giá trầm cảm, âu lo và mức độ căng thẳng tiêu chuẩn quốc tế',
    values: ['check', 'check', 'check'],
  },
  {
    Icon: BookOpen,
    name: 'Kho bài tập tự rèn luyện & video hướng dẫn',
    description: 'Hơn 120 bài thở, thiền tĩnh tâm và nhật ký phản chiếu cảm xúc hằng ngày',
    values: ['check', 'check', 'check'],
  },
  {
    Icon: Video,
    name: 'Buổi tư vấn trực tuyến 1:1 với Chuyên gia tâm lý',
    description: 'Thời lượng 50 phút/buổi, bảo mật riêng tư qua kết nối mã hóa',
    values: ['0 lượt', '1 lượt / kỳ', '3 lượt / kỳ'],
  },
  {
    Icon: CalendarDays,
    name: 'Kế hoạch hỗ trợ cá nhân hóa',
    description: 'Xây dựng lộ trình cải thiện dựa trên dữ liệu đánh giá',
    values: ['—', 'check', 'check'],
  },
  {
    Icon: Clock3,
    name: 'Hỗ trợ đặt lịch hẹn khung giờ vàng (19:00 - 22:00)',
    description: 'Khung giờ cao điểm buổi tối và cuối tuần',
    values: ['—', 'Ưu tiên', 'Ưu tiên hàng đầu'],
  },
  {
    Icon: TrendingUp,
    name: 'Báo cáo đánh giá tiến trình gửi riêng định kỳ',
    description: 'Biểu đồ hồi phục, nhận diện trigger cảm xúc và lời khuyên tiếp theo',
    values: ['—', '—', 'check'],
  },
] as const

export default function SubscriptionPageContent() {
  return (
    <div className="subscription-page svc-page">
      <ServiceCreditsPanel />

      <header className="svc-intro">
        <span className="svc-kicker"><ShieldCheck size={14} aria-hidden="true" /> MINH BẠCH &amp; TIN CẬY</span>
        <h1>GÓI DỊCH VỤ &amp; QUYỀN LỢI TƯ VẤN</h1>
        <p>Minh bạch mọi quyền lợi, dễ dàng quản lý lượt tư vấn và chủ động lựa chọn gói đồng hành chăm sóc sức khỏe tâm thần dài hạn.</p>
      </header>

      <section id="subscription-plans" className="svc-comparison" aria-label="So sánh gói dịch vụ">
        <div className="svc-tiers">
          {plans.map((plan) => (
            <article key={plan.id} className={`svc-tier svc-tier-${plan.id.toLowerCase()}`}>
              {plan.id === 'PLUS' && <span className="svc-popular">PHỔ BIẾN NHẤT</span>}
              <div className="svc-tier-top"><span>{plan.eyebrow}</span><small>{plan.note}</small></div>
              <h2>{plan.name}</h2>
              <p>{plan.description}</p>
              <div className="svc-tier-price"><strong>{plan.price}</strong><span>{plan.id === 'FREE' ? '/ trọn đời' : '/ tháng'}</span></div>
              <button type="button" disabled title="Thanh toán chưa mở" aria-label={`${plan.action} — thanh toán chưa mở`}>
                {plan.action}
              </button>
            </article>
          ))}
        </div>

        <div className="svc-table-scroll">
          <table className="svc-benefits">
            <thead>
              <tr>
                <th scope="col">Tính năng &amp; Quyền lợi</th>
                <th scope="col">Gói Miễn Phí</th>
                <th scope="col">Gói Plus</th>
                <th scope="col">Gói Premium</th>
              </tr>
            </thead>
            <tbody>
              {benefits.map(({ Icon, name, description, values }) => (
                <tr key={name}>
                  <th scope="row"><Icon size={17} aria-hidden="true" /><span><strong>{name}</strong><small>{description}</small></span></th>
                  {values.map((value, index) => (
                    <td key={`${name}-${index}`}>
                      {value === 'check'
                        ? <CheckCircle2 size={19} aria-label="Có" />
                        : <span aria-label={value === '—' ? 'Không bao gồm' : undefined}>{value}</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="svc-price-note">Giá và quyền lợi hiển thị theo mẫu giao diện tham khảo. Thanh toán trực tuyến chưa mở.</p>
      </section>

      <section className="svc-assurance" aria-labelledby="svc-assurance-title">
        <div className="svc-assurance-copy">
          <span className="svc-kicker"><ShieldCheck size={14} aria-hidden="true" /> BẢO MẬT &amp; ĐẠO ĐỨC CHUYÊN NGHIỆP</span>
          <h2 id="svc-assurance-title">Quyền lợi minh bạch, hoàn toàn không phụ phí ngầm</h2>
          <p>Mỗi lượt tư vấn tại MentalBridge đều được ghi nhận rõ trong kỳ dịch vụ. Bạn có thể theo dõi lượt còn lại, lượt đang giữ lịch và lịch sử sử dụng ngay trên trang này.</p>
          <div className="svc-assurance-points">
            <div><CalendarDays size={18} aria-hidden="true" /><strong>Kỳ dịch vụ rõ ràng</strong><span>Ngày bắt đầu, kết thúc và số lượt tư vấn được trình bày trong tài khoản.</span></div>
            <div><Headphones size={18} aria-hidden="true" /><strong>Chủ động theo dõi</strong><span>Kiểm tra lịch sử thay đổi và trạng thái từng lượt tư vấn bất cứ lúc nào.</span></div>
          </div>
        </div>
        <div className="svc-preview" aria-hidden="true">
          <div className="svc-preview-sidebar"><span /><span /><span /><span /><span /><span /></div>
          <div className="svc-preview-main">
            <div className="svc-preview-top"><span /><i /><i /></div>
            <div className="svc-preview-title">Quyền lợi tư vấn minh bạch</div>
            <div className="svc-preview-summary"><span /><span /><span /><span /></div>
            <div className="svc-preview-line" />
            <div className="svc-preview-cards"><span /><span /><span /></div>
            <div className="svc-preview-table"><span /><span /><span /><span /></div>
          </div>
          <div className="svc-preview-caption">Thông tin quyền lợi của bạn luôn rõ ràng</div>
        </div>
      </section>

      <section className="svc-commitment" aria-label="Thông tin hỗ trợ và chính sách">
        <span className="svc-commitment-icon"><HeartHandshake size={23} aria-hidden="true" /></span>
        <div><h2>Cam kết đạo đức và hỗ trợ khi bạn cần</h2><p>Các gói dịch vụ hỗ trợ sức khỏe tinh thần được thiết kế với tiêu chuẩn bảo mật. Quyền lợi và trạng thái lượt tư vấn luôn hiển thị rõ trong tài khoản.</p></div>
        <a href="#subscription-plans" className="svc-round-link svc-round-primary"><Leaf size={16} aria-hidden="true" /> Xem các gói</a>
        <a href="#subscription-policy" className="svc-round-link"><ArrowUpRight size={16} aria-hidden="true" /> Chính sách gói</a>
      </section>

      <details id="subscription-policy" className="svc-policy">
        <summary>Chính sách hiện tại</summary>
        <p>Trong cùng kỳ, nâng cấp Plus lên Premium chỉ cấp thêm phần chênh lệch để tổng số lượt tư vấn trong kỳ là ba. Hiện chưa hỗ trợ hạ gói hoặc hoàn tiền trong kỳ.</p>
      </details>
    </div>
  )
}
