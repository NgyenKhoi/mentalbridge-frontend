import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { router, usePathname } from 'expo-router'
import {
  BackHandler,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSession } from '@/auth/session-context'
import { GUIDE_STEPS, type GuideRole } from './guide-steps'
import { hasSeenGuide, rememberGuide } from './guide-storage'
import { TourOverlay } from './tour-overlay'
import {
  TourTargetsProvider,
  findTourTarget,
  measureTourTarget,
  useTourTargets,
} from './tour-target'
import type { TourRect } from './tour-layout'

const ReplayContext = createContext<(() => void) | null>(null)

export function OnboardingGuideProvider({ children }: { children: ReactNode }) {
  const { session, status } = useSession()
  return (
    <TourTargetsProvider>
      {status !== 'authenticated' || !session ? (
        children
      ) : (
        <AccountGuide
          key={`${session.role}:${session.subject}`}
          subject={session.subject}
          role={session.role}
        >
          {children}
        </AccountGuide>
      )}
    </TourTargetsProvider>
  )
}

export function GuideReplayButton() {
  const replay = useContext(ReplayContext)
  if (!replay) return null
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Xem lại hướng dẫn"
      onPress={replay}
      style={({ pressed }) => ({
        backgroundColor: '#EDF5F0',
        borderRadius: 16,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginVertical: 12,
        minHeight: 72,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: '#D6E8DE',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          accessible={false}
          style={{ color: '#1F4D45', fontSize: 20, fontWeight: '700' }}
        >
          ?
        </Text>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: '#1F4D45', fontWeight: '700', fontSize: 14 }}>
          Xem lại hướng dẫn
        </Text>
        <Text style={{ color: '#52604F', fontSize: 12, lineHeight: 18 }}>
          Làm quen với các tính năng trong app
        </Text>
      </View>
      <Text accessible={false} style={{ color: '#1F4D45', fontSize: 25 }}>
        ›
      </Text>
    </Pressable>
  )
}

function AccountGuide({
  children,
  subject,
  role,
}: {
  children: ReactNode
  subject: string
  role: GuideRole
}) {
  const pathname = usePathname()
  const registry = useTourTargets()
  const root = useRef<View>(null)
  const insets = useSafeAreaInsets()
  const window = useWindowDimensions()
  const [size, setSize] = useState({
    width: window.width,
    height: window.height,
  })
  const [unseen, setUnseen] = useState(false)
  const [active, setActive] = useState(false)
  const dismissed = useRef(false)
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<TourRect | null>(null)
  const [override, setOverride] = useState<{
    title?: string | undefined
    description?: string | undefined
  }>({})
  const [unavailable, setUnavailable] = useState(false)
  const [retry, setRetry] = useState(0)
  const [measuredFor, setMeasuredFor] = useState('')
  const measurementKey = `${index}:${pathname}:${window.width}:${window.height}:${window.fontScale}:${retry}`
  const steps = GUIDE_STEPS[role]
  const step = steps[index] ?? steps[0]
  const home = role === 'USER' ? '/user' : '/specialist'
  const visible = active || (unseen && pathname === home)
  useEffect(() => {
    let current = true
    void hasSeenGuide(subject, role).then((seen) => {
      if (current && !dismissed.current) setUnseen(!seen)
    })
    return () => {
      current = false
    }
  }, [subject, role])
  function finish(outcome: 'completed' | 'skipped') {
    dismissed.current = true
    setActive(false)
    setUnseen(false)
    setRect(null)
    void rememberGuide(subject, role, outcome)
  }
  function go(next: number) {
    const target = steps[next]
    if (!target) return
    setRect(null)
    setOverride({})
    setUnavailable(false)
    setIndex(next)
    setActive(true)
    if (pathname !== target.route) router.replace(target.href)
  }
  useEffect(() => {
    if (!visible) return
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        finish('skipped')
        return true
      },
    )
    return () => subscription.remove()
  })
  useEffect(() => {
    if (!visible) return
    let current = true
    let timer: ReturnType<typeof setTimeout>
    const started = Date.now()
    const measure = async () => {
      let located = false
      const anchor =
        pathname === step.route
          ? findTourTarget(registry, step.target, pathname)
          : undefined
      const node = anchor?.node.current
      if (node && root.current) {
        anchor.reveal?.(node)
        const [target, origin] = await Promise.all([
          measureTourTarget(node),
          measureTourTarget(root.current),
        ])
        if (!current) return
        if (target && origin) {
          const next = {
            ...target,
            x: target.x - origin.x,
            y: target.y - origin.y,
          }
          if (
            next.y >= 0 &&
            next.y + next.height <= origin.height + 1 &&
            next.x >= 0 &&
            next.x + next.width <= origin.width + 1
          ) {
            setRect((previous) =>
              previous &&
              Object.keys(next).every(
                (key) =>
                  Math.abs(
                    previous[key as keyof TourRect] -
                      next[key as keyof TourRect],
                  ) < 1,
              )
                ? previous
                : next,
            )
            setOverride((previous) =>
              previous.title === anchor.title &&
              previous.description === anchor.description
                ? previous
                : { title: anchor.title, description: anchor.description },
            )
            located = true
          } else setRect(null)
        } else setRect(null)
      } else setRect(null)
      if (current) {
        setMeasuredFor(measurementKey)
        setUnavailable(!located && Date.now() - started > 4000)
        timer = setTimeout(() => void measure(), 250)
      }
    }
    void measure()
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [
    visible,
    pathname,
    step,
    registry,
    window.width,
    window.height,
    window.fontScale,
    retry,
    measurementKey,
  ])
  return (
    <ReplayContext.Provider value={() => go(0)}>
      <View
        ref={root}
        collapsable={false}
        style={{ flex: 1 }}
        onLayout={(event) => setSize(event.nativeEvent.layout)}
      >
        <View
          style={{ flex: 1 }}
          pointerEvents={visible ? 'none' : 'auto'}
          accessibilityElementsHidden={visible}
          importantForAccessibility={visible ? 'no-hide-descendants' : 'auto'}
        >
          {children}
        </View>
        {visible && (
          <TourOverlay
            step={{
              ...step,
              ...(override.title ? { title: override.title } : {}),
              ...(override.description
                ? { description: override.description }
                : {}),
            }}
            index={index}
            count={steps.length}
            rect={measuredFor === measurementKey ? rect : null}
            viewport={{ ...size, top: insets.top, bottom: insets.bottom }}
            unavailable={measuredFor === measurementKey && unavailable}
            onBack={() => go(index - 1)}
            onNext={() =>
              index === steps.length - 1 ? finish('completed') : go(index + 1)
            }
            onSkip={() => finish('skipped')}
            onRetry={() => setRetry((value) => value + 1)}
          />
        )}
      </View>
    </ReplayContext.Provider>
  )
}
