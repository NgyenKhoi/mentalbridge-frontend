import { router } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { colors, radii } from '@/theme/tokens'
import { TourTarget } from '@/onboarding/tour-target'
import { AppIcon } from '@/components/AppIcon'

const tabs = [
  { path: '/user', href: '/(user)/user', label: 'Trang chủ', icon: 'home' },
  {
    path: '/support-plan',
    href: '/(user)/support-plan',
    label: 'Kế hoạch',
    icon: 'clipboard',
  },
  { path: '/journal', href: '/(user)/journal', label: 'Nhật ký', icon: 'book' },
  {
    path: '/specialists',
    href: '/(user)/specialists',
    label: 'Chuyên gia',
    icon: 'plus',
  },
  { path: '/profile', href: '/(user)/profile', label: 'Cá nhân', icon: 'user' },
] as const

export const USER_TAB_BAR_HEIGHT = 72

export function isUserTabPath(pathname: string) {
  return (
    pathname === '/appointments' || tabs.some(({ path }) => path === pathname)
  )
}

export function UserTabBar({ pathname }: Readonly<{ pathname: string }>) {
  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.bar}>
      <View accessibilityRole="tablist" style={styles.tabs}>
        {tabs.map(({ path, href, label, icon }) => {
          const selected =
            path === pathname ||
            (path === '/specialists' && pathname === '/appointments')
          const featured = icon === 'plus'
          return (
            <TourTarget
              key={path}
              id={`user-tab-${path.slice(1)}`}
              route={pathname}
              style={{ flex: 1 }}
            >
              <Pressable
                key={path}
                accessibilityRole="tab"
                accessibilityLabel={label}
                accessibilityState={{ selected }}
                onPress={() => {
                  if (pathname !== path) router.replace(href)
                }}
                style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
              >
                <View
                  style={[
                    styles.icon,
                    featured && styles.featuredIcon,
                    featured && selected && styles.featuredSelected,
                  ]}
                >
                  <AppIcon
                    name={icon}
                    size={featured ? 23 : 24}
                    color={
                      featured && selected
                        ? colors.white
                        : selected
                          ? colors.tealDeep
                          : colors.inkSoft
                    }
                  />
                </View>
                <Text
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.2}
                  style={[styles.label, selected && styles.selectedLabel]}
                >
                  {label}
                </Text>
              </Pressable>
            </TourTarget>
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
    gap: 3,
    paddingHorizontal: 2,
  },
  icon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredIcon: { borderRadius: radii.pill, backgroundColor: '#ECF3EE' },
  featuredSelected: { backgroundColor: colors.tealDeep },
  label: { color: colors.inkSoft, fontSize: 12, textAlign: 'center' },
  selectedLabel: { color: colors.tealDeep, fontWeight: '700' },
  pressed: { opacity: 0.7 },
})
