import Link from 'next/link'

const COPY = {
  earnings: {
    eyebrow: 'Thu nhập & thanh toán',
    title: 'Khu vực thu nhập chưa khả dụng',
    description:
      'Số dư, giao dịch và lịch sử chi trả sẽ xuất hiện khi nguồn dữ liệu thanh toán dành cho chuyên gia được hoàn tất.',
    note: 'Lịch hẹn và nội dung tiếp nối tư vấn của bạn vẫn hoạt động bình thường.',
    href: '/specialist/appointments',
    action: 'Xem lịch hẹn',
  },
  notifications: {
    eyebrow: 'Thông báo chuyên gia',
    title: 'Trung tâm thông báo chưa khả dụng',
    description:
      'MentalBridge chưa hiển thị số chưa đọc hoặc danh sách thông báo khi trạng thái thông báo chuyên gia chưa có nguồn dữ liệu xác thực.',
    note: 'Bạn vẫn có thể kiểm tra trực tiếp lịch hẹn và tin nhắn trong không gian chuyên gia.',
    href: '/specialist/messages',
    action: 'Mở tin nhắn',
  },
} as const

export type SpecialistDeferredSectionKey = keyof typeof COPY

export default function SpecialistDeferredSection({
  section,
}: {
  section: SpecialistDeferredSectionKey
}) {
  const copy = COPY[section]
  return (
    <section className="specialist-deferred" aria-labelledby="deferred-title">
      <span className="eyebrow">{copy.eyebrow}</span>
      <div className="specialist-deferred-mark" aria-hidden="true">
        ◇
      </div>
      <h1 id="deferred-title">{copy.title}</h1>
      <p>{copy.description}</p>
      <aside>{copy.note}</aside>
      <Link className="btn-primary" href={copy.href}>
        {copy.action}
      </Link>
    </section>
  )
}
