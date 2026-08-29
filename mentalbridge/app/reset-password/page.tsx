'use client'

import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import '../login/auth.css'

type Step = 'email' | 'code' | 'password'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  
  const codeInputs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  async function handleSendCode(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)
    
    try {
      // TODO: Gọi API gửi mã OTP
      await new Promise(resolve => setTimeout(resolve, 800))
      setStep('code')
      setCountdown(60)
      setTimeout(() => codeInputs.current[0]?.focus(), 100)
    } catch {
      setError('Không thể gửi mã. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResendCode() {
    if (countdown > 0) return
    setError('')
    setLoading(true)
    
    try {
      // TODO: Gọi API gửi lại mã OTP
      await new Promise(resolve => setTimeout(resolve, 800))
      setCode(['', '', '', '', '', ''])
      setCountdown(60)
      setTimeout(() => codeInputs.current[0]?.focus(), 100)
    } catch {
      setError('Không thể gửi lại mã. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  function handleCodeChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return
    
    const newCode = [...code]
    newCode[index] = value.slice(-1)
    setCode(newCode)
    
    if (value && index < 5) {
      codeInputs.current[index + 1]?.focus()
    }
    
    // Auto verify when all filled
    if (newCode.every(digit => digit) && index === 5) {
      handleVerifyCode(newCode)
    }
  }

  function handleCodeKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      codeInputs.current[index - 1]?.focus()
    }
  }

  function handleCodePaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const newCode = pastedData.split('').concat(Array(6).fill('')).slice(0, 6)
    setCode(newCode)
    
    if (pastedData.length === 6) {
      codeInputs.current[5]?.focus()
      handleVerifyCode(newCode)
    } else if (pastedData.length > 0) {
      codeInputs.current[pastedData.length - 1]?.focus()
    }
  }

  async function handleVerifyCode(codeArray = code) {
    const codeString = codeArray.join('')
    if (codeString.length !== 6) return
    
    setError('')
    setLoading(true)
    
    try {
      // TODO: Gọi API verify mã OTP
      await new Promise(resolve => setTimeout(resolve, 800))
      
      // Mock: check if code is correct (for demo purposes, accept 123456)
      if (codeString !== '123456') {
        setError('Mã xác nhận không đúng. Vui lòng thử lại.')
        setCode(['', '', '', '', '', ''])
        setTimeout(() => codeInputs.current[0]?.focus(), 100)
        return
      }
      
      setStep('password')
    } catch {
      setError('Xác thực thất bại. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResetPassword(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    
    if (newPassword.length < 8) {
      setError('Mật khẩu phải có ít nhất 8 ký tự')
      return
    }
    
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      setError('Mật khẩu phải chứa chữ hoa, chữ thường và số')
      return
    }
    
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp')
      return
    }
    
    setLoading(true)
    
    try {
      // TODO: Gọi API đặt lại mật khẩu
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Redirect to login with success message
      router.push('/login?reset=success')
    } catch {
      setError('Không thể đặt lại mật khẩu. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-layout">
      <div className="auth-container">
        <div className="auth-form-side">
          <div className="auth-form-container">
            <Link href="/" className="auth-logo">
              <svg className="mark" viewBox="0 0 40 40" fill="none">
                <path d="M4 26C10 14 30 14 36 26" stroke="#1E4A43" strokeWidth="2.4" strokeLinecap="round"/>
                <circle cx="8" cy="27" r="3" fill="#E1A651"/>
                <circle cx="32" cy="27" r="3" fill="#3D7A6E"/>
              </svg>
              <span>MentalBridge</span>
            </Link>
            
            {/* Step 1: Enter Email */}
            {step === 'email' && (
              <>
                <div className="auth-header">
                  <h1>Khôi phục mật khẩu</h1>
                  <p>Nhập email tài khoản của bạn. Chúng tôi sẽ gửi mã xác nhận để đặt lại mật khẩu.</p>
                </div>
                <form className="auth-form" onSubmit={handleSendCode}>
                  {error && <div className="auth-error">{error}</div>}
                  <div className="form-group">
                    <label className="form-label" htmlFor="reset-email">Email</label>
                    <input 
                      className="form-input" 
                      id="reset-email" 
                      type="email" 
                      value={email} 
                      onChange={e => setEmail(e.target.value)} 
                      placeholder="your@email.com" 
                      required 
                      disabled={loading}
                    />
                  </div>
                  <button className="btn btn-primary auth-submit" disabled={loading}>
                    {loading ? 'Đang gửi mã...' : 'Gửi mã xác nhận'}
                  </button>
                </form>
              </>
            )}
            
            {/* Step 2: Enter OTP Code */}
            {step === 'code' && (
              <>
                <div className="auth-header">
                  <h1>Nhập mã xác nhận</h1>
                  <p>Mã 6 chữ số đã được gửi đến <strong>{email}</strong></p>
                </div>
                <form className="auth-form" onSubmit={(e) => { e.preventDefault(); handleVerifyCode() }}>
                  {error && <div className="auth-error">{error}</div>}
                  
                  <div className="otp-input-group" onPaste={handleCodePaste}>
                    {code.map((digit, index) => (
                      <input
                        key={index}
                        ref={(element) => {
                          codeInputs.current[index] = element
                        }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={e => handleCodeChange(index, e.target.value)}
                        onKeyDown={e => handleCodeKeyDown(index, e)}
                        className="otp-input"
                        disabled={loading}
                        autoFocus={index === 0}
                      />
                    ))}
                  </div>
                  
                  <div className="otp-resend">
                    {countdown > 0 ? (
                      <p>Gửi lại mã sau {countdown}s</p>
                    ) : (
                      <button type="button" onClick={handleResendCode} disabled={loading} className="link-button">
                        Gửi lại mã xác nhận
                      </button>
                    )}
                  </div>
                  
                  <button 
                    type="submit" 
                    className="btn btn-primary auth-submit" 
                    disabled={loading || code.some(d => !d)}
                  >
                    {loading ? 'Đang xác thực...' : 'Xác nhận'}
                  </button>
                </form>
              </>
            )}
            
            {/* Step 3: Set New Password */}
            {step === 'password' && (
              <>
                <div className="auth-header">
                  <h1>Đặt mật khẩu mới</h1>
                  <p>Tạo mật khẩu mạnh để bảo vệ tài khoản của bạn</p>
                </div>
                <form className="auth-form" onSubmit={handleResetPassword}>
                  {error && <div className="auth-error">{error}</div>}
                  
                  <div className="form-group">
                    <label className="form-label" htmlFor="new-password">Mật khẩu mới</label>
                    <div className="password-input-wrapper">
                      <input 
                        className="form-input" 
                        id="new-password" 
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword} 
                        onChange={e => setNewPassword(e.target.value)} 
                        placeholder="Tối thiểu 8 ký tự" 
                        required 
                        disabled={loading}
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 3l18 18M10.5 10.5a2 2 0 0 0 2.829 2.829M9.363 5.365A9.466 9.466 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.043M6.637 6.637C4.483 8.15 3 10.5 2 12c0 0 3 7 10 7 1.457 0 2.763-.31 3.897-.81" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                    <div className="password-requirements">
                      <span className={newPassword.length >= 8 ? 'valid' : ''}>
                        {newPassword.length >= 8 ? '✓' : '•'} Tối thiểu 8 ký tự
                      </span>
                      <span className={/(?=.*[a-z])(?=.*[A-Z])/.test(newPassword) ? 'valid' : ''}>
                        {/(?=.*[a-z])(?=.*[A-Z])/.test(newPassword) ? '✓' : '•'} Chữ hoa và chữ thường
                      </span>
                      <span className={/(?=.*\d)/.test(newPassword) ? 'valid' : ''}>
                        {/(?=.*\d)/.test(newPassword) ? '✓' : '•'} Ít nhất một số
                      </span>
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label" htmlFor="confirm-password">Xác nhận mật khẩu</label>
                    <div className="password-input-wrapper">
                      <input 
                        className="form-input" 
                        id="confirm-password" 
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword} 
                        onChange={e => setConfirmPassword(e.target.value)} 
                        placeholder="Nhập lại mật khẩu mới" 
                        required 
                        disabled={loading}
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 3l18 18M10.5 10.5a2 2 0 0 0 2.829 2.829M9.363 5.365A9.466 9.466 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.043M6.637 6.637C4.483 8.15 3 10.5 2 12c0 0 3 7 10 7 1.457 0 2.763-.31 3.897-.81" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  
                  <button className="btn btn-primary auth-submit" disabled={loading}>
                    {loading ? 'Đang cập nhật...' : 'Đặt lại mật khẩu'}
                  </button>
                </form>
              </>
            )}
            
            <div className="auth-switch">
              <p>
                {step === 'email' ? (
                  <Link href="/login" className="switch-link">← Quay lại đăng nhập</Link>
                ) : (
                  <button 
                    type="button" 
                    onClick={() => {
                      if (step === 'code') {
                        setStep('email')
                        setCode(['', '', '', '', '', ''])
                        setError('')
                      } else if (step === 'password') {
                        setStep('code')
                        setNewPassword('')
                        setConfirmPassword('')
                        setError('')
                      }
                    }}
                    className="link-button"
                  >
                    ← Quay lại
                  </button>
                )}
              </p>
            </div>
          </div>
        </div>
        
        <div className="auth-visual-side">
          <div className="auth-visual-container">
            <div className="auth-breathe-stage">
              <div className="orbit orbit-1"><span className="orbit-dot amber-dot" /></div>
              <div className="orbit orbit-2"><span className="orbit-dot teal-dot" /></div>
              <div className="breathe-ring r1"/>
              <div className="breathe-ring r2"/>
              <div className="breathe-blob"><span className="breathe-label">An tâm…</span></div>
            </div>
            <div className="auth-quote">
              <blockquote>“Bạn luôn có thể bắt đầu lại, thật nhẹ nhàng.”</blockquote>
              <cite>— MentalBridge</cite>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
