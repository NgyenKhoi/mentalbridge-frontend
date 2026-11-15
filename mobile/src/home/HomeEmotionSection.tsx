import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'

import { useSession } from '@/auth/session-context'
import { emphasisEasing, useRevealProps } from '@/components/motion'
import type { EmotionApi } from '@/emotion/emotion-api'
import type { Emotion } from '@/emotion/emotion-contract'
import { emotionByValue } from '@/emotion/emotion-presentation'
import { emotionKeys } from '@/emotion/use-emotion-check-in'
import { dashboardColors as colors, Txt } from '@/theme/dashboard'
import { radii, spacing } from '@/theme/tokens'

import { EmotionCheckInCard } from './EmotionCheckInCard'
import { homeEmotionWeek } from './emotion-week'
import { HomeLink } from './HomeLink'

const dailyMessages: Record<Emotion, { title: string; body: string }> = {
  GREAT: {
    title: 'Một khoảnh khắc đáng trân trọng',
    body: 'Điều gì đã làm ngày hôm nay của bạn thật vui? Bạn có thể giữ lại khoảnh khắc ấy bằng vài dòng để đọc lại khi muốn.',
  },
  GOOD: {
    title: 'Dành chỗ cho những điều đang tốt',
    body: 'Một niềm vui nhỏ cũng đáng được ghi nhớ. Nếu muốn, hãy viết lại điều đã khiến hôm nay dễ chịu hơn với bạn.',
  },
  OKAY: {
    title: 'Cứ đi theo nhịp của bạn',
    body: 'Những ngày bình thường cũng có câu chuyện riêng. Bạn có thể dành một chút thời gian để nhìn lại điều đang ở trong tâm trí mình.',
  },
  LOW: {
    title: 'Hôm nay, hãy nhẹ nhàng với mình',
    body: 'Bạn không cần làm mọi thứ cùng lúc. Nếu muốn, hãy cho mình một khoảng nghỉ, viết vài dòng hoặc trò chuyện với người bạn tin tưởng.',
  },
  VERY_LOW: {
    title: 'Bạn không cần gồng mình một mình',
    body: 'Cảm ơn bạn đã dành thời gian lắng nghe cảm xúc của mình. Bạn có thể viết ra điều đang nặng lòng hoặc tìm một người tin tưởng để chia sẻ, khi sẵn sàng.',
  },
}
const fallbackMessage = {
  title: 'Dành một phút để lắng nghe mình',
  body: 'Bạn đang cảm thấy thế nào? Khi bạn lưu cảm xúc hôm nay, một lời nhắn dành cho cảm xúc ấy sẽ xuất hiện ở đây.',
}

/** Pops in once on first load (240 ms + i * 40 ms); today's face drops in after a save. */
function Face({
  emotion,
  index,
  drop,
}: Readonly<{ emotion: Emotion; index: number; drop: boolean }>) {
  const reduceMotion = useReducedMotion()
  const progress = useSharedValue(reduceMotion ? 1 : 0)
  useEffect(() => {
    if (reduceMotion) return
    progress.value = withDelay(
      drop ? 0 : 240 + index * 40,
      withTiming(1, { duration: 240, easing: emphasisEasing }),
    )
  }, [drop, index, progress, reduceMotion])
  // Drop keeps full opacity: on device the remount after a save left opacity stuck at 0, hiding today's face.
  const style = useAnimatedStyle(() => ({
    opacity: drop ? 1 : progress.value,
    transform: drop
      ? [{ translateY: -8 + 8 * progress.value }]
      : [{ scale: 0.85 + 0.15 * progress.value }],
  }))
  return (
    <Animated.View style={style}>
      <Text accessible={false} style={styles.face}>
        {emotionByValue.get(emotion)?.emoji}
      </Text>
    </Animated.View>
  )
}

function EmotionWeek({ api }: Readonly<{ api: EmotionApi }>) {
  const { session } = useSession()
  const subject = session?.subject
  const reveal = useRevealProps()
  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    [],
  )
  const progress = useQuery({
    queryKey: emotionKeys.progress(subject, timezone),
    enabled: Boolean(subject),
    queryFn: () => api.getProgress(timezone),
  })
  const list = useQuery({
    queryKey: emotionKeys.history(subject, 7),
    enabled: Boolean(subject),
    queryFn: () => api.listCheckIns(7),
  })
  const days =
    progress.data && list.data
      ? homeEmotionWeek(progress.data.asOfLocalDate, list.data.items)
      : null
  const failed =
    !days &&
    (progress.isError || list.isError) &&
    !progress.isFetching &&
    !list.isFetching
  const yesterday = days?.[5]?.emotion
  const today = days?.[6]?.emotion
  const message = today ? dailyMessages[today] : fallbackMessage
  const recorded = days?.filter((day) => day.emotion).length ?? 0
  // The first successful load pops; later loads (after a save) drop today in.
  const [firstLoadAt, setFirstLoadAt] = useState<number | null>(null)
  if (days && firstLoadAt === null) setFirstLoadAt(list.dataUpdatedAt)
  const refreshed = firstLoadAt !== null && list.dataUpdatedAt > firstLoadAt

  return (
    <View style={styles.card} testID="home-emotion-week">
      <View style={styles.header}>
        <Txt accessibilityRole="header" style={styles.title}>
          Tuần này của bạn
        </Txt>
        <HomeLink
          label="Xem tiến độ →"
          onPress={() => router.push('/(user)/emotion')}
        />
      </View>
      {days ? (
        <Animated.View {...reveal} style={styles.body}>
          <View accessibilityRole="list" style={styles.row}>
            {days.map((day, index) => {
              const d = Number(day.localDate.slice(8))
              const m = Number(day.localDate.slice(5, 7))
              const name = day.emotion
                ? emotionByValue.get(day.emotion)?.label
                : 'Chưa ghi nhận'
              return (
                <View
                  key={day.localDate}
                  accessible
                  accessibilityLabel={`${day.label} ${d}/${m}: ${name}`}
                  style={[styles.day, day.today && styles.dayActive]}
                >
                  <Txt style={[styles.dayLabel, day.today && styles.lightText]}>
                    {day.label}
                  </Txt>
                  <View
                    key={day.emotion ?? 'none'}
                    style={[
                      styles.ring,
                      !day.emotion &&
                        (day.today ? styles.ringEmptyActive : styles.ringEmpty),
                    ]}
                    testID={`home-emotion-ring-${day.localDate}`}
                  >
                    {day.emotion ? (
                      <Face
                        key={`${day.localDate}:${day.emotion}`}
                        emotion={day.emotion}
                        index={index}
                        drop={day.today && refreshed}
                      />
                    ) : null}
                  </View>
                  <Txt
                    style={[styles.dayNumber, day.today && styles.lightText]}
                  >
                    {d}
                  </Txt>
                </View>
              )
            })}
          </View>
          <Txt style={styles.supporting}>
            {yesterday
              ? `Hôm qua bạn chọn ${emotionByValue.get(yesterday)?.label}.`
              : 'Hôm qua chưa có ghi nhận.'}
          </Txt>
          <View accessibilityLiveRegion="polite" style={styles.message}>
            <View style={styles.messageHead}>
              <Txt style={styles.messageLabel}>Một lời nhắn cho bạn</Txt>
              {today ? (
                <Txt style={styles.todayChip}>
                  {`Hôm nay: ${emotionByValue.get(today)?.label}`}
                </Txt>
              ) : null}
            </View>
            <Txt style={styles.messageTitle}>{message.title}</Txt>
            <Txt style={styles.supporting}>{message.body}</Txt>
            {today ? (
              <HomeLink
                label="Viết vài dòng cho mình →"
                onPress={() => router.push('/(user)/journal')}
              />
            ) : null}
            <Txt style={styles.recorded}>
              {recorded > 0
                ? `Bạn đã dành thời gian ghi nhận cảm xúc ${recorded}/7 ngày gần đây.`
                : 'Bạn có thể bắt đầu từ hôm nay, theo nhịp của mình.'}
            </Txt>
          </View>
        </Animated.View>
      ) : failed ? (
        <View style={styles.body}>
          <Txt accessibilityLiveRegion="assertive" style={styles.error}>
            Chưa tải được cảm xúc tuần này.
          </Txt>
          <HomeLink
            label="Thử lại"
            loading={progress.isFetching || list.isFetching}
            onPress={() => {
              void progress.refetch()
              void list.refetch()
            }}
          />
        </View>
      ) : (
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Đang tải cảm xúc 7 ngày gần đây"
          style={styles.body}
        >
          <View style={styles.row}>
            {Array.from({ length: 7 }, (_, index) => (
              <View key={index} style={styles.day}>
                <View style={styles.skeletonLabel} />
                <View style={[styles.ring, styles.ringEmpty]} />
                <View style={styles.skeletonLabel} />
              </View>
            ))}
          </View>
          <View style={styles.skeletonMessage} />
        </View>
      )}
    </View>
  )
}

export function HomeEmotionSection({
  api,
  highlight = false,
}: Readonly<{ api: EmotionApi; highlight?: boolean }>) {
  return (
    <View style={styles.section} testID="home-emotion-section">
      <EmotionCheckInCard api={api} highlight={highlight} />
      <EmotionWeek api={api} />
    </View>
  )
}

const styles = StyleSheet.create({
  section: { gap: spacing.md, marginTop: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.shell,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  body: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.xs },
  day: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.control,
    flex: 1,
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 88,
    paddingVertical: spacing.sm,
  },
  dayActive: { backgroundColor: colors.tealDeep },
  dayLabel: { color: colors.inkSoft, fontSize: 11, fontWeight: '600' },
  dayNumber: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  lightText: { color: colors.white },
  ring: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: radii.pill,
    borderWidth: 1.5,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  ringEmpty: { borderColor: '#C9CFD6' },
  ringEmptyActive: { borderColor: 'rgba(255, 255, 255, 0.55)' },
  face: { fontSize: 22, lineHeight: 28 },
  supporting: { color: colors.inkSoft, fontSize: 15, lineHeight: 22 },
  message: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.control,
    gap: spacing.sm,
    minHeight: 168,
    padding: spacing.md,
  },
  messageHead: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  messageLabel: { color: colors.inkSoft, fontSize: 13, fontWeight: '600' },
  todayChip: {
    backgroundColor: colors.tealPale,
    borderRadius: radii.pill,
    color: colors.tealDeep,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  messageTitle: { color: colors.ink, fontSize: 17, fontWeight: '700' },
  recorded: { color: colors.inkFaint, fontSize: 13, lineHeight: 19 },
  error: { color: '#9B352D', fontSize: 15, lineHeight: 22 },
  skeletonLabel: {
    backgroundColor: '#E1E5E3',
    borderRadius: radii.pill,
    height: 10,
    width: 16,
  },
  skeletonMessage: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.control,
    minHeight: 168,
  },
})
