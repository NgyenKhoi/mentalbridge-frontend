import { useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { PrimaryButton } from '@/components/PrimaryButton'
import { localDateInTimeZone } from '@/resources/resource-model'
import { colors, radii, spacing } from '@/theme/tokens'

import type { DiscoveryBadge } from './discovery-api'
import type { DiscoveryItem, DiscoverySlot } from './discovery-contract'
import {
  explanationText,
  languageLabels,
  modalityLabels,
  slotLabel,
  supportAreaLabels,
  type SlotSelection,
} from './discovery-model'

export type ProfileTab = 'profile' | 'slots'

export function SpecialistProfileView({
  item,
  badges,
  tab,
  loading,
  verifying,
  error,
  selection,
  browseOnly,
  credits,
  fontsLoaded,
  onClose,
  onTab,
  onRetry,
  onSelect,
  onChooseOther,
}: Readonly<{
  item: DiscoveryItem | undefined
  badges: readonly DiscoveryBadge[]
  tab: ProfileTab
  loading: boolean
  verifying: boolean
  error: string
  selection: SlotSelection | null
  browseOnly: boolean
  credits: number | undefined
  fontsLoaded: boolean
  onClose: () => void
  onTab: (tab: ProfileTab) => void
  onRetry: () => void
  onSelect: (slot: DiscoverySlot) => void
  onChooseOther: () => void
}>) {
  const [selectedDay, setSelectedDay] = useState<string>()
  const { width, fontScale } = useWindowDimensions()
  const stacked = width < 360 || fontScale > 1.35
  const serif = fontsLoaded && styles.serif
  const slots = [...(item?.selectableSlots ?? [])].sort(
    (left, right) => Date.parse(left.startAt) - Date.parse(right.startAt),
  )
  const timeZone = item?.timezone ?? 'Asia/Ho_Chi_Minh'
  const days = new Map<string, DiscoverySlot[]>()
  for (const slot of slots) {
    const day = localDateInTimeZone(new Date(slot.startAt), timeZone)
    const entries = days.get(day)
    if (entries) entries.push(slot)
    else days.set(day, [slot])
  }
  const activeDay =
    selectedDay && days.has(selectedDay)
      ? selectedDay
      : days.keys().next().value
  const earliest = slots[0]
  const rating = item?.ratingAggregate
  const modalities = [
    ...new Set(slots.map((slot) => modalityLabels[slot.modality])),
  ]
  const canBook = !browseOnly && credits !== 0
  const facts = item
    ? [
        { label: 'Kinh nghiệm', value: `${item.yearsOfExperience} năm` },
        { label: 'Phương pháp', value: 'Chưa được cung cấp riêng' },
        {
          label: 'Ngôn ngữ trao đổi',
          value: item.languages
            .map((language) => languageLabels[language])
            .join(', '),
        },
        {
          label: 'Hình thức',
          value: modalities.length
            ? `${modalities.join(' / ')} · 60 phút`
            : 'Xem lịch trống',
        },
      ]
    : []

  return (
    <Modal
      visible
      animationType="none"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.screen}>
        <View style={styles.shell} accessibilityViewIsModal>
          <View style={styles.hero}>
            {item && (
              <View style={styles.avatar} accessible={false}>
                <Text style={[styles.initials, serif]}>
                  {item.displayName
                    .trim()
                    .split(/\s+/)
                    .slice(-2)
                    .map((part) => part[0])
                    .join('')
                    .toLocaleUpperCase('vi-VN')}
                </Text>
              </View>
            )}
            <View style={styles.identity}>
              <Text accessibilityRole="header" style={[styles.title, serif]}>
                {item?.displayName ?? 'Hồ sơ chuyên gia'}
              </Text>
              {item && (
                <Text style={styles.meta}>
                  {item.yearsOfExperience} năm kinh nghiệm
                </Text>
              )}
              {rating && (
                <Text style={styles.meta}>
                  ★ {rating.averageRating.toFixed(1)} · {rating.ratingCount}{' '}
                  đánh giá
                </Text>
              )}
              {item && badges.length > 0 && (
                <Text style={styles.badge}>✓ Giấy tờ đã xác minh</Text>
              )}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Quay lại danh sách chuyên gia"
              onPress={onClose}
              style={styles.close}
            >
              <Text accessible={false} style={styles.closeIcon}>
                ×
              </Text>
            </Pressable>
          </View>

          {item && !selection && (
            <View accessibilityRole="tablist" style={styles.tabs}>
              {(
                [
                  { id: 'profile', label: 'Hồ sơ' },
                  { id: 'slots', label: 'Lịch trống' },
                ] as const
              ).map(({ id, label }) => (
                <Pressable
                  key={id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === id }}
                  onPress={() => onTab(id)}
                  style={[styles.tab, tab === id && styles.activeTab]}
                >
                  <Text
                    style={[styles.tabText, tab === id && styles.activeText]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <ScrollView
            key={selection ? 'review' : tab}
            style={styles.scroll}
            contentContainerStyle={styles.body}
          >
            {loading ? (
              <View style={styles.panel}>
                <ActivityIndicator color={colors.tealDeep} />
                <Text accessibilityLiveRegion="polite" style={styles.copy}>
                  {verifying
                    ? 'Đang kiểm tra lại hồ sơ và khung giờ…'
                    : 'Đang tải thông tin chuyên gia…'}
                </Text>
              </View>
            ) : error ? (
              <View style={styles.panel}>
                <Text
                  accessibilityRole="header"
                  style={[styles.heading, serif]}
                >
                  Chưa thể tiếp tục
                </Text>
                <Text accessibilityRole="alert" style={styles.copy}>
                  {error}
                </Text>
                <PrimaryButton
                  label="Tải lại hồ sơ và khung giờ"
                  onPress={onRetry}
                />
              </View>
            ) : item && selection ? (
              <View style={styles.panel} testID="discovery-selection-summary">
                <Text
                  accessibilityRole="header"
                  style={[styles.heading, serif]}
                >
                  Khung giờ đã chọn
                </Text>
                <Text style={styles.activeText}>
                  {slotLabel(selection.slot)}
                </Text>
                <Text style={styles.copy}>
                  {modalityLabels[selection.slot.modality]} · 60 phút
                </Text>
                <Text style={styles.copy}>
                  {selection.bookingHandoff === 'BROWSE_ONLY'
                    ? 'Bạn đang xem khung giờ tham khảo. Gói hiện tại chỉ cho phép duyệt xem, chưa thể gửi yêu cầu đặt lịch.'
                    : 'Chưa gửi yêu cầu và chưa giữ chỗ. Lịch sẽ được xác nhận sau khi chuyên gia chấp thuận.'}
                </Text>
                {selection.bookingHandoff !== 'BROWSE_ONLY' &&
                  credits !== undefined && (
                    <Text style={styles.copy}>
                      {credits > 0
                        ? `${credits} lượt tư vấn khả dụng theo gói`
                        : 'Bạn đã hết lượt tư vấn khả dụng theo gói.'}
                    </Text>
                  )}
              </View>
            ) : item && tab === 'profile' ? (
              <>
                <Text style={styles.copy}>{item.bio}</Text>
                <View style={styles.panel}>
                  <Text
                    accessibilityRole="header"
                    style={[styles.heading, serif]}
                  >
                    Vì sao hồ sơ này xuất hiện?
                  </Text>
                  {explanationText(item).map((reason) => (
                    <Text key={reason} style={styles.copy}>
                      • {reason}
                    </Text>
                  ))}
                </View>
                <View style={styles.facts}>
                  {facts.map(({ label, value }) => (
                    <View
                      key={label}
                      style={[styles.fact, stacked && styles.fullWidth]}
                    >
                      <Text style={styles.factLabel}>{label}</Text>
                      <Text style={styles.copy}>{value}</Text>
                    </View>
                  ))}
                </View>
                <Text
                  accessibilityRole="header"
                  style={[styles.heading, serif]}
                >
                  Lĩnh vực hỗ trợ
                </Text>
                <View style={styles.tags}>
                  {item.supportAreas.map((area) => (
                    <Text key={area} style={styles.badge}>
                      {supportAreaLabels[area]}
                    </Text>
                  ))}
                </View>
                {badges.length > 0 && (
                  <View style={styles.panel}>
                    <Text
                      accessibilityRole="header"
                      style={[styles.heading, serif]}
                    >
                      Giấy tờ đã xác minh
                    </Text>
                    {badges.map((badge, index) => (
                      <Text
                        key={`${badge.credentialType}-${index}`}
                        style={styles.copy}
                      >
                        ✓ {badge.title}
                      </Text>
                    ))}
                  </View>
                )}
              </>
            ) : (
              item && (
                <>
                  <Text
                    accessibilityRole="header"
                    style={[styles.heading, serif]}
                  >
                    Chọn ngày và giờ
                  </Text>
                  {activeDay ? (
                    <>
                      <Text style={styles.meta}>
                        Giờ hiển thị theo múi giờ {timeZone}.
                      </Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.days}
                      >
                        {[...days].map(([day, entries]) => (
                          <Pressable
                            key={day}
                            accessibilityRole="button"
                            accessibilityState={{ selected: activeDay === day }}
                            onPress={() => setSelectedDay(day)}
                            style={[
                              styles.day,
                              activeDay === day && styles.selectedDay,
                            ]}
                          >
                            <Text style={styles.activeText}>
                              {new Intl.DateTimeFormat('vi-VN', {
                                weekday: 'short',
                                day: '2-digit',
                                month: '2-digit',
                                timeZone,
                              }).format(new Date(entries[0]!.startAt))}
                            </Text>
                            <Text style={styles.meta}>
                              {entries.length} khung giờ
                            </Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                      {days.get(activeDay)?.map((slot) => (
                        <Pressable
                          key={slot.id}
                          accessibilityRole="button"
                          accessibilityLabel={`Chọn ${slotLabel(slot)}`}
                          testID={`discovery-select-${slot.id}`}
                          onPress={() => onSelect(slot)}
                          style={styles.slot}
                        >
                          <View style={styles.identity}>
                            <Text style={styles.activeText}>
                              {slotLabel(slot)}
                            </Text>
                            <Text style={styles.meta}>
                              {modalityLabels[slot.modality]} · 60 phút
                            </Text>
                          </View>
                          <Text accessible={false} style={styles.activeText}>
                            →
                          </Text>
                        </Pressable>
                      ))}
                    </>
                  ) : (
                    <Text style={styles.copy}>
                      Hiện chưa có lịch trống. Hãy quay lại sau khi chuyên gia
                      cập nhật lịch.
                    </Text>
                  )}
                </>
              )
            )}
          </ScrollView>

          {item && !loading && !error && (
            <View style={styles.footer}>
              <View style={[styles.actions, stacked && styles.stack]}>
                {selection ? (
                  <>
                    <View style={styles.identity}>
                      <PrimaryButton
                        label="Chọn giờ khác"
                        tone="light"
                        onPress={onChooseOther}
                      />
                    </View>
                  </>
                ) : (
                  tab === 'profile' && (
                    <>
                      {earliest && canBook && (
                        <View style={styles.identity}>
                          <PrimaryButton
                            label="Đặt lịch gần nhất"
                            onPress={() => onSelect(earliest)}
                          />
                        </View>
                      )}
                      <View style={styles.identity}>
                        <PrimaryButton
                          label={
                            earliest && canBook
                              ? 'Chọn giờ khác'
                              : 'Xem lịch trống'
                          }
                          tone="light"
                          onPress={() => onTab('slots')}
                        />
                      </View>
                    </>
                  )
                )}
              </View>
              {!selection && tab === 'profile' && earliest && (
                <Text style={styles.meta}>
                  Gần nhất {slotLabel(earliest)}
                  {credits === undefined ? '' : ` · ${credits} lượt khả dụng`}
                </Text>
              )}
              <Pressable
                accessibilityRole="button"
                onPress={onRetry}
                style={styles.refresh}
              >
                <Text style={styles.activeText}>
                  Tải lại hồ sơ và khung giờ
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#E9F4EE' },
  shell: {
    flex: 1,
    width: '100%',
    maxWidth: 660,
    alignSelf: 'center',
    backgroundColor: colors.white,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: '#E9F4EE',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radii.panel,
    backgroundColor: '#D9E9EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: { flex: 1, minWidth: 0, gap: spacing.xs },
  initials: { fontSize: 22, fontWeight: '700', color: colors.tealDeep },
  title: { fontSize: 22, fontWeight: '700', color: colors.ink },
  serif: { fontFamily: 'DashboardSerif' },
  meta: { fontSize: 12, lineHeight: 19, color: colors.inkSoft },
  close: {
    width: 44,
    minHeight: 44,
    borderRadius: radii.control,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: { color: colors.tealDeep, fontSize: 24 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#D9EEE3',
    color: colors.tealDeep,
    fontSize: 12,
    lineHeight: 19,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  tab: {
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderColor: 'transparent',
    paddingVertical: spacing.xs,
  },
  activeTab: { borderColor: colors.tealDeep },
  tabText: { color: colors.inkSoft, fontSize: 14 },
  activeText: { color: colors.tealDeep, fontSize: 14, fontWeight: '700' },
  scroll: { flex: 1 },
  body: { padding: spacing.lg, gap: spacing.lg },
  copy: { color: colors.ink, fontSize: 14, lineHeight: 23 },
  heading: {
    color: colors.ink,
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '700',
  },
  panel: {
    backgroundColor: '#F4F8F5',
    padding: spacing.lg,
    borderRadius: radii.panel,
    gap: spacing.sm,
  },
  facts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.sm,
  },
  fact: {
    width: '48.5%',
    padding: spacing.md,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#F4F8F5',
    gap: spacing.xs,
  },
  fullWidth: { width: '100%' },
  factLabel: {
    textTransform: 'uppercase',
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: '700',
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  days: { gap: spacing.sm, paddingBottom: spacing.xs },
  day: {
    padding: spacing.md,
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.control,
    backgroundColor: '#F4F8F5',
  },
  selectedDay: { backgroundColor: '#D9EEE3', borderColor: colors.teal },
  slot: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.control,
    padding: spacing.md,
  },
  footer: {
    borderTopWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  actions: { flexDirection: 'row', gap: spacing.sm },
  stack: { flexDirection: 'column' },
  refresh: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
})
