import type { components } from '@/contracts/content.generated'
import { ApiError } from '@/lib/api/api-error'
import { browserApiClient } from '@/lib/api/browser-client'

export type ResourceBookmark = components['schemas']['ResourceBookmark']
export type ResourceBingoBoard = components['schemas']['ResourceBingoBoard']

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
  const response = await browserApiClient.get<ResourceBingoBoard>(
    `/resources/bingo/${encodeURIComponent(weekStart)}`,
  )
  return {
    board: response.data,
    etag: requiredEtag(response.headers.etag),
  }
}

export async function setResourceBingoSelfConfirmation(
  weekStart: string,
  position: number,
  selfConfirmed: boolean,
  etag: string,
) {
  const response = await browserApiClient.put<ResourceBingoBoard>(
    `/resources/bingo/${encodeURIComponent(weekStart)}/items/${String(position)}`,
    { selfConfirmed },
    { headers: { 'If-Match': etag } },
  )
  return {
    board: response.data,
    etag: requiredEtag(response.headers.etag),
  }
}
