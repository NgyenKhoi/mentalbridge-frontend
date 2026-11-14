import type { ReactNode, Ref } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { colors, spacing } from '@/theme/tokens'

export function Screen({
  children,
  scrollRef,
  contentRef,
  layout = 'form',
  footer,
  backgroundColor,
}: Readonly<{
  children: ReactNode
  footer?: ReactNode
  backgroundColor?: string
  scrollRef?: Ref<ScrollView>
  contentRef?: Ref<View>
  layout?: 'form' | 'dashboard'
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
    paddingBottom: 96,
  },
  dashboardColumn: {
    maxWidth: 760,
  },
})
