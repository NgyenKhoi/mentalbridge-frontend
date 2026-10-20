import { router } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import type { SupportPlanActionApi } from '@/support-plan/support-plan-action-api'
import type {
  ActionOccurrence,
  CanonicalSupportPlan,
} from '@/support-plan/support-plan-action-contract'
import { colors, radii, spacing, typography } from '@/theme/tokens'

import {
  mobileCompanionNavigation,
  nextStepCopy,
  selectMobileCompanionContext,
} from './companion-context'
import { useCompanionSessionPreferences } from './companion-session'

const unavailableCopy =
  'Chưa thể tải lời giải thích lúc này. Kế hoạch và các hoạt động của bạn vẫn giữ nguyên; bạn có thể thử lại sau.'

type ResponseState = Readonly<{
  status: 'ready' | 'fallback'
  text: string
  source: string
}>

function useReducedMotion() {
  const [reduced, setReduced] = useState(false)
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

function Control({
  label,
  onPress,
  pressed,
  disabled = false,
  testID,
}: Readonly<{
  label: string
  onPress: () => void
  pressed?: boolean
  disabled?: boolean
  testID?: string
}>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{
        disabled,
        ...(pressed === undefined ? {} : { checked: pressed }),
      }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed: active }) => [
        styles.control,
        active && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={styles.controlText}>{label}</Text>
    </Pressable>
  )
}

export function SupportPlanCompanion({
  api,
  subject,
  plan,
  occurrences,
  now,
  preferredOccurrenceId,
  interrupted,
}: Readonly<{
  api: SupportPlanActionApi
  subject: string
  plan: CanonicalSupportPlan
  occurrences: readonly ActionOccurrence[]
  now: () => Date
  preferredOccurrenceId?: string
  interrupted: boolean
}>) {
  const context = selectMobileCompanionContext(plan, occurrences, {
    now: now(),
    ...(preferredOccurrenceId ? { preferredOccurrenceId } : {}),
  })
  const contextKey = context
    ? [
        context.supportPlanId,
        plan.version,
        context.action.actionId,
        context.action.actionVersion,
        context.surface,
        context.occurrence?.occurrenceId ?? '',
        context.occurrence?.version ?? '',
      ].join(':')
    : 'none'
  const navigation = context ? mobileCompanionNavigation(context) : null
  const { muted, hidden, setMuted, setHidden } =
    useCompanionSessionPreferences(subject)
  const reducedMotion = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [response, setResponse] = useState<ResponseState | null>(null)
  const requestSequence = useRef(0)
  const inFlight = useRef(false)
  const activeContextKey = useRef(contextKey)
  const openingControl = useRef<View>(null)
  const sheetHeading = useRef<Text>(null)
  const [pulse] = useState(() => new Animated.Value(0))

  const close = useCallback(() => {
    requestSequence.current += 1
    setPending(false)
    setResponse(null)
    setOpen(false)
    requestAnimationFrame(() => {
      if (openingControl.current)
        AccessibilityInfo.sendAccessibilityEvent?.(
          openingControl.current,
          'focus',
        )
    })
  }, [])

  useEffect(() => {
    if (!interrupted) return
    requestSequence.current += 1
    const frame = requestAnimationFrame(() => {
      setPending(false)
      setResponse(null)
      setOpen(false)
    })
    return () => cancelAnimationFrame(frame)
  }, [interrupted])

  useEffect(() => {
    if (activeContextKey.current === contextKey) return
    activeContextKey.current = contextKey
    requestSequence.current += 1
    const frame = requestAnimationFrame(() => {
      setPending(false)
      setResponse(null)
      setOpen(false)
    })
    return () => cancelAnimationFrame(frame)
  }, [contextKey])

  useEffect(() => {
    if (reducedMotion || muted || hidden || interrupted) {
      pulse.stopAnimation()
      pulse.setValue(0)
      return
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    )
    animation.start()
    return () => animation.stop()
  }, [hidden, interrupted, muted, pulse, reducedMotion])

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => {
      if (sheetHeading.current)
        AccessibilityInfo.sendAccessibilityEvent?.(
          sheetHeading.current,
          'focus',
        )
    })
    return () => cancelAnimationFrame(frame)
  }, [open])

  if (!context) return null

  const explain = async () => {
    if (inFlight.current || interrupted) return
    inFlight.current = true
    const sequence = ++requestSequence.current
    setPending(true)
    setResponse(null)
    try {
      const message = await api.requestCompanionExplanation(
        context.supportPlanId,
        context.action.actionId,
        context.surface,
      )
      if (requestSequence.current !== sequence) return
      setResponse({
        status: message.delivery === 'GENERATED' ? 'ready' : 'fallback',
        text: message.text,
        source:
          message.delivery === 'GENERATED'
            ? 'AI diễn đạt từ kế hoạch đã được duyệt'
            : 'Phản hồi dự phòng; kế hoạch gốc vẫn giữ nguyên',
      })
    } catch {
      if (requestSequence.current !== sequence) return
      setResponse({
        status: 'fallback',
        text: unavailableCopy,
        source: 'Không thể kết nối; kế hoạch gốc vẫn giữ nguyên',
      })
    } finally {
      inFlight.current = false
      if (requestSequence.current === sequence) {
        setPending(false)
      }
    }
  }

  const showNextStep = () => {
    if (interrupted) return
    requestSequence.current += 1
    setPending(false)
    setResponse({
      status: 'ready',
      text: nextStepCopy(context),
      source: 'Chỉ đường từ kế hoạch hiện tại',
    })
  }

  return (
    <View
      accessibilityLabel="Bạn đồng hành trong kế hoạch hỗ trợ"
      style={styles.shell}
      testID="support-plan-companion"
    >
      <View style={styles.header}>
        <View style={styles.identity}>
          <Animated.View
            accessible={false}
            style={[
              styles.character,
              {
                opacity: pulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.76, 1],
                }),
                transform: [
                  {
                    translateY: pulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -4],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.characterText}>❧</Text>
          </Animated.View>
          <View style={styles.identityCopy}>
            <Text accessibilityRole="header" style={styles.title}>
              Bạn đồng hành
            </Text>
            <Text style={styles.state}>
              {interrupted
                ? 'Tạm lắng khi bạn đang chỉnh sửa'
                : 'Sẵn sàng khi bạn cần'}
            </Text>
          </View>
        </View>
        <Control
          label={hidden ? 'Mở rộng Bạn đồng hành' : 'Thu gọn Bạn đồng hành'}
          onPress={() => setHidden(!hidden)}
          testID="companion-collapse"
        />
      </View>

      {!hidden ? (
        <View style={styles.body}>
          <Text style={styles.copy}>
            Mình có thể giải thích hoạt động và chỉ đường. Kế hoạch chỉ thay đổi
            khi bạn xác nhận.
          </Text>
          <Text style={styles.contextLabel}>Đang xem hoạt động</Text>
          <Text style={styles.contextTitle}>
            {context.action.presentation.title}
          </Text>
          <View style={styles.preferenceRow}>
            <Control
              label={
                muted
                  ? 'Bật lời nhắc của Bạn đồng hành'
                  : 'Tắt lời nhắc của Bạn đồng hành'
              }
              pressed={muted}
              onPress={() => setMuted(!muted)}
              testID="companion-mute"
            />
            <Text style={styles.motionCopy}>
              {reducedMotion
                ? 'Thiết bị đang ưu tiên giảm chuyển động.'
                : 'Chuyển động nhẹ đang bật.'}
            </Text>
          </View>
          {interrupted ? (
            <Text accessibilityLiveRegion="polite" style={styles.interruption}>
              Hướng dẫn tạm dừng cho đến khi bạn lưu, hủy hoặc hoàn tất xác
              nhận.
            </Text>
          ) : null}
          <Pressable
            ref={openingControl}
            accessibilityRole="button"
            accessibilityLabel="Mở hướng dẫn có giới hạn"
            accessibilityState={{ disabled: interrupted, expanded: open }}
            disabled={interrupted}
            onPress={() => setOpen(true)}
            testID="companion-open"
            style={({ pressed }) => [
              styles.openButton,
              pressed && styles.pressed,
              interrupted && styles.disabled,
            ]}
          >
            <Text style={styles.openButtonText}>Mở hướng dẫn có giới hạn</Text>
          </Pressable>
        </View>
      ) : null}

      <Modal
        animationType={reducedMotion ? 'none' : 'slide'}
        onRequestClose={close}
        transparent
        visible={open && !interrupted}
      >
        <View style={styles.backdrop}>
          <ScrollView
            accessibilityViewIsModal
            contentContainerStyle={styles.sheetContent}
            onAccessibilityEscape={close}
            style={styles.sheet}
            testID="companion-sheet"
          >
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeadingCopy}>
                <Text style={styles.kicker}>AI KHI BẠN YÊU CẦU</Text>
                <Text
                  ref={sheetHeading}
                  accessible
                  accessibilityRole="header"
                  style={styles.sheetTitle}
                >
                  Bạn đồng hành
                </Text>
              </View>
              <Control label="Đóng hướng dẫn Bạn đồng hành" onPress={close} />
            </View>
            <View style={styles.boundary}>
              <Text style={styles.boundaryText}>
                Bạn đồng hành chỉ giải thích và chỉ đường. Kế hoạch chỉ thay đổi
                khi bạn dùng thao tác xác nhận trong Kế hoạch hỗ trợ.
              </Text>
            </View>
            <Text style={styles.contextLabel}>Đang xem hoạt động</Text>
            <Text style={styles.contextTitle}>
              {context.action.presentation.title}
            </Text>
            <Text style={styles.starterLabel}>Câu hỏi có sẵn</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: pending }}
              disabled={pending}
              onPress={() => void explain()}
              testID="companion-explain"
              style={({ pressed }) => [
                styles.starter,
                pressed && styles.pressed,
                pending && styles.disabled,
              ]}
            >
              <Text style={styles.starterText}>
                Vì sao hoạt động này có trong kế hoạch?
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={showNextStep}
              style={({ pressed }) => [
                styles.starter,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.starterText}>Tôi nên bắt đầu từ đâu?</Text>
            </Pressable>
            {navigation ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  close()
                  router.push(
                    navigation.params
                      ? { pathname: navigation.href, params: navigation.params }
                      : navigation.href,
                  )
                }}
                style={({ pressed }) => [
                  styles.starter,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.starterText}>{navigation.label}</Text>
              </Pressable>
            ) : null}
            {pending ? (
              <Text accessibilityLiveRegion="polite" style={styles.loading}>
                Đang chuẩn bị lời giải thích theo hoạt động…
              </Text>
            ) : null}
            {response ? (
              <View
                accessibilityLiveRegion={muted ? 'none' : 'polite'}
                style={styles.response}
              >
                <Text style={styles.responseSource}>{response.source}</Text>
                <Text style={styles.responseText}>{response.text}</Text>
              </View>
            ) : null}
            <Text style={styles.privacy}>
              Nội dung hướng dẫn chỉ được giữ trong bộ nhớ của màn hình này.
              Không có nội dung Nhật ký hay giá trị cảm xúc nào được gửi từ ứng
              dụng.
            </Text>
          </ScrollView>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.tealPale,
    borderRadius: radii.shell,
    borderWidth: 1,
    gap: spacing.md,
    marginVertical: spacing.xl,
    padding: spacing.lg,
  },
  header: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  identity: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
  },
  identityCopy: { flex: 1 },
  character: {
    alignItems: 'center',
    backgroundColor: colors.tealPale,
    borderRadius: radii.pill,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  characterText: { color: colors.tealDeep, fontSize: 28, lineHeight: 32 },
  title: { color: colors.ink, fontSize: 20, fontWeight: '700', lineHeight: 28 },
  state: {
    color: colors.tealDeep,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  body: { gap: spacing.md },
  copy: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  contextLabel: {
    color: colors.inkFaint,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  contextTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '700',
    lineHeight: typography.bodyLineHeight,
  },
  preferenceRow: { gap: spacing.sm },
  motionCopy: { color: colors.inkSoft, fontSize: 13, lineHeight: 19 },
  control: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderColor: colors.teal,
    borderRadius: radii.control,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: spacing.md,
  },
  controlText: {
    color: colors.tealDeep,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  interruption: { color: colors.inkSoft, fontSize: 14, lineHeight: 22 },
  openButton: {
    alignItems: 'center',
    backgroundColor: colors.tealDeep,
    borderRadius: radii.control,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  openButtonText: {
    color: colors.white,
    fontSize: typography.body,
    fontWeight: '700',
  },
  backdrop: {
    backgroundColor: 'rgba(27, 42, 34, 0.38)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.shell,
    borderTopRightRadius: radii.shell,
    maxHeight: '88%',
  },
  sheetContent: {
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: colors.tealPale,
    borderRadius: radii.pill,
    height: 4,
    width: 48,
  },
  sheetHeader: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  sheetHeadingCopy: { flex: 1 },
  kicker: {
    color: colors.teal,
    fontSize: typography.eyebrow,
    fontWeight: '800',
    lineHeight: 19,
  },
  sheetTitle: {
    color: colors.ink,
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 34,
  },
  boundary: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.control,
    padding: spacing.lg,
  },
  boundaryText: { color: colors.ink, fontSize: 14, lineHeight: 22 },
  starterLabel: {
    color: colors.inkFaint,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: spacing.sm,
  },
  starter: {
    borderColor: colors.tealPale,
    borderRadius: radii.control,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  starterText: {
    color: colors.tealDeep,
    fontSize: typography.body,
    fontWeight: '700',
    lineHeight: typography.bodyLineHeight,
  },
  loading: { color: colors.tealDeep, fontSize: 14, lineHeight: 22 },
  response: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.control,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  responseSource: {
    color: colors.tealDeep,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  responseText: {
    color: colors.ink,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  privacy: { color: colors.inkFaint, fontSize: 13, lineHeight: 20 },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.55 },
})
