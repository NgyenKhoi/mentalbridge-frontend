import {
  AxiosError,
  AxiosHeaders,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from 'axios'

import { createApiClient } from '@/api/api-client'

import { createPushApi } from './push-api'

const installationId = '3f1c8a52-4a5b-4a3e-9d2e-0c6f4f0a1b11'
const body = {
  platform: 'ANDROID',
  provider: 'EXPO',
  providerToken: 'ExponentPushToken[abc]',
  permissionStatus: 'GRANTED',
} as const

function setup(status: number) {
  const requests: InternalAxiosRequestConfig[] = []
  const adapter: AxiosAdapter = async (config) => {
    requests.push(config)
    const response = {
      config,
      data:
        status === 404 ? { title: 'Not found', status, code: 'NOT_FOUND' } : {},
      status,
      statusText: '',
      headers: AxiosHeaders.from({}),
    }
    if (status >= 400) {
      throw new AxiosError('failed', String(status), config, null, response)
    }
    return response
  }
  const client = createApiClient({
    config: { apiBaseUrl: 'https://api.test', apiTimeoutMs: 1000 },
    getBearerToken: async () => 'token',
    adapter,
  })
  return { api: createPushApi(client), requests }
}

describe('push api', () => {
  it('PUTs the registration to the installation path', async () => {
    const { api, requests } = setup(200)
    await api.register(installationId, body)
    expect(requests[0]?.method).toBe('put')
    expect(requests[0]?.url).toBe(`/api/v1/push-devices/${installationId}`)
    expect(JSON.parse(String(requests[0]?.data))).toEqual(body)
  })

  it('rejects an unknown registration field before sending', async () => {
    const { api, requests } = setup(200)
    await expect(
      api.register(installationId, { ...body, extra: 1 } as never),
    ).rejects.toThrow()
    expect(requests).toHaveLength(0)
  })

  it('DELETEs the installation and treats 404 as revoked', async () => {
    const { api, requests } = setup(404)
    await expect(api.revoke(installationId)).resolves.toBeUndefined()
    expect(requests[0]?.method).toBe('delete')
  })

  it('surfaces other revoke failures', async () => {
    const { api } = setup(503)
    await expect(api.revoke(installationId)).rejects.toMatchObject({
      status: 503,
    })
  })
})
