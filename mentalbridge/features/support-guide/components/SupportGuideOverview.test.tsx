import { http, HttpResponse } from 'msw'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { mockServer } from '@/tests/mocks/server'
import type { SupportGuide } from '../api/support-guide-contract'
import SupportGuideOverview from './SupportGuideOverview'

const episodeId = '10000000-0000-4000-8000-000000000668'
const guideId = '30000000-0000-4000-8000-000000000668'

function journey(overrides: Record<string, unknown> = {}) {
  return {
    journeyPolicyVersion: 'mb-guided-journey-v1',
    stage: 'GUIDE_READY',
    assessmentInProgress: false,
    episodeId,
    episodeCompletedAt: '2026-10-16T03:00:00Z',
    presentationEvaluationId: '20000000-0000-4000-8000-000000000668',
    supportGuideId: guideId,
    nextAction: 'START_PLAN_PROPOSAL',
    currentSupportPlanId: null,
    entitlementStatus: 'VERIFIED',
    ...overrides,
  }
}

function guide(): SupportGuide {
  return {
    supportGuideId: guideId,
    guideVersion: 1,
    guidePolicyVersion: 'mb-support-guide-capstone-v1',
    supportEvaluationId: '40000000-0000-4000-8000-000000000668',
    generatedAt: '2026-10-16T03:00:01Z',
    guideType: 'ONE_TIME_SUPPORT_GUIDE',
    explanation: { code: 'STANDARD_POST_SCREENING_GUIDANCE', text: 'Gợi ý.' },
    safety: {
      status: 'NEGATIVE_SAFETY_SCREEN',
      reasonCode: 'PHQ9_ITEM9_NEGATIVE',
      policyVersion: 'MB-SAFETY-PHQ9-001-v1',
      guidanceCode: 'STANDARD_SAFETY_REMINDER',
      guidance: 'Hãy tìm hỗ trợ trực tiếp khi cần.',
    },
    resourceResolution: {
      status: 'EMPTY',
      policyVersion: 'content-eligibility-v1',
      resolvedAt: '2026-10-16T03:00:01Z',
    },
    resources: [],
    provenance: {
      supportEvaluationPolicyVersion: 'mb-support-routing-capstone-v2',
      assessmentResults: [],
    },
    phrasing: { source: 'CARE_APPROVED_STANDARD', status: 'STANDARD' },
  }
}

describe('SupportGuideOverview', () => {
  let ensureCalls: number
  let journeys: ReturnType<typeof journey>[]

  beforeEach(() => {
    ensureCalls = 0
    journeys = []
    mockServer.use(
      http.get('/api/care/initial-check', () =>
        HttpResponse.json({ code: 'UNAVAILABLE' }, { status: 503 }),
      ),
      http.get('/api/care/guided-journey', () =>
        HttpResponse.json(journeys.shift() ?? journey()),
      ),
      http.get('/api/care/support-guides', () =>
        HttpResponse.json({ items: [], nextCursor: null, hasMore: false }),
      ),
      http.get(`/api/care/support-guides/${guideId}`, () =>
        HttpResponse.json(guide()),
      ),
      http.post('/api/care/support-guides', () => {
        ensureCalls += 1
        return HttpResponse.json(guide())
      }),
    )
  })

  it('prepares the current Guide automatically and continues with the Care-decided action', async () => {
    journeys = [
      journey({ stage: 'GUIDE_REQUIRED', supportGuideId: null }),
      journey(),
    ]

    render(<SupportGuideOverview />)

    expect(
      await screen.findByRole('link', { name: /Tiếp tục với kế hoạch hỗ trợ/ }),
    ).toHaveAttribute('href', '/support-plan')
    expect(ensureCalls).toBe(1)
    expect(
      screen.getByRole('navigation', { name: 'Các bước sau sàng lọc' }),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'Kết quả' })).toHaveAttribute(
      'href',
      '/assessments/results/20000000-0000-4000-8000-000000000668',
    )
    expect(screen.queryByRole('button', { name: /Tạo gợi ý/ })).toBeNull()
  })

  it('reopens an existing current Guide without asking Care to prepare it again', async () => {
    render(<SupportGuideOverview />)

    expect(
      await screen.findByRole('link', { name: /Tiếp tục với kế hoạch hỗ trợ/ }),
    ).toBeVisible()
    expect(ensureCalls).toBe(0)
  })

  it('offers retry without inventing a Guide when preparation fails', async () => {
    journeys = [
      journey({ stage: 'GUIDE_REQUIRED', supportGuideId: null }),
      journey({ stage: 'GUIDE_REQUIRED', supportGuideId: null }),
      journey(),
    ]
    let fail = true
    mockServer.use(
      http.post('/api/care/support-guides', () => {
        ensureCalls += 1
        if (fail) {
          fail = false
          return HttpResponse.json(
            { code: 'SERVICE_UNAVAILABLE' },
            { status: 503 },
          )
        }
        return HttpResponse.json(guide())
      }),
    )

    render(<SupportGuideOverview />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chưa thể chuẩn bị gợi ý hỗ trợ',
    )
    expect(
      screen.queryByRole('link', { name: /Tiếp tục với kế hoạch/ }),
    ).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(
      await screen.findByRole('link', { name: /Tiếp tục với kế hoạch hỗ trợ/ }),
    ).toBeVisible()
    expect(ensureCalls).toBe(2)
  })

  it('sends a user without a completed check to the initial check instead of generating', async () => {
    journeys = [
      journey({
        stage: 'ASSESSMENT_REQUIRED',
        assessmentInProgress: true,
        episodeId: null,
        episodeCompletedAt: null,
        presentationEvaluationId: null,
        supportGuideId: null,
        nextAction: null,
        entitlementStatus: 'NOT_REQUIRED',
      }),
    ]

    render(<SupportGuideOverview />)

    expect(
      await screen.findByRole('link', { name: 'Tiếp tục kiểm tra ban đầu' }),
    ).toHaveAttribute('href', '/initial-check')
    expect(ensureCalls).toBe(0)
  })
})
