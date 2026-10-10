import { router } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useSession } from '@/auth/session-context'
import { PrimaryButton } from '@/components/PrimaryButton'
import { Screen } from '@/components/Screen'
import { colors, radii, spacing, typography } from '@/theme/tokens'

export function UserHomeScreen() {
  const { signOut } = useSession()

  return (
    <Screen>
      <Text style={styles.eyebrow}>DÀNH CHO BẠN</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Chào mừng bạn quay lại
      </Text>
      <Text style={styles.description}>
        Nội dung dành cho bạn sẽ xuất hiện tại đây sau khi phiên đăng nhập được
        xác nhận.
      </Text>
      <View style={styles.actions}>
        <PrimaryButton
          label="Mở cộng đồng"
          onPress={() => router.push('./community')}
        />
        <PrimaryButton
          label="Viết nhật ký"
          onPress={() => router.push('./journal')}
        />
        <PrimaryButton
          label="Khám phá tài nguyên"
          onPress={() => router.push('./resources')}
        />
        <PrimaryButton
          label="Ghi nhận cảm xúc"
          onPress={() => router.push('./emotion')}
        />
        <PrimaryButton
          label="Bắt đầu sàng lọc"
          onPress={() => router.push('./assessment')}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('./support-plan')}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.secondaryLabel}>Mở kế hoạch hỗ trợ</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('./profile')}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.secondaryLabel}>Mở hồ sơ cá nhân</Text>
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
  pressed: {
    opacity: 0.65,
  },
})
