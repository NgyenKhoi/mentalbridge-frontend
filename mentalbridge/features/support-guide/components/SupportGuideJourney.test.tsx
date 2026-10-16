import { http, HttpResponse } from 'msw'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { mockServer } from '@/tests/mocks/server'
import type { SupportGuide } from '../api/support-guide-contract'
import SupportGuideJourney from './SupportGuideJourney'

const guideId = '30000000-0000-4000-8000-000000000668'

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

function journey(supportGuideId: string) {
  return {
    journeyPolicyVersion: 'mb-guided-journey-v1',
    stage: 'GUIDE_READY',
    assessmentInProgress: false,
    episodeId: '10000000-0000-4000-8000-000000000668',
    episodeCompletedAt: '2026-10-16T03:00:00Z',
    presentationEvaluationId: '20000000-0000-4000-8000-000000000668',
    supportGuideId,
    nextAction: 'FIND_SPECIALIST',
    currentSupportPlanId: null,
    entitlementStatus: 'NOT_REQUIRED',
  }
}

function serve(journeyResponse: () => Response) {
  mockServer.use(
    http.get(`/api/care/support-guides/${guideId}`, () =>
      HttpResponse.json(guide()),
    ),
    http.get('/api/care/guided-journey', journeyResponse),
  )
}

describe('SupportGuideJourney', () => {
  it('continues the current Guide with the Care-decided action and the step navigation', async () => {
    serve(() => HttpResponse.json(journey(guideId)))

    render(<SupportGuideJourney supportGuideId={guideId} />)

    expect(
      await screen.findByRole('link', { name: /Tìm chuyên gia phù hợp/ }),
    ).toHaveAttribute(
      'href',
      `/specialists?from=support-guide&supportGuideId=${guideId}`,
    )
    expect(
      screen.getByRole('navigation', { name: 'Các bước sau sàng lọc' }),
    ).toBeVisible()
  })

  it('opens a Guide that is no longer current as a read-only saved record', async () => {
    serve(() =>
      HttpResponse.json(journey('90000000-0000-4000-8000-000000000668')),
    )

    render(<SupportGuideJourney supportGuideId={guideId} />)

    expect(
      (await screen.findAllByText('Bản ghi lịch sử · Chỉ đọc')).length,
    ).toBeGreaterThan(0)
    expect(
      screen.queryByRole('navigation', { name: 'Các bước sau sàng lọc' }),
    ).toBeNull()
  })

  it('never infers a primary action while the next step cannot be loaded', async () => {
    serve(() =>
      HttpResponse.json({ code: 'SERVICE_UNAVAILABLE' }, { status: 503 }),
    )

    const { container } = render(
      <SupportGuideJourney supportGuideId={guideId} />,
    )

    expect(
      await screen.findByText(/Chưa tải được bước tiếp theo/),
    ).toBeVisible()
    expect(container.querySelectorAll('.support-guide-primary')).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeVisible()
  })
})
