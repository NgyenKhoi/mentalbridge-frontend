import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'

import { radii, spacing } from '@/theme/tokens'

import { communityColors } from './community-theme'

export function SkeletonBlock({
  width = '100%',
  height,
  radius = radii.control,
}: Readonly<{
  width?: number | `${number}%`
  height: number
  radius?: number
}>) {
  return (
    <View
      style={{
        width,
        height,
        borderRadius: radius,
        backgroundColor: communityColors.soft,
      }}
    />
  )
}

/** Static placeholders inside one progressbar: the label is read once, the blocks stay silent. */
export function SkeletonGroup({
  label,
  children,
}: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={skeleton.group}
    >
      {children}
    </View>
  )
}

export function SkeletonRow({ size = 40 }: Readonly<{ size?: number }>) {
  return (
    <View style={skeleton.row}>
      <SkeletonBlock width={size} height={size} radius={size / 2} />
      <View style={skeleton.lines}>
        <SkeletonBlock width="45%" height={14} />
        <SkeletonBlock height={12} />
      </View>
    </View>
  )
}

/** A post-shaped block: author row, body lines, media, action row. */
export function SkeletonPost() {
  return (
    <View style={skeleton.post}>
      <View style={skeleton.pad}>
        <SkeletonRow size={38} />
        <SkeletonBlock height={14} />
        <SkeletonBlock width="70%" height={14} />
      </View>
      <SkeletonBlock height={220} radius={0} />
      <View style={[skeleton.pad, skeleton.actions]}>
        <SkeletonBlock width={56} height={24} radius={12} />
        <SkeletonBlock width={56} height={24} radius={12} />
      </View>
      <View style={skeleton.band} />
    </View>
  )
}

const skeleton = StyleSheet.create({
  group: { gap: spacing.md },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  lines: { flex: 1, gap: spacing.sm },
  post: { gap: spacing.md, paddingTop: spacing.md },
  pad: { gap: spacing.md, paddingHorizontal: spacing.md },
  actions: { flexDirection: 'row' },
  band: { backgroundColor: communityColors.soft, height: 8 },
})
