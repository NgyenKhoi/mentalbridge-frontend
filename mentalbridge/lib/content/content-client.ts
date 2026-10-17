import 'server-only'

import { readContentServerConfig } from '@/lib/config/server'
import {
  parseAdminResourceDetail,
  parseResourceReviewDecision,
  parseContentProblem,
  parseResourceList,
  parsePublicResourceDetail,
  parseResourceSummary,
  parseNotificationPreferences,
  parseNotification,
  parseNotificationBulkReadResult,
  parseNotificationPage,
  parseWellbeingDigestPreview,
  parseResourceProgressItem,
  parseResourceProgressList,
  parseResourceJourney,
  parseResourceBookmark,
  parseResourceBookmarkList,
  parseResourceBingoBoard,
  parseAchievementCollection,
  type AdminResourceDetail,
  type ResourceReviewDecision,
  type ContentProblem,
  type PublicResourceDetail,
  type ResourceListResponse,
  type ResourceSummary,
  type NotificationPreferencePatch,
  type NotificationPreferences,
  type Notification,
  type NotificationBulkReadResult,
  type NotificationPage,
  type WellbeingDigestPreview,
  type ResourceProgressItem,
  type ResourceProgressList,
  type ResourceProgressUpdate,
  type ResourceJourney,
  type ResourceJourneyRequest,
  type ResourceBookmark,
  type ResourceBookmarkList,
  type ResourceBingoBoard,
  type ResourceBingoSelfConfirmationUpdate,
  type AchievementCollection,
  type AchievementPreferenceUpdate,
} from './content-validation'

const MAX_CONTENT_RESPONSE_BYTES = 128 * 1024

type RequestOptions<T> = Readonly<{
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  expectedStatus: number
  accessToken?: string
  correlationId: string
  body?: unknown
  idempotencyKey?: string
  ifMatch?: string
  onSuccessResponse?: (response: Response) => void
  parseSuccess?: (value: unknown) => T | null
  mutation?: boolean
}>

export class ContentServiceError extends Error {
  readonly code: string
  readonly status: number
  readonly correlationId?: string | null
  readonly fieldViolations?: ContentProblem['fieldViolations']

  constructor(problem: ContentProblem, cause?: unknown) {
    super(problem.title, { cause })
    this.name = 'ContentServiceError'
    this.code = problem.code
    this.status = problem.status
    this.correlationId = problem.correlationId
    this.fieldViolations = problem.fieldViolations
  }
}

function localError(
  status: number,
  code: string,
  title: string,
  cause?: unknown,
) {
  return new ContentServiceError(
    { type: 'about:blank', title, status, code },
    cause,
  )
}

async function readJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
  const contentLength = Number(response.headers.get('content-length'))
  if (
    !contentType.includes('json') ||
    (Number.isFinite(contentLength) &&
      contentLength > MAX_CONTENT_RESPONSE_BYTES)
  ) {
    throw localError(
      502,
      'CONTENT_MALFORMED_RESPONSE',
      'Content returned an invalid response.',
    )
  }
  const reader = response.body?.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  if (!reader) {
    throw localError(
      502,
      'CONTENT_MALFORMED_RESPONSE',
      'Content returned an invalid response.',
    )
  }
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_CONTENT_RESPONSE_BYTES) {
      await reader.cancel()
      throw localError(
        502,
        'CONTENT_MALFORMED_RESPONSE',
        'Content returned an oversized response.',
      )
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  const text = new TextDecoder().decode(bytes)
  try {
    return JSON.parse(text) as unknown
  } catch (cause) {
    throw localError(
      502,
      'CONTENT_MALFORMED_RESPONSE',
      'Content returned an invalid response.',
      cause,
    )
  }
}

async function contentRequest<T>(options: RequestOptions<T>): Promise<T> {
  const config = readContentServerConfig()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs)
  try {
    const response = await fetch(
      new URL(options.path.replace(/^\//, ''), config.baseUrl),
      {
        method: options.method,
        cache: 'no-store',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          Accept: 'application/json, application/problem+json',
          ...(options.accessToken
            ? { Authorization: `Bearer ${options.accessToken}` }
            : {}),
          'X-Correlation-Id': options.correlationId,
          ...(options.body === undefined
            ? {}
            : { 'Content-Type': 'application/json' }),
          ...(options.idempotencyKey
            ? { 'Idempotency-Key': options.idempotencyKey }
            : {}),
          ...(options.ifMatch ? { 'If-Match': options.ifMatch } : {}),
        },
        ...(options.body === undefined
          ? {}
          : { body: JSON.stringify(options.body) }),
      },
    )

    if (!response.ok) {
      const problem = parseContentProblem(
        await readJson(response),
        response.status,
      )
      if (!problem) {
        throw localError(
          502,
          'CONTENT_MALFORMED_RESPONSE',
          'Content returned an invalid error response.',
        )
      }
      throw new ContentServiceError(problem)
    }
    if (response.status !== options.expectedStatus) {
      throw localError(
        502,
        'CONTENT_MALFORMED_RESPONSE',
        'Content returned an unexpected status.',
      )
    }
    options.onSuccessResponse?.(response)
    if (response.status === 204) return undefined as T
    const rawJson = await readJson(response)
    const parsed = options.parseSuccess?.(rawJson)
    if (!parsed) {
      throw localError(
        502,
        'CONTENT_MALFORMED_RESPONSE',
        'Content returned an invalid response.',
      )
    }
    return parsed
  } catch (error) {
    if (error instanceof ContentServiceError) throw error
    if (options.mutation) {
      throw localError(
        503,
        'CONTENT_COMMAND_OUTCOME_UNKNOWN',
        'The command outcome could not be confirmed.',
        error,
      )
    }
    if (controller.signal.aborted) {
      throw localError(
        504,
        'CONTENT_TIMEOUT',
        'Content request timed out.',
        error,
      )
    }
    throw localError(
      503,
      'CONTENT_UNAVAILABLE',
      'Content is unavailable.',
      error,
    )
  } finally {
    clearTimeout(timeout)
  }
}

export const contentPublicClient = {
  detail(id: string, correlationId: string, contentVersion?: string) {
    const query = new URLSearchParams({ locale: 'vi-VN' })
    if (contentVersion !== undefined)
      query.set('contentVersion', contentVersion)
    return contentRequest<PublicResourceDetail>({
      method: 'GET',
      path: `/api/v1/resources/${encodeURIComponent(id)}?${query.toString()}`,
      expectedStatus: 200,
      correlationId,
      parseSuccess: parsePublicResourceDetail,
    })
  },
}

export const contentResourceProgressClient = {
  list(accessToken: string, from: string, to: string, correlationId: string) {
    const query = new URLSearchParams({ from, to })
    return contentRequest<ResourceProgressList>({
      method: 'GET',
      path: `/api/v1/resource-progress?${query.toString()}`,
      expectedStatus: 200,
      accessToken,
      correlationId,
      parseSuccess: parseResourceProgressList,
    })
  },
  save(
    accessToken: string,
    resourceId: string,
    localDate: string,
    update: ResourceProgressUpdate,
    correlationId: string,
  ) {
    return contentRequest<ResourceProgressItem>({
      method: 'PUT',
      path: `/api/v1/resource-progress/${encodeURIComponent(resourceId)}/${encodeURIComponent(localDate)}`,
      expectedStatus: 200,
      accessToken,
      correlationId,
      body: update,
      parseSuccess: (value) => {
        const progress = parseResourceProgressItem(value)
        return progress?.resourceId === resourceId &&
          progress.localDate === localDate
          ? progress
          : null
      },
      mutation: true,
    })
  },
}

export const contentResourceJourneyClient = {
  materialize(
    accessToken: string,
    localDate: string,
    input: ResourceJourneyRequest,
    correlationId: string,
  ) {
    return contentRequest<ResourceJourney>({
      method: 'PUT',
      path: `/api/v1/resource-journeys/${encodeURIComponent(localDate)}`,
      expectedStatus: 200,
      accessToken,
      correlationId,
      body: input,
      parseSuccess: (value) => {
        const journey = parseResourceJourney(value)
        return journey?.localDate === localDate ? journey : null
      },
      mutation: true,
    })
  },
}

function bingoResult(board: ResourceBingoBoard, etag: string | undefined) {
  if (!etag || !/^\"(0|[1-9]\d*)\"$/.test(etag)) {
    throw localError(
      502,
      'CONTENT_MALFORMED_RESPONSE',
      'Content returned an invalid Bingo board version.',
    )
  }
  return { board, etag }
}

export const contentResourceEngagementClient = {
  listBookmarks(accessToken: string, correlationId: string) {
    return contentRequest<ResourceBookmarkList>({
      method: 'GET',
      path: '/api/v1/resource-bookmarks',
      expectedStatus: 200,
      accessToken,
      correlationId,
      parseSuccess: parseResourceBookmarkList,
    })
  },
  saveBookmark(accessToken: string, resourceId: string, correlationId: string) {
    return contentRequest<ResourceBookmark>({
      method: 'PUT',
      path: `/api/v1/resource-bookmarks/${encodeURIComponent(resourceId)}`,
      expectedStatus: 200,
      accessToken,
      correlationId,
      body: {},
      parseSuccess: (value) => {
        const bookmark = parseResourceBookmark(value)
        return bookmark?.resourceId === resourceId ? bookmark : null
      },
      mutation: true,
    })
  },
  deleteBookmark(
    accessToken: string,
    resourceId: string,
    correlationId: string,
  ) {
    return contentRequest<void>({
      method: 'DELETE',
      path: `/api/v1/resource-bookmarks/${encodeURIComponent(resourceId)}`,
      expectedStatus: 204,
      accessToken,
      correlationId,
      mutation: true,
    })
  },
  async getBingo(
    accessToken: string,
    weekStart: string,
    correlationId: string,
  ) {
    let etag: string | undefined
    const board = await contentRequest<ResourceBingoBoard>({
      method: 'GET',
      path: `/api/v1/resource-bingo/${encodeURIComponent(weekStart)}`,
      expectedStatus: 200,
      accessToken,
      correlationId,
      parseSuccess: (value) => {
        const parsed = parseResourceBingoBoard(value)
        return parsed?.weekStart === weekStart ? parsed : null
      },
      onSuccessResponse: (response) => {
        etag = response.headers.get('etag') ?? undefined
      },
    })
    return bingoResult(board, etag)
  },
  async setBingoSelfConfirmation(
    accessToken: string,
    weekStart: string,
    position: number,
    update: ResourceBingoSelfConfirmationUpdate,
    etagValue: string,
    correlationId: string,
  ) {
    let etag: string | undefined
    const board = await contentRequest<ResourceBingoBoard>({
      method: 'PUT',
      path: `/api/v1/resource-bingo/${encodeURIComponent(weekStart)}/items/${String(position)}/self-confirmation`,
      expectedStatus: 200,
      accessToken,
      correlationId,
      body: update,
      ifMatch: etagValue,
      parseSuccess: (value) => {
        const parsed = parseResourceBingoBoard(value)
        return parsed?.weekStart === weekStart &&
          parsed.items.some((item) => item.position === position)
          ? parsed
          : null
      },
      mutation: true,
      onSuccessResponse: (response) => {
        etag = response.headers.get('etag') ?? undefined
      },
    })
    return bingoResult(board, etag)
  },
}

function achievementResult(
  collection: AchievementCollection,
  etag: string | undefined,
) {
  if (!etag || !/^"(0|[1-9]\d*)"$/.test(etag)) {
    throw localError(
      502,
      'CONTENT_MALFORMED_RESPONSE',
      'Content returned an invalid achievement preference version.',
    )
  }
  if (etag !== `"${collection.preferenceVersion}"`) {
    throw localError(
      502,
      'CONTENT_MALFORMED_RESPONSE',
      'Content returned mismatched achievement preference versions.',
    )
  }
  return { collection, etag }
}

export const contentAchievementClient = {
  async get(accessToken: string, timezone: string, correlationId: string) {
    let etag: string | undefined
    const query = new URLSearchParams({ timezone })
    const collection = await contentRequest<AchievementCollection>({
      method: 'GET',
      path: `/api/v1/achievements?${query.toString()}`,
      expectedStatus: 200,
      accessToken,
      correlationId,
      parseSuccess: parseAchievementCollection,
      onSuccessResponse: (response) => {
        etag = response.headers.get('etag') ?? undefined
      },
    })
    return achievementResult(collection, etag)
  },
  async setVisibility(
    accessToken: string,
    timezone: string,
    update: AchievementPreferenceUpdate,
    etagValue: string,
    correlationId: string,
  ) {
    let etag: string | undefined
    const query = new URLSearchParams({ timezone })
    const collection = await contentRequest<AchievementCollection>({
      method: 'PUT',
      path: `/api/v1/achievements/preference?${query.toString()}`,
      expectedStatus: 200,
      accessToken,
      correlationId,
      body: update,
      ifMatch: etagValue,
      parseSuccess: parseAchievementCollection,
      mutation: true,
      onSuccessResponse: (response) => {
        etag = response.headers.get('etag') ?? undefined
      },
    })
    return achievementResult(collection, etag)
  },
}

function preferenceResult(
  preferences: NotificationPreferences,
  etag: string | undefined,
) {
  if (!etag || !/^"(0|[1-9]\d*)"$/.test(etag)) {
    throw localError(
      502,
      'CONTENT_MALFORMED_RESPONSE',
      'Content returned an invalid preference version.',
    )
  }
  return { preferences, etag }
}

export const contentPreferenceClient = {
  async get(accessToken: string, correlationId: string) {
    let etag: string | undefined
    const preferences = await contentRequest<NotificationPreferences>({
      method: 'GET',
      path: '/api/v1/notification-preferences',
      expectedStatus: 200,
      accessToken,
      correlationId,
      parseSuccess: parseNotificationPreferences,
      onSuccessResponse: (response) => {
        etag = response.headers.get('etag') ?? undefined
      },
    })
    return preferenceResult(preferences, etag)
  },
  async update(
    accessToken: string,
    patch: NotificationPreferencePatch,
    etagValue: string,
    correlationId: string,
  ) {
    let etag: string | undefined
    const preferences = await contentRequest<NotificationPreferences>({
      method: 'PATCH',
      path: '/api/v1/notification-preferences',
      expectedStatus: 200,
      accessToken,
      correlationId,
      body: patch,
      ifMatch: etagValue,
      parseSuccess: parseNotificationPreferences,
      mutation: true,
      onSuccessResponse: (response) => {
        etag = response.headers.get('etag') ?? undefined
      },
    })
    return preferenceResult(preferences, etag)
  },
}

export const contentWellbeingDigestClient = {
  preview(accessToken: string, correlationId: string) {
    return contentRequest<WellbeingDigestPreview>({
      method: 'GET',
      path: '/api/v1/wellbeing-digest/preview',
      expectedStatus: 200,
      accessToken,
      correlationId,
      parseSuccess: parseWellbeingDigestPreview,
    })
  },
}

export const contentNotificationClient = {
  list(accessToken: string, query: URLSearchParams, correlationId: string) {
    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    return contentRequest<NotificationPage>({
      method: 'GET',
      path: `/api/v1/notifications${suffix}`,
      expectedStatus: 200,
      accessToken,
      correlationId,
      parseSuccess: parseNotificationPage,
    })
  },
  markRead(accessToken: string, id: string, correlationId: string) {
    return contentRequest<Notification>({
      method: 'PATCH',
      path: `/api/v1/notifications/${encodeURIComponent(id)}/read`,
      expectedStatus: 200,
      accessToken,
      correlationId,
      body: {},
      parseSuccess: parseNotification,
      mutation: true,
    })
  },
  markAllRead(accessToken: string, correlationId: string) {
    return contentRequest<NotificationBulkReadResult>({
      method: 'POST',
      path: '/api/v1/notifications/mark-all-read',
      expectedStatus: 200,
      accessToken,
      correlationId,
      body: {},
      parseSuccess: parseNotificationBulkReadResult,
      mutation: true,
    })
  },
  delete(accessToken: string, id: string, correlationId: string) {
    return contentRequest<void>({
      method: 'DELETE',
      path: `/api/v1/notifications/${encodeURIComponent(id)}`,
      expectedStatus: 204,
      accessToken,
      correlationId,
      mutation: true,
    })
  },
}

export const contentAdminClient = {
  list(accessToken: string, query: URLSearchParams, correlationId: string) {
    return contentRequest<ResourceListResponse>({
      method: 'GET',
      path: `/api/v1/resources/admin/list?${query.toString()}`,
      expectedStatus: 200,
      accessToken,
      correlationId,
      parseSuccess: parseResourceList,
    })
  },
  detail(accessToken: string, id: string, correlationId: string) {
    return contentRequest<AdminResourceDetail>({
      method: 'GET',
      path: `/api/v1/resources/admin/${encodeURIComponent(id)}`,
      expectedStatus: 200,
      accessToken,
      correlationId,
      parseSuccess: parseAdminResourceDetail,
    })
  },
  create(
    accessToken: string,
    body: unknown,
    idempotencyKey: string,
    correlationId: string,
  ) {
    return contentRequest<ResourceSummary>({
      method: 'POST',
      path: '/api/v1/resources',
      expectedStatus: 201,
      accessToken,
      correlationId,
      idempotencyKey,
      body,
      parseSuccess: parseResourceSummary,
      mutation: true,
    })
  },
  update(
    accessToken: string,
    id: string,
    version: number,
    body: unknown,
    correlationId: string,
  ) {
    return contentRequest<ResourceSummary>({
      method: 'PATCH',
      path: `/api/v1/resources/${encodeURIComponent(id)}?version=${String(version)}`,
      expectedStatus: 200,
      accessToken,
      correlationId,
      body,
      parseSuccess: parseResourceSummary,
      mutation: true,
    })
  },
  delete(
    accessToken: string,
    id: string,
    version: number,
    correlationId: string,
  ) {
    return contentRequest<void>({
      method: 'DELETE',
      path: `/api/v1/resources/${encodeURIComponent(id)}?version=${String(version)}`,
      expectedStatus: 204,
      accessToken,
      correlationId,
      mutation: true,
    })
  },
  publish(
    accessToken: string,
    id: string,
    version: number,
    correlationId: string,
  ) {
    return contentRequest<ResourceSummary>({
      method: 'POST',
      path: `/api/v1/resources/${encodeURIComponent(id)}/publish?version=${String(version)}`,
      expectedStatus: 200,
      accessToken,
      correlationId,
      body: {},
      parseSuccess: parseResourceSummary,
      mutation: true,
    })
  },
  review(
    accessToken: string,
    id: string,
    version: number,
    body: unknown,
    correlationId: string,
  ) {
    return contentRequest<ResourceReviewDecision>({
      method: 'POST',
      path: `/api/v1/resources/${encodeURIComponent(id)}/review?version=${String(version)}`,
      expectedStatus: 200,
      accessToken,
      correlationId,
      body,
      parseSuccess: parseResourceReviewDecision,
      mutation: true,
    })
  },
  createVersion(
    accessToken: string,
    id: string,
    version: number,
    correlationId: string,
  ) {
    return contentRequest<AdminResourceDetail>({
      method: 'POST',
      path: `/api/v1/resources/${encodeURIComponent(id)}/versions?version=${String(version)}`,
      expectedStatus: 200,
      accessToken,
      correlationId,
      body: {},
      parseSuccess: parseAdminResourceDetail,
      mutation: true,
    })
  },
  archive(
    accessToken: string,
    id: string,
    version: number,
    correlationId: string,
  ) {
    return contentRequest<ResourceSummary>({
      method: 'POST',
      path: `/api/v1/resources/${encodeURIComponent(id)}/archive?version=${String(version)}`,
      expectedStatus: 200,
      accessToken,
      correlationId,
      body: {},
      parseSuccess: parseResourceSummary,
      mutation: true,
    })
  },
}
