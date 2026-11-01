import { render, screen } from '@testing-library/react-native'
import type * as MockReactModule from 'react'
import type * as MockReactNativeModule from 'react-native'

import { useSession } from '@/auth/session-context'

import { RootNavigator } from './_layout'

type MockChildren = Readonly<{ children?: MockReactModule.ReactNode }>

jest.mock('@/auth/session-context', () => ({
  useSession: jest.fn(),
}))

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof MockReactModule>('react')
  const { View } =
    jest.requireActual<typeof MockReactNativeModule>('react-native')
  const Stack = Object.assign(
    ({ children }: MockChildren) =>
      React.createElement(View, { testID: 'route-stack' }, children),
    {
      Protected: ({ children }: MockChildren) => children,
      Screen: () => null,
    },
  )
  return { Stack }
})

const mockUseSession = jest.mocked(useSession)
const noOp = jest.fn().mockResolvedValue(undefined)

function sessionValue(
  status: 'restoring' | 'authenticated' | 'unauthenticated' | 'unavailable',
) {
  return {
    session: null,
    status,
    notice: null,
    signIn: noOp,
    signOut: noOp,
    retryRestore: noOp,
    registerUser: noOp,
    verifyEmail: noOp,
    requestEmailVerification: noOp,
    requestPasswordRecovery: noOp,
    resetPassword: noOp,
    changePassword: noOp,
  }
}

beforeEach(() => jest.clearAllMocks())

it.each([
  ['restoring', 'Đang kiểm tra phiên đăng nhập'],
  ['unavailable', 'Chưa thể xác minh phiên'],
] as const)(
  'keeps crisis support available while the session is %s',
  async (status, heading) => {
    mockUseSession.mockReturnValue(sessionValue(status))
    await render(<RootNavigator />)

    expect(screen.getByRole('header', { name: heading })).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Mở hỗ trợ khẩn cấp' }),
    ).toBeTruthy()
  },
)

it.each(['unauthenticated', 'authenticated'] as const)(
  'keeps crisis support above the %s route stack',
  async (status) => {
    mockUseSession.mockReturnValue(sessionValue(status))
    await render(<RootNavigator />)

    expect(screen.getByTestId('route-stack')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Mở hỗ trợ khẩn cấp' }),
    ).toBeTruthy()
  },
)
