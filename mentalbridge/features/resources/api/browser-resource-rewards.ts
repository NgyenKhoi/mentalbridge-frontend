import type { components } from '@/contracts/content.generated'
import { browserApiClient } from '@/lib/api/browser-client'

export type ResourceRewardReadModel =
  components['schemas']['ResourceRewardReadModel']
export type ResourceRewardVisibility =
  components['schemas']['ResourceRewardVisibility']

export async function getResourceRewards() {
  const response =
    await browserApiClient.get<ResourceRewardReadModel>('/resources/rewards')
  return response.data
}

export async function setResourceRewardVisibility(
  visibilityState: ResourceRewardVisibility,
) {
  const response = await browserApiClient.put<ResourceRewardReadModel>(
    '/resources/rewards',
    { visibilityState },
  )
  return response.data
}
