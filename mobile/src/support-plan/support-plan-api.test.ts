import {
  create,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from 'axios'

import { createSupportPlanApi } from './support-plan-api'
import {
  makeOccurrence,
  makePlan,
  makePlanChangeRequest,
  makeReassessmentSummary,
} from './support-plan-test-fixtures'

describe('Care mobile SupportPlan API contract', () => {
  it('activates the exact draft with optimistic concurrency and idempotency', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    const active = makePlan('ACTIVE')
    const adapter: AxiosAdapter = async (request) => {
      requests.push(request)
      return {
        config: request,
        data: active,
        headers: {},
        status: 200,
        statusText: 'OK',
      }
    }
    const api = createSupportPlanApi(create({ adapter }))
    const draft = makePlan('DRAFT')

    await api.activate(draft, '11111111-1111-4111-8111-111111111111')

    expect(requests[0]?.url).toBe(
      `/api/v1/support-plans/${draft.supportPlanId}/activate`,
    )
    expect(requests[0]?.headers.get('If-Match')).toBe('"3"')
    expect(requests[0]?.headers.get('Idempotency-Key')).toBe(
      '11111111-1111-4111-8111-111111111111',
    )
  })

  it('records only the supported occurrence engagement fields', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    const completed = makeOccurrence({
      state: 'COMPLETED',
      displayState: 'COMPLETED',
      version: 3,
      helpfulness: 'HELPFUL',
    })
    const adapter: AxiosAdapter = async (request) => {
      requests.push(request)
      return {
        config: request,
        data: completed,
        headers: {},
        status: 200,
        statusText: 'OK',
      }
    }
    const api = createSupportPlanApi(create({ adapter }))
    const occurrence = makeOccurrence()

    await api.replaceOccurrenceEngagement(occurrence, {
      state: 'COMPLETED',
      hidden: false,
      helpfulness: 'HELPFUL',
      barrierCode: null,
      reflection: null,
      summaryReuseApproved: false,
    })

    expect(requests[0]?.url).toBe(
      `/api/v1/support-plan-occurrences/${occurrence.occurrenceId}/engagement`,
    )
    expect(requests[0]?.headers.get('If-Match')).toBe('"2"')
    expect(JSON.parse(String(requests[0]?.data))).toEqual({
      state: 'COMPLETED',
      hidden: false,
      helpfulness: 'HELPFUL',
      barrierCode: null,
      reflection: null,
      summaryReuseApproved: false,
    })
  })

  it('uses the existing proposal authority and exact request version for a decision', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    const accepted = makePlanChangeRequest({
      status: 'ACCEPTED',
      outcomeCode: 'PROPOSAL_APPLIED',
      version: 1,
      decidedAt: '2026-10-07T02:00:00.000Z',
      replacementSupportPlanId: '10000000-0000-4000-8000-000000000003',
      replacementSupportPlanVersion: 1,
    })
    const adapter: AxiosAdapter = async (request) => {
      requests.push(request)
      return {
        config: request,
        data: accepted,
        headers: {},
        status: 200,
        statusText: 'OK',
      }
    }
    const api = createSupportPlanApi(create({ adapter }))
    const request = makePlanChangeRequest()

    await api.decidePlanChangeRequest(
      request,
      'ACCEPT',
      '22222222-2222-4222-8222-222222222222',
    )

    expect(requests[0]?.url).toBe(
      `/api/v1/plan-change-requests/${request.requestId}/decision`,
    )
    expect(requests[0]?.headers.get('If-Match')).toBe('"0"')
    expect(requests[0]?.headers.get('Idempotency-Key')).toBe(
      '22222222-2222-4222-8222-222222222222',
    )
    expect(JSON.parse(String(requests[0]?.data))).toEqual({
      decision: 'ACCEPT',
    })
  })

  it('reviews a replacement against the authoritative reassessment snapshot', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    const current = makePlan('ACTIVE')
    const draft = makePlan('DRAFT')
    const summary = makeReassessmentSummary()
    const review = {
      outcome: 'CURRENT_PLAN_VALID_ALTERNATIVES_AVAILABLE',
      rationaleCodes: ['CURRENT_PLAN_ADMISSIBLE', 'PROPOSED_PLAN_ADMISSIBLE'],
      comparison: [
        {
          change: 'UNCHANGED',
          currentSlotId: current.slots[0]!.slotId,
          currentResource: current.slots[0]!.selectedResource,
          proposedSlotId: draft.slots[0]!.slotId,
          proposedResource: draft.slots[0]!.selectedResource,
        },
      ],
      currentPlan: current,
      proposedPlan: draft,
      reassessmentSummary: summary,
      reviewedAt: '2026-10-07T02:00:00.000Z',
    }
    const adapter: AxiosAdapter = async (request) => {
      requests.push(request)
      return {
        config: request,
        data: requests.length === 1 ? summary : review,
        headers: {},
        status: 200,
        statusText: 'OK',
      }
    }
    const api = createSupportPlanApi(create({ adapter }))

    await api.reviewReplacement(current, draft)

    expect(requests[0]?.url).toBe('/api/v1/reassessment-summaries/current')
    expect(requests[1]?.url).toBe(
      `/api/v1/support-plans/${draft.supportPlanId}/replacement-review`,
    )
    expect(requests[1]?.headers.get('If-Match')).toBe('"3"')
    expect(JSON.parse(String(requests[1]?.data))).toEqual({
      currentSupportPlanId: current.supportPlanId,
      currentVersion: current.version,
      reassessmentSummaryId: summary.summaryId,
    })
  })

  it('rejects a silently drifted SupportPlan response', async () => {
    const adapter: AxiosAdapter = async (request) => ({
      config: request,
      data: { ...makePlan('ACTIVE'), unsupportedAuthority: true },
      headers: {},
      status: 200,
      statusText: 'OK',
    })

    await expect(
      createSupportPlanApi(create({ adapter })).getCurrent(),
    ).rejects.toBeDefined()
  })
})
