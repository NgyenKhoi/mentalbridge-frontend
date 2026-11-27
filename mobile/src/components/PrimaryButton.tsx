import {
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
} from 'react-native'

import { colors, radii, spacing, typography } from '@/theme/tokens'

export function PrimaryButton({
  disabled = false,
  label,
  onPress,
  testID,
  tone = 'default',
  labelStyle,
  leadingIcon,
  accessibilityLabel,
}: Readonly<{
  disabled?: boolean
  label: string
  onPress: () => void
  testID?: string
  tone?: 'default' | 'light' | 'darkPill' | 'dashboard'
  leadingIcon?: string
  accessibilityLabel?: string
  labelStyle?: StyleProp<TextStyle>
}>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        tone === 'light' && styles.lightButton,
        tone === 'darkPill' && styles.darkPill,
        tone === 'dashboard' && styles.dashboard,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.label,
          tone === 'light' && styles.lightLabel,
          labelStyle,
        ]}
      >
        {leadingIcon ? leadingIcon + '  ' : null}
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.tealDeep,
    borderRadius: radii.control,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  dashboard: {
    alignSelf: 'stretch',
    borderRadius: radii.pill,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  darkPill: {
    alignSelf: 'stretch',
    borderRadius: radii.pill,
    backgroundColor: '#174A32',
  },
  lightButton: {
    alignSelf: 'stretch',
    borderRadius: radii.pill,
    backgroundColor: colors.tealPale,
  },
  lightLabel: { color: colors.tealDeep, textAlign: 'center' },
  pressed: {
    opacity: 0.82,
  },
  disabled: {
    opacity: 0.55,
  },
  label: {
    color: colors.white,
    fontSize: typography.body,
    fontWeight: '700',
  },
})
