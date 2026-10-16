import type { components } from '@/contracts/content.generated'
import { ApiError } from '@/lib/api/api-error'
import { browserApiClient } from '@/lib/api/browser-client'

export type AchievementCollection =
  components['schemas']['AchievementCollection']
export type AchievementItem = components['schemas']['AchievementItem']

function requiredEtag(value: unknown) {
  if (typeof value !== 'string' || !/^"(0|[1-9]\d*)"$/.test(value)) {
    throw new ApiError({
      message: 'The achievement preference version is missing.',
      code: 'CONTENT_MALFORMED_RESPONSE',
      status: 502,
    })
  }
  return value
}

export async function getAchievements(timezone: string) {
  const response = await browserApiClient.get<AchievementCollection>(
    `/achievements?timezone=${encodeURIComponent(timezone)}`,
  )
  return {
    collection: response.data,
    etag: requiredEtag(response.headers.etag),
  }
}
