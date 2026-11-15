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
}: Readonly<{
  disabled?: boolean
  label: string
  onPress: () => void
  testID?: string
  tone?: 'default' | 'light' | 'darkPill'
  labelStyle?: StyleProp<TextStyle>
}>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        tone === 'light' && styles.lightButton,
        tone === 'darkPill' && styles.darkPill,
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
