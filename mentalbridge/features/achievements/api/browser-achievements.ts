import type { components } from '@/contracts/content.generated'
import { ApiError } from '@/lib/api/api-error'
import { browserApiClient } from '@/lib/api/browser-client'
import {
  awardsFromAchievements,
  dispatchMamAwardRead,
} from '@/features/mam/mam-celebrations'
import { mamAwardSession } from '@/features/mam/mam-award-session'

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
  const session = mamAwardSession()
  const response = await browserApiClient.get<AchievementCollection>(
    `/achievements?timezone=${encodeURIComponent(timezone)}`,
  )
  const etag = requiredEtag(getHeader(response.headers, 'etag'))
  // MB-774: a successful read is an owner read for the Mầm director.
  // Only inside the dock session that asked (see mam-award-session.ts).
  if (typeof window !== 'undefined' && session === mamAwardSession())
    for (const read of awardsFromAchievements(
      response.data,
      Date.now(),
      response.data.visibilityState === 'VISIBLE',
    ))
      dispatchMamAwardRead(read)
  return { collection: response.data, etag }
}
