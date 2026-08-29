import type { LenisOptions } from 'lenis'

export const PUBLIC_SMOOTH_ROUTES: ReadonlySet<string> = new Set([
  '/',
  '/privacy',
  '/terms',
])

export const exponentialEase = (time: number) =>
  Math.min(1, 1.001 - Math.pow(2, -10 * time))

export const LENIS_OPTIONS = {
  duration: 1.15,
  easing: exponentialEase,
  smoothWheel: true,
  wheelMultiplier: 0.9,
  touchMultiplier: 1,
  syncTouch: false,
  anchors: { offset: -76 },
  autoRaf: false,
  stopInertiaOnNavigate: true,
  respectReducedMotion: true,
} satisfies LenisOptions

export const GSAP_EASE = {
  enter: 'power3.out',
  exit: 'power2.in',
  inOut: 'power3.inOut',
  emphasis: 'expo.out',
} as const

export const GSAP_DURATION = {
  fast: 0.28,
  medium: 0.62,
  reveal: 0.82,
  slow: 1.1,
} as const

export const GSAP_STAGGER = {
  tight: 0.05,
  default: 0.075,
  relaxed: 0.1,
} as const

export const MOTION_SPRINGS = {
  magnetic: {
    type: 'spring',
    stiffness: 180,
    damping: 18,
    mass: 0.35,
  },
  tilt: {
    type: 'spring',
    stiffness: 240,
    damping: 24,
    mass: 0.5,
  },
  cursor: {
    type: 'spring',
    stiffness: 170,
    damping: 26,
    mass: 0.3,
  },
} as const
