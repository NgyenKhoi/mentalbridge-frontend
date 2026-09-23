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

test('MB-511 renders reload history, stale resources, synchronous safety, and AI fallback', async ({
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
  const generated = guide(
    '10000000-0000-4000-8000-000000000512',
    'AVAILABLE',
    'POSITIVE_SAFETY_SCREEN',
  )
  await page.route('**/api/care/support-guides**', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(generated),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [historical],
        nextCursor: null,
        hasMore: false,
      }),
    })
  })

  await page.goto('/support-guides')
  await expect(
    page.getByText('Synchronous safety guidance fixture.'),
  ).toBeVisible()
  await expect(page.getByText('Bạn chủ động lựa chọn')).toBeVisible()
  await expect(page.getByRole('status')).toContainText('AI')
  await expect(page.locator('.support-guide-resources li')).toHaveCount(0)

  await page.reload()
  await expect(
    page.getByText('Synchronous safety guidance fixture.'),
  ).toBeVisible()

  await page.locator('.support-guide-page-header button').click()
  await expect(page.getByText('Reviewed resource fixture')).toBeVisible()
  await expect(page.locator('.support-guide-safety.positive')).toContainText(
    'Synchronous safety guidance fixture.',
  )

  const visible = await page.locator('.support-guide-page').innerText()
  expect(visible).not.toMatch(
    /MB-511|totalScore|answers|raw answer|backend|sprint/i,
  )
})
