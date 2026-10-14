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

test('MB-643 keeps professional support primary and reflects an explicitly requested appointment', async ({
  page,
}) => {
  const current = {
    ...plan(),
    status: 'ACTIVE',
    version: 2,
    activatedAt: '2026-10-11T08:00:00Z',
    templateFamilies: [
      {
        family: 'DEPRESSIVE_PROFESSIONAL_ADJUNCT',
        templateVersion: 1,
        targetDomain: 'DEPRESSIVE_SYMPTOMS',
      },
    ],
    slots: plan().slots.map((slot) => ({
      ...slot,
      selectedResource: { ...slot.selectedResource, role: 'ADJUNCT' },
    })),
  }
  const actionId = '20000000-0000-4000-8000-000000000643'
  const specialistId = '9e3a8903-3d31-48d0-bf1a-4d81bbcef4b8'
  const slotId = '43b7dbb4-021e-4c75-ae48-bfa7126c7256'
  const specialist = {
    specialistAccountId: specialistId,
    displayName: 'Chuyên gia An',
    bio: 'Đồng hành trực tuyến bằng phương pháp hỗ trợ phi lâm sàng.',
    supportAreas: ['DEPRESSIVE_SYMPTOMS'],
    languages: ['vi'],
    yearsOfExperience: 6,
    timezone: 'Asia/Ho_Chi_Minh',
    ratingAggregate: null,
    explanation: {
      compatibility: 'MATCHED',
      languageMatched: true,
      hasSelectableSlot: true,
      earliestSelectableStartAt: '2099-01-02T02:00:00Z',
      timezoneMatch: 'EXACT',
      timezoneOffsetDistanceMinutes: 0,
      ratingTieBreakerApplied: false,
      codes: ['SCREENED_SUPPORT_AREA_MATCH', 'SELECTABLE_SLOT_AVAILABLE'],
    },
    selectableSlots: [
      {
        id: slotId,
        specialistAccountId: specialistId,
        startAt: '2099-01-02T02:00:00Z',
        endAt: '2099-01-02T03:00:00Z',
        timezone: 'Asia/Ho_Chi_Minh',
        modality: 'IN_APP_CHAT',
        version: 2,
      },
    ],
  }
  let bookingCommands = 0
  let appointment: Record<string, unknown> | null = null

  await page.route('**/api/care/support-plans/current', (route) =>
    route.fulfill({ status: 200, json: current }),
  )
  await page.route('**/api/care/support-plans', (route) =>
    route.fulfill({
      status: 404,
      contentType: 'application/problem+json',
      body: JSON.stringify({
        type: '/problems/support-plan-draft-not-found',
        title: 'Draft not found.',
        status: 404,
        code: 'SUPPORT_PLAN_DRAFT_NOT_FOUND',
      }),
    }),
  )
  await page.route('**/api/care/support-plans/history?*', (route) =>
    route.fulfill({
      status: 200,
      json: { items: [], nextCursor: null, hasMore: false },
    }),
  )
  await page.route('**/api/care/support-plan-occurrences?*', (route) =>
    route.fulfill({
      status: 200,
      json: {
        supportPlanId: current.supportPlanId,
        supportPlanStatus: current.status,
        schedulePolicyVersion: 'support-plan-activity-schedule-v1',
        from: '2026-10-04',
        through: '2026-10-25',
        occurrences: [],
        interpretationCode:
          'SELF_REPORTED_WELLBEING_ACTIVITY_NOT_TREATMENT_ADHERENCE',
      },
    }),
  )
  await page.route(
    `**/api/care/support-plans/${current.supportPlanId}/actions`,
    (route) =>
      route.fulfill({
        status: 200,
        json: {
          supportPlanId: current.supportPlanId,
          modelVersion: 3,
          planPolicyVersion: current.source.selectionPolicyVersion,
          representationMode: 'V2_RESOURCE_ADAPTER',
          status: 'ACTIVE',
          version: 2,
          safety: current.safety,
          focuses: [
            {
              focusId: 'professional-support',
              title: 'Hỗ trợ chuyên môn',
              rationale: 'Kết nối với chuyên gia là hướng hỗ trợ chính.',
              ordinal: 1,
              actions: [
                {
                  actionId,
                  actionType: 'PROFESSIONAL_SUPPORT',
                  actionVersion: 0,
                  representationMode: 'V2_RESOURCE_ADAPTER',
                  status: 'ACTIVE',
                  pathRole: 'PRIMARY',
                  purposeCode: 'CONNECT_WITH_PROFESSIONAL_SUPPORT',
                  rationale: 'Kết nối với chuyên gia là hướng hỗ trợ chính.',
                  ordinal: 1,
                  source: {
                    ownerDomain: 'CONSULTATION',
                    sourceKind: 'PROFESSIONAL_SUPPORT_PATHWAY',
                    sourceId: 'professional-support-pathway',
                    sourceRevision: null,
                    sourcePolicyVersion: current.source.evaluationPolicyVersion,
                    publicationId: null,
                    eligibilityPolicyVersion: null,
                    verifiedAt: current.source.evaluatedAt,
                  },
                  provenance: {
                    category: 'SYSTEM_POLICY',
                    referenceId: current.source.supportEvaluationId,
                    referenceVersion: String(current.source.evaluationVersion),
                    acceptedAt: current.createdAt,
                  },
                  presentation: {
                    title: 'Kết nối với chuyên gia',
                    summary: 'Hỗ trợ chuyên môn là hướng hỗ trợ chính.',
                    instructions: null,
                    externalUrl: null,
                  },
                  schedules: [],
                  createdAt: current.createdAt,
                  updatedAt: current.updatedAt,
                  activatedAt: current.activatedAt,
                  endedAt: null,
                },
              ],
            },
          ],
          createdAt: current.createdAt,
          updatedAt: current.updatedAt,
          activatedAt: current.activatedAt,
          completedAt: current.completedAt,
          completionReason: current.completionReason,
          supersededAt: current.supersededAt,
          discardedAt: current.discardedAt,
          disclaimerCode: current.disclaimerCode,
          disclaimer: current.disclaimer,
        },
      }),
  )
  await page.route('**/api/consultation/appointments**', async (route) => {
    if (route.request().method() === 'POST') {
      bookingCommands += 1
      expect(route.request().postDataJSON()).toMatchObject({
        slotId,
        modality: 'IN_APP_CHAT',
        originatingPlanActionId: actionId,
      })
      appointment = {
        id: '30000000-0000-4000-8000-000000000643',
        originatingPlanActionId: actionId,
        requestedAt: '2026-10-11T08:30:00Z',
        status: 'REQUESTED',
      }
      await route.fulfill({ status: 201, json: appointment })
      return
    }
    expect(
      new URL(route.request().url()).searchParams.get(
        'originatingPlanActionId',
      ),
    ).toBe(actionId)
    await route.fulfill({
      status: 200,
      json: {
        items: appointment ? [appointment] : [],
        count: appointment ? 1 : 0,
      },
    })
  })
  await page.route('**/api/consultation/specialists**', (route) => {
    const detail = new URL(route.request().url()).pathname.endsWith(
      `/${specialistId}`,
    )
    return route.fulfill({
      status: 200,
      json: detail
        ? specialist
        : {
            items: [specialist],
            count: 1,
            nextCursor: null,
            rankingPolicyVersion: 'specialist-discovery-v2',
            generatedAt: '2099-01-01T00:00:00Z',
            contextState: 'APPLIED',
            packageCode: 'PLUS',
            bookingHandoff: 'BOOKING_POLICY_CHECK_REQUIRED',
            videoEnabled: false,
          },
    })
  })

  await page.goto('/support-plan')
  await page.getByRole('tab', { name: 'Kế hoạch' }).click()
  await expect(
    page.getByText('Hướng hỗ trợ chính', { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText(/không tự đặt lịch hoặc chia sẻ dữ liệu/),
  ).toBeVisible()
  expect(bookingCommands).toBe(0)

  await page.getByRole('link', { name: 'Xem chuyên gia và lịch trống' }).click()
  await expect(page).toHaveURL(new RegExp(`planActionId=${actionId}`))
  await page.getByRole('button', { name: 'Xem hồ sơ và khung giờ' }).click()
  await page
    .getByRole('group', { name: 'Chọn khung giờ 60 phút' })
    .locator('label')
    .click()
  await page.getByRole('button', { name: 'Gửi yêu cầu đặt lịch' }).click()
  await expect(page.getByText('Đã gửi yêu cầu đặt lịch')).toBeVisible()
  expect(bookingCommands).toBe(1)

  await page.goBack()
  await page.getByRole('tab', { name: 'Kế hoạch' }).click()
  await expect(
    page.getByText(/Yêu cầu đặt lịch đang chờ chuyên gia xác nhận/),
  ).toBeVisible()
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
    if (route.request().method() === 'GET' && persisted.status === 'ACTIVE') {
      await route.fulfill({
        status: 404,
        contentType: 'application/problem+json',
        body: JSON.stringify({
          type: '/problems/support-plan-draft-not-found',
          title: 'Draft not found.',
          status: 404,
          code: 'SUPPORT_PLAN_DRAFT_NOT_FOUND',
          correlationId: '72000000-0000-4000-8000-000000000372',
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
  const companion = page.getByRole('complementary', {
    name: 'Bạn đồng hành trong kế hoạch hỗ trợ',
  })
  await expect(companion).toBeVisible()
  expect(
    await page.evaluate(() => {
      const shell = document.querySelector('.support-plan-companion')
      const content = document.querySelector('.mb-support-companion-content')
      return Boolean(
        shell &&
        content &&
        shell.compareDocumentPosition(content) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      )
    }),
  ).toBe(true)
  const companionControls = companion.getByRole('button')
  expect(await companionControls.count()).toBe(3)
  expect(
    await companionControls.evaluateAll((buttons) =>
      buttons.every((button) => {
        const rect = button.getBoundingClientRect()
        return rect.width >= 44 && rect.height >= 44
      }),
    ),
  ).toBe(true)
  await companion.getByRole('button', { name: 'Thu gọn bạn đồng hành' }).click()
  await expect(
    companion.getByRole('button', { name: 'Mở rộng bạn đồng hành' }),
  ).toHaveAttribute('aria-expanded', 'false')
  expect(activationCommands).toBe(0)
  await companion.getByRole('button', { name: 'Mở rộng bạn đồng hành' }).click()
  const typography = await page.evaluate(() => ({
    body: getComputedStyle(
      document.querySelector<HTMLElement>('.support-plan-page')!,
    ).fontFamily,
    heading: getComputedStyle(
      document.querySelector<HTMLElement>('.support-plan-page h1')!,
    ).fontFamily,
  }))
  expect(typography.body).toContain('Be Vietnam Pro')
  expect(typography.heading).toContain('Fraunces')
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: 'docs/evidence/mb-648-companion-mobile.png',
    fullPage: true,
    animations: 'disabled',
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(companion).toHaveAttribute('data-motion', 'reduced')
  expect(
    await companion.evaluate(
      (shell) =>
        Number.parseFloat(getComputedStyle(shell).transitionDuration) <=
        0.00001,
    ),
  ).toBe(true)
  await page.screenshot({
    path: 'docs/evidence/mb-648-companion-reduced-motion.png',
    fullPage: true,
    animations: 'disabled',
  })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setViewportSize({ width: 1280, height: 900 })
  await expect(companion).toBeVisible()
  expect(
    await companion
      .locator('.support-plan-companion-title')
      .evaluate((title) => title.scrollWidth <= title.clientWidth),
  ).toBe(true)
  await companion.getByRole('button', { name: 'Thu gọn bạn đồng hành' }).click()
  await expect(companion.locator('.support-plan-companion-mark')).toBeVisible()
  await companion.getByRole('button', { name: 'Mở rộng bạn đồng hành' }).click()
  await page.screenshot({
    path: 'docs/evidence/mb-648-companion-desktop.png',
    fullPage: true,
    animations: 'disabled',
  })
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

  await expect(page.getByRole('tab', { name: 'Hôm nay' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.getByText('Hoạt động của tôi')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: /Hoạt động hôm nay/ }),
  ).toBeVisible()

  await page.getByRole('tab', { name: 'Kế hoạch' }).click()
  await expect(page.getByText('Kế hoạch đang thực hiện')).toBeVisible()
  await expect(
    page
      .getByRole('region', { name: 'Nội dung kế hoạch hỗ trợ' })
      .getByRole('heading', { name: 'Lựa chọn thay thế đã duyệt' }),
  ).toBeVisible()
  await page.getByRole('tab', { name: 'Hôm nay' }).click()
  await page.getByText('Chi tiết hoạt động').click()
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
  await expect(page.getByRole('tab', { name: 'Hôm nay' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
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
  await page.getByLabel('Lý do (không bắt buộc)').click()
  await page.getByRole('option', { name: 'Kế hoạch không còn phù hợp' }).click()
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
