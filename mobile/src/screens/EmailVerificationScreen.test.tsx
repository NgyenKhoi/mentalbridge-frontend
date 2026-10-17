import { render, screen, waitFor } from '@testing-library/react-native'

import { ApiError } from '@/api/api-error'

import { EmailVerificationScreen } from './EmailVerificationScreen'

const challenge = 'verification-challenge-that-is-at-least-32-characters'
const mockReplace = jest.fn()
const mockVerifyEmail = jest.fn()
const mockRequestEmailVerification = jest.fn()

jest.mock('expo-router', () => ({
  router: { replace: (path: string) => mockReplace(path) },
  useLocalSearchParams: () => ({ challenge }),
}))

jest.mock('@/auth/session-context', () => ({
  useSession: () => ({
    requestEmailVerification: mockRequestEmailVerification,
    verifyEmail: mockVerifyEmail,
  }),
}))

describe('email-verification deep link', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('consumes the existing challenge query and removes it from navigation state', async () => {
    mockVerifyEmail.mockResolvedValue(undefined)
    await render(<EmailVerificationScreen />)

    await waitFor(() => expect(mockVerifyEmail).toHaveBeenCalledWith(challenge))
    expect(mockReplace).toHaveBeenCalledWith('./verify-email')
    expect(await screen.findByText('Xác minh thành công')).toBeOnTheScreen()
  })

  it('truthfully reports dependency unavailability without calling the link invalid', async () => {
    mockVerifyEmail.mockRejectedValue(
      new ApiError({ code: 'NETWORK_ERROR', message: 'Offline' }),
    )
    await render(<EmailVerificationScreen />)

    expect(await screen.findByText('Chưa thể xác minh')).toBeOnTheScreen()
    expect(
      screen.getByText(
        'Dịch vụ xác minh tạm thời chưa sẵn sàng. Liên kết chưa được kết luận là không hợp lệ.',
      ),
    ).toBeOnTheScreen()
  })
})
