import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { AppIcon, type AppIconName } from '@/components/AppIcon'
import { colors, spacing } from '@/theme/tokens'

/** One preference is open at a time; the form values stay in the owning card. */
export function PlanPreferenceRow({
  title,
  summary,
  icon,
  expanded,
  onPress,
  children,
}: Readonly<{
  title: string
  summary: string
  icon: AppIconName
  expanded: boolean
  onPress: () => void
  children: ReactNode
}>) {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Chỉnh ${title.toLocaleLowerCase('vi-VN')}`}
        accessibilityState={{ expanded }}
        onPress={onPress}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
      >
        <View style={styles.icon}>
          <AppIcon name={icon} size={20} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.summary}>{summary}</Text>
        </View>
        <View
          style={{ transform: [{ rotate: expanded ? '-90deg' : '90deg' }] }}
        >
          <AppIcon name="chevron" size={16} />
        </View>
      </Pressable>
      {expanded && <View style={styles.content}>{children}</View>}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { borderTopColor: colors.line, borderTopWidth: 1 },
  trigger: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  title: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  summary: { color: colors.inkSoft, fontSize: 13, lineHeight: 19 },
  content: { gap: spacing.sm, paddingBottom: spacing.lg },
  pressed: { opacity: 0.68 },
})
