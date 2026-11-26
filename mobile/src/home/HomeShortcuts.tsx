import * as SecureStore from 'expo-secure-store'
import { TourTarget } from '@/onboarding/tour-target'
import { router, type Href } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const shortcuts = [
  {
    id: 'screening',
    label: 'Kiểm tra PHQ-9',
    hint: 'Kiểm tra ban đầu · PHQ-9 & GAD-7',
    href: '/(user)/assessment',
    icon: require('../../assets/home-shortcuts/screening.png'),
    tint: '#FFF9E7',
  },
  {
    id: 'booking',
    label: 'Đặt lịch',
    hint: 'Đặt lịch chuyên gia',
    href: '/(user)/specialists',
    icon: require('../../assets/home-shortcuts/booking.png'),
    tint: '#E2EEE8',
  },
  {
    id: 'library',
    label: 'Kho tài nguyên',
    hint: 'Bài đọc và bài tập',
    href: '/(user)/resources',
    icon: require('../../assets/home-shortcuts/library.png'),
    tint: '#F8F1FF',
  },
  {
    id: 'messages',
    label: 'Tin nhắn',
    hint: 'Tin nhắn tư vấn',
    href: '/(user)/messages',
    icon: require('../../assets/home-shortcuts/messages.png'),
    tint: '#FFF0F2',
  },
  {
    id: 'community',
    label: 'Cộng đồng',
    hint: 'Cộng đồng & Trò chuyện',
    href: '/(user)/community',
    icon: require('../../assets/home-shortcuts/community.png'),
    tint: '#E2EEE8',
  },
  {
    id: 'screeningHistory',
    label: 'Bài sàng lọc',
    hint: 'Lịch sử PHQ-9 & GAD-7',
    href: '/(user)/assessments',
    icon: require('../../assets/home-shortcuts/screening.png'),
    tint: '#FFF9E7',
  },
  {
    id: 'analytics',
    label: 'Thống kê',
    hint: 'Thống kê & Phân tích',
    href: '/(user)/analytics',
    icon: require('../../assets/home-shortcuts/analytics.png'),
    tint: '#F8F1FF',
  },
] as const

const allIcon = require('../../assets/home-shortcuts/all.png')
const defaultOrder = shortcuts.map(({ id }) => id)
type ShortcutId = (typeof defaultOrder)[number]

const additionalLinks = [
  {
    label: 'Kế hoạch hỗ trợ',
    href: '/(user)/support-plan',
    icon: require('../../assets/icons/clipboard.png'),
    tint: '#E2EEE8',
  },
  {
    label: 'Lịch hẹn của tôi',
    href: '/(user)/appointments',
    icon: require('../../assets/home-shortcuts/booking.png'),
    tint: '#FFF9E7',
  },
  {
    label: 'Ghi nhận cảm xúc',
    href: '/(user)/emotion',
    icon: require('../../assets/home-shortcuts/emotion.png'),
    tint: '#FFF0F2',
  },
  {
    label: 'Nhắc nhở của tôi',
    href: '/(user)/reminders',
    icon: require('../../assets/home-shortcuts/reminders.png'),
    tint: '#FFF9E7',
  },
  {
    label: 'Bộ sưu tập và Bingo',
    href: '/(user)/rewards',
    icon: require('../../assets/home-shortcuts/rewards.png'),
    tint: '#F8F1FF',
  },
] as const satisfies readonly {
  label: string
  href: Href
  icon: number
  tint: string
}[]

function restoreOrder(raw: string | null): ShortcutId[] {
  if (!raw) return defaultOrder
  const saved: unknown = JSON.parse(raw)
  if (!Array.isArray(saved)) return defaultOrder
  const order = saved.flatMap((id: unknown) =>
    defaultOrder.filter(
      (key) => key === (id === 'journal' ? 'screeningHistory' : id),
    ),
  )
  return [...new Set([...order, ...defaultOrder])]
}

function searchable(value: string) {
  return value
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
}

export function HomeShortcuts({
  subject,
  searchTerm,
}: {
  subject: string | undefined
  searchTerm: string
}) {
  const { fontScale } = useWindowDimensions()
  const [order, setOrder] = useState(defaultOrder)
  const [draft, setDraft] = useState(defaultOrder)
  const [panel, setPanel] = useState<'all' | 'edit' | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const storageKey = subject ? `home.shortcuts.${subject}` : null

  useEffect(() => {
    if (!storageKey || Platform.OS === 'web') return
    let active = true
    void SecureStore.getItemAsync(storageKey)
      .then((raw) => {
        if (active) setOrder(restoreOrder(raw))
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [storageKey])

  const ordered = (ids: ShortcutId[]) =>
    ids.flatMap((id) => shortcuts.filter((item) => item.id === id))
  const visible = ordered(order).filter((item) =>
    searchable(item.label + ' ' + item.hint).includes(searchable(searchTerm)),
  )
  const close = () => {
    if (!saving) setPanel(null)
  }
  const open = (href: Href) => {
    setPanel(null)
    router.push(href)
  }
  const save = async () => {
    setSaving(true)
    setSaveError(false)
    try {
      if (storageKey && Platform.OS !== 'web')
        await SecureStore.setItemAsync(storageKey, JSON.stringify(draft))
      setOrder(draft)
      setPanel(null)
    } catch {
      setSaveError(true)
    } finally {
      setSaving(false)
    }
  }
  const tile = (
    label: string,
    icon: number,
    tint: string,
    onPress: () => void,
    isLink = true,
  ) => (
    <Pressable
      key={label}
      accessibilityRole={isLink ? 'link' : 'button'}
      onPress={onPress}
      style={({ pressed }) => [
        s.tile,
        fontScale > 1.45 && s.largeTextTile,
        pressed && s.pressed,
      ]}
    >
      <View style={[s.iconBox, { backgroundColor: tint }]}>
        <Image source={icon} style={s.icon} accessible={false} />
      </View>
      <Text style={s.tileLabel}>{label}</Text>
    </Pressable>
  )

  return (
    <TourTarget id="user-shortcuts" route="/user" style={s.card}>
      <View style={s.header}>
        <Text accessibilityRole="header" style={s.heading}>
          Tiện ích chăm sóc
        </Text>
        <Pressable
          accessibilityRole="button"
          style={s.custom}
          onPress={() => {
            setDraft(order)
            setSaveError(false)
            setPanel('edit')
          }}
        >
          <Text style={s.customText}>Tùy chỉnh</Text>
        </Pressable>
      </View>
      <View style={s.grid}>
        {visible.map((item) =>
          tile(item.label, item.icon, item.tint, () => open(item.href)),
        )}
        {!searchTerm &&
          tile('Tất cả', allIcon, '#F4F2EC', () => setPanel('all'), false)}
      </View>
      {searchTerm && !visible.length ? (
        <Text style={s.empty}>Không tìm thấy tiện ích phù hợp.</Text>
      ) : null}
      <Modal
        visible={panel !== null}
        transparent
        animationType="slide"
        onRequestClose={close}
      >
        <View style={s.overlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={close}
            accessible={false}
          />
          <SafeAreaView
            edges={['bottom']}
            accessibilityViewIsModal
            style={s.sheet}
          >
            <View style={s.sheetHeader}>
              <Text accessibilityRole="header" style={s.sheetTitle}>
                {panel === 'edit' ? 'Sắp xếp tiện ích' : 'Tất cả tiện ích'}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đóng tiện ích"
                onPress={close}
                disabled={saving}
                style={s.close}
              >
                <Text aria-hidden style={s.closeText}>
                  ×
                </Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={s.list}>
              {panel === 'edit' && (
                <Text style={s.empty}>
                  Đưa tiện ích bạn dùng nhiều lên trước.
                </Text>
              )}
              {ordered(panel === 'edit' ? draft : order).map((item, index) => (
                <View key={item.id} style={s.listRow}>
                  <View style={[s.iconBox, { backgroundColor: item.tint }]}>
                    <Image
                      source={item.icon}
                      style={s.icon}
                      accessible={false}
                    />
                  </View>
                  {panel === 'edit' ? (
                    <>
                      <Text style={s.listLabel}>{item.label}</Text>
                      <Pressable
                        disabled={index === 0 || saving}
                        accessibilityRole="button"
                        accessibilityLabel={`Đưa ${item.label} lên trước`}
                        accessibilityState={{ disabled: index === 0 || saving }}
                        style={[s.move, index === 0 && s.disabled]}
                        onPress={() =>
                          setDraft((current) => {
                            const next = [...current]
                            const previous = next[index - 1]
                            if (!previous) return current
                            next[index - 1] = item.id
                            next[index] = previous
                            return next
                          })
                        }
                      >
                        <Text aria-hidden style={s.customText}>
                          ↑
                        </Text>
                      </Pressable>
                    </>
                  ) : (
                    <Pressable
                      accessibilityRole="link"
                      style={s.listLink}
                      onPress={() => open(item.href)}
                    >
                      <Text style={s.listLabel}>{item.label}</Text>
                    </Pressable>
                  )}
                </View>
              ))}
              {panel === 'all' &&
                additionalLinks.map(({ label, href, icon, tint }) => (
                  <Pressable
                    key={href}
                    accessibilityRole="link"
                    style={({ pressed }) => [
                      s.listRow,
                      s.additionalLink,
                      pressed && s.pressed,
                    ]}
                    onPress={() => open(href)}
                  >
                    <View style={[s.iconBox, { backgroundColor: tint }]}>
                      <Image
                        source={icon}
                        style={[s.icon, { tintColor: '#1E4A43' }]}
                        accessible={false}
                      />
                    </View>
                    <Text style={s.listLabel}>{label}</Text>
                  </Pressable>
                ))}
            </ScrollView>
            {panel === 'edit' && (
              <View style={s.footer}>
                {saveError && (
                  <Text accessibilityRole="alert" style={s.empty}>
                    Chưa lưu được tiện ích. Vui lòng thử lại.
                  </Text>
                )}
                <Pressable
                  accessibilityRole="button"
                  disabled={saving}
                  onPress={() => setDraft(defaultOrder)}
                  style={s.custom}
                >
                  <Text style={s.customText}>Khôi phục mặc định</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={saving}
                  onPress={() => void save()}
                  style={s.save}
                >
                  <Text style={s.saveLabel}>
                    {saving ? 'Đang lưu…' : 'Lưu thứ tự'}
                  </Text>
                </Pressable>
              </View>
            )}
          </SafeAreaView>
        </View>
      </Modal>
    </TourTarget>
  )
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#FFF',
    borderColor: '#EEEAE2',
    borderWidth: 1,
    borderRadius: 23,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 5,
    paddingTop: 3,
  },
  heading: { flexShrink: 1, color: '#142D28', fontSize: 16, fontWeight: '800' },
  custom: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  customText: { color: '#315D51', fontSize: 12, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 7 },
  tile: {
    width: '25%',
    alignItems: 'center',
    minHeight: 69,
    paddingHorizontal: 3,
    paddingBottom: 4,
    gap: 6,
  },
  largeTextTile: { width: '50%' },
  iconBox: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
  },
  icon: { width: 23, height: 23 },
  tileLabel: {
    textAlign: 'center',
    color: '#183630',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  pressed: { opacity: 0.64 },
  empty: { fontSize: 13, color: '#4C6258', padding: 8 },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: '#112D2670',
  },
  sheet: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '90%',
    alignSelf: 'center',
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    gap: 8,
  },
  sheetTitle: {
    color: '#183630',
    fontSize: 18,
    fontWeight: '800',
    flexShrink: 1,
  },
  close: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: '#315D51', fontSize: 24 },
  list: { paddingBottom: 12 },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DEE9E2',
  },
  listLabel: {
    color: '#183630',
    fontWeight: '700',
    fontSize: 14,
    flexShrink: 1,
  },
  listLink: { flex: 1, minHeight: 46, justifyContent: 'center' },
  additionalLink: { minHeight: 56 },
  move: {
    marginLeft: 'auto',
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.3 },
  footer: { paddingBottom: 12, gap: 4 },
  save: {
    minHeight: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#214E41',
  },
  saveLabel: { color: '#FFF', fontWeight: '800' },
})
