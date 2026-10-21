import { expect, test, type Page } from '@playwright/test'

const fixtureUrl = 'http://127.0.0.1:3201'

async function loginAdmin(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill('admin-resource-e2e@example.com')
  await page.getByLabel('Mật khẩu').fill('synthetic-e2e-password')
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/admin/)
}

test.describe('admin retention and deletion governance journey', () => {
  test.skip(
    Boolean(process.env.PLAYWRIGHT_BASE_URL) &&
      process.env.MENTALBRIDGE_MANAGED_E2E !== 'true',
    'The controlled Identity fixture is available only with the managed local server.',
  )

  test.beforeEach(async ({ request }) => {
    const response = await request.post(`${fixtureUrl}/__test/reset`)
    expect(response.status()).toBe(204)
  })

  test('navigates to retention governance and verifies audit-safe policy view with fail-closed capabilities', async ({
    page,
  }) => {
    await loginAdmin(page)
    await page.goto('/admin/retention')

    // 1. Audit-safe guarantee banner
    await expect(page.getByTestId('audit-safe-guarantee-notice')).toBeVisible()
    await expect(
      page.getByText(
        /Không hiển thị nội dung thô Nhật ký, câu trả lời đánh giá tâm lý/,
      ),
    ).toBeVisible()

    // 2. Approved policies with authoritative aggregate outcomes
    await expect(
      page.getByTestId('policy-card-MB-IDENTITY-REPORTING-001'),
    ).toBeVisible()
    await expect(
      page.getByText('Chính sách bảo lưu tệp báo cáo tổng hợp'),
    ).toBeVisible()
    await expect(page.getByText('30 ngày', { exact: true })).toBeVisible()
    await expect(page.getByText('SUCCEEDED (15 bản ghi dọn dẹp)')).toBeVisible()

    // 3. Explicitly unavailable capabilities rather than simulated
    await expect(
      page.getByTestId('policy-card-MB-CONTENT-NOTIFICATION-RETENTION-001'),
    ).toBeVisible()
    await expect(
      page.getByTestId(
        'unavailable-notice-MB-CONTENT-NOTIFICATION-RETENTION-001',
      ),
    ).toBeVisible()
    const disabledSweep = page.getByTestId(
      'sweep-disabled-MB-CONTENT-NOTIFICATION-RETENTION-001',
    )
    await expect(disabledSweep).toBeDisabled()
    await expect(disabledSweep).toHaveText('Thực thi không khả dụng')

    // 4. Trigger supported sweep and check audit-safe feedback
    const activeSweep = page.getByTestId('sweep-btn-MB-IDENTITY-REPORTING-001')
    await expect(activeSweep).toBeEnabled()
    await activeSweep.click()
    await expect(
      page.getByText(
        /Thực thi dọn dẹp thành công cho MB-IDENTITY-REPORTING-001/i,
      ),
    ).toBeVisible()
  })

  test('monitors deletion requests with minimized tombstones, bounded retries, and hold enforcement', async ({
    page,
  }) => {
    await loginAdmin(page)
    await page.goto('/admin/retention')

    // Switch to deletions tab
    await page.getByTestId('tab-deletions').click()
    await expect(page.getByTestId('deletions-table')).toBeVisible()

    // 1. Traceability with minimized tombstone identifiers (no raw email, no secrets)
    await expect(
      page.getByText(
        'tombstone:948f9e80d3bc45aa91f6044dd5afbf78e2e001e2e001e2e001e2e001e2e001e2',
      ),
    ).toBeVisible()
    await expect(page.locator('body')).not.toContainText('user-raw-password')
    await expect(page.locator('body')).not.toContainText('assessmentAnswers')

    // 2. Legal hold blocks deletion retry
    const holdBadge = page.getByTestId(
      'hold-badge-948f9e80-d3bc-45aa-91f6-044dd5afbf72',
    )
    await expect(holdBadge).toBeVisible()
    await expect(holdBadge).toContainText('LEGAL_HOLD: STATUTORY_INQUIRY')
    const retryHeld = page.getByTestId(
      'btn-retry-948f9e80-d3bc-45aa-91f6-044dd5afbf72',
    )
    await expect(retryHeld).toBeDisabled()

    // 3. Bounded retry exhaustion disables retry button
    const escalationBadge = page.getByTestId(
      'escalation-badge-948f9e80-d3bc-45aa-91f6-044dd5afbf73',
    )
    await expect(escalationBadge).toBeVisible()
    await expect(escalationBadge).toHaveText('RETRY_EXHAUSTED')
    const retryExhausted = page.getByTestId(
      'btn-retry-948f9e80-d3bc-45aa-91f6-044dd5afbf73',
    )
    await expect(retryExhausted).toBeDisabled()

    // 4. Traceable owner completion facts without cross-owner direct DB access
    await page
      .getByTestId('btn-expand-948f9e80-d3bc-45aa-91f6-044dd5afbf71')
      .click()
    const factsPanel = page.getByTestId(
      'facts-panel-948f9e80-d3bc-45aa-91f6-044dd5afbf71',
    )
    await expect(factsPanel).toBeVisible()
    await expect(factsPanel).toContainText('IDENTITY')
    await expect(factsPanel).toContainText(
      'audit:identity:account-deleted:948f9e80-d3bc-45aa-91f6-044dd5afbf71',
    )
    await expect(factsPanel).toContainText('CARE')
    await expect(factsPanel).toContainText('PENDING')
    await expect(
      page.getByTestId('btn-retry-948f9e80-d3bc-45aa-91f6-044dd5afbf71'),
    ).toBeDisabled()
    await expect(
      page.getByTestId(
        'retry-unavailable-948f9e80-d3bc-45aa-91f6-044dd5afbf71',
      ),
    ).toContainText('chưa hỗ trợ thử lại tự động')

    // 5. Apply and release hold flow
    await page
      .getByTestId('btn-apply-hold-948f9e80-d3bc-45aa-91f6-044dd5afbf71')
      .click()
    await expect(page.getByTestId('hold-modal')).toBeVisible()
    await page.getByTestId('select-hold-type').selectOption('OPERATIONAL_HOLD')
    await page.getByTestId('btn-confirm-apply-hold').click()

    // Verify hold applied
    await expect(
      page.getByTestId('hold-badge-948f9e80-d3bc-45aa-91f6-044dd5afbf71'),
    ).toContainText('OPERATIONAL_HOLD')
    // Retry should now be blocked
    await expect(
      page.getByTestId('btn-retry-948f9e80-d3bc-45aa-91f6-044dd5afbf71'),
    ).toBeDisabled()
  })
})
