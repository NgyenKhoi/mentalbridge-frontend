import { randomUUID } from 'expo-crypto'
import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { Screen } from '@/components/Screen'
import { colors, radii, spacing } from '@/theme/tokens'

import { BreathingMedia } from './BreathingMedia'
import { useResourceFonts } from './useResourceFonts'
import type {
  ResourceDetail,
  ResourceProgressUpdate,
} from './resource-contract'
import {
  breathingPhase,
  breathingPractice,
  resourceActions,
  structuredResourceContent,
} from './resource-model'

const advice = [
  {
    icon: '♧',
    title: 'Tư thế thư giãn hoàn toàn',
    text: 'Ngồi tựa lưng hoặc nằm thẳng, thả lỏng hai vai và để cơ thể được nâng đỡ.',
    color: '#c9f1df',
  },
  {
    icon: '≋',
    title: 'Nhịp thở êm, không gắng sức',
    text: 'Hít nhẹ qua mũi, thở ra tự nhiên qua miệng hoặc mũi. Không cần cố hít thật sâu.',
    color: '#e2eee7',
  },
  {
    icon: '♢',
    title: 'An toàn là ưu tiên số một',
    text: 'Nếu thấy chóng mặt hoặc khó chịu, hãy dừng lại và quay về nhịp thở thường ngày.',
    color: '#f9e1d7',
  },
] as const

function timeLabel(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

export function BreathingResourceDetail({
  resource,
  completed,
  progressReady,
  progressError,
  saving,
  message,
  onRetryProgress,
  onComplete,
  onBack,
  onHome,
  bookmarked,
  bookmarkEnabled,
  bookmarkUnavailable,
  onBookmark,
}: Readonly<{
  resource: ResourceDetail
  completed: boolean
  progressReady: boolean
  progressError: boolean
  saving: boolean
  message?: Readonly<{ message: string; tone: 'error' | 'success' }> | null
  onRetryProgress: () => void
  onComplete: (update: ResourceProgressUpdate) => Promise<unknown>
  onBack: () => void
  onHome?: () => void
  bookmarked?: boolean
  bookmarkEnabled?: boolean
  bookmarkUnavailable?: boolean
  onBookmark?: () => void
}>) {
  const fontsLoaded = useResourceFonts()
  const sans = fontsLoaded ? { fontFamily: 'ResourceSans' } : undefined
  const serif = fontsLoaded ? { fontFamily: 'ResourceSerif' } : undefined
  const semibold = fontsLoaded
    ? { fontFamily: 'ResourceSansSemibold', fontWeight: 'normal' as const }
    : undefined
  const italic = fontsLoaded ? { fontFamily: 'ResourceSerifItalic' } : undefined
  const practice = useMemo(() => breathingPractice(resource), [resource])
  const content = useMemo(() => structuredResourceContent(resource), [resource])
  const [remaining, setRemaining] = useState(practice.durationSeconds)
  const [running, setRunning] = useState(false)
  const [confirmationOpen, setConfirmationOpen] = useState(false)
  const [showContent, setShowContent] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)
  const remainingMs = useRef(practice.durationSeconds * 1000)
  const runAnchor = useRef<{ time: number; remaining: number } | null>(null)
  const practiceSession = useRef<{
    practiceSessionId: string
    practiceStartedAt: string
  } | null>(null)
  const confirming = useRef(false)
  const [scale] = useState(() => new Animated.Value(0.92))
  const phase = breathingPhase(practice, remaining)
  const finished = remaining === 0
  const cycle = Math.min(
    practice.cycleCount,
    Math.floor((practice.durationSeconds - remaining) / practice.cycleSeconds),
  )
  const cycleProgress =
    finished || (!running && remaining === practice.durationSeconds)
      ? 1
      : ((practice.durationSeconds - remaining) % practice.cycleSeconds) /
        practice.cycleSeconds

  const pause = useCallback(() => {
    const anchor = runAnchor.current
    if (anchor) {
      remainingMs.current = Math.max(
        0,
        anchor.remaining - (performance.now() - anchor.time),
      )
      runAnchor.current = null
      setRemaining(Math.ceil(remainingMs.current / 1000))
    }
    setRunning(false)
  }, [])

  useFocusEffect(
    useCallback(() => {
      const subscription = AppState.addEventListener('change', (state) => {
        if (state !== 'active') pause()
      })
      return () => {
        subscription.remove()
        pause()
      }
    }, [pause]),
  )

  useEffect(() => {
    if (!running) return
    const tick = () => {
      const anchor = runAnchor.current
      if (!anchor) return
      remainingMs.current = Math.max(
        0,
        anchor.remaining - (performance.now() - anchor.time),
      )
      setRemaining(Math.ceil(remainingMs.current / 1000))
      if (remainingMs.current === 0) {
        runAnchor.current = null
        setRunning(false)
      }
    }
    const interval = setInterval(tick, 250)
    return () => clearInterval(interval)
  }, [running])

  useEffect(() => {
    let active = true
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled)
    })
    const listener = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    )
    return () => {
      active = false
      listener.remove()
    }
  }, [])

  useEffect(() => {
    scale.stopAnimation()
    if (!running || reduceMotion) return
    const animation = Animated.timing(scale, {
      toValue: phase.id === 'exhale' ? 0.92 : 1.04,
      duration: phase.remaining * 1000,
      easing: Easing.inOut(Easing.sin),
      useNativeDriver: true,
      isInteraction: false,
    })
    animation.start()
    return () => animation.stop()
    // Continue the animation within a phase rather than restarting each tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, reduceMotion, phase.id, scale])

  function reset() {
    pause()
    remainingMs.current = practice.durationSeconds * 1000
    setRemaining(practice.durationSeconds)
    practiceSession.current = null
    scale.setValue(0.92)
  }

  function startPause() {
    if (running) {
      pause()
      return
    }
    if (finished) {
      remainingMs.current = practice.durationSeconds * 1000
      setRemaining(practice.durationSeconds)
      practiceSession.current = null
    }
    practiceSession.current ??= {
      practiceSessionId: randomUUID(),
      practiceStartedAt: new Date().toISOString(),
    }
    runAnchor.current = {
      time: performance.now(),
      remaining: remainingMs.current,
    }
    setRunning(true)
  }

  async function confirmCompletion() {
    if (!progressReady || saving || confirming.current) return
    confirming.current = true
    pause()
    const elapsed = Math.floor(
      (practice.durationSeconds * 1000 - remainingMs.current) / 1000,
    )
    const session = practiceSession.current
    try {
      await onComplete({
        status: 'COMPLETED',
        resourceVersion: resource.contentVersion,
        completedActionIds: resourceActions(resource).map(
          (action) => action.id,
        ),
        ...(resource.repeatability === 'REPEATABLE' && session && elapsed > 0
          ? { ...session, practiceDurationSeconds: elapsed }
          : {}),
      })
      setConfirmationOpen(false)
    } catch {
      // The mutation owner displays the error. Retain the same session id on retry.
    } finally {
      confirming.current = false
    }
  }

  const safety = [...new Set([...resource.safetyNotes, ...content.cautions])]
  return (
    <Screen layout="dashboard" backgroundColor="#f5faf7">
      <View style={styles.page}>
        <View style={styles.masthead}>
          <View style={styles.brandIcon}>
            <Text accessible={false} style={styles.brandMark}>
              ♧
            </Text>
          </View>
          <View style={styles.flex}>
            <Text numberOfLines={1} style={[styles.brand, serif]}>
              MentalBridge
            </Text>
            <Text style={[styles.small, sans]}>Tài nguyên chăm sóc</Text>
          </View>
          {onHome ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Về trang chủ"
              onPress={onHome}
              style={styles.homeButton}
            >
              <Text style={[styles.link, semibold]}>⌂ Trang chủ</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.rowBetween}>
          <Pressable
            accessibilityRole="button"
            onPress={onBack}
            style={styles.back}
          >
            <Text style={[styles.link, semibold]}>← Tài nguyên</Text>
          </Pressable>
          <Text style={[styles.mintChip, sans]}>● Khoảnh khắc dịu êm</Text>
        </View>
        <View style={styles.intro}>
          <View style={styles.row}>
            <Text accessibilityRole="header" style={[styles.title, serif]}>
              {resource.title}
            </Text>
            {onBookmark ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  bookmarkUnavailable
                    ? 'Tải lại trạng thái lưu'
                    : bookmarked
                      ? 'Bỏ lưu tài nguyên'
                      : 'Lưu tài nguyên'
                }
                accessibilityState={{
                  selected: bookmarked,
                  disabled: !bookmarkEnabled,
                }}
                disabled={!bookmarkEnabled}
                onPress={onBookmark}
                style={styles.bookmark}
              >
                <Text accessible={false} style={styles.bookmarkIcon}>
                  {bookmarkUnavailable ? '↻' : bookmarked ? '♥' : '♡'}
                </Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={[styles.body, sans]}>{resource.summary}</Text>
          <View style={styles.tags}>
            {[
              'Bài tập điều hòa',
              'Cường độ nhẹ',
              `${resource.expectedDurationMinutes} phút`,
              `Nhịp ${practice.phases.map((item) => item.seconds).join(' · ')}`,
            ].map((tag) => (
              <Text key={tag} style={[styles.chip, sans]}>
                {tag}
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.pacer}>
          <View style={styles.rowBetween}>
            <Text style={[styles.status, sans]}>
              {finished
                ? '✓ Đã kết thúc phiên thở'
                : running
                  ? '● Đang thực hành'
                  : remaining < practice.durationSeconds
                    ? 'Ⅱ Đang nghỉ'
                    : '● Sẵn sàng'}
            </Text>
            <Text style={[styles.small, sans]}>
              Chu kỳ {practice.cycleSeconds} giây
            </Text>
          </View>
          <View style={styles.orbArea}>
            <View
              accessible
              accessibilityLabel={
                finished
                  ? 'Phiên thở đã kết thúc'
                  : `${phase.label}, ${phase.remaining} giây. ${phase.hint}`
              }
              style={styles.ring}
            >
              <View style={styles.track} />
              {Array.from({ length: 120 }, (_, index) => {
                const angle = (index * Math.PI * 2) / 120 - Math.PI / 2
                return (
                  <View
                    key={index}
                    accessible={false}
                    style={[
                      styles.ringSegment,
                      {
                        left: 108.75 + 108 * Math.cos(angle),
                        top: 110 + 108 * Math.sin(angle),
                        backgroundColor:
                          index / 120 <= cycleProgress
                            ? colors.tealDeep
                            : '#dae7df',
                        transform: [{ rotate: `${index * 3}deg` }],
                      },
                    ]}
                  />
                )
              })}
              <Animated.View style={[styles.orb, { transform: [{ scale }] }]}>
                <Text style={[styles.phase, sans]}>
                  {finished
                    ? 'THẢ LỎNG'
                    : phase.label.toLocaleUpperCase('vi-VN')}
                </Text>
                <Text style={[styles.phaseTime, serif]}>
                  {finished ? '✓' : `${phase.remaining}s`}
                </Text>
                <Text style={[styles.phaseHint, sans]}>
                  {finished ? 'Trở về nhịp tự nhiên' : phase.hint}
                </Text>
              </Animated.View>
            </View>
          </View>
          <View style={styles.metrics}>
            <View style={styles.metric}>
              <Text
                testID="breathing-remaining"
                style={[styles.metricValue, serif]}
              >
                {timeLabel(remaining)}
              </Text>
              <Text style={[styles.small, sans]}>Thời gian còn lại</Text>
            </View>
            <View style={[styles.metric, styles.metricDivider]}>
              <Text style={[styles.metricValue, serif]}>
                {cycle}/{practice.cycleCount}
              </Text>
              <Text style={[styles.small, sans]}>Chu kỳ nhịp thở</Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              running
                ? 'Tạm dừng phiên thở'
                : finished
                  ? 'Bắt đầu phiên thở mới'
                  : remaining < practice.durationSeconds
                    ? 'Tiếp tục phiên thở'
                    : 'Bắt đầu phiên thở'
            }
            disabled={saving}
            onPress={startPause}
            style={[styles.primaryButton, saving && styles.disabled]}
          >
            <Text style={[styles.primaryText, semibold]}>
              {running
                ? 'Ⅱ  Tạm dừng'
                : finished
                  ? '↻  Tập lại từ đầu'
                  : remaining < practice.durationSeconds
                    ? '▷  Tiếp tục phiên thở'
                    : '▷  Bắt đầu phiên thở'}
            </Text>
          </Pressable>
          {finished ? (
            <Text
              accessibilityLiveRegion="polite"
              style={[styles.body, styles.center, sans]}
            >
              Bạn đã dành một khoảng nghỉ cho mình. Xác nhận bên dưới nếu muốn
              lưu phiên tập.
            </Text>
          ) : null}
        </View>

        <BreathingMedia
          resource={resource}
          onVideoPlaying={pause}
          fontsLoaded={fontsLoaded}
        >
          <View style={styles.adviceSection}>
            <View style={styles.rowBetween}>
              <Text
                accessibilityRole="header"
                style={[styles.sectionTitle, serif]}
              >
                Điều bạn cần biết trước khi thở
              </Text>
              <Text style={[styles.small, sans]}>3 lưu ý</Text>
            </View>
            {advice.map((item, index) => (
              <View key={item.title} style={styles.advice}>
                <View
                  style={[styles.adviceIcon, { backgroundColor: item.color }]}
                >
                  <Text accessible={false} style={styles.icon}>
                    {item.icon}
                  </Text>
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.adviceTitle, semibold]}>
                    {index + 1}. {item.title}
                  </Text>
                  <Text style={[styles.body, sans]}>{item.text}</Text>
                </View>
              </View>
            ))}
          </View>
        </BreathingMedia>

        <View style={styles.quoteCard}>
          <Text accessible={false} style={[styles.quoteMark, serif]}>
            ❞
          </Text>
          <View style={styles.flex}>
            <Text style={[styles.quote, italic]}>
              “Không cần làm mọi thứ cùng lúc. Một nhịp thở chậm cũng đã là một
              bước chăm sóc bản thân.”
            </Text>
            <Text style={[styles.small, sans]}>Ghi nhớ từ MentalBridge</Text>
          </View>
        </View>
        <View style={styles.progressCard}>
          <View style={styles.rowBetween}>
            <Text style={[styles.adviceTitle, semibold]}>
              ☑ Tiến trình hôm nay
            </Text>
            <Text style={[styles.chip, completed && styles.savedChip, sans]}>
              {completed ? 'Đã lưu' : 'Chưa lưu'}
            </Text>
          </View>
          <Text style={[styles.body, sans]}>
            Sau khi kết thúc bài tập, hãy xác nhận để đồng bộ vào nhật ký phục
            hồi cảm xúc và chuỗi ngày chăm sóc của bạn.
          </Text>
          {!progressReady ? (
            <View>
              <Text style={[styles.body, progressError && styles.error, sans]}>
                {progressError
                  ? 'Chưa tải được tiến độ. Hãy thử lại trước khi lưu.'
                  : 'Đang tải tiến độ…'}
              </Text>
              {progressError ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={onRetryProgress}
                  style={styles.back}
                >
                  <Text style={[styles.link, semibold]}>
                    Thử tải lại tiến độ
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          <View style={styles.row}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Xác nhận hoàn thành bài thở"
              accessibilityState={{ disabled: !progressReady || saving }}
              disabled={!progressReady || saving}
              onPress={() => {
                pause()
                setConfirmationOpen(true)
              }}
              style={[
                styles.confirmButton,
                (!progressReady || saving) && styles.disabled,
              ]}
            >
              <Text style={[styles.confirmText, semibold]}>
                {saving ? 'Đang lưu…' : '✓  Xác nhận hoàn thành'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đặt lại phiên thở"
              disabled={saving}
              onPress={reset}
              style={styles.resetButton}
            >
              <Text accessible={false} style={styles.icon}>
                ↻
              </Text>
            </Pressable>
          </View>
          {message ? (
            <Text
              accessibilityLiveRegion="polite"
              style={[
                styles.body,
                message.tone === 'error' ? styles.error : styles.link,
                sans,
              ]}
            >
              {message.message}
            </Text>
          ) : null}
        </View>
        <View style={styles.sourceCard}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showContent }}
            onPress={() => setShowContent((value) => !value)}
            style={styles.rowBetween}
          >
            <Text style={[styles.link, semibold]}>
              Nội dung & nguồn hướng dẫn
            </Text>
            <Text accessible={false} style={styles.icon}>
              {showContent ? '−' : '+'}
            </Text>
          </Pressable>
          {showContent ? (
            <View style={styles.sourceContent}>
              {[
                content.overview,
                content.whenUseful,
                ...content.keyIdeas,
                ...content.steps,
                ...safety,
                content.nextStep,
              ]
                .filter(Boolean)
                .map((text, index) => (
                  <Text key={index} style={[styles.body, sans]}>
                    {text}
                  </Text>
                ))}
              <Text style={[styles.adviceTitle, semibold]}>
                {resource.sourceTitle ?? resource.sourceOrganization}
              </Text>
              {resource.sourceReviewNote ? (
                <Text style={[styles.body, sans]}>
                  {resource.sourceReviewNote}
                </Text>
              ) : null}
              {resource.sourceUrl?.startsWith('https://') ? (
                <Pressable
                  accessibilityRole="link"
                  onPress={() =>
                    void Linking.openURL(resource.sourceUrl!).catch(
                      () => undefined,
                    )
                  }
                  style={styles.back}
                >
                  <Text style={[styles.link, semibold]}>
                    Xem nguồn tham khảo ↗
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
        <Text style={[styles.boundary, sans]}>
          Nội dung hỗ trợ tự chăm sóc, không dùng để chẩn đoán hoặc thay thế
          đánh giá và điều trị từ chuyên gia.
        </Text>
        <Modal
          visible={confirmationOpen}
          transparent
          animationType={reduceMotion ? 'none' : 'fade'}
          onRequestClose={() => {
            if (!saving) setConfirmationOpen(false)
          }}
        >
          <View style={styles.modalBackdrop}>
            <View accessibilityViewIsModal style={styles.dialog}>
              <Text
                accessibilityRole="header"
                style={[styles.sectionTitle, serif]}
              >
                Ghi nhận phiên tập?
              </Text>
              <Text style={[styles.body, sans]}>
                MentalBridge sẽ lưu kết quả hoàn thành cho ngày này. Bạn vẫn có
                thể quay lại thực hành vào lúc khác.
              </Text>
              {message?.tone === 'error' ? (
                <Text
                  accessibilityRole="alert"
                  style={[styles.body, styles.error, sans]}
                >
                  {message.message}
                </Text>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Lưu xác nhận hoàn thành"
                disabled={saving}
                onPress={() => void confirmCompletion()}
                style={[styles.primaryButton, saving && styles.disabled]}
              >
                <Text style={[styles.primaryText, semibold]}>
                  {saving ? 'Đang lưu…' : 'Xác nhận hoàn thành'}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={() => setConfirmationOpen(false)}
                style={styles.later}
              >
                <Text style={[styles.link, semibold]}>Để sau</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  page: { gap: spacing.lg },
  flex: { flex: 1, minWidth: 0 },
  masthead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  brandIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealDeep,
  },
  brandMark: { color: colors.white, fontSize: 24 },
  brand: { color: colors.ink, fontSize: 19 },
  homeButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    backgroundColor: '#e7f1eb',
    borderRadius: radii.pill,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  back: { minHeight: 44, justifyContent: 'center' },
  link: { color: colors.tealDeep, fontSize: 12, fontWeight: '600' },
  small: { color: colors.inkSoft, fontSize: 11, lineHeight: 17 },
  mintChip: {
    color: colors.tealDeep,
    backgroundColor: '#cef2e0',
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 10,
  },
  intro: { gap: spacing.md },
  title: { flex: 1, color: colors.ink, fontSize: 25, lineHeight: 34 },
  body: { color: colors.inkSoft, fontSize: 13, lineHeight: 21 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    backgroundColor: '#eaf0eb',
    color: colors.inkSoft,
    fontSize: 10,
    lineHeight: 16,
    borderRadius: radii.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  bookmark: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eaf0eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookmarkIcon: { color: colors.tealDeep, fontSize: 24 },
  pacer: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
    borderRadius: 24,
    backgroundColor: colors.surface,
    gap: spacing.lg,
    borderWidth: 1,
    borderColor: '#eef3ef',
  },
  status: { color: colors.tealDeep, fontSize: 11 },
  orbArea: { alignItems: 'center', paddingVertical: spacing.md },
  ring: {
    width: 224,
    height: 224,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderWidth: 4,
    borderColor: '#dae7df',
    borderRadius: 110,
  },
  ringSegment: { position: 'absolute', width: 6.5, height: 4, borderRadius: 2 },
  orb: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: colors.tealDeep,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  phase: { color: '#d5efe3', fontSize: 12 },
  phaseTime: { color: colors.white, fontSize: 34, lineHeight: 42 },
  phaseHint: { color: '#c6e3d5', fontSize: 11 },
  metrics: { flexDirection: 'row', marginHorizontal: spacing.xl },
  metric: { flex: 1, alignItems: 'center', gap: 4 },
  metricDivider: { borderLeftWidth: 1, borderColor: '#e3ebe5' },
  metricValue: {
    fontSize: 24,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.tealDeep,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  primaryText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
  },
  center: { textAlign: 'center' },
  disabled: { opacity: 0.5 },
  adviceSection: { gap: spacing.sm },
  sectionTitle: {
    flexShrink: 1,
    color: colors.ink,
    fontSize: 18,
    lineHeight: 27,
  },
  advice: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#edf2ee',
  },
  adviceIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { color: colors.tealDeep, fontSize: 22 },
  adviceTitle: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 21,
    fontWeight: '600',
  },
  quoteCard: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: 20,
    backgroundColor: '#eaf0eb',
  },
  quoteMark: { color: colors.teal, fontSize: 29 },
  quote: {
    color: colors.ink,
    fontSize: 19,
    lineHeight: 31,
    fontStyle: 'italic',
    marginBottom: spacing.md,
  },
  progressCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: '#edf2ee',
  },
  savedChip: { backgroundColor: '#cef2e0', color: colors.tealDeep },
  confirmButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.pill,
    backgroundColor: '#b8edd6',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  confirmText: {
    color: colors.tealDeep,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  resetButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f4f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceCard: {
    backgroundColor: '#edf3ee',
    borderRadius: 18,
    padding: spacing.lg,
  },
  sourceContent: { gap: spacing.md, paddingTop: spacing.md },
  error: { color: '#9b352d' },
  boundary: {
    color: colors.inkFaint,
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xl,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,42,33,0.45)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  dialog: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 440,
    borderRadius: 24,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  later: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
})
