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

function getHeader(headers: unknown, name: string): string | undefined {
  if (!headers || typeof headers !== 'object') return undefined
  if (
    'get' in headers &&
    typeof (headers as { get: (k: string) => unknown }).get === 'function'
  ) {
    const val = (headers as { get: (k: string) => unknown }).get(name)
    if (typeof val === 'string') return val
  }
  const rec = headers as Record<string, unknown>
  const direct = rec[name] ?? rec[name.toLowerCase()] ?? rec[name.toUpperCase()]
  return typeof direct === 'string' ? direct : undefined
}

export async function getAchievements(timezone: string) {
  const response = await browserApiClient.get<AchievementCollection>(
    `/achievements?timezone=${encodeURIComponent(timezone)}`,
  )
  return {
    collection: response.data,
    etag: requiredEtag(getHeader(response.headers, 'etag')),
  }
}
