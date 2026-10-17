import { expect } from '@playwright/test'

import { test } from './test-fixtures'

const accessCookie = 'mentalbridge_access'

function guide(
  id: string,
  resourceStatus: 'AVAILABLE' | 'STALE',
  safetyStatus: 'NEGATIVE_SAFETY_SCREEN' | 'POSITIVE_SAFETY_SCREEN',
) {
  return {
    supportGuideId: id,
    guideVersion: 1,
    guidePolicyVersion: 'mb-support-guide-capstone-v1',
    supportEvaluationId: '20000000-0000-4000-8000-000000000511',
    generatedAt: '2026-09-17T06:00:00Z',
    guideType: 'ONE_TIME_SUPPORT_GUIDE',
    explanation: {
      code: 'STANDARD_POST_SCREENING_GUIDANCE',
      text: 'Approved standard guidance; this is not a diagnosis or treatment plan.',
    },
    safety: {
      status: safetyStatus,
      reasonCode:
        safetyStatus === 'POSITIVE_SAFETY_SCREEN'
          ? 'PHQ9_ITEM9_POSITIVE'
          : 'PHQ9_ITEM9_NEGATIVE',
      policyVersion: 'MB-SAFETY-PHQ9-001-v1',
      guidanceCode:
        safetyStatus === 'POSITIVE_SAFETY_SCREEN'
          ? 'REVIEW_SAFETY_GUIDANCE'
          : 'STANDARD_SAFETY_REMINDER',
      guidance: 'Synchronous safety guidance fixture.',
    },
    resourceResolution: {
      status: resourceStatus,
      policyVersion: 'content-eligibility-v1',
      resolvedAt: '2026-09-17T06:00:00Z',
    },
    resources:
      resourceStatus === 'AVAILABLE'
        ? [
            {
              resourceId: '30000000-0000-4000-8000-000000000511',
              contentVersion: '0',
              publicationId: '40000000-0000-4000-8000-000000000511',
              domain: 'DEPRESSIVE_SYMPTOMS',
              role: 'PRIMARY',
              category: 'ARTICLE',
              title: 'Reviewed resource fixture',
              summary: 'Approved immutable resource snapshot.',
              externalUrl: null,
            },
          ]
        : [],
    provenance: {
      supportEvaluationPolicyVersion: 'mb-support-routing-capstone-v2',
      assessmentResults: [
        {
          assessmentId: '50000000-0000-4000-8000-000000000511',
          instrument: 'PHQ9',
          questionnaireVersion: 'phq9-v2',
          scoringVersion: 'phq9-standard-bands-v1',
          screeningLevel: 'MILD',
        },
        {
          assessmentId: '60000000-0000-4000-8000-000000000511',
          instrument: 'GAD7',
          questionnaireVersion: 'gad7-v1',
          scoringVersion: 'gad7-standard-bands-v1',
          screeningLevel: 'MINIMAL',
        },
      ],
    },
    phrasing: {
      source: 'CARE_APPROVED_STANDARD',
      status: 'AI_UNAVAILABLE_FALLBACK',
    },
  }
}

function journey(
  stage: 'GUIDE_REQUIRED' | 'GUIDE_READY',
  guideId: string | null,
) {
  return {
    journeyPolicyVersion: 'mb-guided-journey-v1',
    stage,
    assessmentInProgress: false,
    episodeId: '70000000-0000-4000-8000-000000000511',
    episodeCompletedAt: '2026-09-17T05:59:00Z',
    presentationEvaluationId: '80000000-0000-4000-8000-000000000511',
    supportGuideId: guideId,
    nextAction: 'REVIEW_SAFETY_SUPPORT',
    currentSupportPlanId: null,
    entitlementStatus: 'NOT_REQUIRED',
  }
}

test('MB-511/MB-668 prepares the current Guide once, keeps safety first and reloads the saved snapshot', async ({
  context,
  page,
}) => {
  await context.addCookies([
    {
      name: accessCookie,
      value: 'synthetic-mb273-e2e-access',
      url: 'http://127.0.0.1:3100',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])

  const historical = guide(
    '10000000-0000-4000-8000-000000000511',
    'STALE',
    'NEGATIVE_SAFETY_SCREEN',
  )
  const prepared = guide(
    '10000000-0000-4000-8000-000000000512',
    'AVAILABLE',
    'POSITIVE_SAFETY_SCREEN',
  )
  let ensureCalls = 0
  await page.route('**/api/care/guided-journey', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        ensureCalls === 0
          ? journey('GUIDE_REQUIRED', null)
          : journey('GUIDE_READY', prepared.supportGuideId),
      ),
    }),
  )
  await page.route('**/api/care/support-guides**', async (route) => {
    if (route.request().method() === 'POST') {
      ensureCalls += 1
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(prepared),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: ensureCalls === 0 ? [historical] : [prepared, historical],
        nextCursor: null,
        hasMore: false,
      }),
    })
  })

  await page.goto('/support-guides')
  await expect(
    page.getByRole('heading', {
      name: 'Xem hướng dẫn an toàn và tìm hỗ trợ trực tiếp',
    }),
  ).toBeVisible()
  const savedResources = page.getByText('Bài tập đã lưu cùng gợi ý này')
  await expect(page.getByText('Reviewed resource fixture')).toBeHidden()
  await savedResources.click()
  await expect(page.getByText('Reviewed resource fixture')).toBeVisible()
  await expect(
    page.getByRole('navigation', { name: 'Các bước sau sàng lọc' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: /Tạo gợi ý/ })).toHaveCount(0)
  expect(ensureCalls).toBe(1)

  await page.reload()
  await savedResources.click()
  await expect(page.getByText('Reviewed resource fixture')).toBeVisible()
  expect(ensureCalls).toBe(1)

  const visible = await page.locator('main').innerText()
  expect(visible).not.toMatch(
    /MB-511|totalScore|answers|raw answer|backend|sprint/i,
  )
})
