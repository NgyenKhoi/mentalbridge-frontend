import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { colors, spacing } from '@/theme/tokens'

export type CommunitySection = 'feed' | 'reels' | 'groups' | 'profile'
const destinations = [
  ['feed', 'Cộng đồng', '♧'],
  ['reels', 'Reels', '▷'],
  ['chat', 'Trò chuyện', '☏'],
  ['groups', 'Nhóm', '♧'],
  ['profile', 'Danh tính', '◎'],
] as const

export function CommunityHeader({
  onBack,
  onHelp,
}: Readonly<{
  onBack: () => void
  onHelp: () => void
}>) {
  return (
    <View style={s.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Về không gian của bạn"
        onPress={onBack}
        style={s.brand}
      >
        <Text aria-hidden style={s.brandIcon}>
          ‹
        </Text>
      </Pressable>
      <View style={s.copy}>
        <Text accessibilityRole="header" style={s.title}>
          Cộng đồng &amp; Trò chuyện
        </Text>
        <Text style={s.subtitle}>Vùng an yên MentalBridge</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cần hỗ trợ ngay"
        onPress={onHelp}
        style={s.help}
      >
        <Text style={s.helpText}>• Cần hỗ trợ</Text>
      </Pressable>
    </View>
  )
}

export function CommunityNavigation({
  section,
  onSelect,
  onChat,
}: Readonly<{
  section: CommunitySection | 'chat' | null
  onSelect: (section: CommunitySection) => void
  onChat?: (() => void) | undefined
}>) {
  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={s.navigation}>
      <View accessibilityRole="tablist" style={s.tabs}>
        {destinations
          .filter(([key]) => key !== 'chat' || onChat)
          .map(([key, label, icon]) => (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityLabel={
                key === 'chat'
                  ? 'Trò chuyện cộng đồng'
                  : key === 'profile'
                    ? 'Danh tính cộng đồng'
                    : label
              }
              accessibilityState={{ selected: key === section }}
              onPress={() => (key === 'chat' ? onChat?.() : onSelect(key))}
              style={s.tab}
            >
              <Text
                aria-hidden
                style={[s.tabIcon, key === section && s.selected]}
              >
                {icon}
              </Text>
              <Text style={[s.tabLabel, key === section && s.selected]}>
                {label}
              </Text>
            </Pressable>
          ))}
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  brand: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandIcon: {
    width: 32,
    lineHeight: 32,
    textAlign: 'center',
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: '#164C3D',
    color: colors.white,
    fontSize: 27,
  },
  copy: { flex: 1, gap: 3 },
  title: { fontSize: 16, fontWeight: '800', color: colors.ink },
  subtitle: { fontSize: 10, color: colors.tealDeep },
  help: {
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    maxWidth: 90,
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: '#FFF0EC',
    borderColor: '#F4D9D0',
    borderWidth: 1,
  },
  helpText: { fontSize: 11, color: '#9C5141', textAlign: 'center' },
  navigation: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  tabs: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  tab: {
    minHeight: 58,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabIcon: { fontSize: 20, color: colors.inkFaint },
  tabLabel: { fontSize: 10, color: colors.inkSoft },
  selected: { color: '#164C3D', fontWeight: '800' },
})
