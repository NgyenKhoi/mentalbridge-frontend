import Link from 'next/link'

import PasswordRecovery from '@/features/auth/components/PasswordRecovery'

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
            <PasswordRecovery />
          </div>
        </div>
        <div className="auth-visual-side" aria-hidden="true">
          <div className="auth-visual-container">
            <div className="auth-breathe-stage">
              <div className="orbit orbit-1">
                <span className="orbit-dot amber-dot" />
              </div>
              <div className="orbit orbit-2">
                <span className="orbit-dot teal-dot" />
              </div>
              <div className="breathe-ring r1" />
              <div className="breathe-ring r2" />
              <div className="breathe-blob">
                <span className="breathe-label">An tâm...</span>
              </div>
            </div>
            <div className="auth-quote">
              <blockquote>
                “Liên kết một lần bảo vệ việc thay đổi thông tin đăng nhập của
                bạn.”
              </blockquote>
              <cite>— MentalBridge</cite>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
