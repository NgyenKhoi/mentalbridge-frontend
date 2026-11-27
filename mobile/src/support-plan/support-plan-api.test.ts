import {
  create,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from 'axios'

import { appointment, credits } from '@/appointments/appointment-fixtures'

import { createSupportPlanApi } from './support-plan-api'
import {
  makeOccurrence,
  makePlan,
  makePlanChangeRequest,
  makeReassessmentSummary,
} from './support-plan-test-fixtures'

function makeScheduleProjection(version = 3) {
  const plan = makePlan('DRAFT')
  return {
    supportPlanId: plan.supportPlanId,
    modelVersion: 3,
    planPolicyVersion: 'support-plan-selection-v2',
    representationMode: 'V2_RESOURCE_ADAPTER',
    status: 'DRAFT',
    version,
    updatedAt: plan.updatedAt,
    focuses: [
      {
        focusId: 'focus-1',
        title: 'Há»— trá»£ tÃ¢m tráº¡ng',
        rationale: null,
        personalizationProvenance: null,
        actions: [
          {
            actionId: '11111111-1111-4111-8111-111111111111',
            actionType: 'RESOURCE',
            actionVersion: 1,
            representationMode: 'V2_RESOURCE_ADAPTER',
            status: 'DRAFT',
            pathRole: 'PRIMARY',
            purposeCode: 'RESOURCE_SUPPORT',
            rationale: null,
            ordinal: 1,
            presentation: {
              title: 'BÃ i thá»±c hÃ nh Ä‘Ã£ duyá»‡t',
              summary: null,
            },
            schedules: [
              {
                scheduleId: '22222222-2222-4222-8222-222222222222',
                version: 1,
                schedulePolicyVersion: 'support-plan-activity-schedule-v2',
                recurrenceType: 'WEEKLY',
                recurrenceDayOfWeek: null,
                daysOfWeek: [1, 4],
                preferredDaypart: 'MORNING',
                estimatedDurationMinutes: 15,
                localTime: '08:30:00',
                timezone: 'Asia/Ho_Chi_Minh',
                effectiveFrom: '2026-10-12',
                effectiveUntil: null,
                reminderEnabled: true,
                status: 'DRAFT',
              },
            ],
          },
        ],
      },
    ],
  } as const
}

describe('Care mobile SupportPlan API contract', () => {
  it('reads and replaces personalization with the same strong ETag authority', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    const value = {
      personalizationId: null,
      schemaVersion: 'support-plan-personalization-v1',
      revision: 0,
      status: 'NOT_PROVIDED',
      preferredFocus: null,
      desiredPace: null,
      dailyTimeBudgetMinutes: null,
      preferredDaypart: null,
      preferredActivityModes: [],
      commonBarriers: [],
      submittedAt: null,
      planReview: {
        required: false,
        supportPlanId: null,
        supportPlanVersion: null,
        reasonCode: null,
      },
    }
    const adapter: AxiosAdapter = async (request) => {
      requests.push(request)
      return {
        config: request,
        data:
          requests.length === 1
            ? value
            : {
                ...value,
                personalizationId: '10000000-0000-4000-8000-000000000638',
                revision: 1,
                status: 'PROVIDED',
                preferredFocus: 'SLEEP',
                submittedAt: '2026-10-12T08:00:00Z',
              },
        headers: { etag: requests.length === 1 ? '"0"' : '"1"' },
        status: 200,
        statusText: 'OK',
      }
    }
    const api = createSupportPlanApi(create({ adapter }))

    const authority = await api.getPersonalization()
    const updated = await api.replacePersonalization(
      {
        preferredFocus: 'SLEEP',
        desiredPace: null,
        dailyTimeBudgetMinutes: null,
        preferredDaypart: null,
        preferredActivityModes: [],
        commonBarriers: [],
      },
      authority.etag,
    )

    expect(authority.etag).toBe('"0"')
    expect(updated.value.preferredFocus).toBe('SLEEP')
    expect(requests.map((request) => request.url)).toEqual([
      '/api/v2/support-plan-personalization',
      '/api/v2/support-plan-personalization',
    ])
    expect(requests[1]?.headers.get('If-Match')).toBe('"0"')
  })

  it('reads the Care action projection and Consultation progress without joining ownership', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    const plan = makePlan('ACTIVE')
    const actionId = '11111111-1111-4111-8111-111111111111'
    const projection = {
      supportPlanId: plan.supportPlanId,
      modelVersion: 3,
      planPolicyVersion: 'support-plan-selection-v2',
      representationMode: 'V2_RESOURCE_ADAPTER',
      status: 'ACTIVE',
      version: plan.version,
      updatedAt: plan.updatedAt,
      focuses: [
        {
          focusId: 'professional-support',
          title: 'Kết nối với hỗ trợ phù hợp',
          rationale: 'Hỗ trợ chuyên môn là hướng hỗ trợ chính.',
          personalizationProvenance: null,
          actions: [
            {
              actionId,
              actionType: 'PROFESSIONAL_SUPPORT',
              actionVersion: 1,
              representationMode: 'V2_RESOURCE_ADAPTER',
              status: 'ACTIVE',
              pathRole: 'PRIMARY',
              purposeCode: 'CONNECT_WITH_PROFESSIONAL_SUPPORT',
              rationale: null,
              ordinal: 1,
              schedules: [],
              presentation: {
                title: 'Kết nối với chuyên gia',
                summary: 'Hướng hỗ trợ chính.',
              },
            },
          ],
        },
      ],
    }
    const adapter: AxiosAdapter = async (request) => {
      requests.push(request)
      return {
        config: request,
        data:
          requests.length === 1
            ? projection
            : {
                items: [{ ...appointment, originatingPlanActionId: actionId }],
                count: 1,
                generatedAt: credits.generatedAt,
              },
        headers: {},
        status: 200,
        statusText: 'OK',
      }
    }
    const api = createSupportPlanApi(create({ adapter }))

    expect(
      (await api.getActions(plan.supportPlanId)).focuses[0]?.actions[0],
    ).toMatchObject({ actionId, pathRole: 'PRIMARY' })
    expect(
      (await api.getAppointments(actionId)).items[0]?.originatingPlanActionId,
    ).toBe(actionId)
    expect(requests.map((request) => request.url)).toEqual([
      `/api/v2/support-plans/${plan.supportPlanId}`,
      '/api/v1/appointments',
    ])
    expect(requests[1]?.params).toEqual({ originatingPlanActionId: actionId })
  })

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

  it('reviews draft defaults and replaces one action schedule with plan concurrency', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    const projection = makeScheduleProjection()
    const adapter: AxiosAdapter = async (request) => {
      requests.push(request)
      return {
        config: request,
        data:
          requests.length === 1
            ? projection
            : { ...projection, version: projection.version + 1 },
        headers: {},
        status: 200,
        statusText: 'OK',
      }
    }
    const api = createSupportPlanApi(create({ adapter }))
    const draft = makePlan('DRAFT')
    const actionId = projection.focuses[0].actions[0].actionId
    const request = {
      schedule: {
        recurrenceType: 'WEEKLY' as const,
        daysOfWeek: [2, 5],
        preferredDaypart: 'EVENING' as const,
        localTime: '19:00:00',
        estimatedDurationMinutes: 20,
        timezone: 'Asia/Ho_Chi_Minh',
        effectiveFrom: '2026-10-13',
        effectiveUntil: null,
        reminderEnabled: true,
      },
    }

    expect((await api.getCurrentDraftActions()).version).toBe(3)
    expect(
      (
        await api.replaceSchedule(
          draft,
          actionId,
          request,
          'schedule-command-0001',
        )
      ).version,
    ).toBe(4)

    expect(requests.map((item) => item.url)).toEqual([
      '/api/v2/support-plans/current-draft',
      `/api/v2/support-plans/${draft.supportPlanId}/actions/${actionId}/schedule`,
    ])
    expect(requests[1]?.headers.get('If-Match')).toBe('"3"')
    expect(requests[1]?.headers.get('Idempotency-Key')).toBe(
      'schedule-command-0001',
    )
    expect(requests[1]?.data).toBe(JSON.stringify(request))
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
