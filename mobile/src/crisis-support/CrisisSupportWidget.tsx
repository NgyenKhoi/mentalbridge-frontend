import * as Linking from 'expo-linking'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { colors, radii, spacing, typography } from '@/theme/tokens'

import { CRISIS_SUPPORT_CONTENT } from './crisis-support-content'

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

export function CrisisSupportWidget() {
  const insets = useSafeAreaInsets()
  const reducedMotion = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [callingNumber, setCallingNumber] = useState<string | null>(null)
  const [dialError, setDialError] = useState<string | null>(null)
  const callSequence = useRef(0)
  const triggerRef = useRef<View>(null)
  const headingRef = useRef<Text>(null)

  const close = useCallback(() => {
    callSequence.current += 1
    setCallingNumber(null)
    setDialError(null)
    setOpen(false)
    requestAnimationFrame(() => {
      if (triggerRef.current) {
        AccessibilityInfo.sendAccessibilityEvent?.(triggerRef.current, 'focus')
      }
    })
  }, [])

  const show = () => {
    setDialError(null)
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => {
      if (headingRef.current) {
        AccessibilityInfo.sendAccessibilityEvent?.(headingRef.current, 'focus')
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [open])

  const call = async (phone: string) => {
    if (callingNumber) return
    const sequence = ++callSequence.current
    setCallingNumber(phone)
    setDialError(null)
    try {
      await Linking.openURL(`tel:${phone}`)
    } catch {
      if (callSequence.current === sequence) setDialError(phone)
    } finally {
      if (callSequence.current === sequence) setCallingNumber(null)
    }
  }

  return (
    <>
      <Pressable
        ref={triggerRef}
        accessibilityHint="Mở các số điện thoại khẩn cấp đã được kiểm duyệt"
        accessibilityLabel="Mở hỗ trợ khẩn cấp"
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={show}
        style={({ pressed }) => [
          styles.trigger,
          { bottom: Math.max(insets.bottom, spacing.md) + spacing.md },
          pressed && styles.pressed,
        ]}
        testID="crisis-support-trigger"
      >
        <Text accessibilityElementsHidden style={styles.triggerIcon}>
          ♡
        </Text>
        <Text style={styles.triggerText}>Cần hỗ trợ ngay</Text>
      </Pressable>

      <Modal
        animationType={reducedMotion ? 'none' : 'slide'}
        onRequestClose={close}
        statusBarTranslucent
        transparent
        visible={open}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Đóng bảng hỗ trợ khẩn cấp"
            onPress={close}
            style={styles.backdrop}
            testID="crisis-support-backdrop"
          />
          <ScrollView
            accessibilityViewIsModal
            contentContainerStyle={[
              styles.sheetContent,
              { paddingBottom: Math.max(insets.bottom, spacing.lg) },
            ]}
            onAccessibilityEscape={close}
            style={styles.sheet}
            testID="crisis-support-sheet"
          >
            <View style={styles.handle} />
            <View style={styles.header}>
              <View style={styles.headingCopy}>
                <Text style={styles.eyebrow}>LIÊN HỆ NGAY KHI CẦN</Text>
                <Text
                  ref={headingRef}
                  accessible
                  accessibilityRole="header"
                  style={styles.title}
                >
                  Hỗ trợ khẩn cấp
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Đóng bảng hỗ trợ khẩn cấp"
                accessibilityRole="button"
                onPress={close}
                style={({ pressed }) => [
                  styles.close,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>

            <Text style={styles.explanation}>
              Bạn có thể gọi các số dưới đây mà không cần đăng nhập.
              MentalBridge không phải là dịch vụ cấp cứu.
            </Text>

            <View
              accessibilityLabel="Số điện thoại hỗ trợ"
              style={styles.contacts}
            >
              {CRISIS_SUPPORT_CONTENT.contacts.map((contact) => {
                const pending = callingNumber === contact.phone
                return (
                  <View key={contact.id} style={styles.contact}>
                    <View style={styles.contactCopy}>
                      <Text style={styles.contactName}>{contact.name}</Text>
                      <View style={styles.numberRow}>
                        <Text style={styles.number}>{contact.phone}</Text>
                        {contact.availability ? (
                          <Text style={styles.badge}>
                            {contact.availability}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <Pressable
                      accessibilityLabel={`Gọi ${contact.name} số ${contact.phone}`}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: Boolean(callingNumber) }}
                      disabled={Boolean(callingNumber)}
                      onPress={() => void call(contact.phone)}
                      style={({ pressed }) => [
                        styles.call,
                        pressed && styles.callPressed,
                        Boolean(callingNumber) && !pending && styles.disabled,
                      ]}
                    >
                      <Text style={styles.callText}>
                        {pending ? 'Đang mở…' : 'Gọi'}
                      </Text>
                    </Pressable>
                  </View>
                )
              })}
            </View>

            {dialError ? (
              <Text accessibilityLiveRegion="assertive" style={styles.error}>
                Chưa thể mở ứng dụng gọi điện. Bạn vẫn có thể dùng số{' '}
                {dialError} đang hiển thị để gọi.
              </Text>
            ) : null}

            <Text style={styles.finePrint}>
              Cuộc gọi chỉ bắt đầu sau khi bạn xác nhận trong ứng dụng điện
              thoại.
            </Text>
          </ScrollView>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    backgroundColor: 'rgba(27, 42, 34, 0.5)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  trigger: {
    alignItems: 'center',
    backgroundColor: '#9B352D',
    borderColor: '#7D2B25',
    borderRadius: radii.pill,
    borderWidth: 1,
    elevation: 6,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    position: 'absolute',
    right: spacing.lg,
    shadowColor: colors.ink,
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    zIndex: 20,
  },
  triggerIcon: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '800',
  },
  triggerText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
  },
  sheetContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: colors.tealPale,
    borderRadius: radii.pill,
    height: 5,
    marginBottom: spacing.lg,
    width: 44,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.lg,
    justifyContent: 'space-between',
  },
  headingCopy: {
    flex: 1,
  },
  eyebrow: {
    color: '#9B352D',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  title: {
    color: colors.ink,
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 34,
  },
  close: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.pill,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  closeText: {
    color: colors.ink,
    fontSize: 28,
    lineHeight: 32,
  },
  explanation: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.control,
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
    marginVertical: spacing.xl,
    padding: spacing.lg,
  },
  contacts: {
    gap: spacing.md,
  },
  contact: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: radii.panel,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.lg,
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  contactCopy: {
    flex: 1,
  },
  contactName: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  numberRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  number: {
    color: colors.tealDeep,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
  badge: {
    backgroundColor: colors.tealPale,
    borderRadius: 6,
    color: colors.tealDeep,
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  call: {
    alignItems: 'center',
    backgroundColor: colors.tealDeep,
    borderRadius: radii.control,
    justifyContent: 'center',
    minHeight: 52,
    minWidth: 80,
    paddingHorizontal: spacing.lg,
  },
  callPressed: {
    backgroundColor: colors.teal,
  },
  callText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.55,
  },
  error: {
    backgroundColor: '#FFF1EE',
    borderRadius: radii.control,
    color: '#7D2B25',
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  finePrint: {
    color: colors.inkSoft,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.xl,
  },
  pressed: {
    opacity: 0.76,
  },
})
