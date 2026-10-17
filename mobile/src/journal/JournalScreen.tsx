import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
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
import type { SupportPlanActionApi } from '@/support-plan/support-plan-action-api'
import {
  noJournalOrigin,
  resolveJournalPlanOrigin,
  type JournalOriginInput,
  type JournalPlanOrigin,
} from '@/support-plan/journal-plan-context'

import { JournalAnalysisPanel } from './JournalAnalysisPanel'
import { JournalEditor, type JournalNavigationState } from './JournalEditor'
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
  planOrigin,
  planApi,
  onReturnToPlan,
  onNavigationStateChange,
}: Readonly<{
  api: JournalApi
  subject: string
  onBack: () => void
  now: () => Date
  planOrigin: JournalOriginInput
  planApi?: Pick<SupportPlanActionApi, 'getCurrent' | 'getOccurrences'>
  onReturnToPlan?: (origin: JournalPlanOrigin) => void
  onNavigationStateChange?: (state: JournalNavigationState) => void
}>) {
  const [selected, setSelected] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [navigationState, setNavigationState] =
    useState<JournalNavigationState>({
      dirty: false,
      busy: false,
      uncertain: false,
    })
  const navigationRef = useRef(navigationState)
  const [requestedOrigin] = useState(planOrigin)
  const [writingOrigin, setWritingOrigin] = useState<JournalPlanOrigin | null>(
    null,
  )
  const [candidate, setCandidate] = useState<string | null>(null)
  const [returning, setReturning] = useState(false)
  const [returnNotice, setReturnNotice] = useState('')
  const [openedOrigin, setOpenedOrigin] = useState(false)
  const returnRunning = useRef(false)
  const contextChanged =
    JSON.stringify(requestedOrigin) !== JSON.stringify(planOrigin)
  const originContext = useQuery({
    queryKey: ['journal', subject, 'plan-origin', requestedOrigin],
    enabled: requestedOrigin.state === 'valid' && Boolean(planApi),
    queryFn: () =>
      requestedOrigin.state === 'valid' && planApi
        ? resolveJournalPlanOrigin(planApi, requestedOrigin.value, now())
        : null,
    retry: false,
    refetchOnMount: 'always',
    gcTime: 0,
  })
  // Open once after the owned read becomes available. Guarded render adjustment
  // avoids an effect that could mount a second editor over an existing draft.
  if (!openedOrigin && originContext.data) {
    setOpenedOrigin(true)
    const resolved = originContext.data
    if (
      resolved.origin.journalId &&
      resolved.occurrence.completionEvidence?.factId ===
        resolved.origin.journalId
    ) {
      setSelected(resolved.origin.journalId)
    } else if (resolved.canWrite) {
      setWritingOrigin(resolved.origin)
      setSelected('new')
    }
  }
  useEffect(() => {
    onNavigationStateChange?.({
      ...navigationState,
      busy: navigationState.busy || returning,
    })
  }, [navigationState, returning, onNavigationStateChange])
  const editorNavigation = useCallback((state: JournalNavigationState) => {
    navigationRef.current = state
    setNavigationState(state)
  }, [])
  const created = (journalId: string) => {
    if (writingOrigin) {
      setCandidate(journalId)
      setReturnNotice(
        'Đã lưu bài nhật ký. Quay lại hoạt động để kiểm tra ghi nhận; việc lưu chưa tự hoàn thành hoạt động.',
      )
    }
  }
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
    setWritingOrigin(null)
  }
  const returnToPlan = () => {
    if (
      returnRunning.current ||
      navigationRef.current.busy ||
      navigationRef.current.uncertain ||
      requestedOrigin.state !== 'valid' ||
      !planApi ||
      !onReturnToPlan
    )
      return
    const perform = async () => {
      returnRunning.current = true
      setReturning(true)
      setReturnNotice('Đang kiểm tra hoạt động để quay lại…')
      try {
        const fresh = await resolveJournalPlanOrigin(
          planApi,
          requestedOrigin.value,
          now(),
        )
        if (!fresh) {
          setReturnNotice(
            'Hoạt động đã thay đổi hoặc không còn mở. Bài nhật ký đã lưu vẫn riêng tư; không có hoạt động nào được cập nhật thay.',
          )
          return
        }
        const acceptedId =
          fresh.occurrence.completionEvidence?.kind === 'JOURNAL_ENTRY'
            ? fresh.occurrence.completionEvidence.factId
            : null
        onReturnToPlan({
          source: 'journal',
          occurrenceId: fresh.origin.occurrenceId,
          actionId: fresh.origin.actionId,
          localDate: fresh.origin.localDate,
          ...(acceptedId || candidate
            ? { journalId: acceptedId ?? candidate! }
            : {}),
        })
      } catch {
        setReturnNotice(
          'Chưa kiểm tra được hoạt động để quay lại. Bài viết và phần đang viết vẫn được giữ. Bạn có thể thử quay lại lần nữa.',
        )
      } finally {
        returnRunning.current = false
        setReturning(false)
      }
    }
    if (!dirty) {
      void perform()
      return
    }
    Alert.alert(
      'Rời bài viết?',
      'Phần chỉnh sửa chưa lưu sẽ mất. Bài đã lưu vẫn được giữ; hoạt động chỉ thay đổi khi bạn kiểm tra ghi nhận.',
      [
        { text: 'Tiếp tục viết', style: 'cancel' },
        {
          text: 'Bỏ phần chưa lưu, quay lại',
          style: 'destructive',
          onPress: () => void perform(),
        },
      ],
    )
  }
  const back = () => {
    if (navigationRef.current.busy || returning) return
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
      {requestedOrigin.state !== 'none' ? (
        <View style={s.panel}>
          <Text accessibilityRole="header" style={s.heading}>
            Hoạt động trong kế hoạch
          </Text>
          {originContext.isPending && requestedOrigin.state === 'valid' ? (
            <ActivityIndicator accessibilityLabel="Đang kiểm tra hoạt động nhật ký" />
          ) : null}
          {originContext.data ? (
            <>
              <Text style={s.label}>{originContext.data.title}</Text>
              <Text style={s.source}>
                {originContext.data.occurrence.localDate}
              </Text>
              <Text style={s.body}>
                Nội dung nhật ký vẫn riêng tư. Kế hoạch chỉ ghi nhận việc bạn đã
                lưu bài.
              </Text>
              {!originContext.data.canWrite &&
              originContext.data.occurrence.state !== 'COMPLETED' ? (
                <Notice>
                  Bài mới chỉ được ghi nhận cho ngày tạo bài. Bạn có thể viết
                  nhật ký riêng, nhưng không thể tạo bài cho một hoạt động ở
                  ngày khác.
                </Notice>
              ) : null}
            </>
          ) : !originContext.isPending ||
            requestedOrigin.state === 'invalid' ? (
            <Notice error>
              Không xác định được hoạt động này. Bạn vẫn có thể dùng nhật ký
              riêng; không có hoạt động nào được ghi nhận thay.
            </Notice>
          ) : null}
          {originContext.isError ? (
            <TextAction
              label="Thử kiểm tra lại hoạt động"
              onPress={() => void originContext.refetch()}
            />
          ) : null}
          {contextChanged ? (
            <Notice>
              Liên kết vừa thay đổi. Phần đang viết vẫn giữ liên kết ban đầu;
              không tự chuyển sang hoạt động khác.
            </Notice>
          ) : null}
          {returnNotice ? <Notice>{returnNotice}</Notice> : null}
          {originContext.data && onReturnToPlan ? (
            <TextAction
              testID="journal-return-to-plan"
              label={returning ? 'Đang quay lại…' : 'Quay lại hoạt động'}
              disabled={
                returning || navigationState.busy || navigationState.uncertain
              }
              onPress={returnToPlan}
            />
          ) : null}
        </View>
      ) : null}
      {selected === 'new' ? (
        <JournalEditor
          api={api}
          subject={subject}
          onClose={closeEditor}
          onDirtyChange={setDirty}
          onCreated={created}
          onNavigationStateChange={editorNavigation}
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
                  onNavigationStateChange={editorNavigation}
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
              onPress={() => {
                // Starting ordinary writing while the origin read is pending
                // must not let its late response retarget this draft.
                setOpenedOrigin(true)
                setWritingOrigin(
                  originContext.data?.canWrite
                    ? originContext.data.origin
                    : null,
                )
                setSelected('new')
              }}
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
  planOrigin = noJournalOrigin,
  planApi,
  onReturnToPlan,
  onNavigationStateChange,
}: Readonly<{
  api: JournalApi
  onBack: () => void
  now?: () => Date
  planOrigin?: JournalOriginInput
  planApi?: Pick<SupportPlanActionApi, 'getCurrent' | 'getOccurrences'>
  onReturnToPlan?: (origin: JournalPlanOrigin) => void
  onNavigationStateChange?: (state: JournalNavigationState) => void
}>) {
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
      planOrigin={planOrigin}
      {...(planApi ? { planApi } : {})}
      {...(onReturnToPlan ? { onReturnToPlan } : {})}
      {...(onNavigationStateChange ? { onNavigationStateChange } : {})}
    />
  )
}
