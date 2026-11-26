import { DomWebView, type DomWebViewRef } from '@expo/dom-webview'
import Constants from 'expo-constants'
import * as Linking from 'expo-linking'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { PrimaryButton } from '@/components/PrimaryButton'
import { CrisisSupportWidget } from '@/crisis-support/CrisisSupportWidget'
import { CRISIS_SUPPORT_CONTENT } from '@/crisis-support/crisis-support-content'
import { colors, spacing } from '@/theme/tokens'

import { installLandingMenu } from './landing-menu'

const nativeLinks = {
  '/login': '/sign-in',
  '/register': '/register',
  '/assessment/anonymous': '/assessment/anonymous',
  '/assessments': '/assessment/anonymous',
  '/community': '/sign-in',
  '/journal': '/sign-in',
  '/specialists': '/sign-in',
  '/resources': '/sign-in',
} as const

const webPages = new Set(['/', '/privacy', '/terms', '/safety-directory'])
const dialLinks = CRISIS_SUPPORT_CONTENT.contacts.map(
  ({ phone }) => `tel:${phone}`,
)
const ready = 'mentalbridge:landing:ready'

function getLandingUrl() {
  const configured = process.env.EXPO_PUBLIC_LANDING_URL
  const metroHost = Constants.expoConfig?.hostUri
  try {
    const url = configured
      ? new URL(configured)
      : __DEV__ && metroHost
        ? new URL(`http://${metroHost}/mentalbridge-landing`)
        : new URL('https://staging.mentalbridge.online/')
    if (url.username || url.password) return null
    if (url.protocol === 'https:' || (__DEV__ && url.protocol === 'http:'))
      return url
  } catch {
    return null
  }
  return null
}

function pageScript(landing: URL) {
  return `
    (function () {
      if (location.origin !== ${JSON.stringify(landing.origin)}) return;
      const webLanding = ${JSON.stringify(landing.href)};
      const landingPath = new URL(webLanding).pathname;
      if (!window.__mentalBridgeLandingNavigation) {
        window.__mentalBridgeLandingNavigation = true;
        const nativePaths = ${JSON.stringify(Object.keys(nativeLinks))};
        const dialLinks = ${JSON.stringify(dialLinks)};
        document.addEventListener('click', function (event) {
          const link = event.target.closest?.('a[href]');
          if (!link) return;
          const linkUrl = new URL(link.href, location.href);
          if (dialLinks.includes(linkUrl.href)) {
            event.preventDefault();
            window.ReactNativeWebView.postMessage(linkUrl.href);
            return;
          }
          if (linkUrl.origin !== location.origin) return;
          if (nativePaths.includes(linkUrl.pathname)) {
            link.closest('#mb-landing-menu')?.close();
            event.preventDefault();
            event.stopImmediatePropagation();
            window.ReactNativeWebView.postMessage(linkUrl.pathname);
          } else if (linkUrl.pathname === '/' && link.getAttribute('href')?.startsWith('/')) {
            event.preventDefault();
            event.stopImmediatePropagation();
            if (location.pathname === landingPath && linkUrl.hash) {
              location.hash = linkUrl.hash;
            } else {
              location.href = webLanding + linkUrl.hash;
            }
          }
        }, true);
      }
      if (document.querySelector('.marketing-page')) {
        ${installLandingMenu}
        window.ReactNativeWebView.postMessage(${JSON.stringify(ready)});
      }
    })();
    true;
  `
}

const landing = getLandingUrl()
const injectedScript = landing ? pageScript(landing) : ''

export function WelcomeScreen() {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>(
    landing ? 'loading' : 'error',
  )
  const [attempt, setAttempt] = useState(0)
  const webView = useRef<DomWebViewRef>(null)
  const menuOpen = useRef(false)

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          if (!menuOpen.current || !webView.current) return false
          webView.current.injectJavaScript(
            "document.getElementById('mb-landing-menu')?.close(); true;",
          )
          menuOpen.current = false
          return true
        },
      )
      return () => {
        menuOpen.current = false
        subscription.remove()
      }
    }, []),
  )

  useEffect(() => {
    if (state !== 'loading') return
    const timeout = setTimeout(() => setState('error'), 25_000)
    return () => clearTimeout(timeout)
  }, [state, attempt])

  const onMessage = (event: { nativeEvent: { data: string; url: string } }) => {
    if (!landing) return
    let page: URL
    try {
      page = new URL(event.nativeEvent.url)
    } catch {
      return
    }
    if (
      page.origin !== landing.origin ||
      !(page.pathname === landing.pathname || webPages.has(page.pathname))
    )
      return
    const message = event.nativeEvent.data
    if (message === ready && page.pathname === landing.pathname) {
      menuOpen.current = false
      setState('ready')
    } else if (
      page.pathname === landing.pathname &&
      message === 'mentalbridge:menu:opened'
    ) {
      menuOpen.current = true
    } else if (message === 'mentalbridge:menu:closed') {
      menuOpen.current = false
    } else if (Object.hasOwn(nativeLinks, message)) {
      router.push(nativeLinks[message as keyof typeof nativeLinks])
    } else if (dialLinks.some((link) => link === message)) {
      void Linking.openURL(message).catch(() =>
        Alert.alert(
          'Chưa thể mở ứng dụng gọi điện',
          'Bạn có thể nhập số đang hiển thị vào ứng dụng gọi điện.',
        ),
      )
    }
  }

  return (
    <SafeAreaView
      edges={['top', 'left', 'right', 'bottom']}
      style={styles.screen}
    >
      {landing && state !== 'error' && Platform.OS !== 'web' && (
        <DomWebView
          key={attempt}
          ref={webView}
          testID="landing-webview"
          source={{ uri: landing.href }}
          injectedJavaScript={injectedScript}
          onMessage={onMessage}
          useExpoModulesBridge={false}
          mediaPlaybackRequiresUserAction={false}
          onRenderProcessGone={() => setState('error')}
          onContentProcessDidTerminate={() => setState('error')}
          style={styles.screen}
        />
      )}
      {state === 'loading' && Platform.OS !== 'web' && (
        <View pointerEvents="none" style={styles.loading}>
          <ActivityIndicator
            color={colors.teal}
            accessibilityLabel="Đang mở MentalBridge"
          />
        </View>
      )}
      {(state === 'error' || Platform.OS === 'web') && (
        <>
          <View style={styles.fallback}>
            <Text accessibilityRole="header" style={styles.title}>
              MentalBridge
            </Text>
            <Text style={styles.note}>Chưa mở được trang giới thiệu.</Text>
            {landing && Platform.OS !== 'web' && (
              <PrimaryButton
                label="Tải lại trang giới thiệu"
                onPress={() => {
                  setAttempt((current) => current + 1)
                  setState('loading')
                }}
              />
            )}
            <PrimaryButton
              label="Đăng nhập"
              onPress={() => router.push('/sign-in')}
            />
            <PrimaryButton
              label="Bắt đầu sàng lọc miễn phí"
              onPress={() => router.push('/assessment/anonymous')}
            />
          </View>
          <CrisisSupportWidget />
        </>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  loading: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  fallback: {
    flex: 1,
    justifyContent: 'center',
    alignSelf: 'center',
    maxWidth: 440,
    width: '100%',
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: { color: colors.ink, fontSize: 32, fontFamily: 'serif' },
  note: { color: colors.inkSoft, fontSize: 15, lineHeight: 22 },
})
