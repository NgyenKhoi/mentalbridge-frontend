import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

export function PressableScale({
  scaleTo = 0.96,
  style,
  onPressIn,
  onPressOut,
  ...props
}: Readonly<
  Omit<PressableProps, 'style'> & {
    scaleTo?: number
    style?: StyleProp<ViewStyle>
  }
>) {
  const reduceMotion = useReducedMotion()
  const scale = useSharedValue(1)
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))
  const to = (value: number) => {
    if (!reduceMotion) scale.set(withTiming(value, { duration: 120 }))
  }
  return (
    <AnimatedPressable
      {...props}
      style={[style, animated]}
      onPressIn={(event) => {
        to(scaleTo)
        onPressIn?.(event)
      }}
      onPressOut={(event) => {
        to(1)
        onPressOut?.(event)
      }}
    />
  )
}
