import { expect } from '@playwright/test'

import { test } from './test-fixtures'

const accessCookie = 'mentalbridge_access'

function plan() {
  return {
    supportPlanId: '10000000-0000-4000-8000-000000000372',
    status: 'DRAFT',
    version: 0,
    source: {
      supportEvaluationId: '20000000-0000-4000-8000-000000000372',
      evaluationVersion: 2,
      evaluationPolicyVersion: 'mb-support-routing-capstone-v2',
      evaluatedAt: '2026-09-19T04:00:00Z',
      selectionPolicyVersion: 'mb-support-plan-selection-v1',
      resourceEligibilityPolicyVersion: 'content-eligibility-v1',
      resourcesResolvedAt: '2026-09-19T04:01:00Z',
    },
    entitlement: {
      packageCode: 'PLUS',
      source: 'DEMO',
      policyVersion: 'service-entitlement-v1',
      version: 1,
      decidedAt: '2026-09-19T03:00:00Z',
    },
    rationale: {
      code: 'DOMAIN_AWARE_WELLBEING_SUPPORT',
      text: 'Đề xuất sức khỏe tổng quát theo từng miền sàng lọc.',
    },
    safety: {
      status: 'POSITIVE_SAFETY_SCREEN',
      reasonCode: 'PHQ9_ITEM9_POSITIVE',
      policyVersion: 'MB-SAFETY-PHQ9-001-v1',
      guidanceCode: 'REVIEW_SAFETY_GUIDANCE',
      guidance: 'Hướng dẫn an toàn đồng bộ luôn khả dụng.',
    },
    templateFamilies: [
      {
        family: 'DEPRESSIVE_SELF_GUIDED',
        templateVersion: 1,
        targetDomain: 'DEPRESSIVE_SYMPTOMS',
      },
      {
        family: 'ANXIETY_MAINTENANCE',
        templateVersion: 1,
        targetDomain: 'ANXIETY_SYMPTOMS',
      },
    ],
    slots: [
      {
        slotId: 'depression-psychoeducation',
        kind: 'CORE',
        targetDomain: 'DEPRESSIVE_SYMPTOMS',
        purposeCode: 'DEPRESSION_PSYCHOEDUCATION',
        selectedResource: {
          resourceId: '30000000-0000-4000-8000-000000000372',
          contentVersion: '0',
          publicationId: '40000000-0000-4000-8000-000000000372',
          role: 'PRIMARY',
          category: 'ARTICLE',
          title: 'Tài nguyên chính đã duyệt',
          summary: 'Bản chụp nội dung bất biến.',
          externalUrl: null,
        },
        allowedAlternatives: [
          {
            resourceId: '50000000-0000-4000-8000-000000000372',
            contentVersion: '0',
            publicationId: '60000000-0000-4000-8000-000000000372',
            role: 'PRIMARY',
            category: 'VIDEO',
            title: 'Lựa chọn thay thế đã duyệt',
            summary: 'Một lựa chọn nằm trong cùng slot.',
            externalUrl: null,
          },
        ],
      },
    ],
    selectedResourceCount: 1,
    createdAt: '2026-09-19T04:02:00Z',
    updatedAt: '2026-09-19T04:02:00Z',
    disclaimerCode: 'WELLBEING_SUPPORT_NOT_TREATMENT',
    disclaimer:
      'SupportPlan hỗ trợ sức khỏe tổng quát và không phải kế hoạch điều trị.',
  }
}

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    {
      name: accessCookie,
      value: 'synthetic-mb273-e2e-access',
      url: 'http://127.0.0.1:3100',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
})

test('MB-372 reloads the same draft with safety, alternatives, and provenance', async ({
  page,
}) => {
  const fixture = plan()
  let reads = 0
  await page.route('**/api/care/support-plans', async (route) => {
    reads += 1
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fixture),
    })
  })

  await page.goto('/support-plan')
  await expect(page.getByText('Tài nguyên chính đã duyệt')).toBeVisible()
  await expect(
    page.getByText('Hướng dẫn an toàn đồng bộ luôn khả dụng.'),
  ).toBeVisible()
  await expect(page.getByText('Chưa kích hoạt', { exact: true })).toBeVisible()
  await expect(page.getByText('Bạn vẫn là người xác nhận')).toBeVisible()

  await page.getByText('1 lựa chọn phù hợp khác').click()
  await expect(page.getByText('Lựa chọn thay thế đã duyệt')).toBeVisible()
  await page.getByText('Nguồn và phiên bản quyết định').click()
  await expect(page.getByText('mb-support-plan-selection-v1')).toBeVisible()

  await page.reload()
  await expect(page.getByText('Tài nguyên chính đã duyệt')).toBeVisible()
  expect(reads).toBeGreaterThanOrEqual(2)
  expect(await page.locator('.support-plan-page').innerText()).not.toMatch(
    /totalScore|raw answer|journal|activate|diagnosis/i,
  )
})

test('MB-372 presents the stable Free entitlement path without a plan', async ({
  page,
}) => {
  await page.route('**/api/care/support-plans', async (route) => {
    await route.fulfill({
      status: 403,
      contentType: 'application/problem+json',
      body: JSON.stringify({
        type: '/problems/support-plan-entitlement-required',
        title: 'Paid entitlement required.',
        status: 403,
        code: 'SUPPORT_PLAN_ENTITLEMENT_REQUIRED',
        correlationId: '70000000-0000-4000-8000-000000000372',
      }),
    })
  })

  await page.goto('/support-plan')
  await expect(page.getByText(/dành cho gói Plus và Premium/)).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Mở Hướng dẫn hỗ trợ' }),
  ).toHaveAttribute('href', '/support-guides')
  await expect(page.locator('.support-plan-card')).toHaveCount(0)
})
