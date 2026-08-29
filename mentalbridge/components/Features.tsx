'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import ScreeningIllustration from '@/components/ScreeningIllustration'

const services = [
  { number: '01', title: 'Nhật ký cảm xúc', description: 'Viết ra điều bạn đang trải qua mỗi ngày, riêng tư và không cần chỉnh sửa cho hoàn hảo.', note: 'Một khoảng riêng để lắng nghe chính mình' },
  { number: '02', title: 'Sàng lọc PHQ-9 / GAD-7', description: 'Bộ câu hỏi đánh giá trầm cảm và lo âu theo chuẩn lâm sàng, kết quả rõ ràng và dễ hiểu.', note: 'Hiểu tín hiệu trước khi chọn bước tiếp theo' },
  { number: '03', title: 'Kết nối chuyên gia', description: 'Được ghép nối với chuyên gia phù hợp dựa trên mức độ, chủ đề và sự đồng cảm.', note: 'Đúng người, đúng nhu cầu, đúng thời điểm' },
  { number: '04', title: 'Trò chuyện thời gian thực', description: 'Nhắn tin trực tiếp với chuyên gia đã được xác nhận, an toàn và bảo mật.', note: 'Không gian trò chuyện kín đáo và an toàn' },
  { number: '05', title: 'Tài nguyên tự chăm sóc', description: 'Bài tập thở, thiền và nội dung hướng dẫn nhẹ nhàng cho những ngày cần chậm lại.', note: 'Những thực hành nhỏ có thể dùng mỗi ngày' },
  { number: '06', title: 'Theo dõi tiến triển', description: 'Biểu đồ cảm xúc và điểm số theo thời gian, để bạn thấy rõ hành trình của chính mình.', note: 'Nhìn thấy thay đổi theo cách không phán xét' },
] as const

export default function Features() {
  const [hovered, setHovered] = useState<number | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  // Hover is the only desktop selection state; leaving a row returns to the
  // first item instead of keeping a previously clicked item selected.
  const selectedIndex = hovered ?? 0
  const selected = services[selectedIndex]

  // Do not keep a decorative preview video decoding while it is off-screen.
  useEffect(() => {
    const preview = previewRef.current
    const video = preview?.querySelector<HTMLVideoElement>(`[data-service-scene="${selected.number}"] .service-preview-video`)
    if (!preview || !video || typeof IntersectionObserver === 'undefined') return
    if (reduceMotion !== false) {
      video.pause()
      return
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        void video.play().catch(() => undefined)
      } else {
        video.pause()
      }
    }, { threshold: 0.08 })
    observer.observe(preview)

    return () => observer.disconnect()
  }, [reduceMotion, selected.number])

  const selectedImage = selected.number === '01' ? '/images/emotional-journal.png' : undefined
  const selectedIllustration = selected.number === '02'

  return (
    <section className="section services-interactive" id="features">
      <div className="wrap">
        <div className="section-head reveal">
          <div className="eyebrow">Bên trong MentalBridge</div>
          <h2>Mọi công cụ bạn cần, ở một nơi yên tĩnh.</h2>
        </div>

        <div className="services-stage">
          <div className="services-list" aria-label="Các công cụ MentalBridge" onPointerLeave={() => setHovered(null)}>
            {services.map((service, index) => (
              <button
                className={`service-row${selectedIndex === index ? ' is-active' : ''}${hovered === index ? ' is-hovered' : ''}`}
                key={service.number}
                type="button"
                aria-pressed={selectedIndex === index}
                onPointerEnter={(event) => {
                  if (event.pointerType !== 'touch') setHovered(index)
                }}
                onFocus={() => setHovered(index)}
                onBlur={() => setHovered(null)}
                onClick={() => setHovered(index)}
              >
                <span className="service-number">{service.number}</span>
                <span className="service-row-copy">
                  <strong>{service.title}</strong>
                  <span>{service.description}</span>
                </span>
                <span className="service-arrow" aria-hidden="true">↗</span>
              </button>
            ))}
          </div>

          <div className={`service-preview${selectedIllustration ? ' service-preview--screening' : ''}`} ref={previewRef} aria-live="polite">
            <AnimatePresence initial={false} mode="sync">
              <motion.div
                className="service-preview-scene"
                data-service-scene={selected.number}
                key={selected.number}
                initial={{ opacity: 0, scale: 1.025 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: .985 }}
                transition={{ duration: .48, ease: [.16, 1, .3, 1] }}
              >
                {selectedImage ? (
                  <Image
                    className="service-preview-image"
                    src={selectedImage}
                    alt="Minh họa viết nhật ký cảm xúc"
                    fill
                    sizes="(max-width: 900px) 100vw, 42vw"
                    priority={selectedIndex === 0}
                  />
                ) : selectedIllustration ? (
                  <ScreeningIllustration className="service-preview-illustration" />
                ) : (
                  <video className="service-preview-video" src="/videos/openhero/cloud-forest-sanctuaries.mp4" muted loop playsInline preload="metadata" aria-hidden="true" />
                )}
                <div className="service-preview-shade" aria-hidden="true" />
                <div className="service-preview-index" aria-hidden="true">{selected.number}</div>
                <div className="service-preview-copy">
                  <span>{selected.title}</span>
                  <h3>{selected.note}</h3>
                  <p>{selected.description}</p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  )
}
