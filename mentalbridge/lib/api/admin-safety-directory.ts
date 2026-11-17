import type { components } from '@/contracts/content.generated'
import { browserApiClient } from './browser-client'

export type SafetyDirectoryAdminEntry =
  components['schemas']['SafetyDirectoryAdminEntry']
export type SafetyDirectoryEntryWrite =
  components['schemas']['SafetyDirectoryEntryWrite']

const base = '/admin/safety-directory/entries'

export const adminSafetyDirectoryApi = {
  async list() {
    const response =
      await browserApiClient.get<SafetyDirectoryAdminEntry[]>(base)
    return response.data
  },
  async create(body: SafetyDirectoryEntryWrite, idempotencyKey: string) {
    const response = await browserApiClient.post<SafetyDirectoryAdminEntry>(
      base,
      body,
      {
        headers: { 'Idempotency-Key': idempotencyKey },
      },
    )
    return response.data
  },
  async update(
    entry: SafetyDirectoryAdminEntry,
    body: SafetyDirectoryEntryWrite,
  ) {
    const response = await browserApiClient.patch<SafetyDirectoryAdminEntry>(
      `${base}/${encodeURIComponent(entry.directoryEntryId)}?version=${String(entry.recordVersion)}`,
      body,
    )
    return response.data
  },
  async transition(
    entry: SafetyDirectoryAdminEntry,
    action: 'review' | 'deactivate',
  ) {
    const response = await browserApiClient.post<SafetyDirectoryAdminEntry>(
      `${base}/${encodeURIComponent(entry.directoryEntryId)}/${action}?version=${String(entry.recordVersion)}`,
      {},
    )
    return response.data
  },
}
