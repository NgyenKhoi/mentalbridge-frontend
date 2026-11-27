import {
  create,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from 'axios'

import { createSpecialistApi } from './specialist-api'
import type { SpecialistProfileRequest } from './specialist-contract'
import {
  makeAvailabilityList,
  makeAvailabilitySlot,
  makeSpecialistProfile,
} from './specialist-test-fixtures'

function response(request: InternalAxiosRequestConfig, data: unknown) {
  return {
    config: request,
    data,
    headers: {},
    status: 200,
    statusText: 'OK',
  }
}

describe('Consultation mobile SPECIALIST API contract', () => {
  it('creates without If-Match and updates the exact profile version', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    const adapter: AxiosAdapter = async (request) => {
      requests.push(request)
      return response(
        request,
        makeSpecialistProfile({ version: requests.length }),
      )
    }
    const api = createSpecialistApi(create({ adapter }))
    const body: SpecialistProfileRequest = {
      displayName: 'Chuyên gia An',
      bio: 'Đồng hành an toàn.',
      supportAreas: ['ANXIETY_SYMPTOMS'],
      languages: ['vi'],
      yearsOfExperience: 5,
      timezone: 'Asia/Ho_Chi_Minh',
    }

    await api.saveProfile(body, undefined)
    await api.saveProfile(body, 7)

    expect(requests[0]?.url).toBe('/api/v1/specialist-profile')
    expect(requests[0]?.headers.get('If-Match')).toBeUndefined()
    expect(requests[1]?.headers.get('If-Match')).toBe('"7"')
    expect(JSON.parse(String(requests[1]?.data))).toEqual(body)
  })

  it('submits and resubmits only the exact profile version', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    const profile = makeSpecialistProfile({ version: 4 })
    const adapter: AxiosAdapter = async (request) => {
      requests.push(request)
      return response(request, {
        ...profile,
        submittedAt: '2026-10-09T00:00:00.000Z',
        version: 5,
      })
    }
    const api = createSpecialistApi(create({ adapter }))

    await api.submitProfile(profile)
    await api.resubmitProfile(profile)

    expect(requests.map((request) => request.url)).toEqual([
      '/api/v1/specialist-profile/submit',
      '/api/v1/specialist-profile/resubmit',
    ])
    expect(requests[0]?.headers.get('If-Match')).toBe('"4"')
    expect(requests[1]?.headers.get('If-Match')).toBe('"4"')
  })

  it('lists tombstones and publishes with one caller-owned idempotency key', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    const adapter: AxiosAdapter = async (request) => {
      requests.push(request)
      return response(
        request,
        requests.length === 1
          ? makeAvailabilityList([])
          : makeAvailabilitySlot(),
      )
    }
    const api = createSpecialistApi(create({ adapter }))
    const input = {
      startAt: '2030-10-15T02:00:00.000Z',
      endAt: '2030-10-15T03:00:00.000Z',
      timezone: 'Asia/Ho_Chi_Minh',
      modality: 'IN_APP_CHAT' as const,
    }

    await api.listAvailability()
    await api.publishAvailability(input, '33333333-3333-4333-8333-333333333333')

    expect(requests[0]?.params).toEqual({ includeWithdrawn: true })
    expect(requests[1]?.headers.get('Idempotency-Key')).toBe(
      '33333333-3333-4333-8333-333333333333',
    )
    expect(JSON.parse(String(requests[1]?.data))).toEqual(input)
  })

  it('withdraws only the owner slot with its quoted version', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    const slot = makeAvailabilitySlot({ version: 8 })
    const adapter: AxiosAdapter = async (request) => {
      requests.push(request)
      return response(request, {
        ...slot,
        status: 'WITHDRAWN',
        readiness: 'WITHDRAWN',
        withdrawnAt: '2026-10-09T00:00:00.000Z',
        version: 9,
      })
    }
    const api = createSpecialistApi(create({ adapter }))

    await api.withdrawAvailability(slot)

    expect(requests[0]?.url).toBe(`/api/v1/availability-slots/${slot.id}`)
    expect(requests[0]?.headers.get('If-Match')).toBe('"8"')
  })
})
