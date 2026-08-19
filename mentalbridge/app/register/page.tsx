'use client'

import { useState } from 'react'
import Link from 'next/link'
import '../login/auth.css'

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    })
  }

  return (
    <div className="auth-layout">
      <div className="auth-container">
        {/* Left side - Form */}
        <div className="auth-form-side">
          <div className="auth-form-container">
            {/* Logo */}
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

            {/* Form Header */}
            <div className="auth-header">
              <h1>Bắt đầu hành trình</h1>
              <p>
                Tạo tài khoản để lưu trữ và theo dõi tiến trình chăm sóc sức
                khỏe tâm thần của bạn
              </p>
            </div>

            {/* Register Form */}
            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label htmlFor="fullName" className="form-label">
                  Họ và tên
                </label>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="Nguyen Van A"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="email" className="form-label">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="your@email.com"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="password" className="form-label">
                  Mật khẩu
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="Tối thiểu 8 ký tự"
                  required
                  minLength={8}
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword" className="form-label">
                  Xác nhận mật khẩu
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="Nhập lại mật khẩu"
                  required
                />
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="agreeToTerms"
                    checked={formData.agreeToTerms}
                    onChange={handleChange}
                    className="checkbox-input"
                    required
                  />
                  <span className="checkbox-custom"></span>
                  <span className="checkbox-text">
                    Tôi đồng ý với{' '}
                    <Link href="/terms" className="terms-link">
                      Điều khoản dịch vụ
                    </Link>{' '}
                    và{' '}
                    <Link href="/privacy" className="terms-link">
                      Chính sách bảo mật
                    </Link>
                  </span>
                </label>
              </div>

              <button
                type="submit"
                className="btn btn-primary auth-submit"
                disabled={!formData.agreeToTerms}
              >
                Tạo tài khoản
              </button>
            </form>

            {/* Anonymous Assessment CTA */}
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
                >
                  <path d="M9 11l2 2 4-4M20 7v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7l4-4h8l4 4Z" />
                </svg>
                Thử bài đánh giá ẩn danh trước
              </Link>
              <p className="anonymous-note">
                Làm bài đánh giá sức khỏe tâm thần không cần tạo tài khoản
              </p>
            </div>

            {/* Login Link */}
            <div className="auth-switch">
              <p>
                Đã có tài khoản?
                <Link href="/login" className="switch-link">
                  Đăng nhập ngay
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* Right side - Visual */}
        <div className="auth-visual-side">
          <div className="auth-visual-container">
            {/* Breathing Circle (smaller version of hero) */}
            <div className="auth-breathe-stage">
              <div className="orbit orbit-1" aria-hidden="true">
                <span className="orbit-dot amber-dot"></span>
              </div>
              <div className="orbit orbit-2" aria-hidden="true">
                <span className="orbit-dot teal-dot"></span>
              </div>
              <div className="breathe-ring r1"></div>
              <div className="breathe-ring r2"></div>
              <div className="breathe-blob">
                <span className="breathe-label">Thở ra...</span>
              </div>
            </div>

            {/* Float Cards */}
            <div className="auth-float-card fc-1">
              <div className="float-inner">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                >
                  <path d="M4 5.5C4 4.7 4.7 4 5.5 4H16l4 4v10.5c0 .8-.7 1.5-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13Z" />
                  <path d="M8 10h8M8 14h5" />
                </svg>
                <div>
                  <div className="fc-title">Nhật ký cá nhân</div>
                  <div className="fc-value">Hoàn toàn riêng tư</div>
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
                >
                  <path d="M3 17l5-5 4 4 8-9M20 7h-6M20 7v6" />
                </svg>
                <div>
                  <div className="fc-title">Theo dõi tiến độ</div>
                  <div className="fc-value">Lâu dài & chi tiết</div>
                </div>
              </div>
            </div>

            {/* Quote */}
            <div className="auth-quote">
              <blockquote>
                &ldquo;Hành trình ngàn dặm bắt đầu từ một bước chân.&rdquo;
              </blockquote>
              <cite>— Câu châm ngôn cổ</cite>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
