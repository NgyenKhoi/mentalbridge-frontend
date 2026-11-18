import { create, type AxiosAdapter } from 'axios'

import { createAssessmentHistoryApi } from './assessment-history-api'

it('loads an owner episode page without filling missing results from another assessment', async () => {
  const row = {
    episodeId: '50000000-0000-4000-8000-000000000664',
    purpose: 'INITIAL_CHECK',
    status: 'IN_PROGRESS',
    startedAt: '2026-10-06T08:00:00Z',
    updatedAt: '2026-10-06T08:01:00Z',
    completedAt: null,
    presentationEvaluationId: null,
    meaningState: 'INCOMPLETE',
    evidence: [
      {
        instrument: 'PHQ9',
        state: 'AVAILABLE',
        assessmentId: '10000000-0000-4000-8000-000000000101',
        totalScore: 0,
        screeningLevel: 'MINIMAL',
        safetyStatus: 'NEGATIVE_SAFETY_SCREEN',
      },
      {
        instrument: 'GAD7',
        state: 'MISSING',
        assessmentId: null,
        totalScore: null,
        screeningLevel: null,
        safetyStatus: null,
      },
    ],
    meaning: null,
  }
  const adapter: AxiosAdapter = async (config) => {
    expect(config.url).toBe('/api/v1/screening-episodes/history')
    expect(config.params).toEqual({ limit: 10, cursor: 'next' })
    return {
      config,
      data: { items: [row], hasMore: false, nextCursor: null },
      headers: {},
      status: 200,
      statusText: 'OK',
    }
  }
  const api = createAssessmentHistoryApi(create({ adapter }))

  const page = await api.episodes('next', new AbortController().signal)

  expect(page.items).toEqual([row])
})
