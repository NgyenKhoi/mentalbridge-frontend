import {
  create,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from 'axios'

import { createRewardApi } from './reward-api'
import {
  achievements,
  bingo,
  bookmark,
  resourceId,
  rewards,
} from './reward-test-fixtures'

describe('mobile owner reward transport', () => {
  it('uses approved owner endpoints, ETags and no local reward inputs', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    const adapter: AxiosAdapter = async (request) => {
      requests.push(request)
      const url = request.url ?? ''
      const data = url.includes('achievements')
        ? achievements
        : url.includes('bookmarks')
          ? request.method === 'get'
            ? { items: [bookmark] }
            : bookmark
          : url.includes('bingo')
            ? url.includes('plan-sync')
              ? { ...bingo, unavailableActions: [] }
              : bingo
            : rewards
      return {
        config: request,
        data,
        headers:
          url.includes('achievements') || url.includes('bingo')
            ? { etag: '"5"' }
            : {},
        status: 200,
        statusText: 'OK',
      }
    }
    const api = createRewardApi(create({ adapter }))

    await api.getAchievements('Asia/Ho_Chi_Minh')
    await api.setAchievementVisibility('Asia/Ho_Chi_Minh', 'HIDDEN', '"5"')
    await api.getResourceRewards()
    await api.setResourceRewardVisibility('HIDDEN')
    await api.getBookmarks()
    await api.saveBookmark(resourceId)
    await api.deleteBookmark(resourceId)
    await api.getBingo('2026-11-02')
    await api.syncBingo('2026-11-02', 'Asia/Ho_Chi_Minh')
    await api.setBingoSelfConfirmation('2026-11-02', 1, true, '"5"')

    expect(requests.map(({ method, url }) => `${method}:${url}`)).toEqual([
      'get:/api/v1/achievements',
      'put:/api/v1/achievements/preference',
      'get:/api/v1/resources/rewards',
      'put:/api/v1/resources/rewards',
      'get:/api/v1/resources/bookmarks',
      `put:/api/v1/resources/bookmarks/${resourceId}`,
      `delete:/api/v1/resources/bookmarks/${resourceId}`,
      'get:/api/v1/resources/bingo/2026-11-02',
      'put:/api/v1/resources/bingo/2026-11-02/plan-sync',
      'put:/api/v1/resources/bingo/2026-11-02/items/1',
    ])
    expect(requests[1]?.headers.get('If-Match')).toBe('"5"')
    expect(requests[9]?.headers.get('If-Match')).toBe('"5"')
    expect(JSON.parse(String(requests[3]?.data))).toEqual({
      visibilityState: 'HIDDEN',
    })
    expect(JSON.parse(String(requests[8]?.data))).toEqual({
      timeZone: 'Asia/Ho_Chi_Minh',
    })
    expect(JSON.stringify(requests)).not.toMatch(
      /clinical|adherence|scoreRule|threshold|rawJournal|emotionNote/i,
    )
  })

  it('fails closed when a versioned owner response omits its ETag', async () => {
    const adapter: AxiosAdapter = async (request) => ({
      config: request,
      data: achievements,
      headers: {},
      status: 200,
      statusText: 'OK',
    })
    await expect(
      createRewardApi(create({ adapter })).getAchievements('UTC'),
    ).rejects.toMatchObject({ code: 'CONTENT_MALFORMED_RESPONSE' })
  })

  it('rejects fake defaults and client-enriched reward fields', async () => {
    const adapter: AxiosAdapter = async (request) => ({
      config: request,
      data: { ...achievements, fakeDefaultAchievement: true },
      headers: { etag: '"2"' },
      status: 200,
      statusText: 'OK',
    })
    await expect(
      createRewardApi(create({ adapter })).getAchievements('UTC'),
    ).rejects.toBeDefined()
  })
})
