import { browserApiClient } from '@/lib/api/browser-client'

import type { LookBack } from './look-back-model'

/** Without `window` the BFF picks the default view (running chặng, else the newest closed one, else the last 14 days). */
export async function getLookBack(
  timezone: string,
  signal?: AbortSignal,
  window?: Readonly<{ from: string; to: string }>,
) {
  return (
    await browserApiClient.get<LookBack>('/look-back', {
      params: { timezone, ...window },
      signal,
    })
  ).data
}
