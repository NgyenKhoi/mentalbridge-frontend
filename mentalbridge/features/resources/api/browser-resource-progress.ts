import type { components } from '@/contracts/content.generated'
import { browserApiClient } from '@/lib/api/browser-client'

export type ResourceProgressItem = components['schemas']['ResourceProgressItem']
export type ResourceProgressUpdate =
  components['schemas']['ResourceProgressUpdate']

export async function getResourceProgress(from: string, to: string) {
  const response = await browserApiClient.get<
    components['schemas']['ResourceProgressList']
  >('/resources/progress', { params: { from, to } })
  return response.data.items
}

export async function saveResourceProgress(
  resourceId: string,
  localDate: string,
  update: ResourceProgressUpdate,
) {
  const response = await browserApiClient.put<ResourceProgressItem>(
    `/resources/progress/${encodeURIComponent(resourceId)}/${encodeURIComponent(localDate)}`,
    update,
  )
  return response.data
}
