import * as SecureStore from 'expo-secure-store'
import { activationRecoveryStore } from './activation-recovery-store'

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}))

const user = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const marker = {
  planId: '10000000-0000-4000-8000-000000000641',
  version: 3,
  key: '20000000-0000-4000-8000-000000000641',
}

beforeEach(() => jest.clearAllMocks())

it('persists only the activation identity in a subject-scoped secure entry', async () => {
  await activationRecoveryStore.write(user, marker)
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
    `mentalbridge.plan.activation.${user}`,
    JSON.stringify(marker),
    expect.any(Object),
  )
  jest
    .mocked(SecureStore.getItemAsync)
    .mockResolvedValueOnce(JSON.stringify(marker))
    .mockResolvedValueOnce(null)
  expect(await activationRecoveryStore.read(user)).toEqual(marker)
  expect(await activationRecoveryStore.read(other)).toBeNull()
  expect(SecureStore.getItemAsync).toHaveBeenLastCalledWith(
    `mentalbridge.plan.activation.${other}`,
    expect.any(Object),
  )
})

it('fails closed if an existing recovery marker is malformed', async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce('{invalid')
  await expect(activationRecoveryStore.read(user)).rejects.toThrow()
})
