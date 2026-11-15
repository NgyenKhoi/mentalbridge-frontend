import {
  create,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from 'axios'

import { createReassessmentApi } from './reassessment-api'
import { reassessmentContextSchema } from './reassessment-contract'
import { makeMobileReassessmentSummary } from './reassessment-test-fixtures'

const context = reassessmentContextSchema.parse({
  policyVersion: 'reassessment-comparison-v1',
  state: 'READY',
  missingInstruments: [],
  phq9AssessmentId: '10000000-0000-4000-8000-000000000664',
  gad7AssessmentId: '20000000-0000-4000-8000-000000000664',
  previousPeriod: {
    startAt: '2026-09-05T00:00:00Z',
    endAt: '2026-09-19T00:00:00Z',
  },
  currentPeriod: {
    startAt: '2026-09-19T00:00:00Z',
    endAt: '2026-10-03T00:00:00Z',
  },
})

const report = {
  selfReportId: '30000000-0000-4000-8000-000000000664',
  sourceVersion: 'reassessment-self-report-v1',
  currentPeriod: context.currentPeriod,
  currentExperience: 'BETTER',
  helpfulContext: 'Đi bộ ngắn mỗi ngày',
  difficultContext: null,
  version: 0,
  authoredAt: '2026-10-03T05:00:00Z',
  updatedAt: '2026-10-03T05:00:00Z',
} as const

function fixture(responses: unknown[]) {
  const requests: InternalAxiosRequestConfig[] = []
  const adapter: AxiosAdapter = async (request) => {
    requests.push(request)
    return {
      config: request,
      data: responses[requests.length - 1],
      headers: {},
      status: 200,
      statusText: 'OK',
    }
  }
  return { api: createReassessmentApi(create({ adapter })), requests }
}

describe('mobile reassessment owner transport', () => {
  it('reopens exact-period context and self-report without local synthesis', async () => {
    const { api, requests } = fixture([context, report])
    expect((await api.getContext()).state).toBe('READY')
    expect((await api.getCurrentReport()).selfReportId).toBe(
      report.selfReportId,
    )
    expect(requests.map((request) => request.url)).toEqual([
      '/api/v1/reassessment-summaries/context',
      '/api/v1/reassessment-self-reports/current',
    ])
  })

  it('creates, replaces and composes with idempotency and strong revision headers', async () => {
    const updated = {
      ...report,
      currentExperience: 'ABOUT_THE_SAME',
      version: 1,
      updatedAt: '2026-10-03T05:05:00Z',
    } as const
    const summary = {
      ...makeMobileReassessmentSummary(),
      summaryVersion: 'reassessment-summary-v2',
      previousPeriod: context.previousPeriod,
      currentPeriod: context.currentPeriod,
    } as const
    const { api, requests } = fixture([report, updated, summary])
    await api.createReport(
      context,
      {
        currentExperience: 'BETTER',
        helpfulContext: 'Đi bộ ngắn mỗi ngày',
        difficultContext: null,
      },
      'reassessment-report-key-01',
    )
    await api.replaceReport(report, {
      currentExperience: 'ABOUT_THE_SAME',
      helpfulContext: null,
      difficultContext: null,
    })
    await api.compose(
      context,
      '40000000-0000-4000-8000-000000000664',
      report.selfReportId,
      'reassessment-summary-key-01',
    )
    expect(requests[0]?.headers.get('Idempotency-Key')).toBe(
      'reassessment-report-key-01',
    )
    expect(requests[1]?.headers.get('If-Match')).toBe('"0"')
    expect(requests[2]?.headers.get('Idempotency-Key')).toBe(
      'reassessment-summary-key-01',
    )
    expect(JSON.parse(requests[2]?.data).selfReportId).toBe(report.selfReportId)
  })

  it('fails closed when Care returns a different period or stale revision', async () => {
    const { api } = fixture([
      {
        ...report,
        currentPeriod: {
          startAt: '2026-01-01T00:00:00Z',
          endAt: '2026-01-15T00:00:00Z',
        },
      },
      { ...report, version: 0 },
    ])
    await expect(
      api.createReport(
        context,
        {
          currentExperience: 'BETTER',
          helpfulContext: null,
          difficultContext: null,
        },
        'reassessment-report-key-02',
      ),
    ).rejects.toThrow('period mismatch')
    await expect(
      api.replaceReport(report, {
        currentExperience: 'BETTER',
        helpfulContext: null,
        difficultContext: null,
      }),
    ).rejects.toThrow('authority mismatch')
  })
})
