import * as SecureStore from 'expo-secure-store'

import { analysisRequestStore } from './analysis-request-store'
import { entry, running, subject } from './journal-test-fixtures'

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'private',
}))

describe('Journal request correlation persistence', () => {
  beforeEach(() => jest.clearAllMocks())
  it('stores only correlation identifiers, scoped by subject and exact source', async () => {
    const marker = { requestKey: 'a-correlation-key-123', jobId: running.jobId }
    await analysisRequestStore.write(subject, `${entry.id}.1`, marker)
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      `mentalbridge.journal.request.${subject}.${entry.id}.1`,
      JSON.stringify(marker),
      { keychainAccessible: 'private' },
    )
    await analysisRequestStore.read(running.jobId, `${entry.id}.1`)
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith(
      `mentalbridge.journal.request.${running.jobId}.${entry.id}.1`,
      { keychainAccessible: 'private' },
    )
  })
  it('rejects raw Journal/AI/permission fields and corrupt markers', async () => {
    await expect(
      analysisRequestStore.write(subject, 'target', {
        requestKey: 'a-correlation-key-123',
        text: entry.content.text,
      } as never),
    ).rejects.toThrow()
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled()
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue('{invalid}')
    expect(await analysisRequestStore.read(subject, 'target')).toBeNull()
    jest
      .mocked(SecureStore.getItemAsync)
      .mockResolvedValue(
        JSON.stringify({ requestKey: 'a-correlation-key-123', consent: true }),
      )
    expect(await analysisRequestStore.read(subject, 'target')).toBeNull()
  })
})
