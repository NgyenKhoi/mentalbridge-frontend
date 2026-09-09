import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const careMocks = vi.hoisted(() => ({
  questionnaireDefinition: vi.fn(),
}))

vi.mock('@/lib/care/care-client', () => ({
  careClient: { questionnaireDefinition: careMocks.questionnaireDefinition },
}))

import { GET } from './route'

const definitionId = '10000000-0000-4000-8000-000000000001'

function request(value: string) {
  return new NextRequest(
    `http://localhost/api/care/questionnaires/definitions/${value}`,
  )
}

describe('GET /api/care/questionnaires/definitions/[definitionId]', () => {
  beforeEach(() => careMocks.questionnaireDefinition.mockReset())

  it('forwards an immutable definition identifier to Care', async () => {
    careMocks.questionnaireDefinition.mockResolvedValue({
      definitionId,
      version: 'phq9-vi-vn-capstone-v1',
    })

    const response = await GET(request(definitionId), {
      params: Promise.resolve({ definitionId }),
    })

    expect(response.status).toBe(200)
    expect(careMocks.questionnaireDefinition).toHaveBeenCalledWith(
      definitionId,
      expect.any(String),
    )
  })

  it('rejects malformed identifiers before calling Care', async () => {
    const response = await GET(request('not-a-uuid'), {
      params: Promise.resolve({ definitionId: 'not-a-uuid' }),
    })

    expect(response.status).toBe(400)
    expect(careMocks.questionnaireDefinition).not.toHaveBeenCalled()
  })
})
