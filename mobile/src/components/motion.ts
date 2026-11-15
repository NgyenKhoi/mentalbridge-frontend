import type { ComponentProps } from 'react'
import type Animated from 'react-native-reanimated'
import {
  Easing,
  useReducedMotion,
  withDelay,
  withTiming,
  type EntryExitAnimationFunction,
} from 'react-native-reanimated'

export const emphasisEasing = Easing.bezier(0.16, 1, 0.3, 1)

/** FadeIn 200 ms + translateY 8 -> 0. */
export const revealEntering: EntryExitAnimationFunction = () => {
  'worklet'
  const timing = { duration: 200 }
  return {
    initialValues: { opacity: 0, transform: [{ translateY: 8 }] },
    animations: {
      opacity: withTiming(1, timing),
      transform: [{ translateY: withTiming(0, timing) }],
    },
  }
}

/** revealEntering after `step * 40` ms. */
const staggeredReveal = (step: number): EntryExitAnimationFunction => {
  const delay = step * 40
  return () => {
    'worklet'
    const timing = { duration: 200 }
    return {
      initialValues: { opacity: 0, transform: [{ translateY: 8 }] },
      animations: {
        opacity: withDelay(delay, withTiming(1, timing)),
        transform: [{ translateY: withDelay(delay, withTiming(0, timing)) }],
      },
    }
  }
}
// Steps past the fifth share the last delay, so a long screen never waits.
const staggeredReveals = [0, 1, 2, 3, 4, 5].map(staggeredReveal)

type ViewMotion = Pick<
  ComponentProps<typeof Animated.View>,
  'entering' | 'exiting' | 'layout'
>

/** Spread onto an Animated.View: the animations, or nothing under reduced motion. */
export function useMotionProps(props: ViewMotion): ViewMotion {
  const reduceMotion = useReducedMotion()
  return reduceMotion ? {} : props
}

export const useRevealProps = () => useMotionProps({ entering: revealEntering })

/** Entrance for the `step`-th block of a screen, 40 ms after the previous one. */
export function useStaggerProps(step: number, enabled = true): ViewMotion {
  const motion = useMotionProps({
    entering:
      staggeredReveals[Math.min(step, staggeredReveals.length - 1)] ??
      revealEntering,
  })
  return enabled ? motion : {}
}
