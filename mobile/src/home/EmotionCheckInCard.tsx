import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native'
import Animated, {
  FadeIn,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { ApiError } from '@/api/api-error'
import { emphasisEasing, useMotionProps } from '@/components/motion'
import type { EmotionApi } from '@/emotion/emotion-api'
import { EmotionCheckInForm } from '@/emotion/EmotionCheckInForm'
import { emotionByValue } from '@/emotion/emotion-presentation'
import {
  useEmotionCheckIn,
  type EmotionCopy,
} from '@/emotion/use-emotion-check-in'
import { dashboardColors as colors, Txt } from '@/theme/dashboard'
import { radii, spacing } from '@/theme/tokens'

import { HomeLink } from './HomeLink'

const sessionExpired =
  'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.'
const copy: EmotionCopy = {
  conflict:
    'Ghi nhận đã thay đổi ở nơi khác. Bản mới nhất đã được tải; lựa chọn của bạn chưa được lưu.',
  failure: (error) =>
    error instanceof ApiError && error.status === 401
      ? sessionExpired
      : 'Chưa thể lưu thay đổi. Lựa chọn của bạn vẫn được giữ để thử lại.',
}
const fadeIn = FadeIn.duration(200)
const collapse = LinearTransition.duration(240)

function CheckMark({ animate }: Readonly<{ animate: boolean }>) {
  const reduceMotion = useReducedMotion()
  const grow = animate && !reduceMotion
  const scale = useSharedValue(grow ? 0.8 : 1)
  useEffect(() => {
    if (grow)
      scale.value = withTiming(1, { duration: 240, easing: emphasisEasing })
  }, [grow, scale])
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.check, style]}
    >
      <View style={styles.checkMark} />
    </Animated.View>
  )
}

/** One soft teal tint over the card (8 % to 0, 600 ms), when a push tap lands here. */
function TintPulse({ active }: Readonly<{ active: boolean }>) {
  const reduceMotion = useReducedMotion()
  const opacity = useSharedValue(0)
  useEffect(() => {
    if (!active || reduceMotion) return
    opacity.value = 1
    opacity.value = withTiming(0, { duration: 600 })
  }, [active, opacity, reduceMotion])
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }))
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.tint, style]}
    />
  )
}

export function EmotionCheckInCard({
  api,
  highlight = false,
}: Readonly<{ api: EmotionApi; highlight?: boolean }>) {
  const {
    localDate,
    todayQuery,
    current,
    draft,
    notice,
    dirty,
    saveDisabled,
    saveMutation,
    deleteMutation,
    editDraft,
    save,
    remove,
  } = useEmotionCheckIn({ api, copy })
  const [editing, setEditing] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const layout = useMotionProps({ layout: collapse })
  const entering = useMotionProps({ entering: fadeIn })

  const saved = current ? emotionByValue.get(current.emotion) : undefined
  const loadFailed = todayQuery.isError && todayQuery.data === undefined

  const confirmRemove = () =>
    Alert.alert(
      'Xóa ghi nhận hôm nay?',
      'Xóa ghi nhận này sẽ loại nó khỏi lịch sử và tiến độ.',
      [
        { text: 'Giữ lại', style: 'cancel' },
        {
          text: 'Xóa ghi nhận',
          style: 'destructive',
          onPress: () => remove(localDate),
        },
      ],
    )

  return (
    <Animated.View
      {...layout}
      style={styles.card}
      testID="home-emotion-checkin"
    >
      <Txt accessibilityRole="header" style={styles.title}>
        Cảm xúc hôm nay
      </Txt>

      {todayQuery.isPending ? (
        <View style={styles.loading}>
          <ActivityIndicator
            accessibilityLabel="Đang tải ghi nhận hôm nay"
            color={colors.tealDeep}
          />
        </View>
      ) : loadFailed ? (
        <Animated.View {...entering} style={styles.stack}>
          <Txt accessibilityLiveRegion="assertive" style={styles.error}>
            {todayQuery.error instanceof ApiError &&
            todayQuery.error.status === 401
              ? sessionExpired
              : 'Ghi nhận cảm xúc hôm nay tạm thời chưa tải được.'}
          </Txt>
          <HomeLink
            label="Thử lại"
            loading={todayQuery.isFetching}
            onPress={() => void todayQuery.refetch()}
          />
        </Animated.View>
      ) : current && saved && !editing ? (
        <Animated.View {...entering} style={styles.savedStack}>
          <View style={styles.savedRow}>
            <CheckMark animate={justSaved} />
            <View style={styles.savedCopy}>
              <Txt accessibilityLiveRegion="polite" style={styles.savedTitle}>
                {`Đã ghi nhận: ${saved.emoji} ${saved.label}`}
              </Txt>
              <Txt style={styles.supporting}>
                Cảm ơn bạn đã dành chút thời gian cho mình.
              </Txt>
            </View>
          </View>
          <HomeLink
            label="Viết thêm vào nhật ký →"
            onPress={() => router.push('/(user)/journal')}
          />
          <View style={styles.quietRow}>
            <HomeLink
              tone="quiet"
              label="Chỉnh sửa ghi nhận"
              onPress={() => setEditing(true)}
            />
            <HomeLink
              tone="quiet"
              label="Xóa ghi nhận"
              loading={deleteMutation.isPending}
              onPress={confirmRemove}
            />
          </View>
        </Animated.View>
      ) : (
        <View style={styles.stack}>
          {!current && (
            <Txt style={styles.supporting}>
              Chọn cảm xúc gần nhất với bạn lúc này
            </Txt>
          )}
          <EmotionCheckInForm
            variant="card"
            draft={draft}
            onChange={editDraft}
            onSave={() =>
              save(() => {
                setEditing(false)
                setJustSaved(true)
              })
            }
            saving={saveMutation.isPending}
            saveDisabled={saveDisabled}
            saveLabel={current ? 'Cập nhật ghi nhận' : 'Lưu ghi nhận'}
            unsaved={dirty && !saveMutation.isPending}
            footer={
              editing ? (
                <HomeLink
                  tone="quiet"
                  label="Hủy"
                  onPress={() => setEditing(false)}
                />
              ) : null
            }
          />
        </View>
      )}

      {notice?.tone === 'error' && (
        <Txt accessibilityLiveRegion="assertive" style={styles.error}>
          {notice.message}
        </Txt>
      )}
      <Txt style={styles.foot}>
        Đây là ghi nhận do bạn tự chọn, không phải chẩn đoán hay đánh giá an
        toàn.
      </Txt>
      <TintPulse active={highlight} />
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
    overflow: 'hidden',
    padding: spacing.lg,
  },
  tint: { backgroundColor: 'rgba(31, 92, 63, 0.08)' },
  title: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  stack: { gap: spacing.md },
  savedStack: { gap: spacing.xs },
  loading: { alignItems: 'center', justifyContent: 'center', minHeight: 132 },
  supporting: { color: colors.inkSoft, fontSize: 15, lineHeight: 22 },
  error: { color: '#9B352D', fontSize: 15, lineHeight: 22 },
  savedRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  savedCopy: { flex: 1, gap: spacing.xs },
  savedTitle: { color: colors.ink, fontSize: 17, fontWeight: '700' },
  check: {
    alignItems: 'center',
    backgroundColor: colors.tealDeep,
    borderRadius: radii.pill,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  checkMark: {
    borderColor: colors.white,
    borderBottomWidth: 2.5,
    borderRightWidth: 2.5,
    height: 14,
    marginTop: -3,
    transform: [{ rotate: '45deg' }],
    width: 8,
  },
  quietRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  foot: { color: colors.inkSoft, fontSize: 12, lineHeight: 17 },
})
