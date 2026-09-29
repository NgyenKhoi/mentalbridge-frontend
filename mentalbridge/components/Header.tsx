'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import MagneticButton from '@/components/motion/MagneticButton'
import { resolveCurrentWorkspace } from '@/features/auth/api/browser-auth'
import type { Workspace } from '@/features/auth/model/workspace'

function workspaceActionLabel(workspace: Workspace) {
  if (workspace.role === 'ADMIN') return 'Vào trang quản trị'
  if (workspace.role === 'SPECIALIST') return 'Vào trang chuyên gia'
  return 'Vào không gian của bạn'
}

export default function Header({
  hasSessionHint = false,
}: Readonly<{ hasSessionHint?: boolean }>) {
  const headerRef = useRef<HTMLElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [sessionChecked, setSessionChecked] = useState(!hasSessionHint)

  useEffect(() => {
    if (!hasSessionHint) return
    let active = true

    resolveCurrentWorkspace()
      .then((session) => {
        if (active) setWorkspace(session.workspace)
      })
      .catch(() => {
        if (active) setWorkspace(null)
      })
      .finally(() => {
        if (active) setSessionChecked(true)
      })

    return () => {
      active = false
    }
  }, [hasSessionHint])

  useEffect(() => {
    const header = headerRef.current
    if (!header) return
    const topAnchor = document.getElementById('top')
    if (!topAnchor) return

    const observer = new IntersectionObserver(
      ([entry]) => header.classList.toggle('scrolled', !entry.isIntersecting),
      { rootMargin: '-12px 0px 0px' },
    )

    observer.observe(topAnchor)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    document.body.classList.toggle('menu-open', menuOpen)
    return () => document.body.classList.remove('menu-open')
  }, [menuOpen])

  return (
    <header id="site-header" className="marketing-header" ref={headerRef}>
      <div className="wrap">
        <nav aria-label="Điều hướng chính">
          <a href="#top" className="logo">
            <svg
              className="mark"
              viewBox="0 0 40 40"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M4 26C10 14 30 14 36 26"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <circle cx="8" cy="27" r="3" fill="currentColor" />
              <circle cx="32" cy="27" r="3" fill="currentColor" opacity=".55" />
            </svg>
            MentalBridge
          </a>
          <ul className="nav-links">
            <li>
              <a href="#journey">Hành trình</a>
            </li>
            <li>
              <a href="#features">Tính năng</a>
            </li>
            <li>
              <a href="#risk">Cách đọc kết quả</a>
            </li>
          </ul>
          <div className="nav-cta">
            <Link href="/safety-directory" className="btn-ghost">
              Tôi cần hỗ trợ ngay
            </Link>
            {workspace ? (
              <MagneticButton>
                <Link
                  href={workspace.path}
                  className="btn btn-primary"
                  data-cursor="action"
                >
                  {workspaceActionLabel(workspace)}
                </Link>
              </MagneticButton>
            ) : sessionChecked ? (
              <>
                <Link href="/login" className="btn-ghost">
                  Đăng nhập
                </Link>
                <MagneticButton>
                  <Link
                    href="/register"
                    className="btn btn-primary"
                    data-cursor="action"
                  >
                    Bắt đầu miễn phí
                  </Link>
                </MagneticButton>
              </>
            ) : (
              <span className="btn btn-primary" aria-live="polite">
                Đang mở không gian…
              </span>
            )}
          </div>
          <button
            className="nav-menu-btn"
            type="button"
            aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMenuOpen((value) => !value)}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </nav>
        <div
          id="mobile-navigation"
          className={`mobile-navigation ${menuOpen ? 'open' : ''}`}
        >
          <a href="#journey" onClick={() => setMenuOpen(false)}>
            Hành trình
          </a>
          <a href="#features" onClick={() => setMenuOpen(false)}>
            Tính năng
          </a>
          <a href="#risk" onClick={() => setMenuOpen(false)}>
            Cách đọc kết quả
          </a>
          <div className="mobile-nav-actions">
            <Link
              href="/safety-directory"
              className="btn btn-outline"
              onClick={() => setMenuOpen(false)}
            >
              Tôi cần hỗ trợ ngay
            </Link>
            {workspace ? (
              <Link
                href={workspace.path}
                className="btn btn-primary"
                onClick={() => setMenuOpen(false)}
              >
                {workspaceActionLabel(workspace)}
              </Link>
            ) : sessionChecked ? (
              <>
                <Link
                  href="/login"
                  className="btn btn-outline"
                  onClick={() => setMenuOpen(false)}
                >
                  Đăng nhập
                </Link>
                <Link
                  href="/register"
                  className="btn btn-primary"
                  onClick={() => setMenuOpen(false)}
                >
                  Bắt đầu miễn phí
                </Link>
              </>
            ) : (
              <span className="btn btn-primary" aria-live="polite">
                Đang mở không gian…
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
