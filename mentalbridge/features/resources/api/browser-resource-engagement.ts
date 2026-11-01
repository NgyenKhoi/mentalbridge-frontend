import type { components } from '@/contracts/content.generated'
import { ApiError } from '@/lib/api/api-error'
import { browserApiClient } from '@/lib/api/browser-client'
import {
  awardsFromBingo,
  dispatchMamAwardRead,
} from '@/features/mam/mam-celebrations'
import { mamAwardSession } from '@/features/mam/mam-award-session'

export type ResourceBookmark = components['schemas']['ResourceBookmark']
export type ResourceBingoBoard = components['schemas']['ResourceBingoBoard']
export type ResourceBingoPlanSync =
  components['schemas']['ResourceBingoPlanSync']

function requiredEtag(value: unknown) {
  if (typeof value !== 'string' || !/^\"(0|[1-9]\d*)\"$/.test(value)) {
    throw new ApiError({
      message: 'The Bingo board version is missing.',
      code: 'CONTENT_MALFORMED_RESPONSE',
      status: 502,
    })
  }
  return value
}

// MB-774: a successful Bingo read is an owner read for the Mầm director. The
// reward visibility preference covers XP, and web has no Bingo hide control.
// `session` was taken before the request (see mam-award-session.ts).
function reportBingoRead(board: ResourceBingoBoard, session: number) {
  if (typeof window !== 'undefined' && session === mamAwardSession())
    dispatchMamAwardRead(awardsFromBingo(board, Date.now(), true))
}

export async function getResourceBookmarks() {
  const response = await browserApiClient.get<
    components['schemas']['ResourceBookmarkList']
  >('/resources/bookmarks')
  return response.data.items
}

export async function saveResourceBookmark(resourceId: string) {
  const response = await browserApiClient.put<ResourceBookmark>(
    `/resources/bookmarks/${encodeURIComponent(resourceId)}`,
    {},
  )
  return response.data
}

export async function deleteResourceBookmark(resourceId: string) {
  await browserApiClient.delete(
    `/resources/bookmarks/${encodeURIComponent(resourceId)}`,
  )
}

export async function getResourceBingo(weekStart: string) {
  const session = mamAwardSession()
  const response = await browserApiClient.get<ResourceBingoBoard>(
    `/resources/bingo/${encodeURIComponent(weekStart)}`,
  )
  const etag = requiredEtag(response.headers.etag)
  reportBingoRead(response.data, session)
  return { board: response.data, etag }
}

export async function syncResourceBingoWithPlan(
  weekStart: string,
  timeZone: string,
) {
  const session = mamAwardSession()
  const response = await browserApiClient.put<ResourceBingoPlanSync>(
    `/resources/bingo/${encodeURIComponent(weekStart)}/plan-sync`,
    { timeZone },
  )
  const etag = requiredEtag(response.headers.etag)
  reportBingoRead(response.data, session)
  return { board: response.data, etag }
}

export async function setResourceBingoSelfConfirmation(
  weekStart: string,
  position: number,
  selfConfirmed: boolean,
  etag: string,
) {
  const session = mamAwardSession()
  const response = await browserApiClient.put<ResourceBingoBoard>(
    `/resources/bingo/${encodeURIComponent(weekStart)}/items/${String(position)}`,
    { selfConfirmed },
    { headers: { 'If-Match': etag } },
  )
  const next = requiredEtag(response.headers.etag)
  reportBingoRead(response.data, session)
  return { board: response.data, etag: next }
}
