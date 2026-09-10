import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const careMocks = vi.hoisted(() => ({
  currentQuestionnaire: vi.fn(),
}))

vi.mock('@/lib/care/care-client', () => ({
  careClient: { currentQuestionnaire: careMocks.currentQuestionnaire },
}))

import { GET } from './route'

function request(segment: string) {
  return new NextRequest(`http://localhost/api/care/questionnaires/${segment}`)
}

describe('GET /api/care/questionnaires/[instrument]', () => {
  beforeEach(() => careMocks.currentQuestionnaire.mockReset())

  it('maps the bounded GAD-7 route to the Care instrument enum', async () => {
    careMocks.currentQuestionnaire.mockResolvedValue({ instrument: 'GAD7' })

    const response = await GET(request('gad7'), {
      params: Promise.resolve({ instrument: 'gad7' }),
    })

    expect(response.status).toBe(200)
    expect(careMocks.currentQuestionnaire).toHaveBeenCalledWith(
      'GAD7',
      expect.any(String),
    )
  })

  it('rejects unknown instruments before calling Care', async () => {
    const response = await GET(request('custom-score'), {
      params: Promise.resolve({ instrument: 'custom-score' }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      code: 'VALIDATION_FAILED',
    })
    expect(careMocks.currentQuestionnaire).not.toHaveBeenCalled()
  })
})
