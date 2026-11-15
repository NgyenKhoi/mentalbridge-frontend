import type { ComponentProps } from 'react'
import type Animated from 'react-native-reanimated'
import {
  Easing,
  useReducedMotion,
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
