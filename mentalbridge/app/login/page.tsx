'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import './auth.css'

export default function LoginPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'user'
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // TODO: thay bằng API call thực khi có backend
      // Tạm thời mock: bất kỳ email/password đều vào được dashboard
      if (!formData.email || !formData.password) {
        setError('Vui lòng nhập đầy đủ email và mật khẩu.')
        return
      }
      // Giả lập delay API
      await new Promise(res => setTimeout(res, 600))
      const destinations = { user: '/dashboard', specialist: '/specialist/dashboard', admin: '/admin/dashboard' }
      router.push(destinations[formData.role as keyof typeof destinations])
    } catch {
      setError('Đăng nhập thất bại. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
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
              <h1>Chào mừng trở lại</h1>
              <p>Đăng nhập vào tài khoản của bạn để tiếp tục hành trình chăm sóc sức khỏe tâm thần</p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label htmlFor="role" className="form-label">Vai trò truy cập</label>
                <select id="role" name="role" value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})} className="form-input">
                  <option value="user">Người dùng</option>
                  <option value="specialist">Chuyên gia</option>
                  <option value="admin">Quản trị viên</option>
                </select>
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
                  placeholder="Nhập mật khẩu"
                  required
                />
              </div>

              <div className="form-actions">
                <Link href="/reset-password" className="forgot-link">
                  Quên mật khẩu?
                </Link>
              </div>

              {error && (
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: '#fff0f0',
                  color: '#c0392b',
                  fontSize: '14px',
                  border: '1px solid #fcc'
                }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary auth-submit"
                disabled={loading}
                style={{ opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
              >
                {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </button>
            </form>

            {/* Anonymous Assessment CTA */}
            <div className="anonymous-cta">
              <div className="divider">
                <span>hoặc</span>
              </div>
              <Link href="/assessment/anonymous" className="btn btn-outline anonymous-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M9 11l2 2 4-4M20 7v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7l4-4h8l4 4Z"/>
                </svg>
                Tiếp tục ẩn danh với bài đánh giá
              </Link>
              <p className="anonymous-note">
                Làm bài đánh giá sức khỏe tâm thần không cần đăng ký
              </p>
            </div>

            {/* Register Link */}
            <div className="auth-switch">
              <p>
                Chưa có tài khoản? 
                <Link href="/register" className="switch-link">Đăng ký ngay</Link>
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
                <span className="breathe-label">Hít vào...</span>
              </div>
            </div>

            {/* Float Cards */}
            <div className="auth-float-card fc-1">
              <div className="float-inner">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M12 3c3 3 5 6 5 9a5 5 0 0 1-10 0c0-3 2-6 5-9Z"/>
                </svg>
                <div>
                  <div className="fc-title">An toàn & bảo mật</div>
                  <div className="fc-value">100% riêng tư</div>
                </div>
              </div>
            </div>

            <div className="auth-float-card fc-2">
              <div className="float-inner">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M20 21c0-4-3.6-6-8-6s-8 2-8 6M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/>
                </svg>
                <div>
                  <div className="fc-title">Chuyên gia</div>
                  <div className="fc-value">Luôn đồng hành</div>
                </div>
              </div>
            </div>

            {/* Quote */}
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
