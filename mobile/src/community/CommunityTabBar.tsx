import { StyleSheet, View } from 'react-native'

import { PressableScale } from '@/components/PressableScale'

import { CommunityIcon, type IconName } from './community-primitives'
import { communityColors } from './community-theme'

export type CommunityTab = 'feed' | 'moments' | 'compose' | 'chat' | 'me'

const tabs: readonly {
  key: CommunityTab
  label: string
  icon: IconName
  active: IconName
}[] = [
  {
    key: 'feed',
    label: 'Bảng tin',
    icon: 'home-variant-outline',
    active: 'home-variant',
  },
  {
    key: 'moments',
    label: 'Khoảnh khắc',
    icon: 'play-box-outline',
    active: 'play-box',
  },
  { key: 'compose', label: 'Viết', icon: 'plus', active: 'plus' },
  {
    key: 'chat',
    label: 'Tin nhắn',
    icon: 'message-text-outline',
    active: 'message-text',
  },
  {
    key: 'me',
    label: 'Trang của tôi',
    icon: 'account-outline',
    active: 'account',
  },
]

/** Community's own bottom bar. Render it through `Screen`'s `footer` so the safety button lifts above it. */
export function CommunityTabBar({
  active,
  onSelect,
}: Readonly<{
  /** `compose` is an action, never the current screen. */
  active: Exclude<CommunityTab, 'compose'>
  onSelect: (tab: CommunityTab) => void
}>) {
  return (
    <View accessibilityRole="tablist" style={styles.bar}>
      {tabs.map((tab) => {
        const selected = tab.key === active
        const compose = tab.key === 'compose'
        return (
          <PressableScale
            key={tab.key}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected }}
            scaleTo={0.9}
            onPress={() => onSelect(tab.key)}
            style={styles.item}
          >
            <View style={compose ? styles.compose : undefined}>
              <CommunityIcon
                name={selected ? tab.active : tab.icon}
                size={26}
                color={
                  compose
                    ? communityColors.white
                    : selected
                      ? communityColors.primaryDeep
                      : communityColors.inkMuted
                }
              />
            </View>
          </PressableScale>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    alignItems: 'center',
    backgroundColor: communityColors.background,
    borderTopColor: communityColors.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    height: 58,
    justifyContent: 'space-around',
    paddingHorizontal: 6,
  },
  item: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    minWidth: 56,
  },
  compose: {
    alignItems: 'center',
    backgroundColor: communityColors.primaryDeep,
    borderRadius: 12,
    height: 36,
    justifyContent: 'center',
    width: 44,
  },
})
