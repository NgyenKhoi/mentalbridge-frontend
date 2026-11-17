import { useEffect, useState, type ReactNode } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { emphasisEasing } from '@/components/motion'
import { Txt } from '@/theme/dashboard'
import { spacing } from '@/theme/tokens'

import { communityColors } from './community-theme'

/**
 * Overflow menus and short forms. Slides up over a scrim; closes on a scrim tap and on hardware back.
 * The sheet stays mounted until its exit animation ends.
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  children,
}: Readonly<{
  visible: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}>) {
  const reduceMotion = useReducedMotion()
  const { height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const [mounted, setMounted] = useState(visible)
  if (visible && !mounted) setMounted(true)
  const progress = useSharedValue(0)
  useEffect(() => {
    const target = visible ? 1 : 0
    progress.set(
      reduceMotion
        ? target
        : withTiming(target, {
            duration: visible ? 260 : 200,
            easing: emphasisEasing,
          }),
    )
    if (visible) return
    const timer = setTimeout(() => setMounted(false), reduceMotion ? 0 : 200)
    return () => clearTimeout(timer)
  }, [visible, reduceMotion, progress])
  const scrim = useAnimatedStyle(() => ({ opacity: progress.value }))
  const sheet = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * height }],
  }))
  return (
    <Modal
      testID="community-bottom-sheet"
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      visible={mounted}
      onRequestClose={onClose}
    >
      <Animated.View style={[sheetStyles.scrim, scrim]} pointerEvents="none" />
      <Pressable
        // Tap-to-close only; screen readers close with the escape gesture or back.
        accessible={false}
        importantForAccessibility="no"
        testID="community-bottom-sheet-scrim"
        onPress={onClose}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        pointerEvents="box-none"
        style={sheetStyles.anchor}
      >
        <Animated.View
          accessibilityViewIsModal
          onAccessibilityEscape={onClose}
          style={[
            sheetStyles.sheet,
            { maxHeight: height * 0.88, paddingBottom: insets.bottom + 12 },
            sheet,
          ]}
        >
          <View style={sheetStyles.handle} />
          {title ? (
            <Txt accessibilityRole="header" style={sheetStyles.title}>
              {title}
            </Txt>
          ) : null}
          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={sheetStyles.content}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const sheetStyles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: communityColors.scrim },
  anchor: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: communityColors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 16,
    paddingTop: spacing.sm,
    shadowColor: communityColors.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: communityColors.line,
    borderRadius: 2,
    height: 4,
    width: 36,
  },
  title: {
    color: communityColors.ink,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 24,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  content: { paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
})
