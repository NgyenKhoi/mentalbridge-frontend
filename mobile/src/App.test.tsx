import { fireEvent, render, screen } from '@testing-library/react-native'
import type * as ReactNative from 'react-native'

import { AppProviders } from '@/providers/AppProviders'
import { WelcomeScreen } from '@/screens/WelcomeScreen'

const mockPush = jest.fn()

jest.mock('expo-router', () => ({
  useFocusEffect: jest.fn(),
  router: {
    back: jest.fn(),
    push: (path: string) => mockPush(path),
  },
}))

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { hostUri: '192.0.2.10:8089' } },
}))

jest.mock('@expo/dom-webview', () => ({
  DomWebView: jest.requireActual<typeof ReactNative>('react-native').View,
}))

describe('mobile startup shell', () => {
  beforeEach(() => {
    mockPush.mockClear()
  })

  it('loads the original landing and opens native routes only on valid web messages', async () => {
    await render(
      <AppProviders
        runtimeConfig={{
          apiBaseUrl: 'https://api.test.mentalbridge',
          apiTimeoutMs: 5_000,
        }}
      >
        <WelcomeScreen />
      </AppProviders>,
    )

    const webView = screen.getByTestId('landing-webview')
    const url = 'http://192.0.2.10:8089/mentalbridge-landing'
    expect(webView.props.source).toEqual({ uri: url })
    expect(webView.props.useExpoModulesBridge).toBe(false)

    await fireEvent(webView, 'message', {
      nativeEvent: { url, data: 'mentalbridge:landing:ready' },
    })
    expect(screen.queryByLabelText('Đang mở MentalBridge')).toBeNull()
    await fireEvent(webView, 'message', {
      nativeEvent: { url: 'https://other.test/', data: '/login' },
    })
    await fireEvent(webView, 'message', {
      nativeEvent: { url, data: '/admin' },
    })
    expect(mockPush).not.toHaveBeenCalled()

    await fireEvent(webView, 'message', {
      nativeEvent: { url, data: '/login' },
    })
    expect(mockPush).toHaveBeenCalledWith('/sign-in')
    await fireEvent(webView, 'message', {
      nativeEvent: { url, data: '/assessment/anonymous' },
    })
    expect(mockPush).toHaveBeenCalledWith('/assessment/anonymous')

    await fireEvent(webView, 'renderProcessGone')
    expect(
      screen.getByRole('button', { name: 'Tải lại trang giới thiệu' }),
    ).toBeOnTheScreen()
    await fireEvent.press(
      screen.getByRole('button', { name: 'Tải lại trang giới thiệu' }),
    )
    expect(screen.getByTestId('landing-webview')).toBeOnTheScreen()
  }, 30_000)
})
