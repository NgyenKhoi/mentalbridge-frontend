import Link from 'next/link'

import '../login/auth.css'

export default function ResetPasswordPage() {
  return (
    <div className="auth-layout">
      <div className="auth-container">
        <div className="auth-form-side">
          <div className="auth-form-container">
            <Link href="/" className="auth-logo">
              <svg
                className="mark"
                viewBox="0 0 40 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M4 26C10 14 30 14 36 26"
                  stroke="#1E4A43"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
                <circle cx="8" cy="27" r="3" fill="#E1A651" />
                <circle cx="32" cy="27" r="3" fill="#3D7A6E" />
              </svg>
              <span>MentalBridge</span>
            </Link>

            <div className="auth-header">
              <h1>Khôi phục mật khẩu chưa khả dụng</h1>
              <p>
                Identity service chưa cung cấp hợp đồng khôi phục mật khẩu. Vì
                vậy MentalBridge chưa thể gửi mã hoặc thay đổi mật khẩu an toàn
                tại thời điểm này.
              </p>
            </div>

            <div className="auth-error" role="status">
              Vui lòng không nhập thông tin tài khoản trên bất kỳ biểu mẫu khôi
              phục nào cho đến khi tính năng chính thức được công bố.
            </div>

            <Link href="/login" className="btn btn-primary auth-submit">
              Về trang đăng nhập
            </Link>

            <div className="auth-switch">
              <p>
                Cần tiếp tục sử dụng MentalBridge?
                <Link href="/" className="switch-link">
                  Về trang chủ
                </Link>
              </p>
            </div>
          </div>
        </div>

        <div className="auth-visual-side">
          <div className="auth-visual-container">
            <div className="auth-breathe-stage">
              <div className="orbit orbit-1" aria-hidden="true">
                <span className="orbit-dot amber-dot" />
              </div>
              <div className="orbit orbit-2" aria-hidden="true">
                <span className="orbit-dot teal-dot" />
              </div>
              <div className="breathe-ring r1" />
              <div className="breathe-ring r2" />
              <div className="breathe-blob">
                <span className="breathe-label">An tâm...</span>
              </div>
            </div>

            <div className="auth-float-card fc-1">
              <div className="float-inner">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
                <div>
                  <div className="fc-title">Bảo vệ tài khoản</div>
                  <div className="fc-value">
                    Không mô phỏng luồng chưa hỗ trợ
                  </div>
                </div>
              </div>
            </div>

            <div className="auth-float-card fc-2">
              <div className="float-inner">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M12 8v4l3 2" />
                  <circle cx="12" cy="12" r="9" />
                </svg>
                <div>
                  <div className="fc-title">Trạng thái minh bạch</div>
                  <div className="fc-value">
                    Chỉ hiển thị khả năng đã có hợp đồng
                  </div>
                </div>
              </div>
            </div>

            <div className="auth-quote">
              <blockquote>
                &ldquo;An toàn bắt đầu từ việc nói rõ điều hệ thống chưa thể
                làm.&rdquo;
              </blockquote>
              <cite>— MentalBridge</cite>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
