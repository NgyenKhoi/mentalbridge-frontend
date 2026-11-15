import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  runOnJS,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { PressableScale } from '@/components/PressableScale'
import {
  PUSH_INVITE_DISMISSED_KEY,
  PUSH_STATE_KEY,
  type PushState,
} from '@/push/push-constants'
import { isPushEnabledOnDevice } from '@/push/push-registration'
import { dashboardColors as colors, Txt } from '@/theme/dashboard'
import { radii, spacing } from '@/theme/tokens'

const COLLAPSE_MS = 240

async function wasDismissed() {
  try {
    return (await SecureStore.getItemAsync(PUSH_INVITE_DISMISSED_KEY)) === '1'
  } catch {
    return false
  }
}

/** Invites a USER to turn on push once; the caller mounts it only outside safety mode. */
export function PushInviteCard() {
  const [dismissed, setDismissed] = useState<boolean | null>(null)
  const [deviceOn, setDeviceOn] = useState<boolean | null>(null)
  // PushBridge and the preferences screen write the push state here, often before SecureStore is re-read.
  const pushState = useQuery({
    queryKey: PUSH_STATE_KEY,
    queryFn: () => 'OFF' as PushState,
    enabled: false,
  }).data
  const reduceMotion = useReducedMotion()
  // The card collapses itself (height, margin, opacity) so the content below follows without a sibling layout animation.
  const progress = useSharedValue(1)
  const measured = useSharedValue(0)
  const collapse = useAnimatedStyle(() => {
    const p = progress.get()
    return p === 1
      ? {}
      : {
          height: measured.get() * p,
          marginTop: spacing.lg * p,
          opacity: p,
          overflow: 'hidden' as const,
        }
  })

  useEffect(() => {
    let active = true
    void wasDismissed().then((value) => active && setDismissed(value))
    void isPushEnabledOnDevice().then((value) => active && setDeviceOn(value))
    return () => {
      active = false
    }
  }, [])

  const dismiss = () => {
    if (reduceMotion || measured.get() === 0) setDismissed(true)
    else {
      // Unmount exactly when the collapse ends (the callback runs on the UI thread).
      progress.set(
        withTiming(
          0,
          { duration: COLLAPSE_MS, easing: Easing.out(Easing.cubic) },
          (finished) => {
            if (finished) runOnJS(setDismissed)(true)
          },
        ),
      )
    }
    void SecureStore.setItemAsync(PUSH_INVITE_DISMISSED_KEY, '1').catch(
      () => undefined,
    )
  }

  if (dismissed !== false || deviceOn !== false || pushState === 'ENABLED')
    return null

  return (
    <Animated.View
      onLayout={(event) => {
        if (progress.get() === 1) measured.set(event.nativeEvent.layout.height)
      }}
      style={[styles.card, collapse]}
      testID="push-invite-card"
    >
      <View style={styles.copy}>
        <Txt accessibilityRole="header" style={styles.title}>
          Nhận nhắc nhở trên điện thoại
        </Txt>
        <Txt style={styles.body}>
          MentalBridge sẽ nhắc bạn ghi nhận cảm xúc và viết nhật ký, kể cả khi
          ứng dụng đang đóng.
        </Txt>
      </View>
      <View style={styles.actions}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Bật thông báo"
          scaleTo={0.97}
          onPress={() => router.push('/(user)/notification-preferences')}
          style={styles.primary}
        >
          <Txt style={styles.primaryLabel}>Bật thông báo</Txt>
        </PressableScale>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Để sau"
          scaleTo={0.97}
          onPress={dismiss}
          style={styles.ghost}
        >
          <Txt style={styles.ghostLabel}>Để sau</Txt>
        </PressableScale>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.shell,
    borderWidth: 1,
    gap: spacing.md,
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  copy: { gap: spacing.xs },
  title: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  body: { color: colors.inkSoft, fontSize: 15, lineHeight: 22 },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  primary: {
    alignItems: 'center',
    backgroundColor: colors.tealDeep,
    borderRadius: radii.pill,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
  primaryLabel: { color: colors.white, fontSize: 15, fontWeight: '700' },
  ghost: {
    alignItems: 'center',
    borderRadius: radii.pill,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  ghostLabel: { color: colors.inkSoft, fontSize: 15, fontWeight: '600' },
})
