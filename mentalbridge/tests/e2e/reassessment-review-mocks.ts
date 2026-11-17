import { type Page } from '@playwright/test'

import {
  context as reviewContext,
  dashboard,
  job,
  makeSummary,
} from '../fixtures/reassessment-review'

const older = makeSummary({
  summaryId: '40000000-0000-4000-8000-000000000099',
  composedAt: '2026-01-10T08:00:00Z',
})

export function json(body: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) }
}

export async function installMocks(page: Page) {
  // Anything the flow does not need to assert on answers quietly.
  await page.route('**/api/care/**', (route) => route.fulfill(json({})))
  await page.route('**/api/care/profile**', (route) =>
    route.fulfill(
      json({ title: 'x', status: 404, code: 'PROFILE_NOT_FOUND' }, 404),
    ),
  )
  await page.route('**/api/care/questionnaires/**', (route) =>
    route.fulfill(json({ title: 'x', status: 404, code: 'NOT_FOUND' }, 404)),
  )
  await page.route('**/api/care/home-next-step**', (route) =>
    route.fulfill(
      json({ plan: { supportPlanId: '40000000-0000-4000-8000-000000000001' } }),
    ),
  )
  await page.route('**/api/care/reassessment-self-reports**', (route) =>
    route.fulfill(json({ title: 'x', status: 404, code: 'NOT_FOUND' }, 404)),
  )
  await page.route('**/api/care/reassessment-summaries/list**', (route) =>
    route.fulfill(
      json({ items: [makeSummary(), older], nextCursor: null, hasMore: false }),
    ),
  )
  await page.route('**/api/care/reassessment-summaries', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill(json(makeSummary(), 201))
      : route.fulfill(json(reviewContext)),
  )
  await page.route('**/api/care/screening-episodes**', (route) =>
    route.fulfill(json({ items: [], nextCursor: null, hasMore: false })),
  )
  await page.route('**/api/care/assessments/history**', (route) =>
    route.fulfill(json({ items: [], nextCursor: null, hasMore: false })),
  )
  await page.route('**/api/care/support-evaluations/history**', (route) =>
    route.fulfill(json({ items: [], nextCursor: null, hasMore: false })),
  )
  await page.route('**/api/journals/longitudinal-analysis-jobs**', (route) =>
    route.fulfill(json(job, 202)),
  )
  await page.route('**/api/analytics**', (route) =>
    route.fulfill(
      json(
        dashboard([
          ...Array(14).fill(2),
          ...Array(10).fill(4),
          null,
          null,
          5,
          4,
        ]),
      ),
    ),
  )
  await page.route('**/api/resources?**', (route) =>
    route.fulfill(
      json({
        items: [
          { id: '60000000-0000-4000-8000-000000000001', title: 'Thở chậm' },
        ],
        hasMore: false,
      }),
    ),
  )
}

/** Steps 1 to 3 of the reassessment flow with the Care calls mocked. */
export async function walkToStep3(page: Page) {
  await page.goto('/initial-check?purpose=reassessment')
  await page.getByLabel(/Tên gọi thân mật/i).fill('Minh Khôi')
  await page.getByLabel(/Năm sinh/i).fill('1998')
  await page.getByText(/Lưu thông tin & Bắt đầu bài sàng lọc đầu tiên/i).click()
  for (const [count, finish] of [
    [9, 'Lưu PHQ-9 và tiếp tục sang GAD-7 →'],
    [7, 'Nộp bài & Xem phân tích ý nghĩa kết quả →'],
  ] as const) {
    for (let i = 0; i < count; i++) {
      await page.getByText('Vài ngày', { exact: true }).click()
      await page
        .getByRole('button', {
          name: i < count - 1 ? 'Câu tiếp theo →' : finish,
        })
        .click()
    }
  }
  await page.getByText(/Chuẩn thang đo quốc tế PHQ-9/).waitFor()
}
