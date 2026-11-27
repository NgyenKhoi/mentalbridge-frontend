import { http, HttpResponse } from 'msw'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { combinedMeaningFixture } from '@/tests/fixtures/combined-meaning'
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
    http.get('/api/care/support-evaluations/:id/combined-meaning', () =>
      HttpResponse.json({ code: 'NOT_FOUND' }, { status: 404 }),
    ),
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

    expect(await screen.findByText(/Gợi ý này được lưu ngày/)).toBeVisible()
    expect(
      screen.queryByRole('navigation', { name: 'Các bước sau sàng lọc' }),
    ).toBeNull()
  })

  it('reopens a historical Guide with the exact saved Care meaning and keeps its return context on resources', async () => {
    const resultEvaluationId = '20000000-0000-4000-8000-000000000101'
    const saved = {
      ...guide(),
      supportEvaluationId: '80000000-0000-4000-8000-000000000101',
      resourceResolution: {
        ...guide().resourceResolution,
        status: 'AVAILABLE',
      },
      resources: [
        {
          resourceId: '00000000-0000-4000-8000-000000000205',
          contentVersion: '0',
          publicationId: '00000000-0000-4000-9000-000000000205',
          domain: 'DEPRESSIVE_SYMPTOMS',
          role: 'PRIMARY',
          category: 'ARTICLE',
          title: 'Hiểu các dấu hiệu thường gặp của trầm cảm',
          summary: 'Thông tin cơ bản.',
          externalUrl: null,
        },
      ],
    } satisfies SupportGuide
    let journeyCalls = 0
    mockServer.use(
      http.get(`/api/care/support-guides/${guideId}`, () =>
        HttpResponse.json(saved),
      ),
      http.get('/api/care/guided-journey', () => {
        journeyCalls += 1
        return HttpResponse.json(journey(guideId))
      }),
      http.get(
        `/api/care/support-evaluations/${resultEvaluationId}/combined-meaning`,
        () =>
          HttpResponse.json(
            combinedMeaningFixture({ priority: 'PROFESSIONAL_SUPPORT' }),
          ),
      ),
    )

    render(
      <SupportGuideJourney
        supportGuideId={guideId}
        historical
        resultEvaluationId={resultEvaluationId}
      />,
    )

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /Dấu hiệu trầm cảm ở mức trung bình/,
      }),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: /Tìm chuyên gia phù hợp/ }),
    ).toHaveAttribute('href', '/specialists')
    expect(screen.getByRole('link', { name: /Xem bài tập/ })).toHaveAttribute(
      'href',
      `/resources/00000000-0000-4000-8000-000000000205?contentVersion=0&from=support-guide&supportGuideId=${guideId}&guideHistory=1&resultEvaluationId=${resultEvaluationId}`,
    )
    expect(journeyCalls).toBe(0)
  })

  it('ignores a meaning that belongs to a different saved pair', async () => {
    const resultEvaluationId = '20000000-0000-4000-8000-000000000101'
    serve(() => HttpResponse.json(journey(guideId)))
    mockServer.use(
      http.get(
        `/api/care/support-evaluations/${resultEvaluationId}/combined-meaning`,
        () =>
          HttpResponse.json(
            combinedMeaningFixture({ priority: 'PROFESSIONAL_SUPPORT' }),
          ),
      ),
    )

    render(
      <SupportGuideJourney
        supportGuideId={guideId}
        historical
        resultEvaluationId={resultEvaluationId}
      />,
    )

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Gợi ý hỗ trợ đã lưu cho lần sàng lọc này',
      }),
    ).toBeVisible()
    expect(
      screen.queryByRole('link', { name: /Tìm chuyên gia phù hợp/ }),
    ).toBeNull()
  })

  it('recovers the exact saved meaning when the next-step retry succeeds', async () => {
    const presentationEvaluationId = '20000000-0000-4000-8000-000000000668'
    let journeyCalls = 0
    let meaningCalls = 0
    mockServer.use(
      http.get(`/api/care/support-guides/${guideId}`, () =>
        HttpResponse.json({
          ...guide(),
          supportEvaluationId: '80000000-0000-4000-8000-000000000101',
        }),
      ),
      http.get('/api/care/guided-journey', () => {
        journeyCalls += 1
        return journeyCalls === 1
          ? HttpResponse.json({ code: 'SERVICE_UNAVAILABLE' }, { status: 503 })
          : HttpResponse.json(journey(guideId))
      }),
      http.get(
        `/api/care/support-evaluations/${presentationEvaluationId}/combined-meaning`,
        () => {
          meaningCalls += 1
          return HttpResponse.json(
            combinedMeaningFixture({
              supportEvaluationId: presentationEvaluationId,
              priority: 'PROFESSIONAL_SUPPORT',
            }),
          )
        },
      ),
    )

    render(<SupportGuideJourney supportGuideId={guideId} />)

    expect(
      await screen.findByText(/Chưa tải được bước tiếp theo/),
    ).toBeVisible()
    expect(meaningCalls).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /Dấu hiệu trầm cảm ở mức trung bình/,
      }),
    ).toBeVisible()
    expect(meaningCalls).toBe(1)
    expect(screen.queryByText(/Chưa tải được bước tiếp theo/)).toBeNull()
  })

  it('keeps the saved Guide and the focused busy retry when the next step fails again', async () => {
    let guideCalls = 0
    let holdJourney = false
    let release: () => void = () => undefined
    mockServer.use(
      http.get(`/api/care/support-guides/${guideId}`, () => {
        guideCalls += 1
        return HttpResponse.json(guide())
      }),
      http.get('/api/care/guided-journey', async () => {
        if (holdJourney) {
          await new Promise<void>((resolve) => (release = resolve))
        }
        return HttpResponse.json(
          { code: 'SERVICE_UNAVAILABLE' },
          { status: 503 },
        )
      }),
    )

    const { container } = render(
      <SupportGuideJourney supportGuideId={guideId} />,
    )
    const retry = await screen.findByRole('button', { name: 'Thử lại' })
    holdJourney = true
    retry.focus()
    fireEvent.click(retry)

    const busy = await screen.findByRole('button', { name: 'Đang thử lại…' })
    expect(busy).toHaveAttribute('aria-busy', 'true')
    expect(busy).toHaveFocus()
    release()

    expect(await screen.findByRole('button', { name: 'Thử lại' })).toHaveFocus()
    expect(guideCalls).toBe(1)
    expect(container.querySelector('.support-guide-error')).toBeNull()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it.each([
    ['succeeds', 200],
    ['fails', 503],
  ] as const)(
    'keeps the shown meaning when the plan re-check %s',
    async (_label, recheckStatus) => {
      const presentationEvaluationId = '20000000-0000-4000-8000-000000000668'
      let journeyCalls = 0
      let meaningCalls = 0
      mockServer.use(
        http.get(`/api/care/support-guides/${guideId}`, () =>
          HttpResponse.json({
            ...guide(),
            supportEvaluationId: '80000000-0000-4000-8000-000000000101',
          }),
        ),
        http.get('/api/care/guided-journey', () => {
          journeyCalls += 1
          return journeyCalls > 1 && recheckStatus === 503
            ? HttpResponse.json(
                { code: 'SERVICE_UNAVAILABLE' },
                { status: 503 },
              )
            : HttpResponse.json({
                ...journey(guideId),
                entitlementStatus: 'UNAVAILABLE',
              })
        }),
        http.get(
          `/api/care/support-evaluations/${presentationEvaluationId}/combined-meaning`,
          () => {
            meaningCalls += 1
            return meaningCalls === 1
              ? HttpResponse.json(
                  combinedMeaningFixture({
                    supportEvaluationId: presentationEvaluationId,
                    priority: 'PROFESSIONAL_SUPPORT',
                  }),
                )
              : HttpResponse.json({ code: 'UNAVAILABLE' }, { status: 503 })
          },
        ),
      )

      render(<SupportGuideJourney supportGuideId={guideId} />)
      const heading = await screen.findByRole('heading', {
        level: 1,
        name: /Dấu hiệu trầm cảm ở mức trung bình/,
      })
      fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra lại' }))

      if (recheckStatus === 503) {
        expect(
          await screen.findByText(/Chưa tải được bước tiếp theo/),
        ).toBeVisible()
      } else {
        await waitFor(() => expect(journeyCalls).toBe(2))
      }
      expect(heading).toBeVisible()
      expect(meaningCalls).toBe(1)
    },
  )

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
