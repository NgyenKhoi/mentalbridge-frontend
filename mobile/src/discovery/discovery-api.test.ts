import { create } from 'axios'

import { createDiscoveryApi } from './discovery-api'
import {
  fixturePage,
  fixtureSlot,
  fixtureSpecialist,
  specialistId,
} from './discovery-fixtures'

describe('public-edge discovery GETs', () => {
  it('sends supported criteria and opaque cursor with no identity/health payload', async () => {
    const supportEvaluationId = '40000000-0000-4000-8000-000000000725'
    const client = create()
    const get = jest
      .spyOn(client, 'get')
      .mockResolvedValue({ data: fixturePage })
    await createDiscoveryApi(client).list(
      {
        supportEvaluationId,
        supportArea: 'ANXIETY_SYMPTOMS',
        language: 'vi',
        modality: 'IN_APP_CHAT',
        timezone: 'Asia/Ho_Chi_Minh',
      },
      'opaque-cursor',
    )
    expect(get).toHaveBeenCalledWith('/api/v1/specialists', {
      params: {
        supportEvaluationId,
        supportArea: 'ANXIETY_SYMPTOMS',
        language: 'vi',
        modality: 'IN_APP_CHAT',
        timezone: 'Asia/Ho_Chi_Minh',
        limit: 20,
        cursor: 'opaque-cursor',
      },
    })
  })
  it('detail only sends criteria that its public contract supports', async () => {
    const supportEvaluationId = '40000000-0000-4000-8000-000000000725'
    const client = create()
    const get = jest
      .spyOn(client, 'get')
      .mockResolvedValue({ data: fixtureSpecialist })
    expect(
      await createDiscoveryApi(client).detail(specialistId, {
        supportEvaluationId,
        supportArea: 'ANXIETY_SYMPTOMS',
        language: 'vi',
      }),
    ).toEqual(fixtureSpecialist)
    expect(get).toHaveBeenCalledWith(`/api/v1/specialists/${specialistId}`, {
      params: { supportEvaluationId, language: 'vi' },
    })
  })
  it('fails closed on wrong public identity, invalid IDs and private responses', async () => {
    const client = create()
    const get = jest
      .spyOn(client, 'get')
      .mockResolvedValue({ data: fixtureSpecialist })
    await expect(
      createDiscoveryApi(client).detail(fixtureSlot.id, {}),
    ).rejects.toMatchObject({ code: 'DISCOVERY_CONTRACT_MISMATCH' })
    await expect(
      createDiscoveryApi(client).detail('../private', {}),
    ).rejects.toThrow()
    get.mockResolvedValueOnce({
      data: { ...fixtureSpecialist, approvalStatus: 'SUSPENDED' },
    })
    await expect(
      createDiscoveryApi(client).detail(specialistId, {}),
    ).rejects.toThrow()
  })
})
