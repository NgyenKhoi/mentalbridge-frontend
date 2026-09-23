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
    completedAt: null as string | null,
    completionReason: null as
      'USER_DECISION' | 'PLAN_NO_LONGER_FITS' | 'OTHER' | null,
    supersededAt: null as string | null,
    discardedAt: null as string | null,
    disclaimerCode: 'WELLBEING_SUPPORT_NOT_TREATMENT',
    disclaimer:
      'Kế hoạch hỗ trợ sức khỏe tổng quát và không phải kế hoạch điều trị.',
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
  let occurrenceState = 'SCHEDULED'
  let occurrenceVersion = 0
  let occurrenceHelpfulness: 'HELPFUL' | null = null
  let occurrenceReflection: string | null = null
  let occurrenceSummaryReuseApproved = false
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  const occurrence = () => ({
    occurrenceId: '91000000-0000-4000-8000-000000000513',
    supportPlanId: persisted.supportPlanId,
    scheduleId: '92000000-0000-4000-8000-000000000513',
    scheduleVersion: 1,
    localDate: today,
    localTime: '08:00:00',
    timezone: 'Asia/Ho_Chi_Minh',
    scheduledAt: `${today}T01:00:00Z`,
    state: occurrenceState,
    displayState: occurrenceState,
    stateReason: null,
    version: occurrenceVersion,
    source: {
      type: 'RESOURCE',
      supportPlanVersion: 2,
      slotId: 'depression-psychoeducation',
      resourceId: persisted.slots[0].selectedResource.resourceId,
      contentVersion: persisted.slots[0].selectedResource.contentVersion,
      title: persisted.slots[0].selectedResource.title,
    },
    updatedAt: '2026-09-21T00:00:00Z',
    completedAt:
      occurrenceState === 'COMPLETED' ? '2026-09-21T02:00:00Z' : null,
    skippedAt: null,
    cancelledAt: null,
    hidden: false,
    helpfulness: occurrenceHelpfulness,
    barrierCode: null,
    reflection: occurrenceReflection,
    summaryReuseApproved: occurrenceSummaryReuseApproved,
    engagementUpdatedAt: occurrenceVersion > 0 ? '2026-09-21T02:00:00Z' : null,
    interpretationCode:
      'SELF_REPORTED_WELLBEING_ACTIVITY_NOT_TREATMENT_ADHERENCE',
  })

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
  await page.route(
    '**/api/care/support-plan-occurrences/*/engagement',
    async (route) => {
      expect(route.request().method()).toBe('PUT')
      expect(route.request().headers()['if-match']).toBe(
        `"${occurrenceVersion}"`,
      )
      expect(route.request().postDataJSON()).toEqual({
        state: 'COMPLETED',
        hidden: false,
        helpfulness: 'HELPFUL',
        barrierCode: null,
        reflection: 'Tôi muốn tiếp tục theo nhịp này.',
        summaryReuseApproved: true,
      })
      occurrenceState = 'COMPLETED'
      occurrenceHelpfulness = 'HELPFUL'
      occurrenceReflection = 'Tôi muốn tiếp tục theo nhịp này.'
      occurrenceSummaryReuseApproved = true
      occurrenceVersion += 1
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(occurrence()),
      })
    },
  )
  await page.route('**/api/care/support-plan-occurrences?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        supportPlanId: persisted.supportPlanId,
        supportPlanStatus: persisted.status,
        schedulePolicyVersion: 'support-plan-activity-schedule-v1',
        from: today,
        through: today,
        occurrences: [occurrence()],
        interpretationCode:
          'SELF_REPORTED_WELLBEING_ACTIVITY_NOT_TREATMENT_ADHERENCE',
      }),
    })
  })
  await page.route('**/api/care/support-plans/history?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], nextCursor: null, hasMore: false }),
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
    page.getByRole('button', { name: 'Bắt đầu kế hoạch' }),
  ).toBeDisabled()
  await page.getByRole('button', { name: 'Lưu lựa chọn' }).click()
  await expect(page.getByText('Đã lưu lựa chọn của bạn.')).toBeVisible()
  await page.getByRole('button', { name: 'Bắt đầu kế hoạch' }).click()

  await expect(page.getByText('Kế hoạch đang thực hiện')).toBeVisible()
  await expect(
    page
      .getByRole('region', { name: 'Nội dung kế hoạch hỗ trợ' })
      .getByRole('heading', { name: 'Lựa chọn thay thế đã duyệt' }),
  ).toBeVisible()
  await expect(page.getByText('Hoạt động của tôi')).toBeVisible()
  await expect(page.getByText('Asia/Ho_Chi_Minh')).toBeVisible()
  await page
    .locator('.support-plan-occurrence')
    .getByText('Thông tin kỹ thuật')
    .click()
  await expect(page.getByText(/Phiên bản tài nguyên 2/)).toBeVisible()
  await page.getByRole('button', { name: 'Ghi nhận đã làm' }).click()
  await page.getByLabel(/Hoạt động này hữu ích với bạn/).selectOption('HELPFUL')
  await page
    .getByLabel(/Ghi chú riêng/)
    .fill('Tôi muốn tiếp tục theo nhịp này.')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Lưu tự ghi nhận' }).click()
  await expect(page.getByText('Bạn đã ghi nhận là đã làm')).toBeVisible()
  await expect(page.getByText(/Tôi muốn tiếp tục theo nhịp này/)).toBeVisible()
  await expect(
    page.getByText(/không phải đánh giá tuân thủ điều trị/),
  ).toBeVisible()
  expect(activationCommands).toBe(1)
  expect(currentReads).toBeGreaterThanOrEqual(2)

  await page.setViewportSize({ width: 667, height: 375 })
  await page.reload()
  await expect(page.getByText('Kế hoạch đang thực hiện')).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await expect(
    page.getByRole('button', { name: 'Bắt đầu kế hoạch' }),
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
  await page.route('**/api/care/support-plans/history?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], nextCursor: null, hasMore: false }),
    })
  })

  await page.goto('/support-plan')
  await expect(page.getByText(/dành cho gói Plus và Premium/)).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Xem gợi ý hỗ trợ' }),
  ).toHaveAttribute('href', '/support-guides')
  await expect(page.locator('.support-plan-card')).toHaveCount(0)
})

test('MB-374 confirms lifecycle commands and reloads immutable completion history', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  let persisted = {
    ...plan(),
    status: 'ACTIVE',
    version: 1,
    activatedAt: '2026-09-20T04:01:00Z',
  }
  let terminalHistory: ReturnType<typeof plan>[] = []
  const commands: string[] = []

  await page.route('**/api/care/support-plans/current', async (route) => {
    if (!['ACTIVE', 'PAUSED'].includes(persisted.status)) {
      await route.fulfill({
        status: 404,
        contentType: 'application/problem+json',
        body: JSON.stringify({
          type: '/problems/support-plan-current-not-found',
          title: 'Current plan not found.',
          status: 404,
          code: 'SUPPORT_PLAN_CURRENT_NOT_FOUND',
          correlationId: '71000000-0000-4000-8000-000000000374',
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
  await page.route('**/api/care/support-plans/history?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: terminalHistory,
        nextCursor: null,
        hasMore: false,
      }),
    })
  })
  await page.route(
    new RegExp(`/api/care/support-plans/${persisted.supportPlanId}$`),
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(persisted),
      })
    },
  )
  await page.route('**/api/care/support-plans/*/status', async (route) => {
    const request = route.request()
    const body = request.postDataJSON() as {
      status: 'ACTIVE' | 'PAUSED' | 'COMPLETED'
      completionReason?: 'PLAN_NO_LONGER_FITS'
    }
    commands.push(body.status)
    expect(request.headers()['if-match']).toBe(`"${persisted.version}"`)
    persisted = {
      ...persisted,
      status: body.status,
      version: persisted.version + 1,
      updatedAt: `2026-09-21T0${persisted.version}:00:00Z`,
      completedAt: body.status === 'COMPLETED' ? '2026-09-21T04:00:00Z' : null,
      completionReason:
        body.status === 'COMPLETED' ? (body.completionReason ?? null) : null,
    }
    if (body.status === 'COMPLETED') terminalHistory = [persisted]
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(persisted),
    })
  })
  await page.route('**/api/care/support-plans', async (route) => {
    await route.fulfill({
      status: 404,
      contentType: 'application/problem+json',
      body: JSON.stringify({
        type: '/problems/support-plan-draft-not-found',
        title: 'Draft not found.',
        status: 404,
        code: 'SUPPORT_PLAN_DRAFT_NOT_FOUND',
        correlationId: '72000000-0000-4000-8000-000000000374',
      }),
    })
  })
  await page.route('**/api/care/support-plan-occurrences?*', async (route) => {
    const today = new Date().toISOString().slice(0, 10)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        supportPlanId: persisted.supportPlanId,
        supportPlanStatus: persisted.status,
        schedulePolicyVersion: 'support-plan-activity-schedule-v1',
        from: today,
        through: today,
        occurrences: [],
        interpretationCode:
          'SELF_REPORTED_WELLBEING_ACTIVITY_NOT_TREATMENT_ADHERENCE',
      }),
    })
  })

  await page.goto('/support-plan')
  await page.getByRole('button', { name: 'Tạm dừng kế hoạch' }).click()
  await expect(
    page.getByRole('dialog', { name: 'Tạm dừng kế hoạch?' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Quay lại' }).click()
  expect(commands).toEqual([])

  await page.getByRole('button', { name: 'Tạm dừng kế hoạch' }).click()
  await page.getByRole('button', { name: 'Xác nhận tạm dừng' }).click()
  await expect(
    page.getByRole('button', { name: 'Tiếp tục kế hoạch' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Tiếp tục kế hoạch' }).click()
  await page.getByRole('button', { name: 'Xác nhận tiếp tục' }).click()
  await expect(
    page.getByRole('button', { name: 'Tạm dừng kế hoạch' }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Kết thúc kế hoạch' }).click()
  await page
    .getByLabel('Lý do (không bắt buộc)')
    .selectOption('PLAN_NO_LONGER_FITS')
  await page.getByRole('button', { name: 'Xác nhận kết thúc' }).click()

  await expect(page.getByText('Đã kết thúc')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Tạm dừng kế hoạch' }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Xem chi tiết' }).click()
  await expect(page.getByText('Kế hoạch không còn phù hợp')).toBeVisible()
  expect(commands).toEqual(['PAUSED', 'ACTIVE', 'COMPLETED'])

  await page.reload()
  await expect(page.getByText('Đã kết thúc')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Kết thúc kế hoạch' }),
  ).toHaveCount(0)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
})
