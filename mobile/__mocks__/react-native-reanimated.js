/* global jest */
// Jest cannot load the native worklets runtime. This stub keeps the animation API
// shape (builders, shared values, reduced-motion flag) so components render; it
// does not run animations. Override reduced motion with
// require('react-native-reanimated').useReducedMotion.mockReturnValue(true).
const React = require('react')
const { View, Text, ScrollView } = require('react-native')

const builder = new Proxy(() => builder, { get: () => builder })

module.exports = {
  __esModule: true,
  default: {
    View,
    Text,
    ScrollView,
    createAnimatedComponent: (component) => component,
  },
  useReducedMotion: jest.fn(() => false),
  useSharedValue: (initial) =>
    React.useRef({
      value: initial,
      get() {
        return this.value
      },
      set(next) {
        this.value = next
      },
    }).current,
  useAnimatedStyle: (factory) => factory(),
  // Records the completion callback instead of running it, so tests finish an animation on demand.
  withTiming: jest.fn((value) => value),
  runOnJS: (fn) => fn,
  withDelay: (_delay, value) => value,
  Easing: builder,
  FadeIn: builder,
  FadeOut: builder,
  LinearTransition: builder,
}
