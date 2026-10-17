import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { chromium, expect } from '@playwright/test'

let input = ''
for await (const chunk of process.stdin) {
  input += chunk
  assert(input.length < 4096, 'Oversized fixture bootstrap')
}
const config = JSON.parse(input)
for (const name of ['fixture', 'consultation']) {
  const url = new URL(config[name])
  assert(
    url.protocol === 'http:' &&
      url.hostname === '127.0.0.1' &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash,
    'Disposable loopback fixture required',
  )
}
assert(typeof config.key === 'string', 'Protected fixture key required')
const host = '127.0.0.1'
const baseURL = 'http://127.0.0.1:3189'
const evidence = resolve('test-results/mb384-livekit-cloud')
await mkdir(evidence, { recursive: true })
const checks = []
const contexts = []
let browser
let appointment
let server
let step = 'bootstrap'
let readiness = 'not started'
let serverDiagnostic = 'none'
let accessDiagnostic = 'not requested'

// This local proxy opens one path only. A separately approved operator tunnel
// may expose this port; it never exposes the fixture, BFF, or service APIs.
const webhook = createServer(async (request, response) => {
  if (
    request.method !== 'POST' ||
    request.url !== '/internal/v1/video/livekit/webhook' ||
    request.headers['content-type']?.split(';')[0] !==
      'application/webhook+json' ||
    !request.headers.authorization ||
    request.headers.authorization.length > 8192
  ) {
    response.writeHead(404).end()
    return
  }
  try {
    const chunks = []
    let size = 0
    for await (const chunk of request) {
      size += chunk.length
      if (size > 65536) {
        response.writeHead(413).end()
        return
      }
      chunks.push(chunk)
    }
    const result = await fetch(
      `${config.consultation}/internal/v1/video/livekit/webhook`,
      {
        method: 'POST',
        body: Buffer.concat(chunks),
        headers: {
          'Content-Type': 'application/webhook+json',
          Authorization: request.headers.authorization,
        },
        signal: AbortSignal.timeout(10000),
      },
    )
    await result.arrayBuffer()
    response.writeHead(result.status, { 'Cache-Control': 'no-store' }).end()
  } catch {
    response.writeHead(503).end()
  }
})
await new Promise((done, reject) => {
  webhook.once('error', reject)
  webhook.listen(config.webhookPort, host, done)
})

async function fixture(action, body = {}) {
  const result = await fetch(`${config.fixture}/fixture/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Fixture-Key': config.key,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  })
  assert.equal(result.status, 200, `Fixture ${action} failed`)
  return result.json()
}
async function api(context, method, path, data, headers = {}) {
  const response = await context.request.fetch(path, {
    method,
    data,
    headers,
    timeout: 15000,
  })
  let problemCode = 'none'
  if (!response.ok()) {
    try {
      const problem = await response.json()
      if (
        typeof problem.code === 'string' &&
        /^[A-Z_]{1,80}$/.test(problem.code)
      )
        problemCode = problem.code
    } catch {
      /* no raw response retained */
    }
  }
  assert(
    response.ok(),
    `BFF ${method} ${path.split('/').slice(0, 4).join('/')}: HTTP ${response.status()}, ${problemCode}`,
  )
  return response.json()
}
async function actor(role, bootstrap) {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 900 },
    permissions: ['camera', 'microphone'],
    reducedMotion: 'reduce',
  })
  contexts.push(context)
  await context.addCookies([
    {
      name: 'mentalbridge_access',
      value: bootstrap.tokens[role],
      domain: host,
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
  // Only non-sensitive RTP counters are retained, never SDP, identity or tokens.
  await context.addInitScript(() => {
    const NativePeer = globalThis.RTCPeerConnection
    globalThis.__mb384Peers = []
    globalThis.RTCPeerConnection = class extends NativePeer {
      constructor(...args) {
        super(...args)
        globalThis.__mb384Peers.push(this)
      }
    }
  })
  const page = await context.newPage()
  page.on('response', async (response) => {
    if (!new URL(response.url()).pathname.endsWith('/video-access')) return
    let code = 'none'
    if (!response.ok()) {
      try {
        const problem = await response.json()
        if (
          typeof problem.code === 'string' &&
          /^[A-Z_]{1,80}$/.test(problem.code)
        )
          code = problem.code
      } catch {
        /* only status and a bounded public error code are retained */
      }
    }
    accessDiagnostic = `${role}: HTTP ${response.status()}, ${code}`
  })
  return { context, page }
}
async function mediaCounters(page) {
  return page.evaluate(async () => {
    const counters = { audioBytes: 0, videoFrames: 0 }
    for (const peer of globalThis.__mb384Peers ?? []) {
      const stats = await peer.getStats()
      stats.forEach((stat) => {
        if (stat.type === 'inbound-rtp' && stat.kind === 'audio')
          counters.audioBytes += stat.bytesReceived ?? 0
        if (stat.type === 'inbound-rtp' && stat.kind === 'video')
          counters.videoFrames += stat.framesDecoded ?? 0
      })
    }
    return counters
  })
}

function sourceRevision(directory) {
  const args = ['-C', directory, '-c', `safe.directory=${directory}`]
  const head = execFileSync('git', [...args, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim()
  const clean = !execFileSync('git', [...args, 'status', '--porcelain'], {
    encoding: 'utf8',
  }).trim()
  return { head, clean }
}

async function verifyVideoDisplay(page) {
  const region = page.getByRole('region', { name: 'Cuộc gọi tư vấn' })
  await expect(region).toBeVisible()
  const display = await region
    .getByText('Đã kết nối với người còn lại')
    .evaluate(async (element) => {
      await document.fonts.ready
      const style = getComputedStyle(element)
      const rgb = (color) =>
        (color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number)
      const light = (channels) =>
        channels
          .map((channel) => channel / 255)
          .map((channel) =>
            channel <= 0.04045
              ? channel / 12.92
              : ((channel + 0.055) / 1.055) ** 2.4,
          )
          .reduce(
            (sum, channel, index) =>
              sum + channel * [0.2126, 0.7152, 0.0722][index],
            0,
          )
      const front = light(rgb(style.color))
      const back = light(
        rgb(getComputedStyle(element.parentElement).backgroundColor),
      )
      return {
        contrast:
          (Math.max(front, back) + 0.05) / (Math.min(front, back) + 0.05),
        fontLoaded: document.fonts.check(
          `${style.fontSize} ${style.fontFamily}`,
        ),
        width: element.getBoundingClientRect().width,
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
      }
    })
  assert(display.contrast >= 4.5, 'Call status text needs accessible contrast')
  assert(
    display.fontLoaded && display.width >= 200 && !display.overflow,
    'Video font or panel layout failed',
  )
  return display
}

async function screenshot(page, name) {
  await page.evaluate(async () => {
    scrollTo(0, 0)
    await new Promise((done) =>
      requestAnimationFrame(() => requestAnimationFrame(done)),
    )
  })
  await page.screenshot({ path: resolve(evidence, name), fullPage: true })
}

try {
  const bootstrap = await fixture('bootstrap')
  step = 'standalone startup'
  server = spawn('node', ['server.js'], {
    cwd: resolve('.next/standalone'),
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      HOSTNAME: host,
      PORT: '3189',
      IDENTITY_API_BASE_URL: config.fixture,
      CARE_API_BASE_URL: config.fixture,
      CONTENT_SERVICE_URL: config.fixture,
      COMMUNITY_SERVICE_URL: config.fixture,
      JOURNAL_AI_SERVICE_URL: config.fixture,
      CONSULTATION_SERVICE_URL: config.consultation,
      CONSULTATION_SERVICE_TIMEOUT_MS: '10000',
    },
  })
  for (const stream of [server.stdout, server.stderr])
    stream.on('data', (chunk) => {
      const text = chunk.toString()
      for (const code of [
        'EADDRINUSE',
        'MODULE_NOT_FOUND',
        'ENOENT',
        'EACCES',
        'ERR_INVALID_ARG_TYPE',
      ]) {
        if (text.includes(code)) serverDiagnostic = code
      }
    })
  await expect
    .poll(
      async () => {
        if (server.exitCode !== null) {
          readiness = `server exited ${server.exitCode}`
          return false
        }
        try {
          const response = await fetch(`${baseURL}/login`, {
            signal: AbortSignal.timeout(2000),
          })
          readiness = `HTTP ${response.status}`
          return response.ok
        } catch (error) {
          readiness = error.cause?.code ?? error.name
          return false
        }
      },
      { timeout: 30000 },
    )
    .toBe(true)
  browser = await chromium.launch({
    channel: 'chrome',
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
    ],
  })
  step = 'synthetic actor browser setup'
  const user = await actor('USER', bootstrap)
  const specialist = await actor('SPECIALIST', bootstrap)
  step = 'public video availability slot'
  const slot = await api(
    specialist.context,
    'POST',
    '/api/consultation/availability-slots',
    {
      startAt: bootstrap.start,
      endAt: new Date(Date.parse(bootstrap.start) + 3600000).toISOString(),
      timezone: 'Asia/Ho_Chi_Minh',
      modality: 'IN_APP_VIDEO',
    },
    { 'Idempotency-Key': 'mb384-cloud-slot' },
  )
  step = 'public booking'
  appointment = await api(
    user.context,
    'POST',
    '/api/consultation/appointments',
    { slotId: slot.id, modality: 'IN_APP_VIDEO' },
    { 'Idempotency-Key': 'mb384-cloud-booking' },
  )
  step = 'assigned Specialist acceptance'
  await api(
    specialist.context,
    'POST',
    `/api/consultation/specialist/appointments/${appointment.id}/accept`,
    undefined,
    {
      'If-Match': `"${appointment.version}"`,
      'Idempotency-Key': 'mb384-cloud-accept',
    },
  )
  await fixture('activate', { appointmentId: appointment.id })
  checks.push(
    'Public BFF -> real Consultation: video slot, booking, assigned Specialist acceptance; disposable test clock only skips booking lead time, not media attendance.',
  )

  step = 'actual appointment UI and join'
  await user.page.goto(`/appointments/${appointment.id}`)
  await specialist.page.goto(
    `/specialist/appointments?appointmentId=${appointment.id}`,
  )
  for (const participant of [user, specialist]) {
    step = `actual ${participant === user ? 'USER' : 'SPECIALIST'} appointment UI and join`
    await participant.page
      .getByRole('button', { name: 'Phiên tư vấn video', exact: true })
      .click()
    await expect(
      participant.page.getByRole('button', { name: 'Tham gia phiên tư vấn' }),
    ).toBeEnabled({ timeout: 15000 })
    await participant.page
      .getByRole('button', { name: 'Tham gia phiên tư vấn' })
      .click()
    await expect(
      participant.page.getByText(
        /Đang chờ người còn lại tham gia|Đã kết nối với người còn lại/,
      ),
    ).toBeVisible({ timeout: 30000 })
    await participant.page
      .getByRole('button', { name: 'Micro: Đang tắt' })
      .click()
    await participant.page
      .getByRole('button', { name: 'Camera: Đang tắt' })
      .click()
  }
  for (const participant of [user, specialist]) {
    await expect(
      participant.page.getByText('Đã kết nối với người còn lại'),
    ).toBeVisible()
    await expect
      .poll(async () => (await mediaCounters(participant.page)).videoFrames, {
        timeout: 30000,
      })
      .toBeGreaterThan(0)
    await expect
      .poll(async () => (await mediaCounters(participant.page)).audioBytes, {
        timeout: 30000,
      })
      .toBeGreaterThan(0)
  }
  step = 'two-way RTP media verification'
  const connectedAt = Date.now()
  const displayChecks = []
  const rtp = []
  for (const participant of [user, specialist]) {
    rtp.push({
      actor: participant === user ? 'USER' : 'SPECIALIST',
      ...(await mediaCounters(participant.page)),
    })
    displayChecks.push(await verifyVideoDisplay(participant.page))
    await screenshot(
      participant.page,
      `${participant === user ? 'user' : 'specialist'}-connected.png`,
    )
    await participant.page.setViewportSize({ width: 375, height: 812 })
    displayChecks.push(await verifyVideoDisplay(participant.page))
    await screenshot(
      participant.page,
      `${participant === user ? 'user' : 'specialist'}-connected-375.png`,
    )
    await participant.page.setViewportSize({ width: 1440, height: 900 })
  }
  checks.push(
    'Two browser contexts connected through LIVE LiveKit Cloud; actual RTP audio bytes received and video frames decoded in both directions. Camera/mic input is synthetic, not a human consultation.',
  )
  checks.push(
    'Actual USER/SPECIALIST routes at 1440px and 375px: loaded fonts, readable call-status contrast, full-width panel and no horizontal overflow.',
  )

  await user.page.getByRole('button', { name: 'Camera: Đang bật' }).click()
  await expect(
    user.page.getByRole('button', { name: 'Camera: Đang tắt' }),
  ).toBeVisible()
  await user.page.getByRole('button', { name: 'Camera: Đang tắt' }).click()
  await user.page.getByRole('button', { name: 'Micro: Đang bật' }).click()
  await expect(
    user.page.getByRole('button', { name: 'Micro: Đang tắt' }),
  ).toBeVisible()
  await user.page.getByRole('button', { name: 'Micro: Đang tắt' }).click()
  // Keep genuine wall-clock common participation longer than the approved 60s
  // threshold. The fixture never inserts or synthesizes attendance/webhooks.
  while (Date.now() - connectedAt < 65000)
    await new Promise((done) => setTimeout(done, 1000))
  const authorityBeforeLeave = await api(
    user.context,
    'GET',
    `/api/consultation/appointments/${appointment.id}/video-session`,
  )
  assert.equal(authorityBeforeLeave.completion, null)
  await user.page.getByRole('button', { name: 'Rời cuộc gọi' }).click()
  await expect(
    user.page.getByRole('button', { name: 'Tham gia phiên tư vấn' }),
  ).toBeEnabled()
  await user.page.getByRole('button', { name: 'Tham gia phiên tư vấn' }).click()
  await expect(user.page.getByText('Đã kết nối với người còn lại')).toBeVisible(
    { timeout: 30000 },
  )
  checks.push(
    'Camera/microphone toggles; >65s real overlapping connection; leave and fresh-authorized rejoin do not invoke completion.',
  )

  step = 'explicit completion and authoritative reload'
  await specialist.page
    .getByRole('button', { name: 'Xác nhận kết thúc buổi tư vấn' })
    .click()
  await expect(
    specialist.page.getByRole('button', { name: 'Tiếp tục tư vấn' }),
  ).toBeFocused()
  await specialist.page
    .getByRole('button', { name: 'Kết thúc và gửi xác nhận' })
    .click()
  await expect(
    user.page.getByRole('button', { name: 'Tham gia phiên tư vấn' }),
  ).toBeDisabled({ timeout: 15000 })
  let completed
  if (config.requireWebhook) {
    await expect
      .poll(
        async () => {
          const result = await api(
            specialist.context,
            'GET',
            `/api/consultation/appointments/${appointment.id}/video-session`,
          )
          completed = result.completion
          return completed?.verificationState
        },
        { timeout: 180000, intervals: [2000, 5000] },
      )
      .toBe('VERIFIED')
    assert.equal(completed.creditState, 'CONSUMED')
    assert(completed.completionFactId)
    checks.push(
      'Real signed provider webhooks reconciled to VERIFIED + COMPLETED + credit CONSUMED after explicit Specialist confirmation; no client/fake attendance inference.',
    )
  } else {
    const result = await api(
      specialist.context,
      'GET',
      `/api/consultation/appointments/${appointment.id}/video-session`,
    )
    assert.equal(result.phase, 'ENDED')
    assert(result.completion)
    if (result.completion.verificationState !== 'VERIFIED')
      assert.equal(result.completion.creditState, 'HELD')
    checks.push(
      'Webhook evidence not required in this media-only run: explicit Specialist confirmation safely ends the room; pending verification is not reported as full completion proof.',
    )
  }
  await user.page.reload()
  await user.page
    .getByRole('button', { name: 'Phiên tư vấn video', exact: true })
    .click()
  await expect(
    user.page.getByText(
      config.requireWebhook
        ? 'Buổi tư vấn đã được xác nhận hoàn tất.'
        : 'Phiên video đã kết thúc. Bạn không thể kết nối lại phiên này.',
    ),
  ).toBeVisible()
  await screenshot(user.page, 'user-after-reload.png')
  const received = await fixture('evidence')
  await writeFile(
    resolve(evidence, 'manifest.json'),
    JSON.stringify(
      {
        task: 'MB-384',
        frontend: sourceRevision(resolve('..')),
        backend: sourceRevision(resolve(config.backend)),
        executedAt: new Date().toISOString(),
        provider: 'LIVEKIT_CLOUD',
        mediaInput: 'synthetic-camera-and-microphone',
        identity:
          'controlled JWT/current-account fixture; real Consultation owner and public BFF',
        database: 'disposable Testcontainers PostgreSQL',
        realSignedEventCount: received.signedEvents,
        verifiedCompletion: Boolean(config.requireWebhook),
        rtp,
        displayChecks,
        checks,
      },
      null,
      2,
    ),
  )
  console.log(
    `PASS MB-384 LiveKit Cloud journey: ${checks.length} checks, media + ${config.requireWebhook ? 'signed webhook/completion' : 'safe pending verification'}. Evidence: test-results/mb384-livekit-cloud. No secrets or tokens retained.`,
  )
} catch (error) {
  for (const [index, context] of contexts.entries()) {
    const page = context.pages()[0]
    if (page)
      await page
        .screenshot({
          path: resolve(
            evidence,
            `failure-${index === 0 ? 'user' : 'specialist'}.png`,
          ),
          fullPage: true,
        })
        .catch(() => {})
  }
  console.error(
    `Controlled standalone readiness: ${readiness}; startup diagnostic: ${serverDiagnostic}; access: ${accessDiagnostic}`,
  )
  if (appointment) {
    try {
      console.error(
        `Sanitized participation checkpoint: ${JSON.stringify(await fixture('evidence'))}`,
      )
    } catch {
      /* fixture may have stopped */
    }
  }
  console.error(
    `FAIL MB-384 Cloud journey at ${step}: ${error instanceof Error ? error.name : 'Unknown failure'}; ${
      error instanceof Error
        ? error.message
            .split('\n')[0]
            .replace(
              /[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
              '[redacted]',
            )
            .slice(0, 300)
        : 'No detail'
    }. No raw network/provider data retained.`,
  )
  process.exitCode = 1
} finally {
  for (const context of contexts) await context.close()
  await browser?.close()
  await new Promise((done) => webhook.close(done))
  if (server && server.exitCode === null) server.kill()
}
