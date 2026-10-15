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
