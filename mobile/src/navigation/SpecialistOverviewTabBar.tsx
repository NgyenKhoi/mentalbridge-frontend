import { router } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors } from '@/theme/tokens'
import { TourTarget } from '@/onboarding/tour-target'

const tabs = [
  ['Tổng quan', '/(specialist)/specialist', '▦'],
  ['Lịch hẹn', '/(specialist)/appointments', '▣'],
  ['Khách hàng', '/(specialist)/clients', null],
  ['Tin nhắn', '/(specialist)/messages', '▤'],
  ['Tài khoản', '/(specialist)/profile', '◎'],
] as const

export function SpecialistOverviewTabBar({
  onOverview = false,
  onAppointments = false,
  onClients = false,
  onProfile = false,
}: {
  onOverview?: boolean
  onAppointments?: boolean
  onClients?: boolean
  onProfile?: boolean
}) {
  const activeHref = onProfile
    ? '/(specialist)/profile'
    : onClients
      ? '/(specialist)/clients'
      : onAppointments
        ? '/(specialist)/appointments'
        : '/(specialist)/specialist'

  return (
    <View accessibilityRole="tablist" style={s.bar}>
      {tabs.map(([label, href, glyph]) => {
        const overview = href === '/(specialist)/specialist'
        const clients = href === '/(specialist)/clients'
        const selected = href === activeHref
        return (
          <TourTarget
            key={href}
            id={`specialist-tab-${href.split('/').pop()}`}
            route={activeHref.replace('/(specialist)', '')}
            style={{ flex: 1 }}
          >
            <Pressable
              key={href}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected }}
              onPress={() => {
                if (overview) {
                  if (!onOverview) router.dismissTo(href)
                } else if (!selected) router.push(href)
              }}
              style={[s.tab, selected && s.selected]}
            >
              {clients ? (
                <View aria-hidden style={s.personIcon}>
                  <View style={s.personHead} />
                  <View style={s.personBody} />
                  {selected ? <View style={s.personDot} /> : null}
                </View>
              ) : (
                <Text aria-hidden style={s.glyph}>
                  {glyph}
                </Text>
              )}
              <Text style={s.label}>{label}</Text>
            </Pressable>
          </TourTarget>
        )
      })}
    </View>
  )
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopColor: colors.line,
    borderTopWidth: 1,
    backgroundColor: '#F8F8F2',
    minHeight: 58,
  },
  tab: {
    flex: 1,
    paddingVertical: 5,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  selected: { backgroundColor: '#E6EFE6' },
  personIcon: {
    width: 23,
    height: 23,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  personHead: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.tealDeep,
  },
  personBody: {
    width: 13,
    height: 7,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    backgroundColor: colors.tealDeep,
  },
  personDot: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.teal,
  },
  glyph: { fontSize: 19, color: '#173932' },
  label: { fontSize: 10, color: colors.ink, textAlign: 'center' },
})
