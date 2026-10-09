import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Pressable,
  Text,
  View,
} from 'react-native'

import { useSession } from '@/auth/session-context'
import { PrimaryButton } from '@/components/PrimaryButton'
import { Screen } from '@/components/Screen'

import { JournalAnalysisPanel } from './JournalAnalysisPanel'
import { JournalEditor } from './JournalEditor'
import type { JournalApi } from './journal-api'
import type { TrendRequest } from './journal-contract'
import {
  journalError,
  journalStyles as s,
  Notice,
  TextAction,
} from './journal-ui'

export function comparisonPeriods(days: 7 | 14 | 30, now: Date): TrendRequest {
  const end = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  )
  const duration = days * 86400000
  return {
    previousPeriod: {
      startAt: new Date(end - 2 * duration).toISOString(),
      endAt: new Date(end - duration).toISOString(),
    },
    currentPeriod: {
      startAt: new Date(end - duration).toISOString(),
      endAt: new Date(end).toISOString(),
    },
  }
}

function JournalContent({
  api,
  subject,
  onBack,
  now,
}: Readonly<{
  api: JournalApi
  subject: string
  onBack: () => void
  now: () => Date
}>) {
  const [selected, setSelected] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [comparison, setComparison] = useState(false)
  const [days, setDays] = useState<7 | 14 | 30>(7)
  // The periods are frozen while viewing a request so midnight cannot change
  // its identity or attach a completed result to different source windows.
  const [comparisonEnd] = useState(now)
  const list = useInfiniteQuery({
    queryKey: ['journal', subject, 'list'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.list(pageParam),
    getNextPageParam: (page) =>
      page.page.hasMore ? page.page.nextCursor : undefined,
    refetchOnMount: 'always',
    retry: false,
    gcTime: 0,
  })
  const detail = useQuery({
    queryKey: ['journal', subject, 'detail', selected],
    enabled: Boolean(selected && selected !== 'new'),
    queryFn: () => api.detail(selected!),
    refetchOnMount: 'always',
    retry: false,
    gcTime: 0,
  })
  const closeEditor = () => {
    setDirty(false)
    setSelected(null)
  }
  const back = () => {
    const leave = selected ? closeEditor : onBack
    if (!dirty) return leave()
    Alert.alert(
      'Rời bài viết?',
      'Phần chưa lưu sẽ mất. Nếu lần lưu chưa được xác nhận, hãy thử lưu lại trước.',
      [
        { text: 'Tiếp tục viết', style: 'cancel' },
        { text: 'Rời bài viết', style: 'destructive', onPress: leave },
      ],
    )
  }
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        back()
        return true
      },
    )
    return () => subscription.remove()
  })
  const request = comparisonPeriods(days, comparisonEnd)
  return (
    <Screen>
      <TextAction
        label={selected ? '← Về danh sách' : '← Trang của bạn'}
        onPress={back}
        testID="journal-back"
      />
      <Text accessibilityRole="header" style={s.title}>
        Nhật ký riêng tư
      </Text>
      {selected === 'new' ? (
        <JournalEditor
          api={api}
          subject={subject}
          onClose={closeEditor}
          onDirtyChange={setDirty}
        />
      ) : selected ? (
        <>
          {detail.isPending && !detail.data ? (
            <ActivityIndicator accessibilityLabel="Đang mở nhật ký" />
          ) : detail.isError && !detail.data ? (
            <View style={s.panel}>
              <Notice error>{journalError(detail.error)}</Notice>
              <TextAction
                label="Thử mở lại nhật ký"
                onPress={() => void detail.refetch()}
              />
            </View>
          ) : (
            detail.data && (
              <>
                {detail.isError && (
                  <Notice error>
                    Chưa làm mới được bài viết. Phần đang viết vẫn được giữ; lần
                    lưu tiếp theo sẽ kiểm tra bản đã tải.
                  </Notice>
                )}
                <JournalEditor
                  key={selected}
                  api={api}
                  subject={subject}
                  initialEntry={detail.data}
                  onClose={closeEditor}
                  onDirtyChange={setDirty}
                />
              </>
            )
          )}
        </>
      ) : (
        <>
          <View style={s.panel}>
            <Text style={s.body}>
              Một nơi để giữ lại điều bạn đã trải qua, theo cách của bạn.
            </Text>
            <PrimaryButton
              testID="journal-new"
              label="Viết bài mới"
              onPress={() => setSelected('new')}
            />
          </View>
          <View style={s.panel}>
            <Text accessibilityRole="header" style={s.heading}>
              Bài viết đã lưu
            </Text>
            {list.isPending ? (
              <ActivityIndicator accessibilityLabel="Đang tải nhật ký" />
            ) : list.isError ? (
              <>
                <Notice error>{journalError(list.error)}</Notice>
                <TextAction
                  label="Tải lại danh sách"
                  onPress={() => void list.refetch()}
                />
              </>
            ) : list.data?.pages[0]?.items.length === 0 ? (
              <Notice>
                Chưa có bài viết. Bắt đầu bằng một điều bạn muốn ghi lại hôm
                nay.
              </Notice>
            ) : (
              <>
                {list.data?.pages
                  .flatMap((page) => page.items)
                  .map((entry) => (
                    <Pressable
                      key={entry.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Mở nhật ký ${new Date(entry.occurredAt).toLocaleDateString('vi-VN')}`}
                      testID={`journal-entry-${entry.id}`}
                      onPress={() => setSelected(entry.id)}
                      style={s.choice}
                    >
                      <Text style={s.label}>
                        {new Date(entry.occurredAt).toLocaleDateString('vi-VN')}
                      </Text>
                      <Text style={s.body} numberOfLines={3}>
                        {entry.content.preview}
                      </Text>
                    </Pressable>
                  ))}
                {list.hasNextPage && (
                  <TextAction
                    label={
                      list.isFetchingNextPage
                        ? 'Đang tải…'
                        : 'Xem bài viết trước đó'
                    }
                    disabled={list.isFetchingNextPage}
                    onPress={() => void list.fetchNextPage()}
                  />
                )}
              </>
            )}
          </View>
          <TextAction
            label={
              comparison
                ? 'Ẩn phản ánh theo thời gian'
                : 'Nhìn lại nhật ký theo thời gian'
            }
            onPress={() => setComparison((value) => !value)}
          />
          {comparison && (
            <>
              <View style={s.panel}>
                <Text style={s.body}>
                  So sánh hai khoảng đã kết thúc, mỗi khoảng có cùng số ngày.
                  Chỉ dùng dữ liệu bạn đã lưu; hệ thống quyết định dữ liệu có đủ
                  để so sánh hay không.
                </Text>
                <View style={s.row}>
                  {([7, 14, 30] as const).map((value) => (
                    <Pressable
                      key={value}
                      accessibilityRole="button"
                      accessibilityState={{ selected: days === value }}
                      onPress={() => setDays(value)}
                      style={[s.choice, days === value && s.selected]}
                    >
                      <Text style={s.label}>{value} ngày mỗi khoảng</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={s.source}>
                  UTC: {request.previousPeriod.startAt.slice(0, 10)} →{' '}
                  {request.previousPeriod.endAt.slice(0, 10)} và{' '}
                  {request.currentPeriod.startAt.slice(0, 10)} →{' '}
                  {request.currentPeriod.endAt.slice(0, 10)}. Không gồm ngày
                  cuối mỗi khoảng.
                </Text>
              </View>
              <JournalAnalysisPanel
                key={`${subject}:${days}:${comparisonEnd.toISOString().slice(0, 10)}`}
                api={api}
                subject={subject}
                target={{ kind: 'TREND', request }}
              />
            </>
          )}
        </>
      )}
    </Screen>
  )
}

export function JournalScreen({
  api,
  onBack,
  now = () => new Date(),
}: Readonly<{ api: JournalApi; onBack: () => void; now?: () => Date }>) {
  const { session } = useSession()
  if (!session || session.role !== 'USER')
    return (
      <Screen>
        <Notice error>
          Đăng nhập bằng tài khoản của bạn để mở nhật ký riêng tư.
        </Notice>
      </Screen>
    )
  // A revision is scoped to an entry, not an account. Remount all local drafts
  // when the authenticated subject changes, even if navigation stays mounted.
  return (
    <JournalContent
      key={session.subject}
      api={api}
      subject={session.subject}
      onBack={onBack}
      now={now}
    />
  )
}
