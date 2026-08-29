'use client'

import { forwardRef, type CSSProperties, useEffect, useRef } from 'react'

type StarfieldBackgroundProps = {
  className?: string
}

type Star = {
  x: number
  y: number
  radius: number
  baseAlpha: number
  twinkleSpeed: number
  phase: number
  driftX: number
  driftY: number
  depth: number
  glow: boolean
}

const particles = [
  { top: '16%', left: '18%', color: '#3D7A6E', animationDelay: '0s' },
  { top: '26%', left: '74%', color: '#E1A651', animationDelay: '.6s' },
  { top: '68%', left: '13%', color: '#9A8CAE', animationDelay: '1.2s' },
  { top: '80%', left: '60%', color: '#C77B5C', animationDelay: '.3s' },
  { top: '42%', left: '88%', color: '#3D7A6E', animationDelay: '1.6s' },
] as const

// Main background motion speed, line visibility, and pointer parallax strength.
const STAR_SPEED_MULTIPLIER = 10
const STAR_LINK_DISTANCE = 190
const STAR_LINK_ALPHA = 0.32
const STAR_PARALLAX_X = 84
const STAR_PARALLAX_Y = 62

/** Canvas starfield sized to its parent rather than the viewport. */
const StarfieldBackground = forwardRef<HTMLDivElement, StarfieldBackgroundProps>(function StarfieldBackground(
  { className = '' },
  forwardedRef,
) {
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const root = rootRef.current
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!root || !canvas || !context) return

    let width = 1
    let height = 1
    let dpr = 1
    let frame = 0
    let stars: Star[] = []
    let pointerX = 0
    let pointerY = 0
    let targetPointerX = 0
    let targetPointerY = 0
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reduceMotion = motionPreference.matches
    const speed = 1

    const resize = () => {
      const bounds = root.getBoundingClientRect()
      width = Math.max(1, bounds.width)
      height = Math.max(1, bounds.height)
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`

      // Fewer stars on small screens keeps the O(n²) constellation pass light.
      // Keep the decorative constellation pass bounded so it never competes
      // with page scrolling for the main thread.
      const compact = width < 768
      const density = compact ? 11000 : 9000
      const minimum = compact ? 36 : 64
      const maximum = compact ? 90 : 180
      const count = Math.max(minimum, Math.min(maximum, Math.floor((width * height) / density)))
      stars = Array.from({ length: count }, () => {
        const glow = Math.random() < 0.08
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          radius: glow ? Math.random() * 1.6 + 1.6 : Math.random() * 1.1 + 0.4,
          baseAlpha: Math.random() * 0.32 + 0.18,
          twinkleSpeed: (Math.random() * 0.03 + 0.015) * STAR_SPEED_MULTIPLIER * speed,
          phase: Math.random() * Math.PI * 2,
          driftX: (Math.random() - 0.5) * 0.18 * STAR_SPEED_MULTIPLIER * speed,
          driftY: (Math.random() - 0.5) * 0.18 * STAR_SPEED_MULTIPLIER * speed,
          depth: Math.random() * 0.75 + 0.25,
          glow,
        }
      })
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (reduceMotion) return
      if (event.pointerType === 'touch') return
      const bounds = root.getBoundingClientRect()
      const inside = event.clientX >= bounds.left && event.clientX <= bounds.right
        && event.clientY >= bounds.top && event.clientY <= bounds.bottom
      if (!inside) {
        targetPointerX = 0
        targetPointerY = 0
        return
      }
      targetPointerX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2
      targetPointerY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2
    }

    let inView = true
    let documentVisible = document.visibilityState === 'visible'
    let lastDraw = 0
    let pointerListening = false
    const frameInterval = 1000 / 60

    const updatePointerListener = (enabled: boolean) => {
      if (enabled === pointerListening) return
      pointerListening = enabled
      if (enabled) window.addEventListener('pointermove', handlePointerMove, { passive: true })
      else window.removeEventListener('pointermove', handlePointerMove)
    }

    const draw = (timestamp = 0) => {
      frame = 0
      if (!inView || !documentVisible) return
      if (timestamp - lastDraw < frameInterval) {
        frame = window.requestAnimationFrame(draw)
        return
      }
      lastDraw = timestamp

      // Smooth parallax follows the pointer without snapping the canvas.
      pointerX += (targetPointerX - pointerX) * 0.12
      pointerY += (targetPointerY - pointerY) * 0.12
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.clearRect(0, 0, width, height)

      // Subtle constellation links, matching the original HTML effect.
      context.lineWidth = 1.15
      for (let i = 0; i < stars.length; i += 1) {
        for (let j = i + 1; j < stars.length; j += 1) {
          const first = stars[i]
          const second = stars[j]
          const firstX = first.x + pointerX * STAR_PARALLAX_X * first.depth
          const firstY = first.y + pointerY * STAR_PARALLAX_Y * first.depth
          const secondX = second.x + pointerX * STAR_PARALLAX_X * second.depth
          const secondY = second.y + pointerY * STAR_PARALLAX_Y * second.depth
          const dx = firstX - secondX
          const dy = firstY - secondY
          const distanceSquared = dx * dx + dy * dy
          if (distanceSquared >= STAR_LINK_DISTANCE * STAR_LINK_DISTANCE) continue
          const distance = Math.sqrt(distanceSquared)
          context.strokeStyle = `rgba(30,74,67,${(1 - distance / STAR_LINK_DISTANCE) * STAR_LINK_ALPHA})`
          context.beginPath()
          context.moveTo(firstX, firstY)
          context.lineTo(secondX, secondY)
          context.stroke()
        }
      }

      for (const star of stars) {
        star.phase += star.twinkleSpeed
        const alpha = Math.max(0, Math.min(1, star.baseAlpha + Math.sin(star.phase) * 0.35))
        star.x += star.driftX
        star.y += star.driftY
        if (star.x < -5) star.x = width + 5
        if (star.x > width + 5) star.x = -5
        if (star.y < -5) star.y = height + 5
        if (star.y > height + 5) star.y = -5

        if (star.glow) {
          const drawX = star.x + pointerX * STAR_PARALLAX_X * star.depth
          const drawY = star.y + pointerY * STAR_PARALLAX_Y * star.depth
          const glow = context.createRadialGradient(drawX, drawY, 0, drawX, drawY, star.radius * 5)
          glow.addColorStop(0, `rgba(61,122,110,${alpha * 0.45})`)
          glow.addColorStop(1, 'rgba(61,122,110,0)')
          context.fillStyle = glow
          context.beginPath()
          context.arc(drawX, drawY, star.radius * 5, 0, Math.PI * 2)
          context.fill()
        }

        const drawX = star.x + pointerX * STAR_PARALLAX_X * star.depth
        const drawY = star.y + pointerY * STAR_PARALLAX_Y * star.depth
        context.beginPath()
        context.arc(drawX, drawY, star.radius, 0, Math.PI * 2)
        context.fillStyle = `rgba(30,74,67,${alpha * 0.62})`
        context.fill()
      }

      if (!reduceMotion) frame = window.requestAnimationFrame(draw)
    }

    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null
    const visibilityObserver = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(([entry]) => {
        inView = Boolean(entry?.isIntersecting)
        if (!reduceMotion && inView && documentVisible && !frame) frame = window.requestAnimationFrame(draw)
        if (!inView && frame) {
          window.cancelAnimationFrame(frame)
          frame = 0
        }
      }, { threshold: 0.01 })
      : null
    const handleDocumentVisibility = () => {
      documentVisible = document.visibilityState === 'visible'
      if (!reduceMotion && inView && documentVisible && !frame) frame = window.requestAnimationFrame(draw)
      if (!documentVisible && frame) {
        window.cancelAnimationFrame(frame)
        frame = 0
      }
    }
    const handleMotionPreference = () => {
      reduceMotion = motionPreference.matches
      updatePointerListener(!reduceMotion)
      if (reduceMotion) {
        if (frame) window.cancelAnimationFrame(frame)
        frame = 0
        pointerX = 0
        pointerY = 0
        targetPointerX = 0
        targetPointerY = 0
        const now = performance.now()
        lastDraw = now - frameInterval
        draw(now)
      } else if (inView && documentVisible && !frame) {
        frame = window.requestAnimationFrame(draw)
      }
    }
    observer?.observe(root)
    visibilityObserver?.observe(root)
    window.addEventListener('resize', resize)
    updatePointerListener(!reduceMotion)
    motionPreference.addEventListener('change', handleMotionPreference)
    document.addEventListener('visibilitychange', handleDocumentVisibility)
    resize()
    draw()

    return () => {
      window.cancelAnimationFrame(frame)
      observer?.disconnect()
      visibilityObserver?.disconnect()
      window.removeEventListener('resize', resize)
      updatePointerListener(false)
      motionPreference.removeEventListener('change', handleMotionPreference)
      document.removeEventListener('visibilitychange', handleDocumentVisibility)
    }
  }, [])

  return (
    <div
      ref={node => {
        rootRef.current = node
        if (typeof forwardedRef === 'function') forwardedRef(node)
        else if (forwardedRef) forwardedRef.current = node
      }}
      className={`starfield-background ${className}`.trim()}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="starfield-background__canvas" />
      <div className="starfield-background__glow" />
      {particles.map(particle => (
        <span
          key={`${particle.top}-${particle.left}`}
          className="starfield-background__particle"
          style={particle as CSSProperties}
        />
      ))}
    </div>
  )
})

export default StarfieldBackground
