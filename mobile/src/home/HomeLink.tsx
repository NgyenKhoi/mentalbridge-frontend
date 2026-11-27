import { ActivityIndicator, Pressable, StyleSheet } from 'react-native'

import { dashboardColors as colors, Txt } from '@/theme/dashboard'
import { spacing } from '@/theme/tokens'

/** Quiet text link: opacity 0.7 on press; `loading` swaps the label for a spinner. */
export function HomeLink({
  label,
  onPress,
  loading = false,
  tone = 'link',
}: Readonly<{
  label: string
  onPress: () => void
  loading?: boolean
  tone?: 'link' | 'quiet'
}>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: loading }}
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}
    >
      {loading ? (
        <ActivityIndicator color={colors.tealDeep} size="small" />
      ) : (
        <Txt style={[styles.label, tone === 'quiet' && styles.quiet]}>
          {label}
        </Txt>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  link: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: 44,
    paddingRight: spacing.sm,
  },
  label: { color: colors.tealDeep, fontSize: 15, fontWeight: '700' },
  quiet: { color: colors.inkSoft, fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.7 },
})
