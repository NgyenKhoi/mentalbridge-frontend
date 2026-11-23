import { browserApiClient } from '@/lib/api/browser-client'

import type { MamTrajectoryView } from './mam-trajectory-source'

export async function getMamTrajectory(timezone: string, signal?: AbortSignal) {
  return (
    await browserApiClient.get<MamTrajectoryView>('/mam/trajectory', {
      params: { timezone },
      signal,
    })
  ).data
}
