'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type BreathingIntroProps = { onFinish: () => void }
type IntroLanguage = 'vi' | 'en'

/** Full-screen breathing pause. The parent decides what happens after it closes. */
export function BreathingIntro({ onFinish }: BreathingIntroProps) {
  const [phase, setPhase] = useState<'inhale' | 'exhale'>('inhale')
  const [language, setLanguage] = useState<IntroLanguage>('vi')
  const [leaving, setLeaving] = useState(false)
  const finishedRef = useRef(false)
  const leaveTimerRef = useRef<number | null>(null)
  const reducedMotionRef = useRef(false)

  const finish = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    if (reducedMotionRef.current) {
      onFinish()
      return
    }
    setLeaving(true)
    // Keep the exit brisk: the intro should feel like a welcome, not a gate.
    leaveTimerRef.current = window.setTimeout(onFinish, 420)
  }, [onFinish])

  useEffect(() => {
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    reducedMotionRef.current = reducedMotion
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // A short two-phase cue gives the user the idea without making them wait.
    const phaseTimer = reducedMotion
      ? undefined
      : window.setInterval(() => {
          setPhase((current) => (current === 'inhale' ? 'exhale' : 'inhale'))
        }, 1800)
    const languageTimer = reducedMotion
      ? undefined
      : window.setTimeout(() => setLanguage('en'), 1700)

    // Finish in under four seconds; Skip remains available immediately.
    const finishTimer = window.setTimeout(finish, reducedMotion ? 100 : 3600)

    return () => {
      if (phaseTimer) window.clearInterval(phaseTimer)
      if (languageTimer) window.clearTimeout(languageTimer)
      window.clearTimeout(finishTimer)
      if (leaveTimerRef.current !== null)
        window.clearTimeout(leaveTimerRef.current)
      document.body.style.overflow = previousOverflow
    }
  }, [finish])

  return (
    <div
      className={`breathing-intro${leaving ? ' breathing-intro--leaving' : ''}`}
      data-lenis-prevent=""
      role="dialog"
      aria-modal="true"
      aria-label="A quiet breathing moment / Khoảnh khắc hít thở cùng MentalBridge"
    >
      <div className="breathing-intro__stars" aria-hidden="true" />
      <button className="breathing-intro__skip" type="button" onClick={finish}>
        Bỏ qua
      </button>

      <div className="breathing-intro__content">
        <div className="breathing-intro__orb" aria-hidden="true">
          <span className="breathing-intro__halo" />
          <span className="breathing-intro__ring breathing-intro__ring--outer" />
          <span className="breathing-intro__ring breathing-intro__ring--inner" />
          <span className="breathing-intro__wave">
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
        </div>

        <p className="breathing-intro__kicker" key={`kicker-${language}`}>
          {language === 'vi' ? 'MỘT KHOẢNH KHẮC YÊN' : 'A QUIET MOMENT'}
        </p>
        <p className="breathing-intro__label" key={`label-${language}`}>
          {language === 'vi' ? 'THỞ CHẬM LẠI' : 'BREATHE SLOWLY'}
        </p>
        <div
          className="breathing-intro__phase"
          aria-live="polite"
          aria-atomic="true"
        >
          <span key={`${language}-${phase}`}>
            <strong>
              {language === 'vi'
                ? phase === 'inhale'
                  ? 'Hít vào'
                  : 'Thở ra'
                : phase === 'inhale'
                  ? 'Inhale gently'
                  : 'Exhale softly'}
            </strong>
          </span>
        </div>
        <p className="breathing-intro__question" key={`question-${language}`}>
          {language === 'vi' ? 'Tìm lại khoảng bình yên.' : 'Find your calm.'}
        </p>
      </div>
    </div>
  )
}

/** Shows the intro again whenever the home page is loaded. */
export default function Preloader() {
  const [visible, setVisible] = useState(true)
  const finishFrameRef = useRef<number | null>(null)

  const handleFinish = useCallback(() => {
    setVisible(false)
    finishFrameRef.current = window.requestAnimationFrame(() => {
      finishFrameRef.current = null
      window.dispatchEvent(new Event('mentalbridge:preloader-finished'))
    })
  }, [])

  useEffect(
    () => () => {
      if (finishFrameRef.current !== null) {
        window.cancelAnimationFrame(finishFrameRef.current)
      }
    },
    [],
  )

  return visible ? <BreathingIntro onFinish={handleFinish} /> : null
}
