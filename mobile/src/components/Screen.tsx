import type { ReactNode, Ref } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { colors, spacing } from '@/theme/tokens'

const SAFETY_BUTTON_CLEARANCE = 96

export function Screen({
  children,
  scrollRef,
  contentRef,
  layout = 'form',
  footer,
  backgroundColor,
  clearSafetyButton,
}: Readonly<{
  children: ReactNode
  footer?: ReactNode
  backgroundColor?: string
  scrollRef?: Ref<ScrollView>
  contentRef?: Ref<View>
  layout?: 'form' | 'dashboard'
  // Reserves bottom space so the floating "Cần hỗ trợ ngay" button never covers the last row (dashboard does this already).
  clearSafetyButton?: boolean
}>) {
  return (
    <SafeAreaView
      style={[styles.safeArea, backgroundColor && { backgroundColor }]}
      edges={['top', 'right', 'bottom', 'left']}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.content,
          layout === 'dashboard' && styles.dashboardContent,
          clearSafetyButton && styles.clearSafetyButton,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View
          ref={contentRef}
          style={[
            styles.readingColumn,
            layout === 'dashboard' && styles.dashboardColumn,
          ]}
        >
          {children}
        </View>
      </ScrollView>
      {footer}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxxl,
  },
  readingColumn: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 560,
  },
  dashboardContent: {
    justifyContent: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: SAFETY_BUTTON_CLEARANCE,
  },
  clearSafetyButton: { paddingBottom: SAFETY_BUTTON_CLEARANCE },
  dashboardColumn: {
    maxWidth: 760,
  },
})
