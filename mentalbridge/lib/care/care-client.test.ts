// @vitest-environment node

import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { mockServer } from '@/tests/mocks/server'
import { careClient } from './care-client'

const assessmentId = '10000000-0000-4000-8000-000000000003'

describe('Care client progress validation', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('maps a response for a different assessment to CARE_MALFORMED_RESPONSE', async () => {
    vi.stubEnv('CARE_API_BASE_URL', 'http://care.test')
    mockServer.use(
      http.get(
        `http://care.test/api/v1/assessments/${assessmentId}/progress`,
        () =>
          HttpResponse.json({
            instrument: 'PHQ9',
            scoringVersion: 'phq9-standard-bands-v1',
            previous: {
              assessmentId: '10000000-0000-4000-8000-000000000002',
              questionnaireVersion: 'phq9-vi-vn-capstone-v1',
              submittedAt: '2026-09-01T00:00:00Z',
              totalScore: 4,
              screeningLevel: 'MINIMAL',
            },
            current: {
              assessmentId: '10000000-0000-4000-8000-000000000005',
              questionnaireVersion: 'phq9-vi-vn-capstone-v1',
              submittedAt: '2026-09-04T00:00:00Z',
              totalScore: 10,
              screeningLevel: 'MODERATE',
            },
            rawDelta: 6,
            scoreDirection: 'INCREASED',
            bandTransition: { previous: 'MINIMAL', current: 'MODERATE' },
            elapsedDuration: 'PT72H',
          }),
      ),
    )

    await expect(
      careClient.progress('server-side-access-token', assessmentId, 'test-id'),
    ).rejects.toMatchObject({
      code: 'CARE_MALFORMED_RESPONSE',
      status: 502,
    })
  })
})
