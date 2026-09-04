'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  type HTMLMotionProps,
} from 'framer-motion'
import { MOTION_SPRINGS } from '@/lib/animations/config'

const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)'

export type MagneticButtonProps = Omit<HTMLMotionProps<'span'>, 'children'> & {
  children: React.ReactNode
  /** Fraction of the pointer-to-center distance applied to the wrapper. */
  strength?: number
  /** Maximum translation, in CSS pixels, on either axis. */
  maxOffset?: number
  disabled?: boolean
}

/**
 * A semantics-neutral magnetic wrapper. The interactive child keeps its native
 * focus behavior while this span owns only the decorative pointer transform.
 */
const MagneticButton = forwardRef<HTMLSpanElement, MagneticButtonProps>(
  function MagneticButton(
    {
      children,
      strength = 0.22,
      maxOffset = 18,
      disabled = false,
      style,
      onPointerMove,
      onPointerLeave,
      onFocusCapture,
      onBlurCapture,
      ...props
    },
    forwardedRef,
  ) {
    const reducedMotion = useReducedMotion()
    const finePointerRef = useRef(false)
    const targetX = useMotionValue(0)
    const targetY = useMotionValue(0)
    const x = useSpring(targetX, MOTION_SPRINGS.magnetic)
    const y = useSpring(targetY, MOTION_SPRINGS.magnetic)

    const reset = useCallback(() => {
      targetX.set(0)
      targetY.set(0)
    }, [targetX, targetY])

    useEffect(() => {
      const media = window.matchMedia(FINE_POINTER_QUERY)
      const update = () => {
        finePointerRef.current = media.matches
        if (!media.matches) reset()
      }

      update()
      media.addEventListener('change', update)
      return () => media.removeEventListener('change', update)
    }, [reset])

    useEffect(() => {
      if (reducedMotion || disabled) reset()
    }, [disabled, reducedMotion, reset])

    const handlePointerMove = (event: ReactPointerEvent<HTMLSpanElement>) => {
      onPointerMove?.(event)
      if (
        disabled ||
        reducedMotion ||
        !finePointerRef.current ||
        event.pointerType === 'touch'
      )
        return

      const bounds = event.currentTarget.getBoundingClientRect()
      const distanceX = event.clientX - (bounds.left + bounds.width / 2)
      const distanceY = event.clientY - (bounds.top + bounds.height / 2)
      const clamp = (value: number) =>
        Math.max(-maxOffset, Math.min(maxOffset, value))

      targetX.set(clamp(distanceX * strength))
      targetY.set(clamp(distanceY * strength))
    }

    const handlePointerLeave = (event: ReactPointerEvent<HTMLSpanElement>) => {
      onPointerLeave?.(event)
      reset()
    }

    return (
      <motion.span
        {...props}
        ref={forwardedRef}
        data-magnetic-button=""
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onFocusCapture={(event) => {
          onFocusCapture?.(event)
          reset()
        }}
        onBlurCapture={(event) => {
          onBlurCapture?.(event)
          reset()
        }}
        style={{
          display: 'inline-flex',
          ...style,
          x,
          y,
        }}
      >
        {children}
      </motion.span>
    )
  },
)

export default MagneticButton
