import mockSafeAreaContext from 'react-native-safe-area-context/jest/mock'

process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.test.mentalbridge'
process.env.EXPO_PUBLIC_API_TIMEOUT_MS = '5000'

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => jest.fn()),
  },
}))

jest.mock('react-native-safe-area-context', () => mockSafeAreaContext)

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => '11111111-1111-4111-8111-111111111111'),
}))

// Jest has no native WebRTC/audio bridge. Screen tests keep the adapter closed;
// VideoMedia.test.tsx supplies explicit SDK behavior mocks. Neither is a native
// execution claim; CNG/build/runtime checks remain separate.
jest.mock('@livekit/react-native', () => ({}))
jest.mock('@livekit/react-native-webrtc', () => ({}))

// Jest has no native notification module; push tests override these per case.
jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 6 },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  getPermissionsAsync: jest.fn(async () => ({
    status: 'undetermined',
    granted: false,
    canAskAgain: true,
  })),
  requestPermissionsAsync: jest.fn(async () => ({
    status: 'denied',
    granted: false,
    canAskAgain: false,
  })),
  getExpoPushTokenAsync: jest.fn(async () => ({
    type: 'expo',
    data: 'ExponentPushToken[test]',
  })),
  addPushTokenListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({
    remove: jest.fn(),
  })),
  getLastNotificationResponse: jest.fn(() => null),
  clearLastNotificationResponse: jest.fn(),
}))

// expo-font cannot resolve expo-asset under jest (nested install); icons render as an empty Text keyed by glyph name.
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => {
  const { createElement } = jest.requireActual('react')
  const { Text } = jest.requireActual('react-native')
  return {
    __esModule: true,
    default: ({ name, ...props }: { name: string }) =>
      createElement(Text, { ...props, testID: `icon-${name}` }),
  }
})
