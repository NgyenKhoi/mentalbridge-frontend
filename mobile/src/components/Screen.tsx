import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { setSafetyButtonLift } from '@/crisis-support/safety-button-lift'
import { TourScrollContext } from '@/onboarding/tour-target'
import { colors, spacing } from '@/theme/tokens'

export const ScreenBottomInsetContext = createContext(true)
const SAFETY_BUTTON_CLEARANCE = 96

export function Screen({
  children,
  scrollRef,
  contentRef,
  layout = 'form',
  footer,
  bottomActions,
  header,
  backgroundColor,
  clearSafetyButton,
}: Readonly<{
  children: ReactNode
  footer?: ReactNode
  bottomActions?: ReactNode
  header?: ReactNode
  backgroundColor?: string
  scrollRef?: Ref<ScrollView>
  contentRef?: Ref<View>
  layout?: 'form' | 'dashboard' | 'bleed'
  clearSafetyButton?: boolean
}>) {
  const insets = useSafeAreaInsets()
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
          paddingBottom: includeBottomInset ? insets.bottom : 0,
          paddingLeft: insets.left,
        },
        backgroundColor && { backgroundColor },
      ]}
    >
      {header}
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
      </TourScrollContext.Provider>
      {footer ? (
        <View
          onLayout={(event) =>
            setSafetyButtonLift(liftOwner, event.nativeEvent.layout.height)
          }
        >
          {footer}
        </View>
      ) : null}
      {bottomActions}
    </View>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1, minHeight: 0 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxxl,
  },
  readingColumn: { alignSelf: 'center', width: '100%', maxWidth: 560 },
  dashboardContent: {
    justifyContent: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
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
  dashboardColumn: { maxWidth: 560 },
})
