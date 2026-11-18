import { router } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { colors, radii, spacing } from '@/theme/tokens'

const tabs = [
  { path: '/user', href: '/(user)/user', label: 'Trang chủ', icon: '⌂' },
  {
    path: '/support-plan',
    href: '/(user)/support-plan',
    label: 'Kế hoạch',
    icon: '▣',
  },
  { path: '/journal', href: '/(user)/journal', label: 'Nhật ký', icon: '✎' },
  {
    path: '/specialists',
    href: '/(user)/specialists',
    label: 'Chuyên gia',
    icon: '✚',
  },
  { path: '/profile', href: '/(user)/profile', label: 'Cá nhân', icon: '◎' },
] as const

export const USER_TAB_BAR_HEIGHT = 58

export function isUserTabPath(pathname: string) {
  return tabs.some(({ path }) => path === pathname)
}

export function UserTabBar({ pathname }: Readonly<{ pathname: string }>) {
  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.bar}>
      <View accessibilityRole="tablist" style={styles.tabs}>
        {tabs.map(({ path, href, label, icon }) => {
          const selected = path === pathname
          return (
            <Pressable
              key={path}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected }}
              onPress={() => {
                if (!selected) router.replace(href)
              }}
              style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            >
              <Text
                accessible={false}
                style={[styles.icon, selected && styles.selectedIcon]}
              >
                {icon}
              </Text>
              <Text
                numberOfLines={1}
                maxFontSizeMultiplier={1.2}
                style={[styles.label, selected && styles.selectedLabel]}
              >
                {label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.line,
    borderTopWidth: 1,
  },
  tabs: {
    flexDirection: 'row',
    minHeight: USER_TAB_BAR_HEIGHT,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: 2,
  },
  icon: {
    width: 30,
    lineHeight: 28,
    borderRadius: radii.pill,
    overflow: 'hidden',
    textAlign: 'center',
    color: colors.inkSoft,
    fontSize: 20,
  },
  selectedIcon: { color: colors.tealDeep, backgroundColor: colors.tealPale },
  label: { color: colors.inkSoft, fontSize: 11, textAlign: 'center' },
  selectedLabel: { color: colors.tealDeep, fontWeight: '700' },
  pressed: { opacity: 0.7 },
})
