import { act, render, waitFor } from '@testing-library/react-native'

import { RewardCollectionRoute } from './RewardCollectionRoute'

let mockFocus: (() => void) | undefined
let mockMountedFocus = false
const mockRewardScreen = jest.fn((_props: unknown) => null)

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useFocusEffect: (callback: () => void) => {
    mockFocus = callback
    if (!mockMountedFocus) {
      mockMountedFocus = true
      callback()
    }
  },
}))
jest.mock('@/auth/session-context', () => ({
  useSession: () => ({
    status: 'authenticated',
    session: {
      subject: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      role: 'USER',
    },
  }),
}))
jest.mock('@/config/runtime-config-context', () => ({
  useRuntimeConfig: () => ({
    apiBaseUrl: 'https://edge.invalid',
    apiTimeoutMs: 5000,
  }),
}))
jest.mock('@/api/api-client', () => ({ createApiClient: () => ({}) }))
jest.mock('@/resources/resource-api', () => ({
  createResourceApi: () => ({ getResource: jest.fn() }),
}))
jest.mock('@/support-plan/support-plan-action-api', () => ({
  createSupportPlanActionApi: () => ({ getCurrent: jest.fn() }),
}))
jest.mock('./reward-api', () => ({ createRewardApi: () => ({}) }))
jest.mock('./RewardCollectionScreen', () => ({
  RewardCollectionScreen: (props: unknown) => mockRewardScreen(props),
}))

it('asks the owner screen to refresh whenever the route is focused again', async () => {
  await render(<RewardCollectionRoute />)
  expect(mockRewardScreen).toHaveBeenLastCalledWith(
    expect.objectContaining({ refreshToken: 0 }),
  )

  await act(async () => mockFocus?.())
  await waitFor(() =>
    expect(mockRewardScreen).toHaveBeenLastCalledWith(
      expect.objectContaining({ refreshToken: 1 }),
    ),
  )
})
