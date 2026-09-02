import Link from 'next/link'

export default function PolicyPage({ type }: { type: 'terms' | 'privacy' }) {
  const privacy = type === 'privacy'
  return (
    <main className="policy-page">
      <div className="policy-wrap">
        <Link href="/" className="policy-back">
          ← Về MentalBridge
        </Link>
        <div className="eyebrow">Minh bạch và an toàn</div>
        <h1>{privacy ? 'Chính sách bảo mật' : 'Điều khoản dịch vụ'}</h1>
        <p className="policy-lead">
          Cập nhật ngày 14/08/2026 · Chúng tôi trình bày thông tin bằng ngôn ngữ
          rõ ràng để bạn luôn hiểu dữ liệu và quyền của mình.
        </p>
        {(privacy
          ? [
              [
                'Dữ liệu chúng tôi xử lý',
                'Thông tin tài khoản, lịch hẹn và dữ liệu sức khỏe tinh thần chỉ được xử lý để cung cấp những tính năng bạn chủ động sử dụng.',
              ],
              [
                'Quyền đồng ý và chia sẻ',
                'Bạn kiểm soát specialist nào được truy cập loại dữ liệu nào. Quyền này có thể được thu hồi bất kỳ lúc nào trong Profile & Privacy.',
              ],
              [
                'Lưu giữ và xóa dữ liệu',
                'Bạn có thể yêu cầu xuất hoặc xóa dữ liệu. Một số bản ghi giao dịch có thể được lưu theo nghĩa vụ pháp lý hiện hành.',
              ],
              [
                'AI và dữ liệu nhạy cảm',
                'Kết quả AI chỉ hỗ trợ theo dõi và không thay thế chẩn đoán chuyên môn. Dữ liệu không được bán cho bên quảng cáo.',
              ],
            ]
          : [
              [
                'Phạm vi dịch vụ',
                'MentalBridge cung cấp công cụ sàng lọc, nhật ký, tài nguyên tự chăm sóc và kết nối chuyên gia. Nền tảng không phải dịch vụ cấp cứu.',
              ],
              [
                'Tài khoản và trách nhiệm',
                'Bạn chịu trách nhiệm bảo mật thông tin đăng nhập và cung cấp thông tin chính xác khi đặt lịch hoặc thanh toán.',
              ],
              [
                'Lịch hẹn và thanh toán',
                'Điều kiện hủy, đổi lịch và hoàn consultation credit được hiển thị trước khi xác nhận đặt lịch.',
              ],
              [
                'Giới hạn chuyên môn',
                'Assessment và phân tích AI là thông tin hỗ trợ, không phải chẩn đoán hoặc chỉ định điều trị.',
              ],
            ]
        ).map(([title, copy]) => (
          <section key={title}>
            <h2>{title}</h2>
            <p>{copy}</p>
          </section>
        ))}
        <div className="policy-contact">
          <strong>Cần thêm thông tin?</strong>
          <p>
            Xem các tài nguyên đã được công bố trong khu vực hỗ trợ của
            MentalBridge.
          </p>
          <Link href="/resources" className="btn btn-primary">
            Xem tài nguyên
          </Link>
        </div>
      </div>
    </main>
  )
}
