import { useFocusEffect } from 'expo-router'
import { useCallback } from 'react'
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  StyleSheet,
  Text,
  useAnimatedValue,
  View,
} from 'react-native'

function useAuthMotion(orbits = true) {
  const breath = useAnimatedValue(0)
  const clockwise = useAnimatedValue(0)
  const counterclockwise = useAnimatedValue(0)

  useFocusEffect(
    useCallback(() => {
      let focused = true
      let reduced = true
      let foreground = AppState.currentState === 'active'
      const cycle = (value: Animated.Value, duration: number) =>
        Animated.loop(
          Animated.timing(value, {
            toValue: 1,
            duration,
            easing: Easing.linear,
            useNativeDriver: true,
            isInteraction: false,
          }),
        )
      const motion = Animated.parallel([
        cycle(breath, 8000),
        ...(orbits
          ? [cycle(clockwise, 16000), cycle(counterclockwise, 22000)]
          : []),
      ])
      const sync = () => {
        motion.stop()
        breath.setValue(0)
        clockwise.setValue(0)
        counterclockwise.setValue(0)
        if (focused && foreground && !reduced) motion.start()
      }
      let preferenceChanged = false
      void AccessibilityInfo.isReduceMotionEnabled()
        .then((value) => {
          if (!focused || preferenceChanged) return
          reduced = value
          sync()
        })
        .catch(() => undefined)
      const preference = AccessibilityInfo.addEventListener(
        'reduceMotionChanged',
        (value) => {
          preferenceChanged = true
          reduced = value
          sync()
        },
      )
      const appState = AppState.addEventListener('change', (state) => {
        foreground = state === 'active'
        sync()
      })
      return () => {
        focused = false
        motion.stop()
        preference.remove()
        appState.remove()
      }
    }, [breath, clockwise, counterclockwise, orbits]),
  )

  const scale = breath.interpolate({
    inputRange: [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1],
    outputRange: [0.82, 0.85, 0.935, 1.02, 1.05, 1.02, 0.935, 0.85, 0.82],
  })
  return { scale, clockwise, counterclockwise }
}

export function AuthPulseIcon({ glyph }: { glyph: string }) {
  const { scale } = useAuthMotion(false)
  return (
    <Animated.View
      aria-hidden
      style={[s.pulseIcon, { transform: [{ scale }] }]}
    >
      <Text style={s.pulseGlyph}>{glyph}</Text>
    </Animated.View>
  )
}

export function SignInBreathing({
  fonts,
  compactSize,
}: {
  fonts: boolean
  compactSize?: number
}) {
  const { scale, clockwise, counterclockwise } = useAuthMotion()
  const compact = compactSize !== undefined
  return (
    <View style={[s.feature, compact && { width: compactSize }]}>
      <View style={s.stage}>
        <View aria-hidden style={[s.ring, s.outer]} />
        <View aria-hidden style={[s.ring, s.middle]} />
        <View aria-hidden style={[s.ring, s.inner]} />
        <Animated.View
          aria-hidden
          style={[
            s.orbit,
            s.outer,
            {
              transform: [
                {
                  rotate: clockwise.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg'],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={s.goldDot} />
        </Animated.View>
        <Animated.View
          aria-hidden
          style={[
            s.orbit,
            s.inner,
            {
              transform: [
                {
                  rotate: counterclockwise.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '-360deg'],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={s.greenDot} />
        </Animated.View>
        <Animated.View style={[s.orb, { transform: [{ scale }] }]}>
          <Text
            maxFontSizeMultiplier={compact ? 1.15 : undefined}
            style={[s.inhale, compact && s.compactInhale, fonts && s.italic]}
          >
            Hít vào…
          </Text>
          {!compact && <Text style={s.relax}>THƯ GIÃN</Text>}
        </Animated.View>
        {!compact && (
          <>
            <View style={[s.badge, s.topBadge]}>
              <Text aria-hidden style={s.badgeIcon}>
                ✓
              </Text>
              <View style={s.badgeCopy}>
                <Text style={s.badgeTitle}>An toàn &amp; bảo mật</Text>
                <Text style={s.badgeHint}>Phiên đăng nhập riêng tư</Text>
              </View>
            </View>
            <View style={[s.badge, s.bottomBadge]}>
              <Text aria-hidden style={s.badgeIcon}>
                ◎
              </Text>
              <View style={s.badgeCopy}>
                <Text style={s.badgeTitle}>Không gian riêng</Text>
                <Text style={s.badgeHint}>Theo quyền tài khoản</Text>
              </View>
            </View>
          </>
        )}
      </View>
      {!compact && (
        <>
          <Text style={[s.quote, fonts && s.italic]}>
            “Bước đầu tiên không cần phải lớn, chỉ cần bạn dám bắt đầu.”
          </Text>
          <Text style={s.credit}>— MentalBridge</Text>
        </>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  pulseIcon: {
    width: 65,
    height: 65,
    borderRadius: 22,
    backgroundColor: '#1B493B',
    experimental_backgroundImage:
      'radial-gradient(circle at 35% 30%, #53897B, #1B493B 78%)',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 9px 22px rgba(24,63,52,.22)',
  },
  pulseGlyph: { color: '#E8F6EF', fontSize: 30 },
  feature: { alignItems: 'center', width: '100%', gap: 6 },
  stage: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 285,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    aspectRatio: 1,
    borderWidth: 1,
    borderColor: '#C5DDD3',
    borderRadius: 999,
  },
  outer: { width: '85%' },
  middle: { width: '74%' },
  inner: { width: '65%' },
  orbit: {
    position: 'absolute',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  goldDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D6A95F' },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#5B9D87',
  },
  orb: {
    width: '61%',
    aspectRatio: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: '#275747',
    experimental_backgroundImage:
      'radial-gradient(circle at 35% 30%, #4a8a7d, #1e4a43 78%)',
    boxShadow: '0px 12px 28px rgba(30,74,67,.22)',
  },
  inhale: { color: '#FFF', fontSize: 19, fontStyle: 'italic' },
  compactInhale: { fontSize: 10, textAlign: 'center' },
  relax: { color: '#D6ECE3', fontSize: 11, letterSpacing: 1.7 },
  italic: { fontFamily: 'ResourceSerifItalic', fontStyle: 'normal' },
  badge: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '85%',
    padding: 9,
    backgroundColor: '#FCFEFD',
    borderRadius: 13,
  },
  topBadge: { top: '4%', left: '3%' },
  bottomBadge: { bottom: '5%', right: '2%' },
  badgeCopy: { flexShrink: 1 },
  badgeIcon: { fontSize: 15, color: '#2A6954' },
  badgeTitle: { fontSize: 12, fontWeight: '700', color: '#18352C' },
  badgeHint: { fontSize: 11, lineHeight: 15, color: '#4E685D' },
  quote: {
    paddingHorizontal: 8,
    textAlign: 'center',
    color: '#27483D',
    fontSize: 16,
    lineHeight: 23,
    fontStyle: 'italic',
  },
  credit: { color: '#416458', fontSize: 12 },
})
