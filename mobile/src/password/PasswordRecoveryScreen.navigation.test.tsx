import { useEffect } from 'react'

import { ExpoRoot, Stack, useLocalSearchParams, usePathname } from 'expo-router'
import { Text } from 'react-native'

import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { getMockContext } from 'expo-router/testing-library'

import { PasswordRecoveryScreen } from './PasswordRecoveryScreen'

const validChallenge = 'password-reset-challenge-that-is-long-enough'
const mockRequestPasswordRecovery = jest.fn()
const mockResetPassword = jest.fn()
let mountCount = 0
let unmountCount = 0

jest.mock('@/auth/session-context', () => ({
  useSession: () => ({
    requestPasswordRecovery: mockRequestPasswordRecovery,
    resetPassword: mockResetPassword,
  }),
}))

function RecoveryRoute() {
  const pathname = usePathname()
  const params = useLocalSearchParams<{ challenge?: string }>()

  useEffect(() => {
    mountCount += 1
    return () => {
      unmountCount += 1
    }
  }, [])

  return (
    <>
      <Text testID="route-state">
        {pathname}|{params.challenge ?? ''}
      </Text>
      <PasswordRecoveryScreen />
    </>
  )
}

function RootLayout() {
  return <Stack screenOptions={{ animation: 'none', headerShown: false }} />
}

const routes = {
  _layout: RootLayout,
  'reset-password': RecoveryRoute,
}
const context = getMockContext(routes)

function renderRecoveryRoute(initialUrl: string) {
  return render(<ExpoRoot context={context} location={initialUrl} />)
}

describe('password recovery route navigation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mountCount = 0
    unmountCount = 0
  })

  it('keeps a regular recovery entry on one mounted route', async () => {
    const navigation = await renderRecoveryRoute('/reset-password')

    expect(await navigation.findByText('Quên mật khẩu?')).toBeOnTheScreen()
    expect(navigation.getByTestId('route-state')).toHaveTextContent(
      '/reset-password|',
    )
    expect(mountCount).toBe(1)
    expect(unmountCount).toBe(0)
  })

  it('strips a deep-link challenge without remounting and retains it for reset', async () => {
    mockResetPassword.mockResolvedValue(undefined)
    const navigation = await renderRecoveryRoute(
      `/reset-password?challenge=${validChallenge}`,
    )

    expect(await navigation.findByText('Tạo mật khẩu mới')).toBeOnTheScreen()
    await waitFor(() => {
      expect(navigation.getByTestId('route-state')).toHaveTextContent(
        '/reset-password|',
      )
    })
    expect(mountCount).toBe(1)
    expect(unmountCount).toBe(0)

    await fireEvent.changeText(
      navigation.getByLabelText('Mật khẩu mới'),
      'new-correct-password',
    )
    await fireEvent.changeText(
      navigation.getByLabelText('Xác nhận mật khẩu mới'),
      'new-correct-password',
    )
    await fireEvent.press(
      navigation.getByRole('button', { name: 'Đặt lại mật khẩu' }),
    )

    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledWith(
        validChallenge,
        'new-correct-password',
      )
    })
  })
})
