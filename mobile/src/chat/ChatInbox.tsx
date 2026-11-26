import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import type { Appointment } from '@/appointments/appointment-contract'
import { Screen } from '@/components/Screen'
import { useResourceFonts } from '@/resources/useResourceFonts'
import { colors, radii, spacing } from '@/theme/tokens'
import {
  chatInitials,
  chatTime,
  conversationState,
  sortedConversations,
  type ConversationFilter,
} from './chat-presentation'

const filters = [
  { id: 'all', label: 'Tất cả' },
  { id: 'active', label: 'Đang diễn ra' },
  { id: 'waiting', label: 'Sắp tới' },
  { id: 'ended', label: 'Đã kết thúc' },
] as const
const labels = {
  active: 'Đang diễn ra',
  waiting: 'Đã xác nhận',
  ended: 'Đã kết thúc',
} as const

export function ChatInbox({
  items,
  loading,
  failed,
  role,
  onBack,
  onRetry,
  onOpen,
}: Readonly<{
  items: readonly Appointment[]
  loading: boolean
  failed: boolean
  role: 'USER' | 'SPECIALIST'
  onBack: () => void
  onRetry: () => void
  onOpen: (id: string) => void
}>) {
  const loaded = useResourceFonts()
  const font = loaded ? { fontFamily: 'ResourceSans' } : undefined
  const heading = loaded ? { fontFamily: 'ResourceSerif' } : undefined
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ConversationFilter>('all')
  const conversations = useMemo(() => sortedConversations(items), [items])
  const visible = conversations.filter(
    (item) =>
      (filter === 'all' || conversationState(item) === filter) &&
      `${item.specialistDisplayName} ${item.id}`
        .toLocaleLowerCase('vi-VN')
        .includes(query.trim().toLocaleLowerCase('vi-VN')),
  )
  return (
    <Screen layout="dashboard" backgroundColor="#f5faf7">
      <View style={styles.page}>
        <View style={styles.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Về trang trước"
            onPress={onBack}
            style={styles.round}
          >
            <Text accessible={false} style={styles.arrow}>
              ←
            </Text>
          </Pressable>
          <View style={styles.flex}>
            <Text style={[styles.brand, heading]}>MentalBridge</Text>
            <Text style={[styles.small, font]}>Trò chuyện theo lịch hẹn</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tải lại lịch hẹn"
            onPress={onRetry}
            style={styles.round}
          >
            <Text accessible={false} style={styles.arrow}>
              ↻
            </Text>
          </Pressable>
        </View>
        <View style={styles.intro}>
          <Text style={[styles.eyebrow, font]}>KHÔNG GIAN ĐỒNG HÀNH</Text>
          <Text accessibilityRole="header" style={[styles.title, heading]}>
            Tin nhắn tư vấn
          </Text>
          <Text style={[styles.copy, font]}>
            Xem lại những chia sẻ và tiếp tục trò chuyện khi đến giờ hẹn.
          </Text>
        </View>
        <View style={styles.search}>
          <Text accessible={false} style={styles.arrow}>
            ⌕
          </Text>
          <TextInput
            accessibilityLabel="Tìm cuộc trò chuyện"
            placeholder="Tìm chuyên gia hoặc mã lịch hẹn…"
            placeholderTextColor={colors.inkFaint}
            style={[styles.input, font]}
            value={query}
            onChangeText={setQuery}
          />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {filters.map((option) => (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === option.id }}
              onPress={() => setFilter(option.id)}
              style={[styles.filter, filter === option.id && styles.selected]}
            >
              <Text
                style={[
                  styles.filterText,
                  font,
                  filter === option.id && styles.white,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        {loading ? (
          <View style={styles.empty}>
            <ActivityIndicator
              accessibilityLabel="Đang tải cuộc trò chuyện"
              color={colors.tealDeep}
            />
            <Text style={[styles.copy, font]}>Đang tải lịch hẹn…</Text>
          </View>
        ) : failed ? (
          <View style={styles.empty}>
            <Text accessibilityRole="alert" style={[styles.copy, font]}>
              Chưa thể xác minh lịch hẹn của bạn.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={onRetry}
              style={styles.filter}
            >
              <Text style={[styles.filterText, font]}>Thử tải lại</Text>
            </Pressable>
          </View>
        ) : !visible.length ? (
          <View style={styles.empty}>
            <Text style={[styles.copy, font]}>
              {!conversations.length
                ? 'Chưa có lịch tư vấn qua trò chuyện.'
                : 'Chưa có cuộc trò chuyện phù hợp với lựa chọn này.'}
            </Text>
          </View>
        ) : (
          visible.map((item) => {
            const state = conversationState(item)
            const name =
              role === 'USER' ? item.specialistDisplayName : 'Phiên tư vấn'
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`Mở phiên trò chuyện với ${name}`}
                onPress={() => onOpen(item.id)}
                style={styles.conversation}
              >
                <View style={styles.avatar}>
                  <Text style={[styles.initials, font]}>
                    {role === 'USER' ? chatInitials(name) : 'TV'}
                  </Text>
                </View>
                <View style={styles.flex}>
                  <View style={styles.row}>
                    <Text numberOfLines={1} style={[styles.name, font]}>
                      {name}
                    </Text>
                    <Text style={[styles.time, font]}>
                      {chatTime(item.scheduledStartAt, item.timezone)}
                    </Text>
                  </View>
                  <Text numberOfLines={1} style={[styles.small, font]}>
                    {new Intl.DateTimeFormat('vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      timeZone: item.timezone,
                    }).format(new Date(item.scheduledStartAt))}{' '}
                    · #{item.id.slice(0, 8)}
                  </Text>
                  <Text
                    style={[
                      styles.badge,
                      state === 'active' && styles.activeBadge,
                      font,
                    ]}
                  >
                    {labels[state]}
                  </Text>
                </View>
                <Text accessible={false} style={styles.arrow}>
                  ›
                </Text>
              </Pressable>
            )
          })
        )}
        <Text style={[styles.footer, font]}>
          Chỉ những người tham gia lịch hẹn mới có quyền xem cuộc trò chuyện.
        </Text>
      </View>
    </Screen>
  )
}
const styles = StyleSheet.create({
  page: { gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1, minWidth: 0 },
  round: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: '#eaf1ed',
  },
  arrow: { fontSize: 22, color: colors.tealDeep },
  brand: { fontSize: 20, color: colors.ink },
  small: { fontSize: 11, color: colors.inkSoft, lineHeight: 18 },
  intro: { paddingVertical: spacing.lg, gap: spacing.sm },
  eyebrow: { color: colors.teal, fontSize: 10, letterSpacing: 1 },
  title: { color: colors.ink, fontSize: 29, lineHeight: 38 },
  copy: { color: colors.inkSoft, fontSize: 13, lineHeight: 22 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: 24,
    paddingHorizontal: spacing.lg,
  },
  input: { flex: 1, minHeight: 48, fontSize: 13, color: colors.ink },
  filters: { gap: spacing.sm },
  filter: {
    minHeight: 44,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: '#eaf1ed',
    justifyContent: 'center',
  },
  selected: { backgroundColor: colors.tealDeep },
  filterText: { color: colors.tealDeep, fontSize: 11, fontWeight: '600' },
  white: { color: colors.white },
  empty: {
    padding: spacing.xl,
    backgroundColor: colors.white,
    borderRadius: 22,
    gap: spacing.lg,
  },
  conversation: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e7eee9',
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#dfebe4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { color: colors.tealDeep, fontSize: 15, fontWeight: '600' },
  name: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.ink },
  time: { fontSize: 11, color: colors.inkSoft },
  badge: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    backgroundColor: '#edf1ee',
    borderRadius: 10,
    color: colors.inkSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    fontSize: 10,
    overflow: 'hidden',
  },
  activeBadge: { backgroundColor: '#d4f0e3', color: colors.tealDeep },
  footer: {
    color: colors.inkFaint,
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'center',
    padding: spacing.md,
  },
})
