'use client'

import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

export default function Showcase() {
  const phoneRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (!phoneRef.current) return
    const phoneSlides = phoneRef.current.querySelectorAll('.phone-slide')
    if (phoneSlides.length === 0) return

    phoneSlides.forEach((slide) => slide.classList.remove('active'))
    phoneSlides[0].classList.add('active')
    if (reduceMotion) return

    let slideIdx = 0
    let interval: number | undefined
    const advance = () => {
      phoneSlides[slideIdx].classList.remove('active')
      slideIdx = (slideIdx + 1) % phoneSlides.length
      phoneSlides[slideIdx].classList.add('active')
    }
    const start = () => {
      if (interval === undefined) interval = window.setInterval(advance, 2600)
    }
    const stop = () => {
      if (interval !== undefined) window.clearInterval(interval)
      interval = undefined
    }

    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(
            ([entry]) => {
              if (entry?.isIntersecting) start()
              else stop()
            },
            { threshold: 0.08 },
          )

    if (observer && phoneRef.current) observer.observe(phoneRef.current)
    else start()

    return () => {
      stop()
      observer?.disconnect()
    }
  }, [reduceMotion])

  return (
    <section className="section" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <div
          className="section-head center reveal"
          style={{ maxWidth: '620px' }}
        >
          <div className="eyebrow">Bạn sẽ trải nghiệm điều gì</div>
          <h2>Web này giúp bạn hiểu và chăm sóc chính mình ra sao?</h2>
          <p>
            Không phải một bảng câu hỏi lạnh lùng. MentalBridge trò chuyện, lắng
            nghe nhật ký của bạn, và âm thầm theo dõi để đúng lúc đưa ra gợi ý
            phù hợp, từ một bài tập thở nhỏ đến một chuyên gia thật sự.
          </p>
        </div>

        <div className="showcase-card reveal">
          <div className="showcase-glow" aria-hidden="true"></div>
          <div className="showcase-glow g2" aria-hidden="true"></div>

          <div className="showcase-badge sb-1 float-card">
            <div className="float-inner">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              >
                <path d="M12 3c3 3 5 6 5 9a5 5 0 0 1-10 0c0-3 2-6 5-9Z" />
              </svg>
              <div>
                <div className="fc-title">7 ngày liên tiếp</div>
                <div className="fc-value">Đã ghi nhật ký</div>
              </div>
            </div>
          </div>
          <div className="showcase-badge sb-2 float-card">
            <div className="float-inner">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              >
                <path d="M9 11l2 2 4-4M20 7v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7l4-4h8l4 4Z" />
              </svg>
              <div>
                <div className="fc-title">Điểm PHQ-9</div>
                <div className="fc-value">Giảm 30% sau 1 tháng</div>
              </div>
            </div>
          </div>

          <div className="phone" ref={phoneRef}>
            <div className="phone-notch"></div>
            <div className="phone-screen">
              <div className="phone-slide" data-slide="1">
                <div className="phone-slide-label">Trò chuyện cùng AI</div>
                <div className="chat-bubble bot">
                  Hôm nay bạn cảm thấy thế nào?
                </div>
                <div className="chat-bubble user">
                  Mình khá mệt, ngủ không ngon mấy ngày nay.
                </div>
                <div className="chat-bubble bot">
                  Cảm ơn bạn đã chia sẻ. Mình gợi ý một bài tập thở 3 phút trước
                  khi ngủ nhé?
                </div>
                <div className="typing-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <div className="phone-insight phone-insight--symptoms">
                  <span className="phone-insight-label">
                    Tín hiệu đang được nhận diện
                  </span>
                  <div className="signal-pills">
                    <span>Mất ngủ</span>
                    <span>Căng thẳng</span>
                  </div>
                  <div className="solution-card">
                    <span className="solution-mark">✦</span>
                    <div>
                      <small>Gợi ý nhẹ nhàng</small>
                      <strong>Bài thở 3 phút trước khi ngủ</strong>
                    </div>
                  </div>
                </div>
              </div>
              <div className="phone-slide" data-slide="2">
                <div className="phone-slide-label">Nhật ký cảm xúc</div>
                <div className="mood-row">
                  <div className="mood-dot">😔</div>
                  <div className="mood-dot active">🙂</div>
                  <div className="mood-dot">😄</div>
                  <div className="mood-dot">😴</div>
                  <div className="mood-dot">😣</div>
                </div>
                <div className="journal-line w90"></div>
                <div className="journal-line w70"></div>
                <div className="journal-line w50"></div>
                <div className="streak-chip">🔥 Chuỗi 7 ngày viết nhật ký</div>
                <div className="phone-insight phone-insight--journal">
                  <span className="phone-insight-label">
                    Nhìn thấy thay đổi nhỏ
                  </span>
                  <div className="mood-wave" aria-hidden="true">
                    <i></i>
                    <i></i>
                    <i></i>
                    <i></i>
                    <i></i>
                    <i></i>
                    <i></i>
                  </div>
                  <div className="solution-card">
                    <span className="solution-mark">↗</span>
                    <div>
                      <small>Thói quen phù hợp</small>
                      <strong>Ghi 2 dòng, hiểu mình hơn</strong>
                    </div>
                  </div>
                </div>
              </div>
              <div className="phone-slide" data-slide="3">
                <div className="phone-slide-label">Kết quả sàng lọc</div>
                <div className="chart-row">
                  <div className="chart-bar" style={{ height: '70%' }}></div>
                  <div className="chart-bar" style={{ height: '85%' }}></div>
                  <div className="chart-bar" style={{ height: '55%' }}></div>
                  <div className="chart-bar" style={{ height: '40%' }}></div>
                  <div className="chart-bar" style={{ height: '30%' }}></div>
                  <div className="chart-bar" style={{ height: '22%' }}></div>
                </div>
                <div className="score-chip">
                  <span className="sc-label">Mức PHQ-9 hiện tại</span>
                  <span className="sc-num">Nhẹ</span>
                </div>
                <div className="phone-insight phone-insight--screening">
                  <span className="phone-insight-label">Bước tiếp theo</span>
                  <div className="solution-card">
                    <span className="solution-mark">→</span>
                    <div>
                      <small>Mức độ hiện tại</small>
                      <strong>Tiếp tục theo dõi cùng MentalBridge</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="value-row">
          <div className="value-item reveal reveal-d1">
            <div className="value-icon fi-teal">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 5.5C4 4.7 4.7 4 5.5 4H16l4 4v10.5c0 .8-.7 1.5-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13Z" />
                <path d="M8 10h8M8 14h5" />
              </svg>
            </div>
            <div>
              <h4>Bạn viết, chúng tôi lắng nghe</h4>
              <p>
                Chỉ vài dòng nhật ký mỗi ngày, không cần &quot;đúng chuẩn&quot;
                hay hoàn hảo.
              </p>
            </div>
          </div>
          <div className="value-item reveal reveal-d2">
            <div className="value-icon fi-amber">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2a5 5 0 0 0-5 5c0 2 1 3 1 5v2h8v-2c0-2 1-3 1-5a5 5 0 0 0-5-5ZM9 19h6M10 22h4" />
              </svg>
            </div>
            <div>
              <h4>AI thấu hiểu điều chưa nói ra</h4>
              <p>
                Công nghệ xử lý ngôn ngữ nhận ra cảm xúc ẩn sau câu chữ của bạn.
              </p>
            </div>
          </div>
          <div className="value-item reveal reveal-d3">
            <div className="value-icon fi-terra">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM21 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div>
              <h4>Đúng người, đúng lúc</h4>
              <p>
                Khi cần, bạn được ghép nối với chuyên gia phù hợp mà không phải
                chờ đợi mơ hồ.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
