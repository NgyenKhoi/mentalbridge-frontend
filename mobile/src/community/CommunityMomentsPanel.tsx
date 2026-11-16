import type { ReactNode } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'

import { Screen } from '@/components/Screen'
import { spacing } from '@/theme/tokens'

import type { CommunitySummary } from './community-contract'
import { communityColors } from './community-theme'
import { MomentTile } from './CommunityMomentsStrip'
import {
  CommunityButton,
  CommunityHeader,
  Reveal,
  SkeletonBlock,
  SkeletonGroup,
  StateCard,
} from './community-ui'

const GAP = 10
const PAD = 14
const MAX_WIDTH = 760

/** Khoảnh khắc tab: the moments of the loaded feed in a two-column grid, each opening the viewer. */
export function CommunityMomentsPanel({
  moments,
  loading,
  failed,
  hasMore,
  loadingMore,
  onRetry,
  onMore,
  onOpen,
  onCreate,
  footer,
}: Readonly<{
  moments: readonly CommunitySummary[]
  loading: boolean
  failed: boolean
  hasMore: boolean
  loadingMore: boolean
  onRetry: () => void
  onMore: () => void
  onOpen: (index: number) => void
  onCreate: () => void
  footer: ReactNode
}>) {
  const { width } = useWindowDimensions()
  const tile = (Math.min(width, MAX_WIDTH) - PAD * 2 - GAP) / 2
  return (
    <Screen
      layout="bleed"
      backgroundColor={communityColors.background}
      header={<CommunityHeader padded size="large" title="Khoảnh khắc" />}
      footer={footer}
    >
      {loading ? (
        <SkeletonGroup label="Đang tải khoảnh khắc…">
          <View style={styles.grid}>
            {[0, 1, 2, 3].map((key) => (
              <SkeletonBlock
                key={key}
                width={tile}
                height={tile * (4 / 3)}
                radius={16}
              />
            ))}
          </View>
        </SkeletonGroup>
      ) : failed ? (
        <StateCard
          tone="error"
          icon="alert-circle-outline"
          title="Khoảnh khắc tạm thời chưa tải được."
          actionLabel="Thử lại"
          onAction={onRetry}
        />
      ) : moments.length === 0 ? (
        <Reveal step={0}>
          <StateCard
            icon="play-box-outline"
            title="Chưa có khoảnh khắc nào"
            body="Đăng một video ngắn để chia sẻ khoảnh khắc của bạn."
            actionLabel="Tạo khoảnh khắc"
            onAction={onCreate}
          />
        </Reveal>
      ) : (
        <Reveal step={0}>
          <View style={styles.grid}>
            {moments.map((moment, index) => (
              <MomentTile
                key={moment.postId}
                moment={moment}
                width={tile}
                height={tile * (4 / 3)}
                onPress={() => onOpen(index)}
              />
            ))}
          </View>
          {hasMore && (
            <View style={styles.more}>
              <CommunityButton
                label="Xem thêm khoảnh khắc"
                disabled={loadingMore}
                onPress={onMore}
              />
            </View>
          )}
        </Reveal>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    padding: PAD,
  },
  more: { paddingHorizontal: PAD, paddingBottom: spacing.md },
})
