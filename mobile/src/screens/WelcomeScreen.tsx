import { router } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'

import { PrimaryButton } from '@/components/PrimaryButton'
import { Screen } from '@/components/Screen'
import { colors, spacing, typography } from '@/theme/tokens'

export function WelcomeScreen() {
  return (
    <Screen>
      <View style={styles.brandMark} accessibilityElementsHidden>
        <View style={styles.brandLine} />
        <Text style={styles.eyebrow}>MENTALBRIDGE</Text>
      </View>
      <Text accessibilityRole="header" style={styles.title}>
        Một không gian bình tĩnh để chăm sóc tinh thần
      </Text>
      <Text style={styles.description}>
        Theo dõi hành trình hỗ trợ của bạn trên điện thoại với thông tin được
        bảo vệ và đồng bộ từ MentalBridge.
      </Text>
      <PrimaryButton label="Tiếp tục" onPress={() => router.push('/sign-in')} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  brandMark: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  brandLine: {
    backgroundColor: colors.teal,
    height: 2,
    width: 24,
  },
  eyebrow: {
    color: colors.teal,
    fontSize: typography.eyebrow,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  title: {
    color: colors.ink,
    fontSize: typography.heading,
    fontWeight: '700',
    lineHeight: typography.headingLineHeight,
    marginBottom: spacing.lg,
  },
  description: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
    marginBottom: spacing.xxl,
  },
})
