import type { ResourceListResponse } from './content-contract'
import { browserApiClient } from '@/lib/api/browser-client'

export async function getReviewedResources() {
  return (
    await browserApiClient.get<ResourceListResponse>('/content/resources')
  ).data
}
