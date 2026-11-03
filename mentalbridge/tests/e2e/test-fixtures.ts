import { test as base } from '@playwright/test'
import { onboardingStorageKey } from '../../features/onboarding/tour-storage'

const correlationIdPattern = /^[\x20-\x7E]{1,128}$/

export const test = base.extend<{
  correlationEvidence: void
  onboardingSeen: boolean
  onboardingState: void
}>({
  onboardingSeen: [true, { option: true }],
  onboardingState: [
    async ({ page, onboardingSeen }, use) => {
      if (onboardingSeen) {
        await page.addInitScript(
          (keys) => {
            for (const key of keys)
              window.localStorage.setItem(key, 'completed')
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
