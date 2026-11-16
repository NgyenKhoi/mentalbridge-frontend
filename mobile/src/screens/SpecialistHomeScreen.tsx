import { router } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useSession } from '@/auth/session-context'
import { PrimaryButton } from '@/components/PrimaryButton'
import { Screen } from '@/components/Screen'
import { colors, radii, spacing, typography } from '@/theme/tokens'
import type { SpecialistCommercialApi } from '@/specialist-commercial/specialist-commercial-api'
import { SpecialistCommercialPanel } from '@/specialist-commercial/SpecialistCommercialPanel'

export function SpecialistHomeScreen({
  commercialApi,
}: Readonly<{ commercialApi?: SpecialistCommercialApi }>) {
  const { signOut, session } = useSession()

  return (
    <Screen>
      <Text style={styles.eyebrow}>DÀNH CHO CHUYÊN GIA</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Không gian chuyên môn của bạn
      </Text>
      <Text style={styles.description}>
        Quản lý lịch hẹn được giao, chuẩn bị cho phiên tư vấn và cập nhật hồ sơ,
        lịch làm việc của bạn từ một nơi.
      </Text>
      {commercialApi && session?.role === 'SPECIALIST' ? (
        <SpecialistCommercialPanel
          api={commercialApi}
          subject={session.subject}
        />
      ) : null}
      <View style={styles.actions}>
        <PrimaryButton
          label="Mở lịch hẹn tư vấn"
          onPress={() => router.push('./appointments')}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('./messages')}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.secondaryLabel}>Phiên trò chuyện</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('./notifications')}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.secondaryLabel}>Thông báo chuyên môn</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('./profile')}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.secondaryLabel}>Quản lý hồ sơ nghề nghiệp</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('./availability')}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.secondaryLabel}>Quản lý lịch khả dụng</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => void signOut()}
          style={({ pressed }) => [
            styles.signOutButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.signOutLabel}>Đăng xuất</Text>
        </Pressable>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  eyebrow: {
    color: colors.teal,
    fontSize: typography.eyebrow,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: spacing.md,
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
    marginBottom: spacing.xl,
  },
  actions: {
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  secondaryButton: {
    borderColor: colors.tealDeep,
    borderRadius: radii.control,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  secondaryLabel: {
    color: colors.tealDeep,
    fontSize: typography.body,
    fontWeight: '700',
  },
  signOutButton: {
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
  signOutLabel: {
    color: colors.tealDeep,
    fontSize: typography.body,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.65,
  },
})
