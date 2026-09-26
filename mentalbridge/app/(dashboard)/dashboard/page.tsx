'use client'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import PlanGate, { type PlanId } from '@/components/PlanGate'
import { DailyEmotionCheckIn } from '@/features/emotion-check-in/DailyEmotionCheckIn'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import '../dashboard-page.css'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}
const tasks = [
  'Viết nhật ký hôm nay',
  'Hoàn thành bài tập thở',
  'Làm bài sàng lọc khi bạn sẵn sàng',
]
const SmallIcon = ({ type }: { type: 'note' | 'check' | 'user' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {type === 'note' ? (
      <>
        <path d="M6 3h9l3 3v15H6V3Z" />
        <path d="M9 9h6M9 13h6M9 17h3" />
      </>
    ) : type === 'check' ? (
      <path d="m5 13 4 4L19 7" />
    ) : (
      <>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3.5 20c1-3.5 3.3-5.3 5.5-5.3S14 16.5 15 20" />
      </>
    )}
  </svg>
)

export default function DashboardPage() {
  const [done, setDone] = useState<number[]>([])
  const [plan, setPlan] = useState<PlanId>('free')
  const heroRef = useRef<HTMLElement>(null)
  const bentoRef = useRef<HTMLElement>(null)
  const todayRef = useRef<HTMLElement>(null)
  const quickRef = useRef<HTMLElement>(null)
  const streakRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = localStorage.getItem('mentalbridge_plan')
      if (saved === 'plus' || saved === 'premium') setPlan(saved)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    if (prefersReducedMotion) return

    const ctx = gsap.context(() => {
      // Hero entrance
      gsap.from(heroRef.current, {
        opacity: 0,
        y: 30,
        duration: 0.8,
        ease: 'power3.out',
      })

      // Bento cards stagger
      if (bentoRef.current) {
        gsap.from(bentoRef.current.querySelectorAll('.ref-card'), {
          scrollTrigger: {
            trigger: bentoRef.current,
            start: 'top 80%',
            toggleActions: 'play none none reverse',
          },
          opacity: 0,
          y: 40,
          duration: 0.6,
          stagger: 0.15,
          ease: 'power2.out',
        })
      }

      // Today section
      if (todayRef.current) {
        gsap.from(todayRef.current.querySelectorAll('.ref-card'), {
          scrollTrigger: {
            trigger: todayRef.current,
            start: 'top 80%',
            toggleActions: 'play none none reverse',
          },
          opacity: 0,
          y: 40,
          duration: 0.6,
          stagger: 0.2,
          ease: 'power2.out',
        })
      }

      // Quick actions
      if (quickRef.current) {
        gsap.from(quickRef.current.querySelector('header'), {
          scrollTrigger: {
            trigger: quickRef.current,
            start: 'top 80%',
            toggleActions: 'play none none reverse',
          },
          opacity: 0,
          y: 20,
          duration: 0.5,
          ease: 'power2.out',
        })

        gsap.from(quickRef.current.querySelectorAll('a'), {
          scrollTrigger: {
            trigger: quickRef.current,
            start: 'top 80%',
            toggleActions: 'play none none reverse',
          },
          opacity: 0,
          y: 30,
          duration: 0.6,
          stagger: 0.12,
          ease: 'back.out(1.2)',
        })
      }

      // Streak banner
      if (streakRef.current) {
        gsap.from(streakRef.current, {
          scrollTrigger: {
            trigger: streakRef.current,
            start: 'top 85%',
            toggleActions: 'play none none reverse',
          },
          opacity: 0,
          scale: 0.95,
          y: 20,
          duration: 0.6,
          ease: 'back.out(1.4)',
        })
      }
    })

    return () => ctx.revert()
  }, [])

  const toggle = (i: number) =>
    setDone((v) => (v.includes(i) ? v.filter((x) => x !== i) : [...v, i]))

  return (
    <div className="ref-dashboard">
      <section ref={heroRef} className="ref-hero">
        <div>
          <p>
            <i />
            Không gian chăm sóc tinh thần của bạn
          </p>
          <h1>Chào bạn</h1>
          <span>Hôm nay bạn cảm thấy thế nào?</span>
        </div>
        <div className="ref-streak">
          <b>
            Bắt đầu hôm nay<small>Mỗi ghi chép là một bước nhìn lại</small>
          </b>
        </div>
      </section>
      <section
        className="ref-initial-check"
        aria-labelledby="initial-check-cta-title"
      >
        <div>
          <span>Kiểm tra ban đầu</span>
          <h2 id="initial-check-cta-title">Hiểu rõ hơn về 14 ngày gần đây</h2>
          <p>
            Hoàn thành PHQ-9 rồi GAD-7 trong một hành trình có hướng dẫn để nhận
            kết quả và bước hỗ trợ phù hợp.
          </p>
        </div>
        <Link href="/initial-check">
          Bắt đầu kiểm tra ban đầu <strong aria-hidden="true">→</strong>
        </Link>
      </section>
      <section ref={bentoRef} className="ref-bento">
        <DailyEmotionCheckIn />
        <article className="ref-card ref-result">
          <header>
            <h2>Kết quả sàng lọc</h2>
            <i aria-hidden="true">✓</i>
          </header>
          <p>Chưa có kết quả sàng lọc nào được hiển thị.</p>
          <Link href="/assessment/phq9">Làm PHQ-9 để nhận kết quả →</Link>
        </article>
        <PlanGate
          currentPlan={plan}
          required="plus"
          title="Phân tích xu hướng chi tiết"
        >
          <article className="ref-card ref-trend">
            <header>
              <h2>Nhìn lại theo thời gian</h2>
            </header>
            <footer>
              <span>Ghi lại cảm xúc trong nhật ký để có dữ liệu nhìn lại.</span>
            </footer>
          </article>
        </PlanGate>
      </section>
      <section ref={todayRef} className="ref-today">
        <PlanGate
          currentPlan={plan}
          required="premium"
          title="Lịch hẹn ưu tiên"
        >
          <article className="ref-card ref-appointment">
            <header>
              <h2>Lịch hẹn</h2>
              <Link href="/appointments">Xem tất cả →</Link>
            </header>
            <div>
              <p>
                <strong>Xem lịch hẹn của bạn</strong>
                <span>Mở trang lịch hẹn để xem thông tin mới nhất.</span>
              </p>
            </div>
            <footer>
              Thông tin lịch hẹn không được tạo mẫu trên trang này.
            </footer>
          </article>
        </PlanGate>
        <article className="ref-card ref-tasks">
          <header>
            <h2>Gợi ý cho hôm nay</h2>
            <b>{done.length}/3</b>
          </header>
          {tasks.map((task, i) => (
            <button
              type="button"
              key={task}
              onClick={() => toggle(i)}
              className={done.includes(i) ? 'done' : ''}
              aria-pressed={done.includes(i)}
            >
              <i aria-hidden="true">{done.includes(i) ? '✓' : ''}</i>
              {task}
            </button>
          ))}
        </article>
      </section>
      <section ref={quickRef} className="ref-quick">
        <header>
          <h2>Hành động nhanh</h2>
          <span>Những việc bạn có thể làm ngay</span>
        </header>
        <div>
          <Link href="/journal" className="primary">
            <i>
              <SmallIcon type="note" />
            </i>
            <p>
              <b>Viết nhật ký</b>
              <span>Ghi lại cảm xúc và suy nghĩ hôm nay</span>
            </p>
            <strong>→</strong>
          </Link>
          <Link href="/assessments">
            <i>
              <SmallIcon type="check" />
            </i>
            <p>
              <b>Làm bài sàng lọc</b>
              <span>
                Nhìn lại trải nghiệm 14 ngày gần đây với PHQ-9 hoặc GAD-7
              </span>
            </p>
          </Link>
          <Link href="/specialists">
            <i className="amber">
              <SmallIcon type="user" />
            </i>
            <p>
              <b>Tìm chuyên gia</b>
              <span>Xem chuyên gia theo lĩnh vực bạn quan tâm</span>
            </p>
          </Link>
        </div>
      </section>
      <section ref={streakRef} className="ref-journal-streak">
        <p>
          <b>Dành một phút nhìn lại hôm nay</b>
          <span>Viết điều bạn đang cảm nhận theo cách riêng của mình.</span>
        </p>
        <Link href="/journal">Viết nhật ký →</Link>
      </section>
    </div>
  )
}
