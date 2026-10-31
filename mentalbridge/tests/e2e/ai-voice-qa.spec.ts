import { expect } from '@playwright/test'
import { test } from './test-fixtures'
import { eligibility, voiceKey, voiceSessionId } from '../fixtures/voice'

test('MB-762 production BFF rejects anonymous, forged and nonpublic Voice requests', async ({
  page,
}) => {
  const base = '/api/ai-companion/voice'
  const unauthenticated = await page.request.get(`${base}/eligibility`)
  expect(unauthenticated.status()).toBe(401)
  for (const path of [
    'internal/claim',
    `sessions/${voiceSessionId}/transcript`,
    `sessions/${voiceSessionId}/turns`,
    'eligibility?ownerId=foreign',
  ])
    expect((await page.request.get(`${base}/${path}`)).status()).toBe(404)
  const csrf = await page.request.post(`${base}/sessions`, {
    headers: { Origin: 'https://foreign.example', 'Idempotency-Key': voiceKey },
    data: {},
  })
  expect(csrf.status()).toBe(403)
  await page.context().addCookies([
    {
      name: 'mentalbridge_access',
      value: 'synthetic-resource-e2e-access',
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
  const forged = await page.request.post(`${base}/sessions`, {
    headers: {
      Origin: new URL(unauthenticated.url()).origin,
      'Idempotency-Key': voiceKey,
    },
    data: {
      ownerId: voiceSessionId,
      packageCode: 'PREMIUM',
      roomName: 'consultation-forged',
    },
  })
  expect(forged.status()).toBe(422)
  expect(await forged.text()).not.toContain('consultation-forged')
})

for (const [status, code, copy] of [
  [409, 'GLOBAL_CAPACITY_FULL', 'Cả hai chỗ gọi AI đang được sử dụng.'],
  [409, 'SESSION_LIMIT', 'Tài khoản đang có một cuộc gọi khác.'],
  [429, 'RATE_LIMITED', 'Bạn đang thao tác quá nhanh.'],
  [503, 'PROVIDER_UNAVAILABLE', 'Gọi AI hiện chưa sẵn sàng.'],
] as const) {
  test(`MB-762 simulated admission ${code} stops synthetic capture and offers text without retry`, async ({
    page,
  }) => {
    await page.context().addCookies([
      {
        name: 'mentalbridge_access',
        value: 'synthetic-resource-e2e-access',
        domain: '127.0.0.1',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ])
    await page.addInitScript(() => {
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
        value: async () => {
          const audio = new AudioContext()
          const stream = audio.createMediaStreamDestination().stream
          Reflect.set(
            window,
            '__voiceSyntheticTrack',
            stream.getAudioTracks()[0],
          )
          return stream
        },
      })
    })
    await page.route('**/api/ai-companion/conversations**', (route) =>
      route.fulfill({ json: { items: [] } }),
    )
    await page.route('**/api/resources**', (route) =>
      route.fulfill({ json: { items: [] } }),
    )
    let starts = 0
    let connections = 0
    await page.route('**/api/ai-companion/voice/**', (route) => {
      const path = new URL(route.request().url()).pathname
      if (path.endsWith('/eligibility'))
        return route.fulfill({ json: eligibility() })
      if (path.endsWith('/sessions')) starts++
      if (path.endsWith('/connection')) connections++
      return route.fulfill({ status, json: { code } })
    })
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/ai-companion')
    await page.getByRole('button', { name: 'Gọi AI', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Gọi AI' })
    await dialog.getByRole('button', { name: 'Bắt đầu cuộc gọi' }).click()
    await expect(dialog.getByText(copy, { exact: false })).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate(() => {
          const track: unknown = Reflect.get(window, '__voiceSyntheticTrack')
          return track instanceof MediaStreamTrack ? track.readyState : null
        }),
      )
      .toBe('ended')
    expect(starts).toBe(1)
    expect(connections).toBe(0)
    await expect(
      dialog.getByRole('link', { name: 'Cần trợ giúp ngay' }),
    ).toHaveAttribute('href', '/safety-directory')
    await dialog.getByRole('button', { name: 'Tiếp tục nhắn tin' }).click()
    await expect(dialog).not.toBeVisible()
    await expect(
      page.getByRole('button', { name: /Cuộc trò chuyện mới/ }),
    ).toBeVisible()
    expect(starts).toBe(1)
  })
}
