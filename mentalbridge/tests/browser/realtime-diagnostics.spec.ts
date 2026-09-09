import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/browser-harness/')
  await expect(page.getByTestId('phase')).toHaveText('ready')
})

test('ready, send/ack, duplicate event and delivery semantics', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Send fixture' }).click()
  await expect(page.getByTestId('ack-count')).toHaveText('1')
  await expect(page.getByTestId('event-count')).toHaveText('1')
  await expect(page.getByTestId('delivery')).toHaveText('unconfirmed')

  await page.getByRole('button', { name: 'Duplicate event' }).click()
  await expect(page.getByTestId('event-count')).toHaveText('2')
})

test('malformed frame degrades safely', async ({ page }) => {
  await page.getByRole('button', { name: 'Malformed event' }).click()
  await expect(page.getByTestId('phase')).toHaveText('degraded')
  await expect(page.getByTestId('issue')).toHaveText('MALFORMED_FRAME')
})

test('disconnect reconnects, resubscribes and uses history boundary', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Subscribe fixture' }).click()
  await page.getByRole('button', { name: 'Send fixture' }).click()
  await page.getByRole('button', { name: 'Disconnect' }).click()
  await expect(page.getByTestId('phase')).toHaveText('ready')
  await expect(page.getByTestId('recovery')).toHaveText('recovered')
  await expect(page.getByTestId('history-count')).toHaveText('1')
})

test('authentication expiry stops and eligibility unavailable never bypasses', async ({
  page,
}) => {
  await page
    .getByRole('button', { name: 'Make eligibility unavailable' })
    .click()
  await page.getByRole('button', { name: 'Subscribe fixture' }).click()
  await expect(page.getByTestId('last-action')).toHaveText(
    'subscribe:unavailable',
  )
  await expect(page.getByTestId('issue')).toHaveText(
    'CHAT_ELIGIBILITY_UNAVAILABLE',
  )

  await page.getByRole('button', { name: 'Expire authentication' }).click()
  await expect(page.getByTestId('phase')).toHaveText('authentication-expired')
})
