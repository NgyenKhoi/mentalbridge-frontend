import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="marketing-footer">
      <div className="wrap">
        <div className="footer-top">
          <div>
            <div className="footer-logo">
              <svg
                className="mark"
                viewBox="0 0 40 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4 26C10 14 30 14 36 26"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
                <circle cx="8" cy="27" r="3" fill="currentColor" />
                <circle
                  cx="32"
                  cy="27"
                  r="3"
                  fill="currentColor"
                  opacity=".55"
                />
              </svg>
              MentalBridge
            </div>
            <p>
              Cây cầu giúp bạn tiếp cận công cụ sàng lọc và tài nguyên hỗ trợ
              một cách nhẹ nhàng, kín đáo.
            </p>
          </div>
          <div className="footer-col">
            <h4>Sản phẩm</h4>
            <ul>
              <li>
                <Link href="/assessments">Sàng lọc PHQ-9</Link>
              </li>
              <li>
                <Link href="/journal">Nhật ký cảm xúc</Link>
              </li>
              <li>
                <Link href="/specialists">Kết nối chuyên gia</Link>
              </li>
              <li>
                <Link href="/resources">Tài nguyên tự chăm sóc</Link>
              </li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Về chúng tôi</h4>
            <ul>
              <li>
                <Link href="/#journey">Câu chuyện</Link>
              </li>
              <li>
                <Link href="/specialists">Đội ngũ chuyên gia</Link>
              </li>
              <li>
                <Link href="/privacy">Bảo mật & riêng tư</Link>
              </li>
              <li>
                <Link href="/resources">Tài nguyên hỗ trợ</Link>
              </li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Thông tin quan trọng</h4>
            <ul>
              <li>
                <Link href="/terms">Phạm vi dịch vụ</Link>
              </li>
              <li>
                <Link href="/privacy">Quyền riêng tư</Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © 2026 MentalBridge. Đây là công cụ sàng lọc, không thay thế chẩn
            đoán y khoa.
          </span>
          <span>Thiết kế với sự thấu cảm.</span>
        </div>
      </div>
    </footer>
  )
}
