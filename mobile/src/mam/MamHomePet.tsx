import { router, useFocusEffect, type Href } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  AccessibilityInfo,
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useAnimatedValue,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { colors } from '@/theme/tokens'
import { useDashboardFonts } from '@/theme/useDashboardFonts'

const mam = require('../../assets/mam/mam-idle.png')

const questions = [
  {
    label: 'Mầm giải thích',
    answer:
      'Đây là trang chính của bạn. Bạn có thể ghi lại cảm xúc hôm nay, mở kế hoạch hỗ trợ, hoặc tìm bài đọc và bài tập trong kho tài nguyên.',
    action: 'Xem kho tài nguyên',
    href: '/(user)/resources',
  },
  {
    label: 'Nên bắt đầu từ đâu?',
    answer:
      'Nếu bạn đang theo một kế hoạch, hãy mở mục Hôm nay để xem hoạt động tiếp theo. Bạn có thể làm theo nhịp của mình.',
    action: 'Mở kế hoạch hỗ trợ',
    href: '/(user)/support-plan',
  },
] as const satisfies readonly {
  label: string
  answer: string
  action: string
  href: Href
}[]

type Question = (typeof questions)[number]

export function MamHomePet() {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Question | null>(null)
  const insets = useSafeAreaInsets()
  const fonts = useDashboardFonts()
  const titleFont = fonts ? styles.serif : null
  const close = () => setOpen(false)
  const { width } = useWindowDimensions()
  const idle = useAnimatedValue(0)

  useFocusEffect(
    useCallback(() => {
      if (open) return
      let active = true
      const motion = Animated.loop(
        Animated.sequence([
          Animated.timing(idle, {
            toValue: -4,
            duration: 1400,
            useNativeDriver: true,
            isInteraction: false,
          }),
          Animated.timing(idle, {
            toValue: 0,
            duration: 1400,
            useNativeDriver: true,
            isInteraction: false,
          }),
        ]),
      )
      const updateMotion = (reduced: boolean) => {
        if (!active) return
        motion.stop()
        idle.setValue(0)
        if (!reduced) motion.start()
      }
      const subscription = AccessibilityInfo.addEventListener(
        'reduceMotionChanged',
        updateMotion,
      )
      void AccessibilityInfo.isReduceMotionEnabled()
        .then(updateMotion)
        .catch(() => undefined)
      return () => {
        active = false
        subscription.remove()
        motion.stop()
        idle.setValue(0)
      }
    }, [idle, open]),
  )

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Hỏi Mầm về Trang chủ"
        accessibilityState={{ expanded: open }}
        onPress={() => {
          setSelected(null)
          setOpen(true)
        }}
        style={({ pressed }) => [
          styles.pet,
          { left: Math.max(12, (width - 560) / 2) },
          pressed && styles.pressed,
        ]}
      >
        <Animated.Image
          source={mam}
          accessible={false}
          style={[styles.petImage, { transform: [{ translateY: idle }] }]}
        />
      </Pressable>

      <Modal
        transparent
        visible={open}
        animationType="fade"
        onRequestClose={close}
      >
        <View style={styles.overlay}>
          <Pressable
            accessible={false}
            onPress={close}
            style={StyleSheet.absoluteFill}
          />
          <View
            accessibilityViewIsModal
            style={[
              styles.sheet,
              { paddingBottom: Math.max(20, insets.bottom + 12) },
            ]}
          >
            <ScrollView
              contentContainerStyle={styles.sheetContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.header}>
                <View style={styles.avatar}>
                  <Image source={mam} accessible={false} style={styles.image} />
                </View>
                <View style={styles.copy}>
                  <Text
                    accessibilityRole="header"
                    style={[styles.title, titleFont]}
                  >
                    Hỏi Mầm
                  </Text>
                  <Text style={styles.description}>Trang chủ MentalBridge</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Đóng Mầm"
                  onPress={close}
                  style={styles.close}
                >
                  <Text style={styles.arrow} aria-hidden>
                    ×
                  </Text>
                </Pressable>
              </View>
              {questions.map((question) => (
                <Pressable
                  key={question.label}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selected === question }}
                  onPress={() => setSelected(question)}
                  style={({ pressed }) => [
                    styles.option,
                    selected === question && styles.selected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.optionText, styles.copy]}>
                    {question.label}
                  </Text>
                  <Text style={styles.optionText} aria-hidden>
                    ›
                  </Text>
                </Pressable>
              ))}
              {selected && (
                <View style={styles.answer}>
                  <Text
                    accessibilityLiveRegion="polite"
                    style={styles.answerText}
                  >
                    {selected.answer}
                  </Text>
                  <Pressable
                    accessibilityRole="link"
                    onPress={() => {
                      close()
                      router.push(selected.href)
                    }}
                    style={({ pressed }) => [
                      styles.action,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.actionText}>{selected.action} →</Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  pet: {
    position: 'absolute',
    bottom: 9,
    width: 76,
    height: 76,
  },
  petImage: { width: '100%', height: '100%', resizeMode: 'contain' },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#D8EBDF',
  },
  image: { width: 44, height: 44, resizeMode: 'contain' },
  copy: { flex: 1, minWidth: 0 },
  title: { color: colors.ink, fontSize: 19, fontWeight: '700' },
  serif: { fontFamily: 'DashboardSerif' },
  description: { color: colors.inkSoft, fontSize: 13, lineHeight: 19 },
  arrow: { color: colors.tealDeep, fontSize: 24 },
  pressed: { opacity: 0.76 },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: 'rgba(13,32,26,0.42)',
  },
  sheet: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '90%',
    backgroundColor: '#FAFCF8',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },
  sheetContent: { paddingHorizontal: 18, paddingTop: 18, gap: 10 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
  },
  close: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 48,
    padding: 12,
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 14,
  },
  selected: { backgroundColor: '#E4F1E8', borderColor: colors.teal },
  optionText: { color: colors.tealDeep, fontWeight: '600', fontSize: 14 },
  answer: {
    gap: 12,
    padding: 13,
    borderRadius: 16,
    backgroundColor: '#EAF3EB',
  },
  answerText: { fontSize: 14, lineHeight: 22, color: colors.ink },
  action: {
    backgroundColor: colors.tealDeep,
    minHeight: 46,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
    borderRadius: 22,
  },
  actionText: { color: colors.white, fontWeight: '700', textAlign: 'center' },
})
