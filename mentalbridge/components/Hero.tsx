'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'

export default function Hero() {
  const heroVisualRef = useRef<HTMLDivElement>(null)
  const heroGlowRef = useRef<HTMLDivElement>(null)
  const breatheStageRef = useRef<HTMLDivElement>(null)
  const breatheLabelRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    // Breathing label sync (Hít vào / Thở ra)
    const label = breatheLabelRef.current
    if (!label) return

    let breatheIn = true
    const interval = setInterval(() => {
      breatheIn = !breatheIn
      label.textContent = breatheIn ? 'Hít vào...' : 'Thở ra...'
    }, 4000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    // Hero mouse-parallax: glow follows cursor, float cards & blob tilt gently
    const heroVisual = heroVisualRef.current
    const heroGlow = heroGlowRef.current
    const breatheStage = breatheStageRef.current
    if (!heroVisual || !heroGlow || !breatheStage) return

    const cards = Array.from(heroVisual.querySelectorAll('.float-card')) as HTMLDivElement[]
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) return

    const handleMouseMove = (e: MouseEvent) => {
      const rect = heroVisual.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const cx = x - rect.width / 2
      const cy = y - rect.height / 2

      heroGlow.style.left = x + 'px'
      heroGlow.style.top = y + 'px'
      heroGlow.style.opacity = '1'

      breatheStage.style.transform = `translate(${cx * 0.02}px, ${cy * 0.02}px)`

      cards.forEach(card => {
        const depth = parseInt(card.dataset.depth || '30', 10)
        const tx = (cx / rect.width) * depth
        const ty = (cy / rect.height) * depth
        card.style.transform = `translate(${tx}px, ${ty}px)`
      })
    }

    const handleMouseLeave = () => {
      heroGlow.style.opacity = '0'
      breatheStage.style.transform = 'translate(0,0)'
      cards.forEach(card => { card.style.transform = 'translate(0,0)' })
    }

    heroVisual.addEventListener('mousemove', handleMouseMove)
    heroVisual.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      heroVisual.removeEventListener('mousemove', handleMouseMove)
      heroVisual.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [])

  return (
    <section className="hero">
      <div className="hero-bg"></div>
      <div className="wrap hero-grid">
        <div>
          <div className="eyebrow reveal">Nền tảng sàng lọc sức khỏe tâm thần</div>
          <h1 className="hero-title reveal reveal-d1">Có những ngày<br/>bạn không chắc<br/><em>mình có đang ổn.</em></h1>
          <p className="hero-sub reveal reveal-d2">MentalBridge lắng nghe cảm xúc của bạn qua khảo sát, nhật ký hằng ngày và AI thấu cảm — rồi nhẹ nhàng dẫn lối đến đúng sự hỗ trợ bạn cần, không phán xét, không vội vàng.</p>
          <div className="hero-actions reveal reveal-d3">
            <Link href="/assessment/anonymous" className="btn btn-primary">Bắt đầu sàng lọc miễn phí</Link>
            <a href="#journey" className="btn btn-outline">Xem cách hoạt động</a>
          </div>
          <div className="hero-trust reveal reveal-d4">
            <div className="trust-item"><span className="trust-num">PHQ-9</span><span className="trust-label">& GAD-7 chuẩn lâm sàng</span></div>
            <div className="trust-item"><span className="trust-num">24/7</span><span className="trust-label">đồng hành cùng bạn</span></div>
            <div className="trust-item"><span className="trust-num">Ẩn danh</span><span className="trust-label">khi bạn cần riêng tư</span></div>
          </div>
        </div>

        <div className="hero-visual reveal reveal-d2" id="heroVisual" ref={heroVisualRef}>
          <div className="hero-glow" id="heroGlow" ref={heroGlowRef}></div>
          <div className="particles" aria-hidden="true">
            <span style={{left:'8%', '--dur':'9s', '--delay':'0s', '--c':'var(--amber)'} as React.CSSProperties}></span>
            <span style={{left:'22%', '--dur':'12s', '--delay':'1.5s', '--c':'var(--teal)'} as React.CSSProperties}></span>
            <span style={{left:'78%', '--dur':'10s', '--delay':'.6s', '--c':'var(--amber)'} as React.CSSProperties}></span>
            <span style={{left:'88%', '--dur':'13s', '--delay':'2.4s', '--c':'var(--lavender)'} as React.CSSProperties}></span>
            <span style={{left:'48%', '--dur':'11s', '--delay':'3.2s', '--c':'var(--teal)'} as React.CSSProperties}></span>
            <span style={{left:'65%', '--dur':'9.5s', '--delay':'1s', '--c':'var(--amber)'} as React.CSSProperties}></span>
          </div>
          <div className="breathe-stage" id="breatheStage" ref={breatheStageRef}>
            <div className="orbit orbit-1" aria-hidden="true"><span className="orbit-dot amber-dot"></span></div>
            <div className="orbit orbit-2" aria-hidden="true"><span className="orbit-dot teal-dot"></span></div>
            <div className="breathe-ring r1"></div>
            <div className="breathe-ring r2"></div>
            <div className="breathe-blob"><span className="breathe-label" id="breatheLabel" ref={breatheLabelRef}>Hít vào...</span></div>
          </div>
          <div className="float-card fc-1" data-depth="30">
            <div className="float-inner">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 12c3-6 6-8 8-8s5 2 8 8c-3 6-6 8-8 8s-5-2-8-8Z"/><circle cx="12" cy="12" r="2.4"/></svg>
              <div><div className="fc-title">Mức độ hôm nay</div><div className="fc-value">Nhẹ · ổn định</div></div>
            </div>
          </div>
          <div className="float-card fc-2" data-depth="45">
            <div className="float-inner">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 19V9M10 19V4M16 19v-7M22 19v-3"/></svg>
              <div><div className="fc-title">Xu hướng cảm xúc</div><div className="fc-value">Cải thiện +12%</div></div>
            </div>
          </div>
          <div className="float-card fc-3" data-depth="22">
            <div className="float-inner">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M20 21c0-4-3.6-6-8-6s-8 2-8 6M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/></svg>
              <div><div className="fc-title">Chuyên gia gợi ý</div><div className="fc-value">2 phù hợp với bạn</div></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
