import {
  create,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from 'axios'

import { createCareProfileApi } from './profile-api'

const profile = {
  accountId: '11111111-1111-4111-8111-111111111111',
  displayName: 'Nguyễn An',
  dateOfBirth: '1998-05-12',
  gender: 'female',
  locale: 'vi-VN',
  timezone: 'Asia/Ho_Chi_Minh',
  reminderEnabled: false,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  version: 3,
}

describe('Care mobile profile API contract', () => {
  it('uses the owner-scoped profile path and sends If-Match only for replacement', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    const adapter: AxiosAdapter = async (request) => {
      requests.push(request)
      return {
        config: request,
        data: profile,
        headers: { etag: '"3"' },
        status: request.method === 'put' ? 200 : 200,
        statusText: 'OK',
      }
    }
    const api = createCareProfileApi(create({ adapter }))

    await api.getProfile()
    await api.putProfile(
      {
        displayName: 'Nguyễn An',
        dateOfBirth: '1998-05-12',
        gender: 'female',
      },
      2,
    )
    await api.putProfile(
      { displayName: 'Nguyễn An', dateOfBirth: null, gender: null },
      undefined,
    )

    expect(requests.map(({ method, url }) => ({ method, url }))).toEqual([
      { method: 'get', url: '/api/v1/profile' },
      { method: 'put', url: '/api/v1/profile' },
      { method: 'put', url: '/api/v1/profile' },
    ])
    expect(requests[1]?.headers.get('If-Match')).toBe('"2"')
    expect(requests[2]?.headers.get('If-Match')).toBeUndefined()
    expect(JSON.parse(String(requests[1]?.data))).toEqual({
      displayName: 'Nguyễn An',
      dateOfBirth: '1998-05-12',
      gender: 'female',
    })
    expect(JSON.parse(String(requests[1]?.data))).not.toHaveProperty(
      'accountId',
    )
  })

  it('rejects an unrecognized profile payload', async () => {
    const adapter: AxiosAdapter = async (request) => ({
      config: request,
      data: { ...profile, unexpected: true },
      headers: {},
      status: 200,
      statusText: 'OK',
    })

    await expect(
      createCareProfileApi(create({ adapter })).getProfile(),
    ).rejects.toBeDefined()
  })
})
