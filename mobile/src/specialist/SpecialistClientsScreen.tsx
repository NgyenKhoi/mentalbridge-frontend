import { router } from 'expo-router'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'

import { Screen } from '@/components/Screen'
import { SpecialistOverviewTabBar } from '@/navigation/SpecialistOverviewTabBar'
import { sharedAppointmentChatHandoff } from '@/specialist-appointments/specialist-chat-handoff'
import { SpecialistContinuityPanel } from '@/specialist-continuity/SpecialistContinuityPanel'
import type { SpecialistContinuityApi } from '@/specialist-continuity/specialist-continuity-api'
import type { SpecialistClientContinuityList } from '@/specialist-continuity/specialist-continuity-contract'
import { colors, radii, spacing } from '@/theme/tokens'
import { useDashboardFonts } from '@/theme/useDashboardFonts'

import {
  ACCESS_LABEL,
  CLIENT_TIME_ZONE,
  SESSION_LABEL,
  clientInitials,
  groupClientVisits,
  normalizeClientSearch,
  visitDateTime,
  visitDay,
  visitTime,
} from './specialist-clients-model'

import {
  SpecialistClientSessionSummary,
  type ClientSummaryApi,
} from './SpecialistClientSessionSummary'

const tabs = [
  ['preparation', 'Chuẩn bị phiên'],
  ['summary', 'Tổng kết & EMR'],
  ['permission', 'Phân quyền'],
] as const

type DetailTab = (typeof tabs)[number][0]

function openVisit(appointmentId: string) {
  router.push({
    pathname: '/(specialist)/appointments/[appointmentId]',
    params: { appointmentId },
  })
}

function Action({
  children,
  label,
  onPress,
  primary = false,
  compact = false,
  icon,
}: {
  children?: ReactNode
  label?: string
  onPress: () => void
  primary?: boolean
  compact?: boolean
  icon?: 'bell'
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        s.action,
        compact && s.iconButton,
        primary && s.dark,
        pressed && s.pressed,
      ]}
    >
      {icon === 'bell' ? (
        <View aria-hidden style={s.bell}>
          <View style={s.bellDome} />
          <View style={s.bellRim} />
          <View style={s.bellClapper} />
        </View>
      ) : (
        <Text style={[s.actionText, primary && s.light]}>{children}</Text>
      )}
    </Pressable>
  )
}

function Avatar({ name, active = false }: { name: string; active?: boolean }) {
  return (
    <View aria-hidden style={[s.avatar, active && s.dark]}>
      <Text style={[s.avatarText, active && s.light]}>
        {clientInitials(name)}
      </Text>
    </View>
  )
}

export function SpecialistClientsScreen({
  subject,
  initialAppointmentId,
  data,
  loading,
  failed,
  specialistName,
  continuityApi,
  summaryApi,
  refresh,
}: {
  subject: string
  initialAppointmentId: string | undefined
  data: SpecialistClientContinuityList | undefined
  loading: boolean
  failed: boolean
  specialistName: string | undefined
  continuityApi: SpecialistContinuityApi
  summaryApi: ClientSummaryApi
  refresh: () => void
}) {
  const fontsLoaded = useDashboardFonts()
  const { fontScale, width } = useWindowDimensions()
  const stackActions = fontScale > 1.3 || width < 360
  const searchRef = useRef<TextInput>(null)
  const scrollRef = useRef<ScrollView>(null)
  const detailsOffset = useRef(0)
  const [search, setSearch] = useState('')
  const [selection, setSelection] = useState(initialAppointmentId)
  const [tabChoice, setTabChoice] = useState<{
    appointmentId: string
    tab: DetailTab
  }>()
  const clients = useMemo(
    () => (data ? groupClientVisits(data.items) : []),
    [data],
  )
  const term = normalizeClientSearch(search)
  const filtered = clients.filter(
    ({ id, name, appointments }) =>
      normalizeClientSearch(name).includes(term) ||
      id.includes(term) ||
      appointments.some(({ appointmentId }) => appointmentId.includes(term)),
  )
  const preferredVisitId =
    data?.items.find((item) => item.appointmentId === selection)
      ?.appointmentId ?? data?.items[0]?.appointmentId
  const client =
    filtered.find(({ appointments }) =>
      appointments.some((visit) => visit.appointmentId === preferredVisitId),
    ) ?? filtered[0]
  const visit =
    client?.appointments.find(
      (item) => item.appointmentId === preferredVisitId,
    ) ?? client?.appointments[0]
  const tab =
    tabChoice && tabChoice.appointmentId === visit?.appointmentId
      ? tabChoice.tab
      : visit?.status === 'COMPLETED'
        ? 'summary'
        : 'preparation'
  const name = specialistName || 'Không gian chuyên gia'

  return (
    <Screen
      scrollRef={scrollRef}
      layout="dashboard"
      backgroundColor={palette.background}
      bottomActions={<SpecialistOverviewTabBar onClients />}
    >
      <View style={s.page}>
        <View style={s.masthead}>
          <Avatar name={name} active />
          <View style={s.flex}>
            <Text numberOfLines={1} style={s.strong}>
              {name}
            </Text>
            <Text style={s.muted}>Không gian làm việc</Text>
          </View>
          <Action
            compact
            label="Tìm thân chủ"
            onPress={() => searchRef.current?.focus()}
          >
            ⌕
          </Action>
          <Action
            compact
            label="Thông báo chuyên gia"
            icon="bell"
            onPress={() => router.push('/(specialist)/notifications')}
          />
        </View>

        <View style={s.heading}>
          <Text style={s.kicker}>KHÔNG GIAN CHUYÊN GIA</Text>
          <View style={[s.row, stackActions && s.stacked]}>
            <Text
              accessibilityRole="header"
              style={[s.title, fontsLoaded && s.displayFont]}
            >
              Khách hàng & phiên tư vấn
            </Text>
            {data ? (
              <Text style={s.count}>Tất cả thân chủ ({clients.length})</Text>
            ) : null}
          </View>
        </View>

        <View style={[s.row, stackActions && s.stacked]}>
          <Action onPress={refresh}>
            {loading ? 'Đang tải…' : 'Tải lại khách hàng'}
          </Action>
          <Action onPress={() => router.push('/(specialist)/appointments')}>
            Quản lý lịch hẹn
          </Action>
        </View>

        <View style={s.search}>
          <Text aria-hidden style={s.searchIcon}>
            ⌕
          </Text>
          <TextInput
            ref={searchRef}
            accessibilityLabel="Tìm theo tên thân chủ, mã thân chủ hoặc mã lịch hẹn"
            placeholder="Tìm tên thân chủ hoặc mã lịch hẹn…"
            placeholderTextColor={palette.muted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            style={s.input}
          />
          {search ? (
            <Action compact label="Xóa tìm kiếm" onPress={() => setSearch('')}>
              ×
            </Action>
          ) : null}
        </View>

        <View style={s.notice}>
          <Text aria-hidden style={s.noticeIcon}>
            ◇
          </Text>
          <Text style={[s.body, s.flex]}>
            <Text style={s.strong}>
              Danh sách được giới hạn theo lịch hẹn.{' '}
            </Text>
            Chỉ hiển thị thân chủ có phiên đã xác nhận, đang diễn ra hoặc mới
            hoàn thành với bạn.
          </Text>
        </View>

        {failed || !client || !visit ? (
          <View style={s.detailPanel}>
            {loading && !data ? (
              <ActivityIndicator
                accessibilityLabel="Đang tải khách hàng"
                color={palette.forest}
              />
            ) : (
              <>
                <Text
                  accessibilityRole={failed ? 'alert' : 'header'}
                  style={s.sectionTitle}
                >
                  {failed
                    ? 'Chưa thể tải danh sách thân chủ'
                    : term
                      ? 'Không tìm thấy thân chủ phù hợp'
                      : 'Chưa có phiên tư vấn để hiển thị'}
                </Text>
                <Action
                  onPress={term && !failed ? () => setSearch('') : refresh}
                >
                  {term && !failed ? 'Xóa tìm kiếm' : 'Tải lại'}
                </Action>
              </>
            )}
          </View>
        ) : (
          <>
            <View style={s.group}>
              <View style={s.row}>
                <Text accessibilityRole="header" style={s.kicker}>
                  CHUYỂN NHANH THÂN CHỦ
                </Text>
                {filtered.length > 1 ? (
                  <Text style={s.muted}>Vuốt để chọn</Text>
                ) : null}
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={s.rail}
              >
                {filtered.map((item) => {
                  const selected = item.id === client.id
                  const firstVisit = item.appointments[0]
                  return (
                    <Pressable
                      key={item.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => {
                        setSelection(firstVisit.appointmentId)
                        setTabChoice(undefined)
                      }}
                      style={({ pressed }) => [
                        s.clientTile,
                        selected && s.dark,
                        pressed && s.pressed,
                      ]}
                    >
                      <Avatar name={item.name} />
                      <Text
                        numberOfLines={2}
                        style={[s.strong, selected && s.light]}
                      >
                        {item.name}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={[s.muted, selected && s.lightMuted]}
                      >
                        {SESSION_LABEL[firstVisit.status]} ·{' '}
                        {item.appointments.length} phiên
                      </Text>
                    </Pressable>
                  )
                })}
              </ScrollView>
            </View>

            <View style={s.card}>
              <View style={s.identity}>
                <Avatar name={client.name} active />
                <View style={s.flex}>
                  <Text accessibilityRole="header" style={s.sectionTitle}>
                    {client.name}
                  </Text>
                  <Text style={s.muted}>
                    {client.appointments.length} phiên trong danh sách
                  </Text>
                </View>
              </View>
              <View style={s.metadata}>
                <Text style={[s.body, s.flex]}>
                  {visit.modality === 'IN_APP_CHAT'
                    ? 'Tư vấn qua tin nhắn'
                    : 'Tư vấn qua video'}
                </Text>
                <Text style={s.status}>{SESSION_LABEL[visit.status]}</Text>
              </View>
              <View style={[s.actions, stackActions && s.stacked]}>
                <Action
                  primary
                  onPress={() =>
                    visit.modality === 'IN_APP_CHAT'
                      ? sharedAppointmentChatHandoff.openAppointmentChat(
                          visit.appointmentId,
                        )
                      : openVisit(visit.appointmentId)
                  }
                >
                  {visit.modality === 'IN_APP_CHAT'
                    ? 'Mở chat bảo mật'
                    : 'Mở chi tiết phiên video'}
                </Action>
                <Action
                  onPress={() => {
                    setTabChoice({
                      appointmentId: visit.appointmentId,
                      tab: 'summary',
                    })
                    scrollRef.current?.scrollTo({
                      y: detailsOffset.current,
                      animated: true,
                    })
                  }}
                >
                  Xem tổng kết & EMR
                </Action>
              </View>
            </View>

            <View style={s.timeline}>
              <View style={[s.row, stackActions && s.stacked]}>
                <Text accessibilityRole="header" style={s.kicker}>
                  TIẾN TRÌNH CÁC PHIÊN HẸN
                </Text>
                <Text style={s.muted}>{CLIENT_TIME_ZONE}</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={s.rail}
              >
                {client.appointments.map((item) => {
                  const selected = visit.appointmentId === item.appointmentId
                  return (
                    <Pressable
                      key={item.appointmentId}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => {
                        setSelection(item.appointmentId)
                        setTabChoice(undefined)
                      }}
                      style={({ pressed }) => [
                        s.visitTile,
                        selected && s.dark,
                        pressed && s.pressed,
                      ]}
                    >
                      <View style={s.row}>
                        <Text style={[s.muted, selected && s.lightMuted]}>
                          {visitDay(item.scheduledStartAt)}
                        </Text>
                        <Text style={s.status}>
                          {SESSION_LABEL[item.status]}
                        </Text>
                      </View>
                      <Text style={[s.visitTime, selected && s.light]}>
                        {visitTime(item.scheduledStartAt)} –{' '}
                        {visitTime(item.scheduledEndAt)}
                      </Text>
                      <Text style={[s.muted, selected && s.lightMuted]}>
                        {item.modality === 'IN_APP_CHAT'
                          ? 'Chat trong ứng dụng'
                          : 'Video trong ứng dụng'}
                      </Text>
                    </Pressable>
                  )
                })}
              </ScrollView>
            </View>

            <View
              accessibilityRole="tablist"
              onLayout={({ nativeEvent }) => {
                detailsOffset.current = nativeEvent.layout.y
              }}
              style={[s.tabs, stackActions && s.stacked]}
            >
              {tabs.map(([id, label]) => (
                <Pressable
                  key={id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === id }}
                  onPress={() =>
                    setTabChoice({
                      appointmentId: visit.appointmentId,
                      tab: id,
                    })
                  }
                  style={({ pressed }) => [
                    s.tab,
                    tab === id && s.selectedTab,
                    pressed && s.pressed,
                  ]}
                >
                  <Text style={[s.tabText, tab === id && s.strong]}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {tab === 'preparation' ? (
              <View style={s.detailPanel}>
                <View style={[s.row, stackActions && s.stacked]}>
                  <Text accessibilityRole="header" style={s.sectionTitle}>
                    Bản chuẩn bị từ thân chủ
                  </Text>
                  <Text style={s.status}>
                    {ACCESS_LABEL[visit.briefAccessState]}
                  </Text>
                </View>
                <SpecialistContinuityPanel
                  key={[visit.appointmentId, visit.appointmentVersion].join(
                    ':',
                  )}
                  api={continuityApi}
                  appointmentId={visit.appointmentId}
                  appointmentVersion={visit.appointmentVersion}
                  compact
                  onRefreshAccess={refresh}
                />
              </View>
            ) : tab === 'summary' ? (
              <View style={s.detailPanel}>
                <Text accessibilityRole="header" style={s.sectionTitle}>
                  Tổng kết phiên tư vấn
                </Text>
                {visit.status === 'COMPLETED' ? (
                  <SpecialistClientSessionSummary
                    key={[visit.appointmentId, visit.appointmentVersion].join(
                      ':',
                    )}
                    appointmentId={visit.appointmentId}
                    appointmentVersion={visit.appointmentVersion}
                    api={summaryApi}
                    subject={subject}
                    onOpenAppointment={() => openVisit(visit.appointmentId)}
                  />
                ) : (
                  <Text style={s.muted}>
                    Tổng kết được mở sau khi phiên tư vấn hoàn thành.
                  </Text>
                )}
              </View>
            ) : (
              <View style={s.detailPanel}>
                <Text accessibilityRole="header" style={s.sectionTitle}>
                  Nguồn và thời hạn truy cập
                </Text>
                <View style={s.inset}>
                  <Text style={s.strong}>
                    {ACCESS_LABEL[visit.briefAccessState]}
                  </Text>
                  <Text style={s.body}>
                    {visit.briefAccessStartAt && visit.briefAccessEndAt
                      ? [
                          visitDateTime(visit.briefAccessStartAt),
                          visitDateTime(visit.briefAccessEndAt),
                        ].join(' – ')
                      : 'Lịch hẹn này chưa có thời hạn chia sẻ được ghi nhận.'}
                  </Text>
                  <Text style={s.body}>
                    Phiên hẹn · {visitDateTime(visit.scheduledStartAt)}
                  </Text>
                  <Text style={s.body}>
                    Chỉ bản tóm tắt do thân chủ phê duyệt cho phiên này được
                    chia sẻ tại đây.
                  </Text>
                </View>
                <Action onPress={refresh}>
                  {loading ? 'Đang kiểm tra…' : 'Kiểm tra lại quyền xem'}
                </Action>
              </View>
            )}

            <Action onPress={() => openVisit(visit.appointmentId)}>
              Xem chi tiết lịch hẹn →
            </Action>
          </>
        )}
      </View>
    </Screen>
  )
}

const palette = {
  background: '#F8F8F2',
  forest: '#15382F',
  mint: '#DDECE5',
  soft: '#EFF2EC',
  muted: '#52645B',
  onDarkMuted: '#D2E8DC',
}

const s = StyleSheet.create({
  page: { gap: spacing.lg },
  flex: { flex: 1, minWidth: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  stacked: { flexDirection: 'column', alignItems: 'stretch' },
  masthead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingBottom: spacing.sm,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.mint,
  },
  avatarText: { color: palette.forest, fontSize: 16, fontWeight: '700' },
  heading: { gap: spacing.xs, paddingTop: spacing.sm },
  kicker: {
    color: colors.tealDeep,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    flexShrink: 1,
  },
  title: {
    color: colors.ink,
    fontSize: 27,
    lineHeight: 33,
    fontWeight: '800',
    flexShrink: 1,
  },
  displayFont: { fontFamily: 'DashboardSans' },
  count: {
    color: palette.forest,
    backgroundColor: palette.mint,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    fontSize: 12,
    fontWeight: '700',
    maxWidth: 136,
    textAlign: 'center',
  },
  search: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  searchIcon: { color: palette.forest, fontSize: 24 },
  input: {
    flex: 1,
    minWidth: 0,
    color: colors.ink,
    fontSize: 14,
    paddingVertical: 12,
  },
  notice: {
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    backgroundColor: palette.soft,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
  },
  noticeIcon: { color: palette.forest, fontSize: 21 },
  body: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  strong: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  muted: { color: palette.muted, fontSize: 12, lineHeight: 18 },
  group: { gap: spacing.sm },
  rail: { flexDirection: 'row', gap: spacing.sm },
  clientTile: {
    width: 128,
    minHeight: 108,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    borderRadius: 16,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  sectionTitle: {
    color: colors.ink,
    fontWeight: '800',
    fontSize: 16,
    lineHeight: 22,
    flexShrink: 1,
  },
  metadata: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: palette.soft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  status: {
    flexShrink: 1,
    alignSelf: 'center',
    overflow: 'hidden',
    backgroundColor: palette.mint,
    borderRadius: radii.pill,
    color: palette.forest,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: 11,
    fontWeight: '700',
  },
  actions: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  action: {
    flexGrow: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: palette.soft,
    borderRadius: radii.control,
  },
  actionText: {
    color: palette.forest,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  iconButton: { flexGrow: 0, width: 48, borderRadius: radii.pill },
  bell: {
    width: 18,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDome: {
    width: 12,
    height: 12,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderColor: palette.forest,
  },
  bellRim: {
    width: 16,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: palette.forest,
  },
  bellClapper: {
    width: 3,
    height: 2,
    borderRadius: 1,
    marginTop: 2,
    backgroundColor: palette.forest,
  },
  dark: { backgroundColor: palette.forest },
  light: { color: colors.white },
  lightMuted: { color: palette.onDarkMuted },
  pressed: { opacity: 0.8 },
  timeline: {
    gap: spacing.md,
    backgroundColor: palette.soft,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
  },
  visitTile: {
    width: 226,
    minHeight: 97,
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
  },
  visitTime: {
    color: colors.ink,
    fontWeight: '800',
    fontSize: 18,
    fontVariant: ['tabular-nums'],
  },
  tabs: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: 14,
    backgroundColor: palette.soft,
  },
  tab: {
    flexGrow: 1,
    flexBasis: 0,
    minHeight: 48,
    paddingHorizontal: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 11,
  },
  selectedTab: { backgroundColor: colors.surface },
  tabText: { color: palette.muted, fontSize: 13, textAlign: 'center' },
  detailPanel: {
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 20,
  },
  inset: {
    backgroundColor: palette.soft,
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 14,
  },
})
