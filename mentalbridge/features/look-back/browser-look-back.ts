import { browserApiClient } from '@/lib/api/browser-client'

import type { LookBack } from './look-back-model'

export async function getLookBack(timezone: string, signal?: AbortSignal) {
  return (
    await browserApiClient.get<LookBack>('/look-back', {
      params: { timezone },
      signal,
    })
  ).data
}
