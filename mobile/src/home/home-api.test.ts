import {
  create,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from 'axios'

import { createHomeApi } from './home-api'
import { activePlanHome } from './home-test-fixtures'

describe('Home API', () => {
  it('reads the owner-scoped minimized decision with only the device timezone', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    const adapter: AxiosAdapter = async (request) => {
      requests.push(request)
      return {
        config: request,
        data: activePlanHome(),
        headers: {},
        status: 200,
        statusText: 'OK',
      }
    }

    await expect(
      createHomeApi(create({ adapter })).getNextStep('Asia/Bangkok'),
    ).resolves.toEqual(activePlanHome())

    expect(requests[0]?.method).toBe('get')
    expect(requests[0]?.url).toBe('/api/v1/home-next-step')
    expect(requests[0]?.params).toEqual({ timezone: 'Asia/Bangkok' })
    expect(requests[0]?.data).toBeUndefined()
  })

  it('rejects a response that adds private or fabricated Home data', async () => {
    const adapter: AxiosAdapter = async (request) => ({
      config: request,
      data: { ...activePlanHome(), journalText: 'private' },
      headers: {},
      status: 200,
      statusText: 'OK',
    })

    await expect(
      createHomeApi(create({ adapter })).getNextStep(),
    ).rejects.toBeDefined()
  })
})
