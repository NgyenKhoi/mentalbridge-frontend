import {
  createContext,
  useCallback,
  useContext,
  useImperativeHandle,
  useRef,
  type ReactNode,
  type Ref,
} from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { colors, spacing } from '@/theme/tokens'
import { TourScrollContext } from '@/onboarding/tour-target'

export const ScreenBottomInsetContext = createContext(true)

export function Screen({
  children,
  scrollRef,
  contentRef,
  layout = 'form',
  backgroundColor,
  bottomActions,
}: Readonly<{
  children: ReactNode
  backgroundColor?: string
  bottomActions?: ReactNode
  scrollRef?: Ref<ScrollView>
  contentRef?: Ref<View>
  layout?: 'form' | 'dashboard'
}>) {
  const includeBottomInset = useContext(ScreenBottomInsetContext)
  const localScroll = useRef<ScrollView>(null)
  useImperativeHandle(scrollRef, () => localScroll.current!, [])
  const scrollOffset = useRef(0)
  const reveal = useCallback((node: View) => {
    const scroll = localScroll.current
    if (!scroll) return
    node.measureInWindow((_x, y, _width, height) => {
      scroll
        .getNativeScrollRef()
        ?.measureInWindow((_sx, top, _sw, viewportHeight) => {
          if (viewportHeight <= 0 || height <= 0) return
          if (y < top + 20 || y + height > top + viewportHeight - 20) {
            scroll.scrollTo({
              y: Math.max(
                0,
                scrollOffset.current +
                  y -
                  top -
                  Math.max(20, (viewportHeight - height) / 2),
              ),
              animated: false,
            })
          }
        })
    })
  }, [])
  return (
    <SafeAreaView
      style={[styles.safeArea, backgroundColor && { backgroundColor }]}
      edges={
        includeBottomInset
          ? ['top', 'right', 'bottom', 'left']
          : ['top', 'right', 'left']
      }
    >
      <TourScrollContext.Provider value={reveal}>
        <ScrollView
          ref={localScroll}
          onScroll={(event) => {
            scrollOffset.current = event.nativeEvent.contentOffset.y
          }}
          scrollEventThrottle={16}
          style={styles.scroll}
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
      </TourScrollContext.Provider>
      {bottomActions}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: { flex: 1, minHeight: 0 },
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
    paddingTop: spacing.sm,
    paddingBottom: 96,
  },
  dashboardColumn: {
    maxWidth: 560,
  },
})
