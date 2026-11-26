import { useEffect, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import type { GuideStep } from './guide-steps'
import { spotlightRect, tooltipLayout, type TourRect } from './tour-layout'

const DIM = 'rgba(0,0,0,0.65)'
const GREEN = '#1F4D45'
const ACCENT = '#CBEDAA'
const RADIUS = 16

function useReducedMotion() {
  const [reduced, setReduced] = useState(true)
  useEffect(() => {
    let active = true
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active) setReduced(value)
      })
      .catch(() => undefined)
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduced,
    )
    return () => {
      active = false
      subscription.remove()
    }
  }, [])
  return reduced
}

export function TourOverlay({
  step,
  index,
  count,
  rect,
  viewport,
  unavailable,
  onBack,
  onNext,
  onSkip,
  onRetry,
}: {
  step: GuideStep
  index: number
  count: number
  rect: TourRect | null
  viewport: { width: number; height: number; top: number; bottom: number }
  unavailable: boolean
  onBack: () => void
  onNext: () => void
  onSkip: () => void
  onRetry: () => void
}) {
  const reduced = useReducedMotion()
  const heading = useRef<Text>(null)
  const cardKey = `${index}:${viewport.width}:${viewport.height}`
  const [cardMeasurement, setCardMeasurement] = useState({
    key: '',
    height: 300,
  })
  const cardHeight =
    cardMeasurement.key === cardKey ? cardMeasurement.height : 300
  const [motion] = useState(() => new Animated.ValueXY())
  const [size] = useState(() => new Animated.ValueXY())
  const [card] = useState(() => new Animated.ValueXY())
  const [arrow] = useState(() => new Animated.ValueXY())
  const [pulse] = useState(() => new Animated.Value(0))
  const initialized = useRef(false)
  const previousViewport = useRef(viewport)
  const hasTarget = rect !== null
  const hole = rect
    ? spotlightRect(rect, viewport.width, viewport.height)
    : null
  const fallback = {
    x: viewport.width / 2 - 1,
    y: viewport.height - viewport.bottom,
    width: 2,
    height: 0,
  }
  const layout = tooltipLayout(
    hole ?? fallback,
    viewport,
    cardHeight,
    step.placement,
  )
  const hx = hole?.x ?? 0,
    hy = hole?.y ?? 0,
    hw = hole?.width ?? 0,
    hh = hole?.height ?? 0
  const cardPadding = layout.height < 240 ? 12 : 18
  useEffect(() => {
    if (!rect) return
    const resized =
      previousViewport.current.width !== viewport.width ||
      previousViewport.current.height !== viewport.height
    previousViewport.current = viewport
    const duration = reduced || !initialized.current || resized ? 0 : 300
    const animation = Animated.parallel([
      Animated.timing(motion, {
        toValue: { x: hx, y: hy },
        duration,
        useNativeDriver: false,
      }),
      Animated.timing(size, {
        toValue: { x: hw, y: hh },
        duration,
        useNativeDriver: false,
      }),
      Animated.timing(card, {
        toValue: { x: layout.x, y: layout.y },
        duration,
        useNativeDriver: false,
      }),
      Animated.timing(arrow, {
        toValue: { x: layout.arrowX, y: layout.arrowY },
        duration,
        useNativeDriver: false,
      }),
    ])
    initialized.current = true
    animation.start()
    return () => animation.stop()
  }, [
    hx,
    hy,
    hw,
    hh,
    layout.x,
    layout.y,
    layout.arrowX,
    layout.arrowY,
    motion,
    size,
    card,
    arrow,
    reduced,
    rect,
    viewport,
  ])
  useEffect(() => {
    pulse.setValue(0)
    if (reduced || !hasTarget) return
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    )
    animation.start()
    return () => animation.stop()
  }, [pulse, reduced, hasTarget])
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (heading.current)
        AccessibilityInfo.sendAccessibilityEvent?.(heading.current, 'focus')
    })
    return () => cancelAnimationFrame(frame)
  }, [index, unavailable, hasTarget])
  const bottom = Animated.add(motion.y, size.y)
  const right = Animated.add(motion.x, size.x)
  const vertical = layout.side === 'top' || layout.side === 'bottom'
  const rotation = {
    top: '180deg',
    bottom: '0deg',
    left: '90deg',
    right: '-90deg',
  }[layout.side]
  const body = (
    <>
      <ScrollView
        style={{ flexShrink: 1 }}
        contentContainerStyle={{ gap: 8 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text
          ref={heading}
          accessibilityRole="header"
          accessibilityLabel={`Bước ${index + 1} trên ${count}. ${step.title}`}
          style={s.title}
        >
          {step.title}
        </Text>
        <Text style={s.description}>
          {rect
            ? step.description
            : unavailable
              ? 'Vùng này chưa hiển thị. Bạn có thể thử lại, tiếp tục hoặc xem lại hướng dẫn sau.'
              : 'Đang chuyển đến vị trí hướng dẫn…'}
        </Text>
        {unavailable && !rect && (
          <Pressable
            accessibilityRole="button"
            onPress={onRetry}
            style={s.retry}
          >
            <Text style={s.backText}>Tìm lại vị trí</Text>
          </Pressable>
        )}
      </ScrollView>
      <View style={s.progress}>
        <Text accessibilityLiveRegion="polite" style={s.counter}>
          Bước {index + 1}/{count}
        </Text>
        <View
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={s.dots}
        >
          {Array.from({ length: count }, (_, i) => (
            <View key={i} style={[s.dot, i === index && s.activeDot]} />
          ))}
        </View>
      </View>
      <View style={s.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          accessibilityState={{ disabled: index === 0 }}
          disabled={index === 0}
          onPress={onBack}
          style={[s.back, index === 0 && { opacity: 0.4 }]}
        >
          <Text style={s.backText}>Quay lại</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={index === count - 1 ? 'Hoàn tất' : 'Tiếp tục'}
          onPress={onNext}
          style={({ pressed }) => [s.next, pressed && { opacity: 0.8 }]}
        >
          <Text style={s.nextText}>
            {index === count - 1 ? 'Hoàn tất' : 'Tiếp tục'}
          </Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Bỏ qua hướng dẫn"
        onPress={onSkip}
        style={s.skip}
      >
        <Text style={s.skipText}>Bỏ qua hướng dẫn</Text>
      </Pressable>
    </>
  )
  return (
    <View
      accessibilityViewIsModal
      importantForAccessibility="yes"
      style={StyleSheet.absoluteFill}
      testID="tour-overlay"
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {!hole ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: DIM }]} />
        ) : (
          <>
            <Animated.View
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: viewport.width,
                height: motion.y,
                backgroundColor: DIM,
              }}
            />
            <Animated.View
              style={{
                position: 'absolute',
                left: 0,
                top: motion.y,
                width: motion.x,
                height: size.y,
                backgroundColor: DIM,
              }}
            />
            <Animated.View
              style={{
                position: 'absolute',
                left: right,
                top: motion.y,
                width: Animated.subtract(viewport.width, right),
                height: size.y,
                backgroundColor: DIM,
              }}
            />
            <Animated.View
              style={{
                position: 'absolute',
                left: 0,
                top: bottom,
                width: viewport.width,
                height: Animated.subtract(viewport.height, bottom),
                backgroundColor: DIM,
              }}
            />
            <Animated.View
              testID="tour-spotlight"
              style={{
                position: 'absolute',
                left: motion.x,
                top: motion.y,
                width: size.x,
                height: size.y,
              }}
            >
              {[0, 1, 2, 3].map((corner) => (
                <View
                  key={corner}
                  style={{
                    position: 'absolute',
                    width: RADIUS,
                    height: RADIUS,
                    overflow: 'hidden',
                    ...(corner < 2 ? { top: 0 } : { bottom: 0 }),
                    ...(corner % 2 === 0 ? { left: 0 } : { right: 0 }),
                    transform: [{ rotate: `${[0, 90, 270, 180][corner]}deg` }],
                  }}
                >
                  <View
                    style={{
                      position: 'absolute',
                      left: -RADIUS,
                      top: -RADIUS,
                      width: RADIUS * 4,
                      height: RADIUS * 4,
                      borderRadius: RADIUS * 2,
                      borderWidth: RADIUS,
                      borderColor: DIM,
                    }}
                  />
                </View>
              ))}
              <Animated.View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    borderWidth: 2,
                    borderRadius: RADIUS,
                    borderColor: ACCENT,
                    opacity: pulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.7, 1],
                    }),
                    boxShadow: '0 0 16px rgba(203,237,170,0.6)',
                  },
                ]}
              />
            </Animated.View>
          </>
        )}
        {hole && (
          <Animated.View
            testID="tour-arrow"
            style={{
              position: 'absolute',
              left: Animated.subtract(arrow.x, 9),
              top: Animated.subtract(arrow.y, 9),
            }}
          >
            <Animated.View
              style={{
                transform: [
                  vertical
                    ? {
                        translateY: pulse.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, layout.side === 'top' ? 4 : -4],
                        }),
                      }
                    : {
                        translateX: pulse.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, layout.side === 'left' ? 4 : -4],
                        }),
                      },
                  { rotate: rotation },
                ],
              }}
            >
              <View style={s.arrow} />
            </Animated.View>
          </Animated.View>
        )}
      </View>
      <Animated.View
        style={[
          s.card,
          {
            left: rect ? card.x : layout.x,
            top: rect ? card.y : layout.y,
            width: layout.width,
            maxHeight: layout.height,
            padding: cardPadding,
          },
        ]}
      >
        <View
          onLayout={(event) => {
            const next = event.nativeEvent.layout.height + cardPadding * 2
            if (next > cardPadding * 2)
              setCardMeasurement((current) =>
                current.key === cardKey && Math.abs(current.height - next) <= 1
                  ? current
                  : { key: cardKey, height: next },
              )
          }}
          style={{ gap: layout.height < 240 ? 6 : 12, flexShrink: 1 }}
        >
          {body}
        </View>
      </Animated.View>
    </View>
  )
}

const s = StyleSheet.create({
  card: {
    position: 'absolute',
    padding: 18,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    boxShadow: '0 12px 32px rgba(0,0,0,0.22)',
  },
  title: { color: GREEN, fontSize: 20, lineHeight: 26, fontWeight: '700' },
  description: { color: '#46564E', fontSize: 15, lineHeight: 22 },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counter: { fontSize: 12, color: '#52604F' },
  dots: { flexDirection: 'row', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#DCE6DF' },
  activeDot: { width: 18, backgroundColor: GREEN },
  actions: { flexDirection: 'row', gap: 10 },
  back: {
    flex: 1,
    minHeight: 46,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#DCE6DF',
  },
  next: {
    flex: 1,
    minHeight: 46,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 13,
    backgroundColor: GREEN,
  },
  backText: { color: GREEN, fontWeight: '600', fontSize: 14 },
  nextText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  skip: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  skipText: { color: '#52604F', fontSize: 13 },
  retry: { minHeight: 44, justifyContent: 'center' },
  arrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderBottomWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: ACCENT,
  },
})
