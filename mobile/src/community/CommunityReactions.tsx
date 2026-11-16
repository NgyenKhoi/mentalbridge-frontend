import { useEffect, useRef, useState } from 'react'
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
} from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { emphasisEasing } from '@/components/motion'
import { PressableScale } from '@/components/PressableScale'
import { Txt } from '@/theme/dashboard'
import { spacing } from '@/theme/tokens'

import type { Reaction } from './community-contract'
import { reactionKind, reactionKinds } from './community-reactions'
import { communityColors } from './community-theme'

const EMPTY_HEART = '🤍'
const TRAY_ITEM = 46
const TRAY_PAD = 8
const TRAY_WIDTH = TRAY_ITEM * reactionKinds.length + TRAY_PAD * 2
const TRAY_HEIGHT = TRAY_ITEM + 12

/** Scale pop when `key` becomes a new non-null value (not on first render, not under reduced motion). */
export function usePop(key: string | null, peak = 1.35, duration = 420) {
  const reduceMotion = useReducedMotion()
  const scale = useSharedValue(1)
  const was = useRef(key)
  useEffect(() => {
    if (key && key !== was.current && !reduceMotion)
      scale.set(
        withSequence(
          withTiming(0.6, { duration: 0 }),
          withTiming(peak, {
            duration: duration * 0.45,
            easing: emphasisEasing,
          }),
          withTiming(1, { duration: duration * 0.55, easing: emphasisEasing }),
        ),
      )
    was.current = key
  }, [key, reduceMotion, scale, peak, duration])
  return useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
}

const DRIFT = [-26, -10, 4, 16, 30]

function FloatEmoji({
  emoji,
  index,
}: Readonly<{ emoji: string; index: number }>) {
  const travel = useSharedValue(0)
  useEffect(() => {
    travel.set(
      withDelay(
        index * 50,
        withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }),
      ),
    )
  }, [index, travel])
  const style = useAnimatedStyle(() => ({
    opacity: 1 - travel.value,
    transform: [
      { translateX: (DRIFT[index] ?? 0) * travel.value },
      { translateY: -70 * travel.value },
      { scale: 0.7 + 0.55 * travel.value },
    ],
  }))
  return (
    <Animated.Text style={[styles.float, style]} importantForAccessibility="no">
      {emoji}
    </Animated.Text>
  )
}

function TrayItem({
  kind,
  index,
  selected,
  onPick,
}: Readonly<{
  kind: (typeof reactionKinds)[number]
  index: number
  selected: boolean
  onPick: () => void
}>) {
  const reduceMotion = useReducedMotion()
  const enter = useSharedValue(reduceMotion ? 1 : 0)
  useEffect(() => {
    if (!reduceMotion)
      enter.set(
        withDelay(
          index * 40,
          withTiming(1, { duration: 320, easing: emphasisEasing }),
        ),
      )
  }, [index, reduceMotion, enter])
  const style = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      { translateY: 12 * (1 - enter.value) },
      { scale: 0.5 + 0.5 * enter.value },
    ],
  }))
  return (
    <Animated.View style={style}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={kind.label}
        accessibilityState={{ selected }}
        scaleTo={1.25}
        onPress={onPick}
        style={styles.trayItem}
      >
        <Text style={styles.trayEmoji}>{kind.emoji}</Text>
      </PressableScale>
    </Animated.View>
  )
}

function ReactionTray({
  origin,
  reaction,
  onPick,
  onClose,
}: Readonly<{
  origin: { x: number; y: number }
  reaction: Reaction | null
  onPick: (value: Reaction) => void
  onClose: () => void
}>) {
  const reduceMotion = useReducedMotion()
  const { width } = useWindowDimensions()
  const open = useSharedValue(reduceMotion ? 1 : 0)
  useEffect(() => {
    if (!reduceMotion)
      open.set(withTiming(1, { duration: 220, easing: emphasisEasing }))
  }, [reduceMotion, open])
  const style = useAnimatedStyle(() => ({
    opacity: open.value,
    transform: [{ scale: 0.4 + 0.6 * open.value }],
  }))
  return (
    <Modal
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Đóng khay cảm xúc"
        onPress={onClose}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        accessibilityViewIsModal
        style={[
          styles.tray,
          {
            left: Math.min(Math.max(origin.x, 8), width - TRAY_WIDTH - 8),
            top: Math.max(origin.y - TRAY_HEIGHT - 6, 8),
          },
          style,
        ]}
      >
        {reactionKinds.map((kind, index) => (
          <TrayItem
            key={kind.value}
            kind={kind}
            index={index}
            selected={reaction === kind.value}
            onPick={() => onPick(kind.value)}
          />
        ))}
      </Animated.View>
    </Modal>
  )
}

/**
 * Emoji reaction button. Tap sets or clears the viewer's SUPPORT, a long press (about 380 ms)
 * opens the three-emoji tray, and screen readers get the same choices as accessibility actions.
 * `small` is the comment variant: no count, a lighter pop and no floating burst.
 */
export function ReactionControl({
  reaction,
  count,
  onChange,
  size = 'default',
  disabled = false,
  target,
  tone = 'light',
}: Readonly<{
  reaction: Reaction | null
  count: number
  onChange: (next: Reaction | null) => void
  size?: 'default' | 'small'
  disabled?: boolean
  /** What is reacted to, for the label, for example "bình luận của An". */
  target?: string
  /** `dark` is the moments rail: white count below the emoji. */
  tone?: 'light' | 'dark'
}>) {
  const small = size === 'small'
  const reduceMotion = useReducedMotion()
  const [tray, setTray] = useState<{ x: number; y: number } | null>(null)
  const [burst, setBurst] = useState<{ id: number; emoji: string } | null>(null)
  const burstId = useRef(0)
  const was = useRef(reaction)
  const pop = usePop(reaction, small ? 1.2 : 1.35)
  useEffect(() => {
    if (reaction && reaction !== was.current && !small && !reduceMotion) {
      burstId.current += 1
      setBurst({ id: burstId.current, emoji: reactionKind(reaction).emoji })
      const timer = setTimeout(() => setBurst(null), 1300)
      was.current = reaction
      return () => clearTimeout(timer)
    }
    was.current = reaction
  }, [reaction, small, reduceMotion])
  const suffix = target ? ` cho ${target}` : ''
  const label = reaction
    ? `Bạn đã thả: ${reactionKind(reaction).label}${suffix}`
    : `Thả cảm xúc${suffix}`
  const open = (event?: GestureResponderEvent) => {
    const touch = event?.nativeEvent
    setTray({
      x: touch ? touch.pageX - touch.locationX : 12,
      y: touch ? touch.pageY - touch.locationY : 320,
    })
  }
  return (
    <View style={styles.root}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: `${count} cảm xúc` }}
        accessibilityState={{ disabled, selected: reaction !== null }}
        accessibilityActions={[
          ...reactionKinds.map((kind) => ({
            name: `react-${kind.value}`,
            label: kind.label,
          })),
          ...(reaction ? [{ name: 'react-clear', label: 'Bỏ cảm xúc' }] : []),
        ]}
        onAccessibilityAction={({ nativeEvent }) => {
          const name = nativeEvent.actionName
          if (name === 'react-clear') onChange(null)
          else {
            const kind = reactionKinds.find(
              (item) => `react-${item.value}` === name,
            )
            if (kind) onChange(kind.value)
          }
        }}
        delayLongPress={380}
        disabled={disabled}
        hitSlop={small ? 6 : undefined}
        scaleTo={0.92}
        onPress={() => onChange(reaction ? null : 'SUPPORT')}
        onLongPress={open}
        style={[
          styles.button,
          small && styles.buttonSmall,
          tone === 'dark' && styles.buttonRail,
        ]}
      >
        <Animated.Text
          style={[
            small ? styles.emojiSmall : styles.emoji,
            !reaction && styles.empty,
            pop,
          ]}
        >
          {reaction ? reactionKind(reaction).emoji : EMPTY_HEART}
        </Animated.Text>
        {!small && (
          <Txt style={[styles.count, tone === 'dark' && styles.countRail]}>
            {count}
          </Txt>
        )}
      </PressableScale>
      {burst && (
        <View pointerEvents="none" style={styles.burst}>
          {DRIFT.map((_, index) => (
            <FloatEmoji key={index} emoji={burst.emoji} index={index} />
          ))}
        </View>
      )}
      {tray && (
        <ReactionTray
          origin={tray}
          reaction={reaction}
          onClose={() => setTray(null)}
          onPick={(value) => {
            setTray(null)
            if (value !== reaction) onChange(value)
          }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { position: 'relative' },
  button: {
    alignItems: 'center',
    borderRadius: 21,
    flexDirection: 'row',
    gap: spacing.sm - 2,
    height: 42,
    justifyContent: 'center',
    minWidth: 44,
    paddingHorizontal: spacing.sm,
  },
  buttonSmall: { height: 32, minWidth: 32, paddingHorizontal: 4 },
  buttonRail: {
    borderRadius: 24,
    flexDirection: 'column',
    gap: 2,
    height: 64,
    minWidth: 48,
  },
  emoji: { fontSize: 23, lineHeight: 28 },
  emojiSmall: { fontSize: 17, lineHeight: 22 },
  empty: { opacity: 0.55 },
  count: {
    color: communityColors.ink,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  countRail: { color: communityColors.white, fontSize: 12, lineHeight: 16 },
  burst: { left: 14, position: 'absolute', top: 6 },
  float: { fontSize: 22, position: 'absolute' },
  tray: {
    backgroundColor: communityColors.background,
    borderRadius: 28,
    elevation: 10,
    flexDirection: 'row',
    gap: 2,
    padding: spacing.sm - 2,
    paddingHorizontal: TRAY_PAD,
    position: 'absolute',
    shadowColor: communityColors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    transformOrigin: '20px 100%',
  },
  trayItem: {
    alignItems: 'center',
    height: TRAY_ITEM,
    justifyContent: 'center',
    width: TRAY_ITEM,
  },
  trayEmoji: { fontSize: 28, lineHeight: 34 },
})
