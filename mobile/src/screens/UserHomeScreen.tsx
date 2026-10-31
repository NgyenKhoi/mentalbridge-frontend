import { useQuery } from '@tanstack/react-query'
import { router, useFocusEffect, type Href } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { useSession } from '@/auth/session-context'
import { PrimaryButton } from '@/components/PrimaryButton'
import { Screen } from '@/components/Screen'
import type { HomeApi } from '@/home/home-api'
import { homePresentation } from '@/home/home-model'
import { colors, radii, spacing, typography } from '@/theme/tokens'

function deviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined
  } catch {
    return undefined
  }
}

function SecondaryAction({
  label,
  href,
}: Readonly<{ label: string; href: Href }>) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={() => router.push(href)}
      style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
    >
      <Text style={styles.linkLabel}>{label}</Text>
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.arrow}
      >
        →
      </Text>
    </Pressable>
  )
}

export function UserHomeScreen({ api }: Readonly<{ api: HomeApi }>) {
  const { session, signOut } = useSession()
  const [showMore, setShowMore] = useState(false)
  const firstFocus = useRef(true)
  const timeZone = deviceTimeZone()
  const query = useQuery({
    queryKey: ['home-next-step', session?.subject, timeZone],
    queryFn: () => api.getNextStep(timeZone),
    enabled: Boolean(session?.subject),
    refetchOnMount: 'always',
  })
  const refetchHome = query.refetch

  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false
        return
      }
      void refetchHome()
    }, [refetchHome]),
  )

  const presentation = query.data ? homePresentation(query.data) : null

  return (
    <Screen>
      <Text style={styles.pageEyebrow}>MENTALBRIDGE</Text>
      <Text accessibilityRole="header" style={styles.pageTitle}>
        Hôm nay của bạn
      </Text>
      <Text style={styles.pageDescription}>
        Một bước rõ ràng để bạn tiếp tục chăm sóc bản thân theo nhịp của mình.
      </Text>

      <View style={styles.nextStep} testID="home-next-step">
        {query.isPending && session ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator
              accessibilityLabel="Đang tải bước tiếp theo"
              color={colors.tealDeep}
            />
            <Text style={styles.body}>Đang xem bước phù hợp tiếp theo…</Text>
          </View>
        ) : null}

        {!session ? (
          <>
            <Text accessibilityRole="header" style={styles.cardTitle}>
              Chưa thể xác nhận phiên của bạn
            </Text>
            <Text style={styles.body}>
              Hãy đăng nhập lại để xem bước tiếp theo. Không có hoạt động nào
              được thay đổi.
            </Text>
          </>
        ) : null}

        {query.isError && !query.data ? (
          <>
            <Text style={styles.cardEyebrow}>CHƯA TẢI ĐƯỢC</Text>
            <Text accessibilityRole="header" style={styles.cardTitle}>
              Bước tiếp theo tạm thời chưa khả dụng
            </Text>
            <Text accessibilityLiveRegion="polite" style={styles.body}>
              Kế hoạch và các ghi nhận trước đó vẫn được giữ nguyên. Bạn có thể
              thử tải lại hoặc mở tài nguyên miễn phí.
            </Text>
            <View style={styles.buttonGroup}>
              <PrimaryButton
                label="Tải lại bước tiếp theo"
                onPress={() => void refetchHome()}
              />
              <SecondaryAction
                label="Khám phá tài nguyên"
                href="/(user)/resources"
              />
            </View>
          </>
        ) : null}

        {presentation ? (
          <>
            {query.isRefetchError ? (
              <View style={styles.staleNotice}>
                <Text
                  accessibilityLiveRegion="polite"
                  style={styles.supporting}
                >
                  Chưa cập nhật được thay đổi mới nhất. Bước đang hiển thị là
                  lần tải gần nhất; bạn có thể thử lại.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void refetchHome()}
                  style={({ pressed }) => [
                    styles.retryButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.linkLabel}>Thử cập nhật</Text>
                </Pressable>
              </View>
            ) : null}
            <Text style={styles.cardEyebrow}>{presentation.eyebrow}</Text>
            <Text accessibilityRole="header" style={styles.cardTitle}>
              {presentation.title}
            </Text>
            <Text style={styles.body}>{presentation.description}</Text>
            {presentation.progress ? (
              <Text style={styles.progress}>{presentation.progress}</Text>
            ) : null}
            <PrimaryButton
              label={presentation.primaryLabel}
              testID="home-primary-action"
              onPress={() => router.push(presentation.primaryHref)}
            />
            {query.data?.journey.supportGuideId &&
            presentation.primaryHref !== '/(user)/assessment' ? (
              <SecondaryAction
                label="Xem lại gợi ý sau sàng lọc"
                href="/(user)/assessment"
              />
            ) : null}
          </>
        ) : null}
      </View>

      <View style={styles.moreSection}>
        <Pressable
          accessibilityLabel="Các khu vực khác"
          accessibilityRole="button"
          accessibilityState={{ expanded: showMore }}
          onPress={() => setShowMore((current) => !current)}
          style={({ pressed }) => [
            styles.moreToggle,
            pressed && styles.pressed,
          ]}
        >
          <View>
            <Text style={styles.moreTitle}>Các khu vực khác</Text>
            <Text style={styles.supporting}>
              Tin nhắn, lịch hẹn và công cụ tự chăm sóc
            </Text>
          </View>
          <Text style={styles.toggleLabel}>
            {showMore ? 'Thu gọn' : 'Xem thêm'}
          </Text>
        </Pressable>

        {showMore ? (
          <View style={styles.links}>
            <SecondaryAction
              label="Thông báo của tôi"
              href="/(user)/notifications"
            />
            <SecondaryAction
              label="Nhắc nhở của tôi"
              href="/(user)/reminders"
            />
            <SecondaryAction label="Phiên trò chuyện" href="/(user)/messages" />
            <SecondaryAction
              label="Lịch hẹn của tôi"
              href="/(user)/appointments"
            />
            <SecondaryAction
              label="Tìm chuyên gia"
              href="/(user)/specialists"
            />
            <SecondaryAction label="Cộng đồng" href="/(user)/community" />
            <SecondaryAction label="Nhật ký" href="/(user)/journal" />
            <SecondaryAction label="Ghi nhận cảm xúc" href="/(user)/emotion" />
            <SecondaryAction label="Hồ sơ cá nhân" href="/(user)/profile" />
          </View>
        ) : null}
      </View>

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
    </Screen>
  )
}

const styles = StyleSheet.create({
  pageEyebrow: {
    color: colors.teal,
    fontSize: typography.eyebrow,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
  },
  pageTitle: {
    color: colors.ink,
    fontSize: typography.heading,
    fontWeight: '700',
    lineHeight: typography.headingLineHeight,
    marginBottom: spacing.sm,
  },
  pageDescription: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
    marginBottom: spacing.xl,
  },
  nextStep: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.panel,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.xl,
  },
  cardEyebrow: {
    color: colors.teal,
    fontSize: typography.eyebrow,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 31,
  },
  body: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  progress: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.pill,
    color: colors.tealDeep,
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  staleNotice: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.control,
    padding: spacing.md,
  },
  retryButton: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: 44,
    paddingTop: spacing.sm,
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 56,
  },
  buttonGroup: {
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  linkButton: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    width: '100%',
  },
  linkLabel: {
    color: colors.tealDeep,
    flex: 1,
    fontSize: typography.body,
    fontWeight: '700',
  },
  arrow: {
    color: colors.tealDeep,
    fontSize: 20,
    marginLeft: spacing.md,
  },
  moreSection: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    marginTop: spacing.xl,
  },
  moreToggle: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 64,
    paddingVertical: spacing.md,
  },
  moreTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '700',
  },
  supporting: {
    color: colors.inkFaint,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  toggleLabel: {
    color: colors.tealDeep,
    fontSize: 14,
    fontWeight: '700',
    marginLeft: spacing.md,
  },
  links: {
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
  signOutButton: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    marginTop: spacing.xl,
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
