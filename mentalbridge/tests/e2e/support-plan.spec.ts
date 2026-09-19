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
    ],
    slots: [
      {
        slotId: 'depression-psychoeducation',
        kind: 'CORE',
        targetDomain: 'DEPRESSIVE_SYMPTOMS',
        purposeCode: 'DEPRESSION_PSYCHOEDUCATION',
        selectedResource: {
          resourceId: '30000000-0000-4000-8000-000000000372',
          contentVersion: '4',
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
            contentVersion: '2',
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
    activatedAt: null as string | null,
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

test('MB-373 saves an admitted alternative and reloads the activated current plan', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 })
  const draft = plan()
  let persisted = draft
  let currentReads = 0
  let activationCommands = 0

  await page.route('**/api/care/support-plans/current', async (route) => {
    currentReads += 1
    if (persisted.status !== 'ACTIVE') {
      await route.fulfill({
        status: 404,
        contentType: 'application/problem+json',
        body: JSON.stringify({
          type: '/problems/support-plan-current-not-found',
          title: 'Current plan not found.',
          status: 404,
          code: 'SUPPORT_PLAN_CURRENT_NOT_FOUND',
          correlationId: '71000000-0000-4000-8000-000000000372',
        }),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(persisted),
    })
  })
  await page.route('**/api/care/support-plans', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(persisted),
    })
  })
  await page.route('**/api/care/support-plans/*/choices', async (route) => {
    expect(route.request().method()).toBe('PUT')
    expect(route.request().headers()['if-match']).toBe('"0"')
    expect(route.request().headers()['idempotency-key']).toBeTruthy()
    expect(route.request().postDataJSON()).toEqual({
      slotSelections: [
        {
          slotId: 'depression-psychoeducation',
          resourceId: '50000000-0000-4000-8000-000000000372',
          contentVersion: '2',
        },
      ],
    })
    persisted = {
      ...persisted,
      version: 1,
      updatedAt: '2026-09-20T04:00:00Z',
      slots: [
        {
          ...persisted.slots[0],
          selectedResource: persisted.slots[0].allowedAlternatives[0],
          allowedAlternatives: [persisted.slots[0].selectedResource],
        },
      ],
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(persisted),
    })
  })
  await page.route('**/api/care/support-plans/*/activate', async (route) => {
    activationCommands += 1
    expect(route.request().method()).toBe('POST')
    expect(route.request().headers()['if-match']).toBe('"1"')
    expect(route.request().headers()['idempotency-key']).toBeTruthy()
    persisted = {
      ...persisted,
      status: 'ACTIVE',
      version: 2,
      updatedAt: '2026-09-20T04:01:00Z',
      activatedAt: '2026-09-20T04:01:00Z',
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(persisted),
    })
  })

  await page.goto('/support-plan')
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await expect(
    page.getByText('Hướng dẫn an toàn đồng bộ luôn khả dụng.'),
  ).toBeVisible()
  await page.getByRole('radio', { name: /Lựa chọn thay thế đã duyệt/ }).click()
  await expect(
    page.getByRole('button', { name: 'Kích hoạt SupportPlan' }),
  ).toBeDisabled()
  await page.getByRole('button', { name: 'Lưu lựa chọn' }).click()
  await expect(
    page.getByText('Đã lưu lựa chọn đã được Care kiểm tra.'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Kích hoạt SupportPlan' }).click()

  await expect(page.getByText('SupportPlan đang hoạt động')).toBeVisible()
  await expect(page.getByText('Lựa chọn thay thế đã duyệt')).toBeVisible()
  expect(activationCommands).toBe(1)
  expect(currentReads).toBeGreaterThanOrEqual(2)

  await page.setViewportSize({ width: 667, height: 375 })
  await page.reload()
  await expect(page.getByText('SupportPlan đang hoạt động')).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await expect(
    page.getByRole('button', { name: 'Kích hoạt SupportPlan' }),
  ).toHaveCount(0)
})

test('MB-373 presents the stable Free entitlement path without a plan', async ({
  page,
}) => {
  await page.route('**/api/care/support-plans/current', async (route) => {
    await route.fulfill({
      status: 404,
      contentType: 'application/problem+json',
      body: JSON.stringify({
        type: '/problems/support-plan-current-not-found',
        title: 'Current plan not found.',
        status: 404,
        code: 'SUPPORT_PLAN_CURRENT_NOT_FOUND',
        correlationId: '71000000-0000-4000-8000-000000000372',
      }),
    })
  })
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
