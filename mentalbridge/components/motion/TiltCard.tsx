'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  type ComponentPropsWithoutRef,
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

type TiltWrapperProps = Omit<
  ComponentPropsWithoutRef<'div'>,
  'children' | 'className'
>

export type TiltCardProps = Omit<HTMLMotionProps<'div'>, 'children'> & {
  children: React.ReactNode
  wrapperClassName?: string
  wrapperProps?: TiltWrapperProps
  /** Optional grouping value exposed on the plain wrapper as data-group. */
  dataGroup?: string
  maxTilt?: number
  hoverY?: number
  hoverScale?: number
  perspective?: number
  disabled?: boolean
}

/**
 * Two transform layers: GSAP can reveal the plain outer wrapper while Motion
 * independently owns the inner hover tilt.
 */
const TiltCard = forwardRef<HTMLDivElement, TiltCardProps>(function TiltCard(
  {
    children,
    wrapperClassName,
    wrapperProps,
    dataGroup,
    maxTilt = 5,
    hoverY = -4,
    hoverScale = 1.012,
    perspective = 900,
    disabled = false,
    className,
    style,
    ...innerProps
  },
  forwardedRef,
) {
  const reducedMotion = useReducedMotion()
  const finePointerRef = useRef(false)
  const boundsRef = useRef<DOMRect | null>(null)
  const rotateXTarget = useMotionValue(0)
  const rotateYTarget = useMotionValue(0)
  const yTarget = useMotionValue(0)
  const scaleTarget = useMotionValue(1)
  const rotateX = useSpring(rotateXTarget, MOTION_SPRINGS.tilt)
  const rotateY = useSpring(rotateYTarget, MOTION_SPRINGS.tilt)
  const y = useSpring(yTarget, MOTION_SPRINGS.tilt)
  const scale = useSpring(scaleTarget, MOTION_SPRINGS.tilt)

  const reset = useCallback(() => {
    boundsRef.current = null
    rotateXTarget.set(0)
    rotateYTarget.set(0)
    yTarget.set(0)
    scaleTarget.set(1)
  }, [rotateXTarget, rotateYTarget, scaleTarget, yTarget])

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

  useEffect(() => {
    const invalidateBounds = () => {
      boundsRef.current = null
    }

    window.addEventListener('scroll', invalidateBounds, { passive: true })
    window.addEventListener('resize', invalidateBounds)
    return () => {
      window.removeEventListener('scroll', invalidateBounds)
      window.removeEventListener('resize', invalidateBounds)
    }
  }, [])

  const {
    style: wrapperStyle,
    onPointerEnter: onWrapperPointerEnter,
    onPointerMove: onWrapperPointerMove,
    onPointerLeave: onWrapperPointerLeave,
    onFocusCapture: onWrapperFocusCapture,
    onBlurCapture: onWrapperBlurCapture,
    ...restWrapperProps
  } = wrapperProps ?? {}

  const canTilt = (event: ReactPointerEvent<HTMLDivElement>) =>
    !disabled &&
    !reducedMotion &&
    finePointerRef.current &&
    event.pointerType !== 'touch'

  return (
    <div
      {...restWrapperProps}
      ref={forwardedRef}
      className={wrapperClassName}
      data-group={dataGroup}
      data-tilt-card=""
      onPointerEnter={(event) => {
        onWrapperPointerEnter?.(event)
        if (!canTilt(event)) return
        boundsRef.current = event.currentTarget.getBoundingClientRect()
        yTarget.set(hoverY)
        scaleTarget.set(hoverScale)
      }}
      onPointerMove={(event) => {
        onWrapperPointerMove?.(event)
        if (!canTilt(event)) return
        const bounds =
          boundsRef.current ?? event.currentTarget.getBoundingClientRect()
        boundsRef.current = bounds
        const clampUnit = (value: number) =>
          Math.max(-0.5, Math.min(0.5, value))
        const horizontal = clampUnit(
          (event.clientX - bounds.left) / bounds.width - 0.5,
        )
        const vertical = clampUnit(
          (event.clientY - bounds.top) / bounds.height - 0.5,
        )
        rotateXTarget.set(vertical * maxTilt * -2)
        rotateYTarget.set(horizontal * maxTilt * 2)
      }}
      onPointerLeave={(event) => {
        onWrapperPointerLeave?.(event)
        boundsRef.current = null
        reset()
      }}
      onFocusCapture={(event) => {
        onWrapperFocusCapture?.(event)
        reset()
      }}
      onBlurCapture={(event) => {
        onWrapperBlurCapture?.(event)
        reset()
      }}
      style={{ perspective, ...wrapperStyle }}
    >
      <motion.div
        {...innerProps}
        className={className}
        data-tilt-card-inner=""
        style={{
          transformStyle: 'preserve-3d',
          ...style,
          rotateX,
          rotateY,
          y,
          scale,
        }}
      >
        {children}
      </motion.div>
    </div>
  )
})

export default TiltCard
