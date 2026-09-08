'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useRef, useState } from 'react'

import {
  loginAndResolveWorkspace,
  loginErrorMessage,
} from '../api/browser-auth'

export default function LoginForm({ notice }: Readonly<{ notice?: string }>) {
  const router = useRouter()
  const submitting = useRef(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting.current) return

    submitting.current = true
    setError('')
    setLoading(true)

    try {
      const session = await loginAndResolveWorkspace({ email, password })
      router.replace(session.path)
      router.refresh()
    } catch (caught) {
      setError(loginErrorMessage(caught))
    } finally {
      submitting.current = false
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      {notice ? (
        <div className="auth-success" role="status">
          {notice}
        </div>
      ) : null}
      <div className="form-group">
        <label htmlFor="email" className="form-label">
          Email
        </label>
        <input
          type="email"
          id="email"
          name="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="form-input"
          placeholder="your@email.com"
          autoComplete="username"
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
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="form-input"
          placeholder="Nhập mật khẩu"
          autoComplete="current-password"
          required
        />
      </div>

      <Link href="/reset-password" className="forgot-link">
        Quên mật khẩu?
      </Link>

      {error ? (
        <div className="auth-error" role="alert">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        className="btn btn-primary auth-submit"
        disabled={loading}
        aria-busy={loading}
      >
        {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
      </button>
    </form>
  )
}
