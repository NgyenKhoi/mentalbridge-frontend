import { test as base } from '@playwright/test'

const correlationIdPattern = /^[\x20-\x7E]{1,128}$/

export const test = base.extend<{ correlationEvidence: void }>({
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
