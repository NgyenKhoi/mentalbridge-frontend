import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { mockServer } from '@/tests/mocks/server'
import { browserApiClient } from '@/lib/api/browser-client'
import {
  emotionOccurrenceFixture,
  nativeSupportPlanFixture,
} from '@/features/support-plan/testing/native-support-plan-fixture'
import { homeDestination } from './home-destination'
import { homeResourceDetailFixture } from './testing/home-secondary-fixtures'
import {
  HOME_GUIDE_ID,
  homeJourneyFixture,
  homeNextStepFixture,
  homePlanFixture,
} from './testing/home-next-step-fixture'

function taskWorld() {
  const current = nativeSupportPlanFixture()
  const occurrence = emotionOccurrenceFixture()
  const action = current.focuses[0].actions[0]
  const home = homeNextStepFixture({
    journey: homeJourneyFixture({ nextAction: 'OPEN_CURRENT_PLAN' }),
    plan: homePlanFixture('DO_TODAY', {
      supportPlanId: current.supportPlanId,
      localDate: occurrence.localDate,
      nextOccurrence: {
        occurrenceId: occurrence.occurrenceId,
        actionId: action.actionId,
        actionType: action.actionType,
        title: action.presentation.title,
        displayState: 'SCHEDULED',
        scheduledAt: occurrence.scheduledAt,
        estimatedDurationMinutes: 5,
      },
    }),
  })
  return { current, occurrence, home }
}

describe('Home task destinations', () => {
  it.each(['ASSESSMENT_REQUIRED', 'GUIDE_REQUIRED'] as const)(
    'keeps %s out of plan and provider context reads even with an existing plan',
    async (stage) => {
      const { home } = taskWorld()
      home.journey.stage = stage
      home.journey.supportGuideId = null
      const apiRead = vi
        .spyOn(browserApiClient, 'get')
        .mockRejectedValue(new Error('Unexpected context read'))
      const contentRead = vi
        .spyOn(globalThis, 'fetch')
        .mockRejectedValue(new Error('Unexpected Content read'))
      try {
        expect(await homeDestination(home)).toEqual({})
        expect(apiRead).not.toHaveBeenCalled()
        expect(contentRead).not.toHaveBeenCalled()
      } finally {
        apiRead.mockRestore()
        contentRead.mockRestore()
      }
    },
  )

  it.each([200, 503])(
    'uses exact Content metadata when available without losing navigation on %s',
    async (status) => {
      const { current, occurrence, home } = taskWorld()
      const action = current.focuses[0].actions[0]
      action.actionType = 'RESOURCE'
      action.source = {
        ownerDomain: 'CONTENT',
        sourceKind: 'RESOURCE_VERSION',
        sourceId: '70000000-0000-4000-8000-000000000672',
        sourceRevision: '7',
        sourcePolicyVersion: null,
        publicationId: null,
        eligibilityPolicyVersion: null,
        verifiedAt: null,
      }
      home.plan!.nextOccurrence!.actionType = 'RESOURCE'
      mockServer.use(
        http.get('/api/care/v2/support-plans/current', () =>
          HttpResponse.json(current),
        ),
        http.get('/api/care/v2/support-plan-occurrences', () =>
          HttpResponse.json({
            supportPlanId: current.supportPlanId,
            occurrences: [occurrence],
          }),
        ),
        http.get(
          '/api/resources/70000000-0000-4000-8000-000000000672',
          ({ request }) => {
            expect(
              new URL(request.url).searchParams.get('contentVersion'),
            ).toBe('7')
            return status === 200
              ? HttpResponse.json(
                  homeResourceDetailFixture({ category: 'JOURNALING' }),
                )
              : new HttpResponse(null, { status })
          },
        ),
      )
      const context = await homeDestination(home)
      expect(context.remaining).toBe(1)
      const destination = new URL(context.destination!, 'http://localhost')
      expect(destination.pathname).toBe(
        '/resources/70000000-0000-4000-8000-000000000672',
      )
      expect(destination.searchParams.get('contentVersion')).toBe('7')
      expect(destination.searchParams.get('occurrenceId')).toBe(
        occurrence.occurrenceId,
      )
      expect(context.resourceCategory).toBe(
        status === 200 ? 'JOURNALING' : undefined,
      )
    },
  )
  it('uses the existing emotion origin link and counts open items without skipped or cancelled items', async () => {
    const { current, occurrence, home } = taskWorld()
    mockServer.use(
      http.get('/api/care/v2/support-plans/current', () =>
        HttpResponse.json(current),
      ),
      http.get('/api/care/v2/support-plan-occurrences', ({ request }) => {
        const query = new URL(request.url).searchParams
        expect(query.get('from')).toBe(occurrence.localDate)
        expect(query.get('through')).toBe(occurrence.localDate)
        return HttpResponse.json({
          supportPlanId: current.supportPlanId,
          occurrences: [
            occurrence,
            {
              ...occurrence,
              occurrenceId: 'skipped',
              state: 'SKIPPED',
              displayState: 'SKIPPED',
            },
            {
              ...occurrence,
              occurrenceId: 'cancelled',
              state: 'CANCELLED',
              displayState: 'CANCELLED',
            },
          ],
        })
      }),
    )
    const context = await homeDestination(home)
    expect(context.destination).toContain(
      `/dashboard?occurrenceId=${occurrence.occurrenceId}`,
    )
    expect(context.destination).toContain(`#emotion-check-in`)
    expect(context.remaining).toBe(1)
  })

  it.each(['read-failed', 'plan-changed', 'occurrence-missing'])(
    'falls back to Today when %s',
    async (mode) => {
      const { current, occurrence, home } = taskWorld()
      mockServer.use(
        http.get('/api/care/v2/support-plans/current', () =>
          mode === 'read-failed'
            ? new HttpResponse(null, { status: 503 })
            : HttpResponse.json({
                ...current,
                supportPlanId:
                  mode === 'plan-changed'
                    ? 'another-plan'
                    : current.supportPlanId,
              }),
        ),
        http.get('/api/care/v2/support-plan-occurrences', () =>
          HttpResponse.json({
            supportPlanId: current.supportPlanId,
            occurrences: mode === 'occurrence-missing' ? [] : [occurrence],
          }),
        ),
      )
      expect((await homeDestination(home)).destination).toBe('/support-plan')
    },
  )

  it('keeps safety out of task context reads', async () => {
    const { home } = taskWorld()
    home.journey.nextAction = 'REVIEW_SAFETY_SUPPORT'
    expect(await homeDestination(home)).toEqual({})
  })

  it.each([
    'FIND_SPECIALIST',
    'START_PLAN_PROPOSAL',
    'EXPLORE_GUIDE_RESOURCES',
  ] as const)('uses guideContinuation for %s', async (nextAction) => {
    const home = homeNextStepFixture({
      journey: homeJourneyFixture({ nextAction }),
    })
    if (nextAction === 'FIND_SPECIALIST')
      home.plan = homePlanFixture('DO_TODAY')
    mockServer.use(
      http.get(`/api/care/support-guides/${HOME_GUIDE_ID}`, () =>
        HttpResponse.json({
          supportGuideId: HOME_GUIDE_ID,
          resources: [{ title: 'A saved resource' }],
        }),
      ),
    )
    const { destination } = await homeDestination(home)
    expect(destination).toBe(
      nextAction === 'FIND_SPECIALIST'
        ? `/specialists?from=support-guide&supportGuideId=${HOME_GUIDE_ID}`
        : nextAction === 'START_PLAN_PROPOSAL'
          ? '/support-plan'
          : `/support-guides/${HOME_GUIDE_ID}#support-guide-resources`,
    )
  })

  it('falls back to the saved Guide if it cannot load continuation context', async () => {
    mockServer.use(
      http.get(
        `/api/care/support-guides/${HOME_GUIDE_ID}`,
        () => new HttpResponse(null, { status: 503 }),
      ),
    )
    expect(await homeDestination(homeNextStepFixture())).toEqual({
      destination: `/support-guides/${HOME_GUIDE_ID}`,
    })
  })
})
