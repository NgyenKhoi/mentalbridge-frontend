'use client'

import Link from 'next/link'
import { useState } from 'react'
import '../login/auth.css'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    await new Promise(resolve => setTimeout(resolve, 700))
    setLoading(false)
    setSent(true)
  }

  return <div className="auth-layout"><div className="auth-container">
    <div className="auth-form-side"><div className="auth-form-container">
      <Link href="/" className="auth-logo"><svg className="mark" viewBox="0 0 40 40" fill="none"><path d="M4 26C10 14 30 14 36 26" stroke="#1E4A43" strokeWidth="2.4" strokeLinecap="round"/><circle cx="8" cy="27" r="3" fill="#E1A651"/><circle cx="32" cy="27" r="3" fill="#3D7A6E"/></svg>MentalBridge</Link>
      {!sent ? <><div className="auth-header"><h1>Khôi phục mật khẩu</h1><p>Nhập email tài khoản. Chúng tôi sẽ gửi liên kết đặt lại mật khẩu an toàn.</p></div><form className="auth-form" onSubmit={submit}><div className="form-group"><label className="form-label" htmlFor="reset-email">Email</label><input className="form-input" id="reset-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required /></div><button className="btn btn-primary auth-submit" disabled={loading}>{loading ? 'Đang gửi liên kết…' : 'Gửi liên kết khôi phục'}</button></form></> : <div className="auth-header"><div className="reset-success">✓</div><h1>Kiểm tra email của bạn</h1><p>Nếu <strong>{email}</strong> tồn tại trong hệ thống, bạn sẽ nhận được liên kết khôi phục. Liên kết có hiệu lực trong 15 phút.</p></div>}
      <div className="auth-switch"><p><Link href="/login" className="switch-link">← Quay lại đăng nhập</Link></p></div>
    </div></div>
    <div className="auth-visual-side"><div className="auth-visual-container"><div className="auth-breathe-stage"><div className="orbit orbit-1"><span className="orbit-dot amber-dot" /></div><div className="orbit orbit-2"><span className="orbit-dot teal-dot" /></div><div className="breathe-ring r1"/><div className="breathe-ring r2"/><div className="breathe-blob"><span className="breathe-label">An tâm…</span></div></div><div className="auth-quote"><blockquote>“Bạn luôn có thể bắt đầu lại, thật nhẹ nhàng.”</blockquote><cite>— MentalBridge</cite></div></div></div>
  </div></div>
}
