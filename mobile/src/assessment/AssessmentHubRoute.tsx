import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { createApiClient } from '@/api/api-client'
import { useSession } from '@/auth/session-context'
import { Screen } from '@/components/Screen'
import { useRuntimeConfig } from '@/config/runtime-config-context'
import { secureCredentialStore } from '@/security/credential-store'
import { colors } from '@/theme/tokens'
import { useDashboardFonts } from '@/theme/useDashboardFonts'

import { ReassessmentJourneyRoute } from '@/reassessment/ReassessmentJourneyRoute'

import { AssessmentSupportPanel } from './assessment-support-panel'
import { GuidePanel, HelpNowPanel } from './AssessmentJourneyScreen'
import { createAssessmentApi } from './assessment-api'
import type { Assessment, ScreeningEpisode } from './assessment-contract'
import {
  createAssessmentHistoryApi,
  type ScreeningHistoryEpisode,
} from './assessment-history-api'

const timeZone = 'Asia/Ho_Chi_Minh'
const date = new Intl.DateTimeFormat('vi-VN', { timeZone })
const time = new Intl.DateTimeFormat('vi-VN', {
  timeZone,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})
const background = '#F8F8F2'
const dark = '#163B33'
const mint = '#DAECE4'
const levels = {
  MINIMAL: 'Tối thiểu',
  MILD: 'Mức nhẹ',
  MODERATE: 'Trung bình',
  MODERATELY_SEVERE: 'Khá nặng',
  SEVERE: 'Mức nặng',
} as const
const purposes = {
  INITIAL_CHECK: 'Kiểm tra ban đầu',
  REASSESSMENT: 'Đánh giá lại',
} as const
const tabs = ['Lịch sử', 'Gợi ý sau sàng lọc', 'Đánh giá lại'] as const
type Tab = (typeof tabs)[number]
type Filter = 'all' | ScreeningEpisode['purpose']
type Detail =
  | { kind: 'episode'; row: ScreeningHistoryEpisode }
  | { kind: 'guide'; id: string; evaluationId: string }
  | { kind: 'assessment'; id: string }
  | { kind: 'support' }

function formatDate(timestamp: string) {
  return date.format(new Date(timestamp))
}
function formatTime(timestamp: string) {
  return time.format(new Date(timestamp))
}

function Action({
  label,
  onPress,
  soft,
  danger,
}: {
  label: string
  onPress: () => void
  soft?: boolean
  danger?: boolean
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        s.action,
        soft && s.soft,
        danger && s.danger,
        pressed && s.pressed,
      ]}
    >
      <Text style={[s.actionText, soft && s.softText, danger && s.dangerText]}>
        {label}
      </Text>
    </Pressable>
  )
}

function Score({
  instrument,
  score,
  level,
  unavailable = 'Chưa có kết quả',
}: {
  instrument: Assessment['instrument']
  score: number | null
  level: keyof typeof levels | null
  unavailable?: string | undefined
}) {
  const phq = instrument === 'PHQ9'
  const max = phq ? 27 : 21
  const accent = !phq && level && level !== 'MINIMAL' ? '#A95140' : dark
  return (
    <View style={s.score}>
      <Text style={s.label}>{phq ? 'PHQ-9' : 'GAD-7'}</Text>
      <Text style={s.muted}>{phq ? 'Trầm cảm' : 'Lo âu'}</Text>
      {score !== null && level ? (
        <>
          <Text style={s.number}>
            {score}
            <Text style={s.muted}> /{max}</Text>
          </Text>
          <View style={s.track} accessible={false}>
            <View
              style={[
                s.fill,
                {
                  width: `${Math.min(score / max, 1) * 100}%`,
                  backgroundColor: accent,
                },
              ]}
            />
          </View>
          <Text style={[s.badge, { color: accent }]}>{levels[level]}</Text>
        </>
      ) : (
        <Text style={s.muted}>{unavailable}</Text>
      )}
    </View>
  )
}

function EpisodeCard({
  row,
  onDetail,
  showDetailAction = true,
}: {
  row: ScreeningHistoryEpisode
  onDetail: (detail: Detail) => void
  showDetailAction?: boolean
}) {
  const timestamp = row.completedAt ?? row.startedAt
  const meaning = row.meaning
  const guideId = meaning?.supportGuideId
  const safety =
    meaning?.presentationPriority === 'SAFETY' ||
    row.evidence.some(
      (record) => record.safetyStatus === 'POSITIVE_SAFETY_SCREEN',
    )
  return (
    <View style={s.card}>
      <View style={s.wrap}>
        <Text style={s.label}>● {formatDate(timestamp)}</Text>
        <Text style={s.muted}>{formatTime(timestamp)}</Text>
        <Text style={[s.badge, s.neutralBadge]}>{purposes[row.purpose]}</Text>
        <Text style={s.badge}>
          {row.status === 'COMPLETED' ? '✓ Đã hoàn thành' : 'Đang thực hiện'}
        </Text>
      </View>
      <View style={s.scoreRow}>
        {row.evidence.map((item) => (
          <Score
            key={item.instrument}
            instrument={item.instrument}
            score={item.state === 'AVAILABLE' ? item.totalScore : null}
            level={item.state === 'AVAILABLE' ? item.screeningLevel : null}
            unavailable={
              item.state === 'UNAVAILABLE' ? 'Chưa thể hiển thị' : undefined
            }
          />
        ))}
      </View>
      <Text style={[s.note, safety && s.safetyNote]}>
        {safety
          ? 'Ưu tiên xem hướng dẫn an toàn.'
          : meaning
            ? `Ý nghĩa: ${meaning.baseMeaning.text}`
            : row.status === 'COMPLETED'
              ? 'Chưa có diễn giải chung cho lượt này.'
              : 'Diễn giải chung sẽ hiển thị sau khi hoàn thành lượt sàng lọc.'}
      </Text>
      <View style={[s.wrap, s.actionsEnd]}>
        {meaning && guideId && (
          <Action
            label="Gợi ý đã lưu"
            soft
            onPress={() =>
              onDetail({
                kind: 'guide',
                id: guideId,
                evaluationId: meaning.supportEvaluationId,
              })
            }
          />
        )}
        {showDetailAction && (
          <Action
            label="Xem chi tiết  →"
            onPress={() => onDetail({ kind: 'episode', row })}
          />
        )}
      </View>
    </View>
  )
}

function QueryState({
  loading,
  error,
  empty,
  retry,
}: {
  loading: boolean
  error: boolean
  empty?: string | undefined
  retry: () => void
}) {
  if (loading)
    return (
      <View style={s.card} accessibilityLiveRegion="polite">
        <ActivityIndicator color={dark} />
        <Text style={s.muted}>Đang tải thông tin…</Text>
      </View>
    )
  if (error)
    return (
      <View style={s.card} accessibilityLiveRegion="polite">
        <Text style={s.body}>Chưa thể tải thông tin lúc này.</Text>
        <Action label="Thử tải lại" soft onPress={retry} />
      </View>
    )
  return empty ? <Text style={s.note}>{empty}</Text> : null
}

type Page<T> = {
  items: T[]
  hasMore: boolean
  nextCursor?: string | null | undefined
}
function useHistory<T>(
  subject: string | undefined,
  name: string,
  enabled: boolean,
  list: (cursor: string | undefined, signal: AbortSignal) => Promise<Page<T>>,
) {
  return useInfiniteQuery({
    queryKey: ['assessmentHub', subject, name],
    enabled: Boolean(subject) && enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => list(pageParam, signal),
    getNextPageParam: (last) =>
      last.hasMore ? (last.nextCursor ?? undefined) : undefined,
  })
}

export function AssessmentHubRoute() {
  const config = useRuntimeConfig()
  const { session } = useSession()
  const subject = session?.subject
  const fonts = useDashboardFonts()
  const headingFont = fonts ? 'DashboardSerif' : undefined
  const titleStyle = [s.title, { fontFamily: headingFont }]
  const api = useMemo(() => {
    const client = createApiClient({
      config,
      getBearerToken: () => secureCredentialStore.getAccessToken(),
    })
    return {
      ...createAssessmentApi(client),
      ...createAssessmentHistoryApi(client),
    }
  }, [config])
  const params = useLocalSearchParams<{ tab?: string }>()
  const [tab, setTab] = useState<Tab>(() =>
    params.tab === 'reassessment' ? 'Đánh giá lại' : 'Lịch sử',
  )
  const [filter, setFilter] = useState<Filter>('all')
  const [expanded, setExpanded] = useState(false)
  const [detail, setDetail] = useState<Detail | null>(null)

  const history = useHistory(subject, 'episodes', true, api.episodes)
  const assessments = useHistory(
    subject,
    'assessments',
    expanded && tab === 'Lịch sử',
    api.assessments,
  )
  const refreshHistory = history.refetch
  const refreshAssessments = assessments.refetch
  useFocusEffect(
    useCallback(() => {
      if (!subject) return
      void refreshHistory()
      if (tab === 'Lịch sử' && expanded) void refreshAssessments()
    }, [subject, tab, expanded, refreshHistory, refreshAssessments]),
  )

  const rows = history.data?.pages.flatMap((page) => page.items) ?? []
  const visibleRows = rows.filter(
    (row) => filter === 'all' || row.purpose === filter,
  )
  const individual = assessments.data?.pages.flatMap((page) => page.items) ?? []
  const latest = rows.reduce<ScreeningHistoryEpisode | null>(
    (current, row) =>
      !current || Date.parse(row.updatedAt) > Date.parse(current.updatedAt)
        ? row
        : current,
    null,
  )
  const readDetail = useQuery({
    queryKey: [
      'assessmentHub',
      subject,
      'detail',
      detail?.kind,
      detail && 'id' in detail ? detail.id : null,
    ],
    enabled:
      Boolean(subject) &&
      (detail?.kind === 'guide' || detail?.kind === 'assessment'),
    queryFn: async () => {
      if (detail?.kind === 'guide') {
        const guide = await api.getSupportGuide(detail.id)
        if (
          guide.supportGuideId !== detail.id ||
          guide.supportEvaluationId !== detail.evaluationId
        )
          throw new Error('Unexpected support guide')
        return { kind: 'guide' as const, guide }
      }
      if (detail?.kind === 'assessment') {
        const assessment = await api.getAssessment(detail.id)
        if (assessment.assessmentId !== detail.id)
          throw new Error('Unexpected assessment')
        return { kind: 'assessment' as const, assessment }
      }
      throw new Error('No detail selected')
    },
  })
  const remoteDetail = readDetail.data

  return (
    <>
      <Screen layout="dashboard" backgroundColor={background}>
        <View style={s.page}>
          <View style={s.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Quay lại"
              style={s.iconButton}
              onPress={() =>
                router.canGoBack()
                  ? router.back()
                  : router.replace('/(user)/user')
              }
            >
              <Text style={s.icon}>‹</Text>
            </Pressable>
            <View style={s.brand}>
              <Text style={s.kicker}>MENTALBRIDGE</Text>
              <Text style={[s.brandTitle, { fontFamily: headingFont }]}>
                Sàng Lọc
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Thông báo"
              style={s.iconButton}
              onPress={() => router.push('/(user)/notifications')}
            >
              <Text style={s.icon}>🔔︎</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cá nhân"
              style={[s.iconButton, s.profile]}
              onPress={() => router.push('/(user)/profile')}
            >
              <Text style={[s.icon, s.profileText]}>◎</Text>
            </Pressable>
          </View>

          <View style={s.intro}>
            <View style={s.spread}>
              <Text style={s.badge}>● KHÔNG GIAN CỦA BẠN</Text>
              {latest && (
                <Text style={s.muted}>
                  Cập nhật {formatDate(latest.updatedAt)}
                </Text>
              )}
            </View>
            <Text accessibilityRole="header" style={titleStyle}>
              Bài sàng lọc
            </Text>
            <Text style={s.body}>
              Làm bài ngắn định kỳ để lắng nghe bản thân và theo dõi biến chuyển
              cảm xúc theo thời gian.
            </Text>
            <View style={s.actionRow}>
              <View style={s.actionColumn}>
                <Action
                  label="● Cần hỗ trợ ngay?"
                  danger
                  onPress={() => setDetail({ kind: 'support' })}
                />
              </View>
              <View style={s.actionColumn}>
                <Action
                  label="⟳ Làm bài sàng lọc"
                  soft
                  onPress={() => router.push('/(user)/assessment')}
                />
              </View>
            </View>
          </View>

          <View style={s.tabs} accessibilityRole="tablist">
            {tabs.map((item) => (
              <Pressable
                key={item}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === item }}
                onPress={() => setTab(item)}
                style={[s.tab, item === tab && s.selectedTab]}
              >
                <Text style={[s.tabText, item === tab && s.selectedText]}>
                  {item}
                </Text>
              </Pressable>
            ))}
          </View>

          {tab === 'Lịch sử' && (
            <>
              <View style={s.wrap}>
                {(['all', 'INITIAL_CHECK', 'REASSESSMENT'] as const).map(
                  (item) => (
                    <Pressable
                      key={item}
                      accessibilityRole="button"
                      accessibilityState={{ selected: item === filter }}
                      onPress={() => setFilter(item)}
                      style={[s.filter, item === filter && s.selectedFilter]}
                    >
                      <Text style={[s.label, item === filter && s.profileText]}>
                        {item === 'all'
                          ? history.data && !history.hasNextPage
                            ? `Tất cả (${rows.length})`
                            : 'Tất cả'
                          : purposes[item]}
                      </Text>
                    </Pressable>
                  ),
                )}
              </View>
              <QueryState
                loading={history.isPending}
                error={history.isError}
                retry={() => void history.refetch()}
                empty={
                  !visibleRows.length
                    ? 'Chưa có lượt sàng lọc phù hợp.'
                    : undefined
                }
              />
              {visibleRows.map((row) => (
                <EpisodeCard
                  key={row.episodeId}
                  row={row}
                  onDetail={setDetail}
                />
              ))}
              {history.hasNextPage && (
                <Action
                  label={
                    history.isFetchingNextPage
                      ? 'Đang tải…'
                      : 'Xem thêm lượt sàng lọc'
                  }
                  soft
                  onPress={() => {
                    if (!history.isFetchingNextPage)
                      void history.fetchNextPage()
                  }}
                />
              )}

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                onPress={() => setExpanded((value) => !value)}
                style={s.disclosure}
              >
                <Text style={s.disclosureIcon}>☷</Text>
                <View style={s.brand}>
                  <Text style={s.label}>Bài sàng lọc riêng lẻ</Text>
                  <Text style={s.muted}>Tra cứu kết quả từng bài độc lập</Text>
                </View>
                <Text style={s.icon}>{expanded ? '⌃' : '⌄'}</Text>
              </Pressable>
              {expanded && (
                <>
                  <QueryState
                    loading={assessments.isPending}
                    error={assessments.isError}
                    retry={() => void assessments.refetch()}
                    empty={
                      !individual.length
                        ? 'Chưa có bài sàng lọc đã lưu.'
                        : undefined
                    }
                  />
                  {individual.map((item) => (
                    <Pressable
                      key={item.assessmentId}
                      accessibilityRole="button"
                      onPress={() =>
                        setDetail({ kind: 'assessment', id: item.assessmentId })
                      }
                      style={[s.card, s.spread]}
                    >
                      <View>
                        <Text style={s.label}>
                          {item.instrument === 'PHQ9' ? 'PHQ-9' : 'GAD-7'} ·{' '}
                          {levels[item.result.screeningLevel]}
                        </Text>
                        <Text style={s.muted}>
                          {formatDate(item.submittedAt)} ·{' '}
                          {formatTime(item.submittedAt)}
                        </Text>
                      </View>
                      <Text style={s.icon}>›</Text>
                    </Pressable>
                  ))}
                  {assessments.hasNextPage && (
                    <Action
                      label={
                        assessments.isFetchingNextPage
                          ? 'Đang tải…'
                          : 'Xem thêm bài riêng lẻ'
                      }
                      soft
                      onPress={() => {
                        if (!assessments.isFetchingNextPage)
                          void assessments.fetchNextPage()
                      }}
                    />
                  )}
                </>
              )}
            </>
          )}

          {tab === 'Gợi ý sau sàng lọc' && (
            <>
              <QueryState
                loading={history.isPending}
                error={history.isError}
                retry={() => void history.refetch()}
              />
              {history.data && (
                <AssessmentSupportPanel
                  rows={rows.filter((row) => row.status === 'COMPLETED')}
                  api={api}
                  headingFont={headingFont}
                  loadMore={
                    history.hasNextPage && !history.isFetchingNextPage
                      ? () => void history.fetchNextPage()
                      : undefined
                  }
                  onResult={(row) => setDetail({ kind: 'episode', row })}
                  onGuide={(id, evaluationId) =>
                    setDetail({ kind: 'guide', id, evaluationId })
                  }
                />
              )}
            </>
          )}

          {tab === 'Đánh giá lại' && <ReassessmentJourneyRoute embedded />}
          <Text style={s.note}>
            Sàng lọc giúp bạn theo dõi triệu chứng và xu hướng theo thời gian.
            Kết quả tham khảo và không thay thế chẩn đoán y khoa.
          </Text>
        </View>
      </Screen>

      <Modal
        visible={detail !== null}
        onRequestClose={() => setDetail(null)}
        animationType="fade"
      >
        <Screen layout="dashboard" backgroundColor={background}>
          <View style={s.page}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setDetail(null)}
              style={s.back}
            >
              <Text style={s.label}>‹ Quay lại</Text>
            </Pressable>
            {detail?.kind === 'support' && (
              <HelpNowPanel api={api} defaultTrigger="HELP_NOW" overviewCard />
            )}
            {detail?.kind === 'episode' && (
              <>
                <Text accessibilityRole="header" style={titleStyle}>
                  Chi tiết lượt sàng lọc
                </Text>
                <EpisodeCard
                  row={detail.row}
                  onDetail={setDetail}
                  showDetailAction={false}
                />
                {detail.row.meaning && (
                  <View style={s.card}>
                    {detail.row.meaning.safetyGuidance && (
                      <HelpNowPanel
                        api={api}
                        defaultTrigger="POSITIVE_ITEM_9"
                        guidance={detail.row.meaning.safetyGuidance}
                      />
                    )}
                    <Text style={s.body}>
                      {detail.row.meaning.nextStep.text}
                    </Text>
                    <Text style={s.muted}>
                      {detail.row.meaning.nextStep.boundary}
                    </Text>
                    <Text style={s.muted}>{detail.row.meaning.disclaimer}</Text>
                  </View>
                )}
              </>
            )}
            {(detail?.kind === 'assessment' || detail?.kind === 'guide') && (
              <QueryState
                loading={readDetail.isPending}
                error={readDetail.isError}
                retry={() => void readDetail.refetch()}
              />
            )}
            {detail?.kind === 'assessment' &&
              remoteDetail?.kind === 'assessment' && (
                <View style={s.card}>
                  <Text accessibilityRole="header" style={titleStyle}>
                    Kết quả sàng lọc
                  </Text>
                  <Score
                    instrument={remoteDetail.assessment.instrument}
                    score={remoteDetail.assessment.result.totalScore}
                    level={remoteDetail.assessment.result.screeningLevel}
                  />
                  <Text style={s.muted}>
                    {formatDate(remoteDetail.assessment.submittedAt)}
                  </Text>
                  {remoteDetail.assessment.result.safetyStatus ===
                    'POSITIVE_SAFETY_SCREEN' && (
                    <HelpNowPanel api={api} defaultTrigger="POSITIVE_ITEM_9" />
                  )}
                </View>
              )}
            {detail?.kind === 'guide' && remoteDetail?.kind === 'guide' && (
              <GuidePanel api={api} guide={remoteDetail.guide} />
            )}
          </View>
        </Screen>
      </Modal>
    </>
  )
}

const s = StyleSheet.create({
  page: { gap: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  brand: { flex: 1, minWidth: 0 },
  kicker: {
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '700',
    color: colors.inkSoft,
  },
  brandTitle: { fontSize: 23, color: colors.ink, fontWeight: '600' },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: mint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: { fontSize: 23, color: dark, fontWeight: '600' },
  profile: { backgroundColor: dark },
  profileText: { color: colors.white },
  intro: { gap: 10 },
  spread: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  title: { fontSize: 27, fontWeight: '700', color: colors.ink },
  body: { fontSize: 14, lineHeight: 22, color: colors.inkSoft },
  muted: { fontSize: 12, lineHeight: 18, color: colors.inkSoft },
  label: { fontSize: 13, lineHeight: 19, fontWeight: '700', color: colors.ink },
  badge: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '700',
    color: dark,
    backgroundColor: mint,
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 5,
    overflow: 'hidden',
  },
  neutralBadge: { backgroundColor: '#EDEFEA', color: colors.inkSoft },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  actionColumn: { flexGrow: 1, flexBasis: 126 },
  action: {
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: dark,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  soft: { backgroundColor: '#EBEEE8' },
  danger: { backgroundColor: '#F1E3DE' },
  actionText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  softText: { color: dark },
  dangerText: { color: '#732F26' },
  pressed: { opacity: 0.75 },
  tabs: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 19,
    gap: 2,
    backgroundColor: '#EDEFE9',
  },
  tab: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 4,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  selectedTab: { backgroundColor: colors.white },
  tabText: { color: colors.inkSoft, textAlign: 'center', fontSize: 13 },
  selectedText: { color: dark, fontWeight: '700' },
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 7,
  },
  filter: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: '#EDEFE9',
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  selectedFilter: { backgroundColor: dark },
  card: {
    backgroundColor: colors.white,
    padding: 13,
    gap: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EBEDE7',
  },
  scoreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  score: {
    flexGrow: 1,
    flexBasis: 120,
    borderRadius: 16,
    backgroundColor: '#F0F2EC',
    padding: 11,
    gap: 4,
  },
  number: { fontSize: 24, fontWeight: '700', color: colors.ink },
  track: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: '#DDE3DD',
    marginVertical: 4,
  },
  fill: { height: '100%', borderRadius: 3 },
  note: {
    color: colors.inkSoft,
    backgroundColor: '#F0F2EC',
    borderRadius: 16,
    padding: 12,
    fontSize: 13,
    lineHeight: 20,
  },
  safetyNote: { backgroundColor: '#F1E3DE', color: '#732F26' },
  actionsEnd: { justifyContent: 'flex-end' },
  disclosure: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 11,
    borderRadius: 16,
    backgroundColor: '#F0F2EC',
  },
  disclosureIcon: {
    width: 40,
    textAlign: 'center',
    borderRadius: 20,
    overflow: 'hidden',
    paddingVertical: 8,
    fontSize: 18,
    color: dark,
    backgroundColor: mint,
  },
  back: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
})
