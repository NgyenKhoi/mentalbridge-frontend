import type { AxiosInstance } from 'axios'
import { z } from 'zod'

import { ApiError } from '@/api/api-error'

import {
  achievementCollectionSchema,
  resourceBingoBoardSchema,
  resourceBingoPlanSyncSchema,
  resourceBookmarkListSchema,
  resourceBookmarkSchema,
  resourceRewardSchema,
  type AchievementCollection,
  type ResourceBingoBoard,
  type ResourceBingoPlanSync,
  type ResourceBookmark,
  type ResourceReward,
} from './reward-contract'

const etagSchema = z.string().regex(/^"(0|[1-9]\d*)"$/)
const idSchema = z.uuid()
const dateSchema = z.iso.date()
const timezoneSchema = z.string().min(1).max(64)

function etag(headers: unknown) {
  if (!headers || typeof headers !== 'object') return malformedEtag()
  const candidate = headers as {
    get?: (name: string) => unknown
    etag?: unknown
    ETag?: unknown
  }
  const value =
    typeof candidate.get === 'function'
      ? candidate.get('etag')
      : (candidate.etag ?? candidate.ETag)
  const parsed = etagSchema.safeParse(value)
  return parsed.success ? parsed.data : malformedEtag()
}

function malformedEtag(): never {
  throw new ApiError({
    message: 'Owner version is missing from the response.',
    code: 'CONTENT_MALFORMED_RESPONSE',
    status: 502,
  })
}

export interface RewardApi {
  getAchievements(
    timezone: string,
  ): Promise<{ collection: AchievementCollection; etag: string }>
  setAchievementVisibility(
    timezone: string,
    visibilityState: 'VISIBLE' | 'HIDDEN',
    currentEtag: string,
  ): Promise<{ collection: AchievementCollection; etag: string }>
  getResourceRewards(): Promise<ResourceReward>
  setResourceRewardVisibility(
    visibilityState: 'VISIBLE' | 'HIDDEN',
  ): Promise<ResourceReward>
  getBookmarks(): Promise<ResourceBookmark[]>
  saveBookmark(resourceId: string): Promise<ResourceBookmark>
  deleteBookmark(resourceId: string): Promise<void>
  getBingo(
    weekStart: string,
  ): Promise<{ board: ResourceBingoBoard; etag: string }>
  syncBingo(
    weekStart: string,
    timezone: string,
  ): Promise<{ board: ResourceBingoPlanSync; etag: string }>
  setBingoSelfConfirmation(
    weekStart: string,
    position: number,
    selfConfirmed: boolean,
    currentEtag: string,
  ): Promise<{ board: ResourceBingoBoard; etag: string }>
}

export function createRewardApi(client: AxiosInstance): RewardApi {
  return {
    async getAchievements(timezone) {
      const response = await client.get('/api/v1/achievements', {
        params: { timezone: timezoneSchema.parse(timezone) },
      })
      return {
        collection: achievementCollectionSchema.parse(response.data),
        etag: etag(response.headers),
      }
    },
    async setAchievementVisibility(timezone, visibilityState, currentEtag) {
      const response = await client.put(
        '/api/v1/achievements/preference',
        { visibilityState },
        {
          params: { timezone: timezoneSchema.parse(timezone) },
          headers: { 'If-Match': etagSchema.parse(currentEtag) },
        },
      )
      return {
        collection: achievementCollectionSchema.parse(response.data),
        etag: etag(response.headers),
      }
    },
    async getResourceRewards() {
      return resourceRewardSchema.parse(
        (await client.get('/api/v1/resources/rewards')).data,
      )
    },
    async setResourceRewardVisibility(visibilityState) {
      return resourceRewardSchema.parse(
        (
          await client.put('/api/v1/resources/rewards', {
            visibilityState,
          })
        ).data,
      )
    },
    async getBookmarks() {
      return resourceBookmarkListSchema.parse(
        (await client.get('/api/v1/resources/bookmarks')).data,
      ).items
    },
    async saveBookmark(resourceId) {
      const id = idSchema.parse(resourceId)
      return resourceBookmarkSchema.parse(
        (
          await client.put(
            `/api/v1/resources/bookmarks/${encodeURIComponent(id)}`,
            {},
          )
        ).data,
      )
    },
    async deleteBookmark(resourceId) {
      const id = idSchema.parse(resourceId)
      await client.delete(
        `/api/v1/resources/bookmarks/${encodeURIComponent(id)}`,
      )
    },
    async getBingo(weekStart) {
      const response = await client.get(
        `/api/v1/resources/bingo/${encodeURIComponent(dateSchema.parse(weekStart))}`,
      )
      return {
        board: resourceBingoBoardSchema.parse(response.data),
        etag: etag(response.headers),
      }
    },
    async syncBingo(weekStart, timezone) {
      const response = await client.put(
        `/api/v1/resources/bingo/${encodeURIComponent(dateSchema.parse(weekStart))}/plan-sync`,
        { timeZone: timezoneSchema.parse(timezone) },
      )
      return {
        board: resourceBingoPlanSyncSchema.parse(response.data),
        etag: etag(response.headers),
      }
    },
    async setBingoSelfConfirmation(
      weekStart,
      position,
      selfConfirmed,
      currentEtag,
    ) {
      const response = await client.put(
        `/api/v1/resources/bingo/${encodeURIComponent(dateSchema.parse(weekStart))}/items/${z.number().int().min(1).max(25).parse(position)}`,
        { selfConfirmed },
        { headers: { 'If-Match': etagSchema.parse(currentEtag) } },
      )
      return {
        board: resourceBingoBoardSchema.parse(response.data),
        etag: etag(response.headers),
      }
    },
  }
}
