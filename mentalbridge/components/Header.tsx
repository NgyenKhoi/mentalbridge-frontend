'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

export default function Header() {
  const headerRef = useRef<HTMLElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const header = headerRef.current
    if (!header) return

    const handleScroll = () => {
      header.classList.toggle('scrolled', window.scrollY > 12)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    document.body.classList.toggle('menu-open', menuOpen)
    return () => document.body.classList.remove('menu-open')
  }, [menuOpen])

  return (
    <header id="site-header" ref={headerRef}>
      <div className="wrap">
        <nav aria-label="Điều hướng chính">
          <a href="#top" className="logo">
            <svg className="mark" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 26C10 14 30 14 36 26" stroke="#1E4A43" strokeWidth="2.4" strokeLinecap="round"/>
              <circle cx="8" cy="27" r="3" fill="#E1A651"/>
              <circle cx="32" cy="27" r="3" fill="#3D7A6E"/>
            </svg>
            MentalBridge
          </a>
          <ul className="nav-links">
            <li><a href="#journey">Hành trình</a></li>
            <li><a href="#features">Tính năng</a></li>
            <li><a href="#risk">Mức độ hỗ trợ</a></li>
            <li><a href="#hotline">Đường dây nóng</a></li>
          </ul>
          <div className="nav-cta">
            <Link href="/login" className="btn-ghost">Đăng nhập</Link>
            <Link href="/register" className="btn btn-primary">Bắt đầu miễn phí</Link>
          </div>
          <button
            className="nav-menu-btn"
            type="button"
            aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMenuOpen(value => !value)}
          >
            <span></span><span></span><span></span>
          </button>
        </nav>
        <div id="mobile-navigation" className={`mobile-navigation ${menuOpen ? 'open' : ''}`}>
          <a href="#journey" onClick={() => setMenuOpen(false)}>Hành trình</a>
          <a href="#features" onClick={() => setMenuOpen(false)}>Tính năng</a>
          <a href="#risk" onClick={() => setMenuOpen(false)}>Mức độ hỗ trợ</a>
          <a href="#hotline" onClick={() => setMenuOpen(false)}>Đường dây nóng</a>
          <div className="mobile-nav-actions">
            <Link href="/login" className="btn btn-outline" onClick={() => setMenuOpen(false)}>Đăng nhập</Link>
            <Link href="/register" className="btn btn-primary" onClick={() => setMenuOpen(false)}>Bắt đầu miễn phí</Link>
          </div>
        </div>
      </div>
    </header>
  )
}
