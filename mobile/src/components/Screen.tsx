import { useEffect, useState, type ReactNode, type Ref } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { setSafetyButtonLift } from '@/crisis-support/safety-button-lift'
import { colors, spacing } from '@/theme/tokens'

const SAFETY_BUTTON_CLEARANCE = 96

export function Screen({
  children,
  scrollRef,
  contentRef,
  layout = 'form',
  footer,
  header,
  backgroundColor,
  clearSafetyButton,
}: Readonly<{
  children: ReactNode
  footer?: ReactNode
  // Stays fixed above the scrolling content.
  header?: ReactNode
  backgroundColor?: string
  scrollRef?: Ref<ScrollView>
  contentRef?: Ref<View>
  // `bleed`: no side padding, for edge-to-edge content that insets its own blocks.
  layout?: 'form' | 'dashboard' | 'bleed'
  // Reserves bottom space so the floating "Cần hỗ trợ ngay" button never covers the last row (dashboard does this already).
  clearSafetyButton?: boolean
}>) {
  // Context insets pad the first frame of a fresh mount; native SafeAreaView reports them a frame or two late.
  const insets = useSafeAreaInsets()
  const hasFooter = Boolean(footer)
  const [liftOwner] = useState(() => ({}))
  useEffect(() => {
    if (hasFooter) return () => setSafetyButtonLift(liftOwner, null)
  }, [hasFooter, liftOwner])
  return (
    <View
      style={[
        styles.safeArea,
        {
          paddingTop: insets.top,
          paddingRight: insets.right,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
        },
        backgroundColor && { backgroundColor },
      ]}
    >
      {header}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.content,
          layout === 'dashboard' && styles.dashboardContent,
          layout === 'bleed' && styles.bleedContent,
          clearSafetyButton && styles.clearSafetyButton,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View
          ref={contentRef}
          style={[
            styles.readingColumn,
            layout === 'dashboard' && styles.dashboardColumn,
            layout === 'bleed' && styles.bleedColumn,
          ]}
        >
          {children}
        </View>
      </ScrollView>
      {footer ? (
        <View
          onLayout={(event) =>
            setSafetyButtonLift(liftOwner, event.nativeEvent.layout.height)
          }
        >
          {footer}
        </View>
      ) : null}
    </View>
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
  bleedContent: {
    justifyContent: 'flex-start',
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: SAFETY_BUTTON_CLEARANCE,
  },
  bleedColumn: { maxWidth: 760 },
  clearSafetyButton: { paddingBottom: SAFETY_BUTTON_CLEARANCE },
  dashboardColumn: {
    maxWidth: 760,
  },
})
