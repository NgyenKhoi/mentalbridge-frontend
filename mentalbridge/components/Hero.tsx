'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useMemo } from 'react'
import { useReducedMotion } from 'framer-motion'
import StarfieldBackground from '@/components/StarfieldBackground'
import MagneticButton from '@/components/motion/MagneticButton'

const heroTopics = [
  {
    label: 'Lo âu',
    eyebrow: 'Lắng nghe điều đang diễn ra',
    title: 'Bạn có đang\nổn không?',
    description: 'Nhận diện cảm xúc và tìm đúng sự hỗ trợ khi bạn cần.',
  },
  {
    label: 'Giá trị bản thân',
    eyebrow: 'Bạn vẫn luôn đủ đầy',
    title: 'Nhẹ nhàng hơn với chính mình.',
    description:
      'Ghi lại cảm xúc, nhìn thấy tiến triển và xây dựng lòng trắc ẩn với bản thân mỗi ngày.',
  },
  {
    label: 'Các mối quan hệ',
    eyebrow: 'Kết nối bằng sự thấu hiểu',
    title: 'Hiểu mình để gần nhau hơn.',
    description:
      'Nhận diện điều khó nói và kết nối với chuyên gia phù hợp khi bạn cần một người đồng hành.',
  },
  {
    label: 'Căng thẳng',
    eyebrow: 'Chậm lại một nhịp',
    title: 'Tìm lại khoảng thở bình yên.',
    description:
      'Những bài tập ngắn và tài nguyên tự chăm sóc giúp bạn trở về với hiện tại.',
  },
  {
    label: 'Sang chấn',
    eyebrow: 'Một không gian an toàn',
    title: 'Bạn không cần đi qua một mình.',
    description:
      'MentalBridge đồng hành kín đáo và gợi ý hỗ trợ chuyên môn theo đúng mức độ bạn cần.',
  },
  {
    label: 'Kiệt sức',
    eyebrow: 'Lắng nghe cơ thể và tâm trí',
    title: 'Nghỉ ngơi cũng là một bước tiến.',
    description:
      'Theo dõi những thay đổi nhỏ để nhận ra khi nào bạn cần chậm lại và tìm sự hỗ trợ.',
  },
] as const

// Calculate orbit positions using trigonometry
const calculateOrbitPositions = (count: number, radius: number = 42) => {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i * 360) / count - 90 // Start from top
    const radian = (angle * Math.PI) / 180
    const x = 50 + radius * Math.cos(radian) // 50% = center
    const y = 50 + radius * Math.sin(radian)
    return { x, y, angle }
  })
}

export default function Hero() {
  const [activeTopic, setActiveTopic] = useState(0)
  const sceneRef = useRef<HTMLDivElement>(null)
  const orbitTopicsRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const spotlightRef = useRef<HTMLDivElement>(null)
  const transitionRef = useRef(false)
  const mountedRef = useRef(false)
  const topicTimelineRef = useRef<{ kill: () => void } | null>(null)
  const reducedMotion = useReducedMotion()

  // Memoize orbit positions
  const orbitPositions = useMemo(
    () => calculateOrbitPositions(heroTopics.length),
    [],
  )

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      topicTimelineRef.current?.kill()
      topicTimelineRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!reducedMotion) return
    topicTimelineRef.current?.kill()
    topicTimelineRef.current = null
    transitionRef.current = false
  }, [reducedMotion])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    let cancelled = false
    let cleanup: (() => void) | undefined

    Promise.all([import('gsap')]).then(([{ default: gsap }]) => {
      if (cancelled) return
      const halo = scene.querySelector<HTMLElement>('.hero-orbit-halo')
      const haloCore = scene.querySelector<HTMLElement>('.halo-core')
      const parallaxNodes = Array.from(
        scene.querySelectorAll<HTMLElement>('.orbit-topic-parallax'),
      )
      if (!halo) return

      const media = gsap.matchMedia()
      media.add(
        {
          motionAllowed: '(prefers-reduced-motion: no-preference)',
          finePointer: '(hover: hover) and (pointer: fine)',
        },
        (context) => {
          const conditions = context.conditions as {
            motionAllowed?: boolean
            finePointer?: boolean
          }
          if (!conditions.motionAllowed) return

          const lightX = spotlightRef.current
            ? gsap.quickTo(spotlightRef.current, 'x', {
                duration: 0.35,
                ease: 'power2.out',
              })
            : null
          const lightY = spotlightRef.current
            ? gsap.quickTo(spotlightRef.current, 'y', {
                duration: 0.35,
                ease: 'power2.out',
              })
            : null
          const lightOpacity = spotlightRef.current
            ? gsap.quickTo(spotlightRef.current, 'opacity', {
                duration: 0.3,
                ease: 'power2.out',
              })
            : null
          const topicTweens = parallaxNodes.map((item, index) => ({
            x: gsap.quickTo(item, 'x', { duration: 0.65, ease: 'power3.out' }),
            y: gsap.quickTo(item, 'y', { duration: 0.65, ease: 'power3.out' }),
            depth: 14 + (index % 3) * 7,
          }))

          const handlePointerMove = (event: PointerEvent) => {
            if (event.pointerType === 'touch') return
            const rect = scene.getBoundingClientRect()
            const x = (event.clientX - rect.left) / rect.width - 0.5
            const y = (event.clientY - rect.top) / rect.height - 0.5
            lightX?.(event.clientX - rect.left)
            lightY?.(event.clientY - rect.top)
            lightOpacity?.(0.82)
            topicTweens.forEach((item) => {
              item.x(x * item.depth)
              item.y(y * item.depth)
            })
          }

          const resetPointer = () => {
            lightOpacity?.(0)
            topicTweens.forEach((item) => {
              item.x(0)
              item.y(0)
            })
          }

          if (conditions.finePointer) {
            scene.addEventListener('pointermove', handlePointerMove)
            scene.addEventListener('pointerleave', resetPointer)
          }

          return () => {
            scene.removeEventListener('pointermove', handlePointerMove)
            scene.removeEventListener('pointerleave', resetPointer)
            const animatedNodes = [
              halo,
              haloCore,
              spotlightRef.current,
              ...parallaxNodes,
            ].filter((node): node is HTMLElement => node !== null)
            gsap.killTweensOf(animatedNodes)
            gsap.set(animatedNodes, { clearProps: 'transform,opacity' })
          }
        },
      )

      cleanup = () => media.revert()
    })

    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [])

  const topic = heroTopics[activeTopic]

  const pauseOrbit = () => {
    orbitTopicsRef.current?.classList.add('is-paused')
  }

  const resumeOrbit = () => {
    orbitTopicsRef.current?.classList.remove('is-paused')
  }

  useEffect(() => {
    const content = contentRef.current
    // Skip if transition is being handled by selectTopic's timeline
    if (!content || reducedMotion || transitionRef.current) return

    let cancelled = false
    let cleanupTween: (() => void) | undefined
    import('gsap').then(({ default: gsap }) => {
      if (cancelled) return
      const tween = gsap.fromTo(
        content.children,
        { opacity: 0, y: 14 },
        {
          opacity: 1,
          y: 0,
          duration: 0.62,
          stagger: 0.065,
          ease: 'power3.out',
          clearProps: 'transform,opacity',
        },
      )
      cleanupTween = () => {
        tween.kill()
        gsap.set(content.children, { clearProps: 'transform,opacity' })
      }
    })
    return () => {
      cancelled = true
      cleanupTween?.()
    }
  }, [activeTopic, reducedMotion])

  const selectTopic = (index: number) => {
    if (index === activeTopic || transitionRef.current) return
    const content = contentRef.current
    if (!content || reducedMotion) {
      setActiveTopic(index)
      return
    }

    transitionRef.current = true
    import('gsap').then(({ default: gsap }) => {
      if (!mountedRef.current) return
      const selected = sceneRef.current?.querySelector<HTMLElement>(
        `.orbit-topic-${index + 1}`,
      )
      const allTopics =
        sceneRef.current?.querySelectorAll<HTMLElement>('.orbit-topic')
      if (!selected || !allTopics) {
        setActiveTopic(index)
        transitionRef.current = false
        return
      }
      topicTimelineRef.current?.kill()
      const timeline = gsap.timeline({
        onStart: () => {
          setActiveTopic(index)
        },
        onComplete: () => {
          transitionRef.current = false
          if (topicTimelineRef.current === timeline)
            topicTimelineRef.current = null
        },
        onInterrupt: () => {
          gsap.set(content.children, { clearProps: 'transform,opacity' })
          gsap.set(allTopics, { clearProps: 'transform,opacity' })
          transitionRef.current = false
          if (topicTimelineRef.current === timeline)
            topicTimelineRef.current = null
        },
      })
      topicTimelineRef.current = timeline
      // Fade out content with smooth stagger
      timeline.to(content.children, {
        opacity: 0,
        y: -12,
        duration: 0.28,
        stagger: 0.02,
        ease: 'power2.in',
      })

      // Pulse all topics
      timeline.to(
        allTopics,
        {
          scale: 0.92,
          opacity: 0.5,
          duration: 0.2,
          ease: 'power2.out',
        },
        0,
      )

      // Pop the selected topic with glow
      timeline.fromTo(
        selected,
        { scale: 0.92 },
        {
          scale: 1.24,
          opacity: 1,
          duration: 0.32,
          ease: 'back.out(2.5)',
        },
        0.15,
      )

      // Return other topics to normal
      timeline.to(
        allTopics,
        {
          scale: 1,
          opacity: 1,
          duration: 0.25,
          ease: 'power2.out',
          clearProps: 'transform,opacity',
        },
        0.4,
      )

      // Fade in new content with elastic bounce
      timeline.fromTo(
        content.children,
        { opacity: 0, y: 18, scale: 0.96 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.72,
          stagger: 0.055,
          ease: 'back.out(1.4)',
          clearProps: 'transform,opacity',
        },
        '+=0.08',
      )
    })
  }

  return (
    <section className="hero hero-orbit" aria-labelledby="hero-title">
      <StarfieldBackground className="hero-starfield" />
      <div className="wrap hero-orbit-wrap" ref={sceneRef}>
        <div
          className="hero-pointer-light"
          aria-hidden="true"
          ref={spotlightRef}
        />
        <div className="hero-orbit-halo" aria-hidden="true">
          <span className="halo-ring halo-ring-outer" />
          <span className="halo-ring halo-ring-inner" />
          <span className="halo-core" />
        </div>

        <div
          ref={orbitTopicsRef}
          className="orbit-topics"
          aria-label="Chọn chủ đề bạn đang quan tâm"
        >
          {heroTopics.map((item, index) => {
            const position = orbitPositions[index]
            return (
              <button
                key={item.label}
                className={`orbit-topic orbit-topic-${index + 1}${activeTopic === index ? ' active' : ''}`}
                type="button"
                aria-pressed={activeTopic === index}
                onClick={() => selectTopic(index)}
                onPointerDown={() => {
                  pauseOrbit()
                  selectTopic(index)
                }}
                onPointerEnter={() => {
                  pauseOrbit()
                  selectTopic(index)
                }}
                onPointerLeave={resumeOrbit}
                onFocus={() => {
                  pauseOrbit()
                  selectTopic(index)
                }}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget))
                    resumeOrbit()
                }}
                style={
                  {
                    '--orbit-x': `${position.x}%`,
                    '--orbit-y': `${position.y}%`,
                    '--orbit-angle': `${position.angle}deg`,
                  } as React.CSSProperties
                }
              >
                <span className="orbit-topic-parallax">
                  <span className="orbit-topic-inner">
                    <span aria-hidden="true" />
                    {item.label}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        <div className="hero-orbit-content" ref={contentRef} aria-live="off">
          <p className="hero-orbit-eyebrow">{topic.eyebrow}</p>
          <h1
            id="hero-title"
            className={`hero-title${activeTopic === 0 ? ' hero-title--anxiety' : ''}`}
          >
            {topic.title}
          </h1>
          <p className="hero-sub">{topic.description}</p>
          <div className="hero-actions">
            <MagneticButton>
              <Link
                href="/assessment/anonymous"
                className="btn btn-primary"
                data-cursor="action"
              >
                Bắt đầu sàng lọc miễn phí
              </Link>
            </MagneticButton>
            <a href="#journey" className="hero-text-link">
              Xem cách hoạt động <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>

        <div className="hero-trust" aria-label="Thông tin nền tảng">
          <div className="trust-item">
            <span className="trust-num">PHQ-9</span>
            <span className="trust-label">chấm điểm bởi Care service</span>
          </div>
          <div className="trust-item">
            <span className="trust-num">Tự chủ</span>
            <span className="trust-label">truy cập theo nhu cầu</span>
          </div>
          <div className="trust-item">
            <span className="trust-num">Ẩn danh</span>
            <span className="trust-label">khi bạn cần riêng tư</span>
          </div>
        </div>
      </div>
    </section>
  )
}
