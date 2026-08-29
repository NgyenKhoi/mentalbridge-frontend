'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import './ChangePasswordModal.css'

type ChangePasswordModalProps = {
  isOpen: boolean
  onClose: () => void
}

export default function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) onClose()
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', closeOnEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isOpen, loading, onClose])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.currentPassword) {
      newErrors.currentPassword = 'Vui lòng nhập mật khẩu hiện tại'
    }

    if (!formData.newPassword) {
      newErrors.newPassword = 'Vui lòng nhập mật khẩu mới'
    } else if (formData.newPassword.length < 8) {
      newErrors.newPassword = 'Mật khẩu phải có ít nhất 8 ký tự'
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.newPassword)) {
      newErrors.newPassword = 'Mật khẩu phải chứa chữ hoa, chữ thường và số'
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Vui lòng xác nhận mật khẩu mới'
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Mật khẩu xác nhận không khớp'
    }

    if (formData.currentPassword && formData.newPassword && formData.currentPassword === formData.newPassword) {
      newErrors.newPassword = 'Mật khẩu mới phải khác mật khẩu hiện tại'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    setLoading(true)
    setErrors({})

    try {
      // TODO: Kết nối API backend
      // const response = await fetch('/api/user/change-password', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     currentPassword: formData.currentPassword,
      //     newPassword: formData.newPassword
      //   })
      // })
      // if (!response.ok) throw new Error('Failed to change password')

      // Giả lập API call
      await new Promise(resolve => setTimeout(resolve, 1500))

      setSuccess(true)
      
      setTimeout(() => {
        handleClose()
      }, 2000)
    } catch {
      setErrors({ submit: 'Mật khẩu hiện tại không đúng. Vui lòng thử lại.' })
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (loading) return
    setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' })
    setErrors({})
    setSuccess(false)
    setShowCurrentPassword(false)
    setShowNewPassword(false)
    setShowConfirmPassword(false)
    onClose()
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="change-password-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />
          <motion.div
            className="change-password-modal-shell"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="change-password-modal" role="dialog" aria-modal="true" aria-labelledby="change-password-title">
              {success ? (
                <div className="change-password-success">
                  <div className="success-icon">
                    <svg viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="26" cy="26" r="25" stroke="currentColor" strokeWidth="2" />
                      <motion.path
                        d="M14 27l8 8 16-16"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                      />
                    </svg>
                  </div>
                  <h2>Đổi mật khẩu thành công!</h2>
                  <p>Mật khẩu của bạn đã được cập nhật. Vui lòng sử dụng mật khẩu mới cho lần đăng nhập tiếp theo.</p>
                </div>
              ) : (
                <>
                  <div className="change-password-header">
                    <div>
                      <span className="change-password-eyebrow">Bảo mật tài khoản</span>
                      <h2 id="change-password-title">Đổi mật khẩu</h2>
                      <p>Tạo mật khẩu mạnh để bảo vệ tài khoản của bạn</p>
                    </div>
                    <button 
                      className="change-password-close" 
                      onClick={handleClose} 
                      aria-label="Đóng"
                      disabled={loading}
                    >
                      ×
                    </button>
                  </div>

                  <form className="change-password-form" onSubmit={handleSubmit}>
                    {errors.submit && (
                      <div className="change-password-error-banner">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
                        </svg>
                        <span>{errors.submit}</span>
                      </div>
                    )}

                    <div className="form-group">
                      <label htmlFor="currentPassword" className="form-label">
                        Mật khẩu hiện tại
                      </label>
                      <div className="password-input-wrapper">
                        <input
                          type={showCurrentPassword ? 'text' : 'password'}
                          id="currentPassword"
                          name="currentPassword"
                          value={formData.currentPassword}
                          onChange={handleChange}
                          className={`form-input ${errors.currentPassword ? 'error' : ''}`}
                          placeholder="Nhập mật khẩu hiện tại"
                          disabled={loading}
                        />
                        <button
                          type="button"
                          className="password-toggle"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          aria-label={showCurrentPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                          tabIndex={-1}
                        >
                          {showCurrentPassword ? (
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
                      {errors.currentPassword && (
                        <span className="form-error">{errors.currentPassword}</span>
                      )}
                    </div>

                    <div className="form-group">
                      <label htmlFor="newPassword" className="form-label">
                        Mật khẩu mới
                      </label>
                      <div className="password-input-wrapper">
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          id="newPassword"
                          name="newPassword"
                          value={formData.newPassword}
                          onChange={handleChange}
                          className={`form-input ${errors.newPassword ? 'error' : ''}`}
                          placeholder="Tối thiểu 8 ký tự"
                          disabled={loading}
                        />
                        <button
                          type="button"
                          className="password-toggle"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          aria-label={showNewPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                          tabIndex={-1}
                        >
                          {showNewPassword ? (
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
                      {errors.newPassword && (
                        <span className="form-error">{errors.newPassword}</span>
                      )}
                      <div className="password-requirements">
                        <span className={formData.newPassword.length >= 8 ? 'valid' : ''}>
                          {formData.newPassword.length >= 8 ? '✓' : '•'} Tối thiểu 8 ký tự
                        </span>
                        <span className={/(?=.*[a-z])(?=.*[A-Z])/.test(formData.newPassword) ? 'valid' : ''}>
                          {/(?=.*[a-z])(?=.*[A-Z])/.test(formData.newPassword) ? '✓' : '•'} Chữ hoa và chữ thường
                        </span>
                        <span className={/(?=.*\d)/.test(formData.newPassword) ? 'valid' : ''}>
                          {/(?=.*\d)/.test(formData.newPassword) ? '✓' : '•'} Ít nhất một số
                        </span>
                      </div>
                    </div>

                    <div className="form-group">
                      <label htmlFor="confirmPassword" className="form-label">
                        Xác nhận mật khẩu mới
                      </label>
                      <div className="password-input-wrapper">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          id="confirmPassword"
                          name="confirmPassword"
                          value={formData.confirmPassword}
                          onChange={handleChange}
                          className={`form-input ${errors.confirmPassword ? 'error' : ''}`}
                          placeholder="Nhập lại mật khẩu mới"
                          disabled={loading}
                        />
                        <button
                          type="button"
                          className="password-toggle"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          aria-label={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
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
                      {errors.confirmPassword && (
                        <span className="form-error">{errors.confirmPassword}</span>
                      )}
                    </div>

                    <div className="change-password-actions">
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={handleClose}
                        disabled={loading}
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        className="btn-primary"
                        disabled={loading}
                      >
                        {loading ? (
                          <>
                            <span className="spinner" />
                            Đang cập nhật...
                          </>
                        ) : (
                          'Đổi mật khẩu'
                        )}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
