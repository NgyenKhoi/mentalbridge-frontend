import { ScrollView, StyleSheet, View } from 'react-native'

import { PressableScale } from '@/components/PressableScale'
import { Txt } from '@/theme/dashboard'
import { spacing } from '@/theme/tokens'

import type { CommunitySummary } from './community-contract'
import { CommunityIcon, Avatar } from './community-ui'
import { communityColors } from './community-theme'

/** Dark flat tile for one moment: author avatar top-left, two-line caption at the bottom. No video is decoded. */
export function MomentTile({
  moment,
  width,
  height,
  onPress,
}: Readonly<{
  moment: CommunitySummary
  width: number
  height: number
  onPress: () => void
}>) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Mở khoảnh khắc của ${moment.author.displayName}`}
      scaleTo={0.96}
      testID={`community-moment-${moment.postId}`}
      onPress={onPress}
      style={[tile.box, { height, width }]}
    >
      <View style={tile.ring}>
        <Avatar author={moment.author} size={22} />
      </View>
      <View style={tile.play}>
        <CommunityIcon
          name="play-circle-outline"
          size={34}
          color={communityColors.onDarkSoft}
        />
      </View>
      <Txt numberOfLines={2} style={tile.caption}>
        {moment.contentPreview.replace(/\s+/g, ' ')}
      </Txt>
    </PressableScale>
  )
}

const tile = StyleSheet.create({
  box: {
    backgroundColor: communityColors.primaryDeep,
    borderRadius: 16,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    padding: 8,
  },
  ring: {
    borderColor: communityColors.white,
    borderRadius: 15,
    borderWidth: 2,
    left: 7,
    overflow: 'hidden',
    position: 'absolute',
    top: 7,
  },
  play: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  // 11.5 is the mock's tile caption size.
  caption: {
    color: communityColors.white,
    fontSize: 11.5,
    fontWeight: '600',
    lineHeight: 14.5,
  },
})

/** Horizontal strip on top of the feed: "Tạo" first, then one tile per moment. */
export function CommunityMomentsStrip({
  moments,
  onCreate,
  onOpen,
}: Readonly<{
  moments: readonly CommunitySummary[]
  onCreate: () => void
  onOpen: (index: number) => void
}>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Tạo khoảnh khắc mới"
        scaleTo={0.96}
        onPress={onCreate}
        style={styles.create}
      >
        <View style={styles.plus}>
          <CommunityIcon name="plus" size={22} color={communityColors.white} />
        </View>
        <Txt style={styles.label}>Tạo</Txt>
      </PressableScale>
      {moments.map((moment, index) => (
        <MomentTile
          key={moment.postId}
          moment={moment}
          width={86}
          height={128}
          onPress={() => onOpen(index)}
        />
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  row: {
    gap: 10,
    paddingBottom: spacing.md + 2,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  create: {
    alignItems: 'center',
    backgroundColor: communityColors.soft,
    borderRadius: 16,
    gap: spacing.sm,
    height: 128,
    justifyContent: 'center',
    width: 86,
  },
  plus: {
    alignItems: 'center',
    backgroundColor: communityColors.primaryDeep,
    borderRadius: 17,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  label: {
    color: communityColors.primaryDeep,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
})
