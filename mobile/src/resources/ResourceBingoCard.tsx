import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useRef } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { ApiError } from '@/api/api-error'
import { PrimaryButton } from '@/components/PrimaryButton'
import type { RewardApi } from '@/rewards/reward-api'
import type { ResourceBingoBoard } from '@/rewards/reward-contract'
import type { SupportPlanActionApi } from '@/support-plan/support-plan-action-api'
import { colors, radii, spacing } from '@/theme/tokens'

import { shiftLocalDate } from './resource-model'

const winLines = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
  [1, 4, 7],
  [2, 5, 8],
  [3, 6, 9],
  [1, 5, 9],
  [3, 5, 7],
]

export function ResourceBingoCard({
  api,
  planApi,
  subject,
  today,
  timezone,
  fontsLoaded,
}: Readonly<{
  api: RewardApi
  planApi: SupportPlanActionApi
  subject: string
  today: string
  timezone: string
  fontsLoaded: boolean
}>) {
  const client = useQueryClient()
  const saving = useRef(false)
  const day = new Date(`${today}T00:00:00Z`).getUTCDay()
  const weekStart = shiftLocalDate(today, -((day + 6) % 7))
  const plan = useQuery({
    queryKey: ['resources-bingo-plan', subject],
    retry: false,
    queryFn: async () => {
      try {
        return await planApi.getCurrent()
      } catch (error) {
        if (
          error instanceof ApiError &&
          error.status === 404 &&
          error.code === 'SUPPORT_PLAN_CURRENT_NOT_FOUND'
        )
          return null
        throw error
      }
    },
  })
  const key = [
    'resources-bingo-board',
    subject,
    weekStart,
    timezone,
    plan.data?.supportPlanId,
    plan.data?.version,
  ] as const
  const board = useQuery({
    queryKey: key,
    enabled: plan.isSuccess,
    retry: false,
    queryFn: async (): Promise<{
      board: ResourceBingoBoard
      etag: string
    } | null> => {
      let result: { board: ResourceBingoBoard; etag: string }
      if (plan.data?.status === 'ACTIVE' || plan.data?.status === 'PAUSED') {
        result = await api.syncBingo(weekStart, timezone)
      } else {
        try {
          result = await api.getBingo(weekStart)
        } catch (error) {
          if (error instanceof ApiError && error.status === 404) return null
          throw error
        }
      }
      if (result.board.weekStart !== weekStart)
        throw new Error('Bingo response does not match the requested week')
      return result
    },
  })
  const update = useMutation({
    mutationFn: async ({
      position,
      marked,
    }: {
      position: number
      marked: boolean
    }) => {
      if (!board.data || board.isFetching || plan.data?.status !== 'ACTIVE')
        throw new Error('Bingo is not ready')
      return api.setBingoSelfConfirmation(
        weekStart,
        position,
        marked,
        board.data.etag,
      )
    },
    onSuccess: (result) => client.setQueryData(key, result),
    onError: () => {
      void board.refetch()
    },
    onSettled: () => {
      saving.current = false
    },
  })
  const items = board.data?.board.items ?? []
  const marked = items.filter(
    (item) => item.evidence !== 'NONE' || item.selfConfirmedAt !== null,
  )
  const markedPositions = new Set(marked.map((item) => item.position))
  const won = winLines.some((line) =>
    line.every((position) => markedPositions.has(position)),
  )
  const failed = plan.isError || board.isError
  const loading = plan.isPending || (plan.isSuccess && board.isPending)
  const percent = items.length
    ? Math.round((marked.length / items.length) * 100)
    : 0

  return (
    <View style={styles.card} testID="resources-bingo">
      <View style={styles.heading}>
        <View style={styles.flex}>
          <Text
            accessibilityRole="header"
            style={[styles.title, fontsLoaded && styles.serif]}
          >
            Bingo Thói Quen Tâm Trí
          </Text>
          <Text style={styles.small}>
            Tuần từ{' '}
            {new Intl.DateTimeFormat('vi-VN', {
              day: 'numeric',
              month: 'numeric',
              timeZone: 'UTC',
            }).format(new Date(`${weekStart}T00:00:00Z`))}
          </Text>
        </View>
        {items.length ? (
          <Text style={styles.count}>
            {marked.length}/{items.length} ô · {percent}%
          </Text>
        ) : null}
      </View>
      {loading ? (
        <ActivityIndicator
          accessibilityLabel="Đang tải Bingo"
          color={colors.tealDeep}
        />
      ) : null}
      {failed ? (
        <>
          <Text accessibilityRole="alert" style={styles.small}>
            Chưa thể tải Bingo tuần này.
          </Text>
          <PrimaryButton
            label="Thử tải lại Bingo"
            tone="light"
            onPress={() => {
              void (plan.isError ? plan.refetch() : board.refetch())
            }}
          />
        </>
      ) : !loading && !items.length ? (
        <>
          <Text style={styles.small}>
            Chưa có Bingo từ kế hoạch hiện tại. Bạn có thể xem các hoạt động
            trong kế hoạch của mình.
          </Text>
          <PrimaryButton
            label="Xem kế hoạch"
            tone="light"
            onPress={() => router.push('/(user)/support-plan')}
          />
        </>
      ) : null}
      {items.length ? (
        <>
          <View
            accessibilityRole="progressbar"
            accessibilityValue={{
              min: 0,
              max: items.length,
              now: marked.length,
            }}
            accessibilityLabel="Hoạt động Bingo đã đánh dấu"
            style={styles.track}
          >
            <View style={[styles.fill, { width: `${percent}%` }]} />
          </View>
          <View style={styles.grid}>
            {Array.from({ length: 9 }, (_, index) => {
              const position = index + 1
              const cellKey = `bingo-position-${position}`
              const item = items.find((entry) => entry.position === position)
              if (!item)
                return (
                  <View
                    key={cellKey}
                    style={[styles.tile, styles.empty]}
                    accessible
                    accessibilityLabel="Ô trống"
                  >
                    <Text style={styles.small}>Chưa có hoạt động</Text>
                  </View>
                )
              const confirmed =
                item.selfConfirmedAt !== null ||
                item.evidence === 'SELF_CONFIRMED'
              const checked = confirmed || item.evidence === 'CONTENT_VERIFIED'
              const disabled =
                failed ||
                update.isPending ||
                board.isFetching ||
                plan.data?.status !== 'ACTIVE' ||
                item.retired ||
                (item.evidence === 'CONTENT_VERIFIED' && !confirmed)
              return (
                <Pressable
                  key={cellKey}
                  accessibilityRole="checkbox"
                  accessibilityLabel={item.label}
                  accessibilityHint={
                    item.retired
                      ? 'Hoạt động không còn trong kế hoạch'
                      : item.evidence === 'CONTENT_VERIFIED'
                        ? 'Đã được xác minh từ hoạt động'
                        : 'Tự đánh dấu hoạt động bạn đã làm'
                  }
                  accessibilityState={{ checked, disabled }}
                  disabled={disabled}
                  onPress={() => {
                    if (saving.current) return
                    saving.current = true
                    update.mutate({
                      position: item.position,
                      marked: !confirmed,
                    })
                  }}
                  style={({ pressed }) => [
                    styles.tile,
                    checked && styles.marked,
                    item.retired && styles.retired,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    accessible={false}
                    style={[styles.check, checked && styles.checked]}
                  >
                    {checked ? '✓' : '○'}
                  </Text>
                  <Text style={styles.tileLabel} numberOfLines={4}>
                    {item.label}
                  </Text>
                  <Text style={styles.tileState}>
                    {item.retired
                      ? 'Đã dừng'
                      : item.evidence === 'CONTENT_VERIFIED'
                        ? 'Đã xác minh'
                        : confirmed
                          ? 'Tự đánh dấu'
                          : 'Chạm để ghi'}
                  </Text>
                </Pressable>
              )
            })}
          </View>
          <Text accessibilityLiveRegion="polite" style={styles.note}>
            {won
              ? 'Bạn đã hoàn thành một đường Bingo!'
              : 'Chạm vào ô để đánh dấu hoạt động bạn đã thực hiện.'}
          </Text>
          {plan.data?.status !== 'ACTIVE' ? (
            <Text style={styles.small}>Bảng đang ở chế độ chỉ xem.</Text>
          ) : null}
          {update.isError ? (
            <Text accessibilityRole="alert" style={styles.small}>
              Chưa lưu được dấu vừa chọn. Bảng đã được tải lại để bạn thử tiếp.
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: '#e7eee9',
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  flex: { flex: 1, minWidth: 170 },
  title: { fontSize: 19, lineHeight: 27, color: colors.ink },
  serif: { fontFamily: 'ResourceSerif' },
  small: { color: colors.inkSoft, fontSize: 12, lineHeight: 18 },
  count: {
    color: colors.tealDeep,
    backgroundColor: colors.tealPale,
    borderRadius: radii.pill,
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    fontSize: 12,
  },
  track: {
    height: 6,
    backgroundColor: '#edf1ee',
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: colors.tealDeep },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    flexBasis: '30%',
    flexGrow: 1,
    minHeight: 104,
    padding: spacing.sm,
    borderRadius: 18,
    backgroundColor: '#edf1ee',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  empty: { opacity: 0.6 },
  marked: { backgroundColor: '#d4e5db' },
  retired: { opacity: 0.55 },
  check: {
    width: 22,
    lineHeight: 22,
    textAlign: 'center',
    borderRadius: radii.pill,
    overflow: 'hidden',
    color: colors.tealDeep,
  },
  checked: { color: colors.white, backgroundColor: colors.tealDeep },
  tileLabel: {
    color: colors.ink,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  tileState: { color: colors.inkSoft, fontSize: 10, textAlign: 'center' },
  note: {
    backgroundColor: '#eaf2ed',
    borderRadius: 15,
    padding: spacing.md,
    color: colors.tealDeep,
    fontSize: 13,
    lineHeight: 19,
  },
  pressed: { opacity: 0.7 },
})
