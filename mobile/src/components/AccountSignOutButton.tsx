import { useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { useSession } from '@/auth/session-context'
import { colors, radii, spacing } from '@/theme/tokens'

const ink = '#943D36'

export function AccountSignOutButton() {
  const { signOut } = useSession()
  const [pending, setPending] = useState(false)
  const label = pending ? 'Đang đăng xuất…' : 'Đăng xuất'

  const handlePress = async () => {
    setPending(true)
    try {
      await signOut()
    } finally {
      setPending(false)
    }
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Kết thúc phiên đăng nhập trên thiết bị này"
      accessibilityState={{ disabled: pending, busy: pending }}
      disabled={pending}
      onPress={() => void handlePress()}
      style={({ pressed }) => [s.row, pressed && s.pressed]}
    >
      <View
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={s.icon}
      >
        {pending ? (
          <ActivityIndicator color={ink} size="small" />
        ) : (
          <View style={s.symbol}>
            <View style={s.door} />
            <Text style={s.arrow}>→</Text>
          </View>
        )}
      </View>
      <Text accessibilityLiveRegion="polite" style={s.label}>
        {label}
      </Text>
    </Pressable>
  )
}

const s = StyleSheet.create({
  row: {
    minHeight: 60,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.panel,
    borderWidth: 1,
    borderColor: '#EBDAD7',
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  pressed: { backgroundColor: '#FAF1EF' },
  label: {
    flex: 1,
    color: ink,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: radii.control,
    backgroundColor: '#F8E9E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbol: { width: 28, height: 26 },
  door: {
    position: 'absolute',
    left: 4,
    top: 4,
    width: 13,
    height: 18,
    borderWidth: 1.6,
    borderRightWidth: 0,
    borderColor: ink,
    borderRadius: 2,
  },
  arrow: {
    position: 'absolute',
    left: 10,
    top: 1,
    color: ink,
    fontSize: 22,
    lineHeight: 24,
  },
})
