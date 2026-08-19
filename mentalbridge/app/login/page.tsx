import Link from 'next/link'

import LoginForm from '@/features/auth/components/LoginForm'

import './auth.css'

export default function LoginPage() {
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
              <h1>Chào mừng trở lại</h1>
              <p>
                Đăng nhập để tiếp tục hành trình chăm sóc sức khỏe tinh thần của
                bạn.
              </p>
            </div>

            <LoginForm />

            <div className="anonymous-cta">
              <div className="divider">
                <span>hoặc</span>
              </div>
              <Link
                href="/assessment/anonymous"
                className="btn btn-outline anonymous-btn"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M9 11l2 2 4-4M20 7v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7l4-4h8l4 4Z" />
                </svg>
                Tiếp tục ẩn danh với bài đánh giá
              </Link>
              <p className="anonymous-note">
                Làm bài đánh giá sức khỏe tinh thần không cần đăng ký.
              </p>
            </div>

            <div className="auth-switch">
              <p>
                Chưa có tài khoản?
                <Link href="/register" className="switch-link">
                  Đăng ký ngay
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
                <span className="breathe-label">Hít vào...</span>
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
                  <path d="M9 11l2 2 4-4M20 7v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7l4-4h8l4 4Z" />
                </svg>
                <div>
                  <div className="fc-title">An toàn và bảo mật</div>
                  <div className="fc-value">Phiên đăng nhập riêng tư</div>
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
                  <path d="M20 21c0-4-3.6-6-8-6s-8 2-8 6M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
                </svg>
                <div>
                  <div className="fc-title">Không gian phù hợp</div>
                  <div className="fc-value">Theo quyền tài khoản</div>
                </div>
              </div>
            </div>

            <div className="auth-quote">
              <blockquote>
                “Bước đầu tiên không cần phải lớn, chỉ cần bạn dám bắt đầu.”
              </blockquote>
              <cite>— MentalBridge</cite>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
