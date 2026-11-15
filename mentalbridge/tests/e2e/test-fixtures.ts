import { test as base, type Page } from '@playwright/test'
import { onboardingStorageKey } from '../../features/onboarding/tour-storage'

const correlationIdPattern = /^[\x20-\x7E]{1,128}$/

/**
 * Marks the onboarding tours as completed. The `page` fixture does it for
 * every test; a page from `browser.newContext()` (touch specs) must call it, or
 * the tour's modal popover opens and Mầm leaves (an open dialog is "away").
 */
export async function seedOnboardingSeen(page: Page) {
  await page.addInitScript(
    (keys) => {
      for (const key of keys) window.localStorage.setItem(key, 'completed')
    },
    [
      ...[1, 4, 5, 7].map((suffix) =>
        onboardingStorageKey(
          `10000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`,
        ),
      ),
      onboardingStorageKey(
        '10000000-0000-4000-8000-000000000003',
        'specialist',
      ),
    ],
  )
}

export const test = base.extend<{
  correlationEvidence: void
  onboardingSeen: boolean
  onboardingState: void
  mamTipSeen: boolean
  mamTipState: void
}>({
  onboardingSeen: [true, { option: true }],
  // MB-814: the one-time Mầm tip would appear in every dock journey; only the
  // tip specs turn it back on (`test.use({ mamTipSeen: false })`).
  mamTipSeen: [true, { option: true }],
  mamTipState: [
    async ({ page, mamTipSeen }, use) => {
      if (mamTipSeen)
        await page.addInitScript(() =>
          window.localStorage.setItem('mentalbridge_mam_tip_seen', 'true'),
        )
      await use()
    },
    { auto: true },
  ],
  onboardingState: [
    async ({ page, onboardingSeen }, use) => {
      if (onboardingSeen) await seedOnboardingSeen(page)
      await use()
    },
    { auto: true },
  ],
  correlationEvidence: [
    async ({ page }, use, testInfo) => {
      const correlationIds = new Set<string>()
      const onResponse = (response: {
        headers: () => Record<string, string>
      }) => {
        const correlationId = response.headers()['x-correlation-id']
        if (correlationId && correlationIdPattern.test(correlationId)) {
          correlationIds.add(correlationId)
        }
      }

      page.on('response', onResponse)
      await use()
      page.off('response', onResponse)

      if (
        testInfo.status !== testInfo.expectedStatus &&
        correlationIds.size > 0
      ) {
        await testInfo.attach('correlation-evidence.json', {
          body: JSON.stringify(
            { correlationIds: [...correlationIds].slice(0, 20) },
            null,
            2,
          ),
          contentType: 'application/json',
        })
      }
    },
    { auto: true },
  ],
})
