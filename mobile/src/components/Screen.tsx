import type { ReactNode, Ref } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { colors, spacing } from '@/theme/tokens'

export function Screen({
  children,
  scrollRef,
  contentRef,
}: Readonly<{
  children: ReactNode
  scrollRef?: Ref<ScrollView>
  contentRef?: Ref<View>
}>) {
  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top', 'right', 'bottom', 'left']}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View ref={contentRef} style={styles.readingColumn}>
          {children}
        </View>
      </ScrollView>
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
})
