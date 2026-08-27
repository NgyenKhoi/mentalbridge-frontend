'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import '../login/auth.css'

export default function RegisterPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (formData.password !== formData.confirmPassword) {
        setError('Mật khẩu xác nhận không khớp.')
        return
      }
      // TODO: Thay bằng API call thực khi có backend
      await new Promise(res => setTimeout(res, 800))
      router.push('/dashboard')
    } catch {
      setError('Đăng ký thất bại. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
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
              <svg className="mark" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 26C10 14 30 14 36 26" stroke="#1E4A43" strokeWidth="2.4" strokeLinecap="round"/>
                <circle cx="8" cy="27" r="3" fill="#E1A651"/>
                <circle cx="32" cy="27" r="3" fill="#3D7A6E"/>
              </svg>
              <span>MentalBridge</span>
            </Link>

            {/* Form Header */}
            <div className="auth-header">
              <h1>Bắt đầu hành trình</h1>
              <p>Tạo tài khoản để theo dõi tiến trình của bạn</p>
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
                    Tôi đồng ý với <Link href="/terms" className="terms-link">Điều khoản dịch vụ</Link> và <Link href="/privacy" className="terms-link">Chính sách bảo mật</Link>
                  </span>
                </label>
              </div>

              {error && (
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: 'var(--terracotta-soft)',
                  color: 'var(--terracotta)',
                  fontSize: '14px',
                  border: '1px solid rgba(199,123,92,.3)',
                  marginBottom: '16px'
                }}>
                  {error}
                </div>
              )}

              <button 
                type="submit" 
                className="btn btn-primary auth-submit" 
                disabled={!formData.agreeToTerms || loading}
                style={{ opacity: loading || !formData.agreeToTerms ? 0.6 : 1 }}
              >
                {loading ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
              </button>

              {/* Social Login - Inside Form */}
              <div className="divider">
                <span>hoặc</span>
              </div>

              <button
                type="button"
                onClick={async () => {
                  setLoading(true)
                  setError('')
                  try {
                    // TODO: Thay bằng Google OAuth flow thực tế
                    await new Promise(res => setTimeout(res, 800))
                    router.push('/dashboard')
                  } catch {
                    setError('Đăng ký với Google thất bại. Vui lòng thử lại.')
                  } finally {
                    setLoading(false)
                  }
                }}
                className="btn-google"
                disabled={loading}
              >
                <svg className="google-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Đăng ký với Google
              </button>
            </form>

            {/* Login Link */}
            <div className="auth-switch">
              <p>
                Đã có tài khoản? 
                <Link href="/login" className="switch-link">Đăng nhập</Link>
                <span className="auth-divider-dot">•</span>
                <Link href="/assessment/anonymous" className="switch-link">Dùng thử ẩn danh</Link>
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
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M4 5.5C4 4.7 4.7 4 5.5 4H16l4 4v10.5c0 .8-.7 1.5-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13Z"/>
                  <path d="M8 10h8M8 14h5"/>
                </svg>
                <div>
                  <div className="fc-title">Nhật ký cá nhân</div>
                  <div className="fc-value">Hoàn toàn riêng tư</div>
                </div>
              </div>
            </div>

            <div className="auth-float-card fc-2">
              <div className="float-inner">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M3 17l5-5 4 4 8-9M20 7h-6M20 7v6"/>
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
