import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { chromium, expect } from '@playwright/test'
import { SignalResponse, DisconnectReason } from '@livekit/protocol'

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
const ownedBrowsers = []
const lifecycle = process.env.MB384_CALL_LIFECYCLE === 'true'
const continuityChecks = []
const transportEvents = []
const mediaArgs = [
  '--use-fake-device-for-media-stream',
  '--use-fake-ui-for-media-stream',
  '--autoplay-policy=no-user-gesture-required',
]
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
  const response = await context.request.fetch(new URL(path, baseURL).href, {
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
  let context
  if (lifecycle) {
    const debugPort = role === 'USER' ? 3196 : 3197
    const probe = createServer()
    await new Promise((done, reject) => {
      probe.once('error', reject)
      probe.listen(debugPort, host, done)
    })
    await new Promise((done) => probe.close(done))
    const owner = await chromium.launch({
      channel: 'chrome',
      headless: false,
      args: [...mediaArgs, `--remote-debugging-port=${debugPort}`],
    })
    ownedBrowsers.push(owner)
    const driver = await chromium.connectOverCDP(
      `http://${host}:${debugPort}`,
      { noDefaults: true },
    )
    ownedBrowsers.push(driver)
    context = driver.contexts()[0]
    await context.grantPermissions(['camera', 'microphone'])
  } else {
    context = await browser.newContext({
      baseURL,
      viewport: { width: 1440, height: 900 },
      permissions: ['camera', 'microphone'],
      reducedMotion: 'reduce',
    })
  }
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
    globalThis.__mb384MediaEvents = []
    const record = (event) => {
      if (globalThis.__mb384MediaEvents.length < 200)
        globalThis.__mb384MediaEvents.push({ ...event, at: Date.now() })
    }
    document.addEventListener('visibilitychange', () =>
      record({ visibility: document.visibilityState }),
    )
    const nativeCapture = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    )
    // This journey verifies real Cloud RTP, not a physical camera driver. Keep
    // synthetic video independent of Chrome's fake capture service, which can
    // end a track and then report NotFoundError during reconnect on this host.
    function syntheticVideo() {
      const canvas = document.createElement('canvas')
      canvas.width = 640
      canvas.height = 480
      const paint = canvas.getContext('2d')
      if (!paint) throw new Error('Synthetic video unavailable')
      let frame = 0
      const draw = () => {
        paint.fillStyle = `hsl(${frame++ % 360} 65% 25%)`
        paint.fillRect(0, 0, canvas.width, canvas.height)
        paint.fillStyle = 'white'
        paint.font = '28px sans-serif'
        paint.fillText(`MB-384 synthetic frame ${frame}`, 24, 64)
      }
      draw()
      const [track] = canvas.captureStream(15).getVideoTracks()
      const timer = setInterval(draw, 100)
      const stop = track.stop.bind(track)
      track.stop = () => {
        clearInterval(timer)
        stop()
      }
      return track
    }
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      let stream
      try {
        if (constraints?.video) {
          stream = constraints.audio
            ? await nativeCapture({ ...constraints, video: false })
            : new MediaStream()
          stream.addTrack(syntheticVideo())
        } else {
          stream = await nativeCapture(constraints)
        }
      } catch (error) {
        record({
          captureError: [
            'NotAllowedError',
            'NotFoundError',
            'NotReadableError',
            'AbortError',
            'OverconstrainedError',
            'InvalidStateError',
          ].includes(error?.name)
            ? error.name
            : 'DeviceError',
        })
        throw error
      }
      for (const track of stream.getTracks()) {
        record({ trackEvent: 'captured', kind: track.kind })
        for (const name of ['ended', 'mute', 'unmute'])
          track.addEventListener(name, () =>
            record({ trackEvent: name, kind: track.kind }),
          )
      }
      return stream
    }
    const NativePeer = globalThis.RTCPeerConnection
    globalThis.__mb384Peers = []
    globalThis.RTCPeerConnection = class extends NativePeer {
      constructor(...args) {
        super(...args)
        globalThis.__mb384Peers.push(this)
      }
    }
    const NativeSocket = globalThis.WebSocket
    globalThis.__mb384Signals = []
    globalThis.WebSocket = class extends NativeSocket {
      constructor(...args) {
        super(...args)
        if (this.url.startsWith('wss:')) globalThis.__mb384Signals.push(this)
      }
    }
    globalThis.__mb384ControlClicks = []
    document.addEventListener(
      'click',
      (event) => {
        const button = event.target.closest?.('button')
        const label = button?.getAttribute('aria-label') || button?.textContent
        if (
          /^(Micro:|Camera:|Rời cuộc gọi|Tham gia phiên tư vấn)/.test(
            label ?? '',
          )
        )
          globalThis.__mb384ControlClicks.push({
            label,
            at: Date.now(),
            ...(/^(Micro:|Camera:)/.test(label)
              ? { planned: globalThis.__mb384ExpectedMediaClick === label }
              : {}),
          })
      },
      true,
    )
  })
  const page = await context.newPage()
  await page.setViewportSize({ width: 1440, height: 900 })
  let accessRequests = 0
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith('/video-access'))
      transportEvents.push({
        role,
        accessRequest: ++accessRequests,
        at: Date.now(),
      })
  })
  page.on('websocket', (socket) => {
    socket.on('framereceived', ({ payload }) => {
      if (typeof payload === 'string') return
      try {
        const { message } = SignalResponse.fromBinary(payload)
        if (message.case === 'leave')
          transportEvents.push({
            role,
            providerLeave: DisconnectReason[message.value.reason],
            action: message.value.action,
            at: Date.now(),
          })
      } catch {
        return
      }
    })
    socket.on('close', () =>
      transportEvents.push({ role, signalClosed: true, at: Date.now() }),
    )
  })
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
  return { role, context, page, accessRequests: () => accessRequests }
}
async function clickMedia(page, name) {
  await page.evaluate((label) => {
    globalThis.__mb384ExpectedMediaClick = label
  }, name)
  try {
    await page.getByRole('button', { name, exact: true }).click()
  } finally {
    await page.evaluate(() => {
      globalThis.__mb384ExpectedMediaClick = null
    })
  }
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
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }))
  const region = page.getByRole('region', { name: 'Cuộc gọi tư vấn' })
  await expect(region).toBeVisible()
  const display = await region
    .getByText('Đã kết nối với người còn lại')
    .evaluate(async (element) => {
      await document.fonts.ready
      const style = getComputedStyle(element)
      // A viewport change can expose a previously unused font subset/weight.
      // Force that exact Vietnamese face to load before measuring its layout.
      const font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
      const text = element.textContent ?? ''
      const faces = await document.fonts.load(font, text)
      await document.fonts.ready
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
      let surface = element.parentElement
      while (
        surface.parentElement &&
        getComputedStyle(surface).backgroundColor === 'rgba(0, 0, 0, 0)'
      )
        surface = surface.parentElement
      const back = light(rgb(getComputedStyle(surface).backgroundColor))
      const controlsVisible =
        innerWidth < 1280 ||
        innerHeight < 800 ||
        [
          ...element.parentElement.parentElement.querySelectorAll(
            '[aria-label="Điều khiển cuộc gọi"] button',
          ),
        ].every(
          (button) => button.getBoundingClientRect().bottom <= innerHeight,
        )
      return {
        contrast:
          (Math.max(front, back) + 0.05) / (Math.min(front, back) + 0.05),
        fontLoaded: faces.length > 0 && document.fonts.check(font, text),
        fontFamily: style.fontFamily,
        fontWeight: style.fontWeight,
        fontSize: Number.parseFloat(style.fontSize),
        textClipped:
          element.scrollHeight > element.clientHeight + 1 ||
          element.scrollWidth > element.clientWidth + 1,
        controlsVisible,
        width: element.getBoundingClientRect().width,
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
      }
    })
  assert(display.contrast >= 4.5, 'Call status text needs accessible contrast')
  assert(
    display.fontLoaded &&
      display.width > 0 &&
      display.fontSize >= 12 &&
      !display.textClipped &&
      !display.overflow &&
      display.controlsVisible,
    `Video font or panel layout failed: ${JSON.stringify(display)}`,
  )
  const layout = await region.evaluate((root) => {
    const remote = root.querySelector(
      'figure[aria-label="Hình ảnh người tham gia cùng bạn"]',
    )
    const local = root.querySelector('figure[aria-label="Hình ảnh của bạn"]')
    const stage = remote.getBoundingClientRect()
    const inset = local.getBoundingClientRect()
    const controls = [
      ...root.querySelectorAll('[aria-label="Điều khiển cuộc gọi"] button'),
    ]
    return {
      localBottomRight:
        inset.right < stage.right &&
        inset.left >= stage.left + 12 &&
        stage.bottom - inset.bottom > 0 &&
        stage.bottom - inset.bottom <= 100,
      overlay:
        getComputedStyle(remote.parentElement).position === 'relative' &&
        getComputedStyle(local).position === 'absolute',
      clearOfControls: controls.every(
        (button) => inset.bottom < button.getBoundingClientRect().top,
      ),
      videoNotStretched: [...root.querySelectorAll('figure video')].every(
        (video) => getComputedStyle(video).objectFit === 'cover',
      ),
      minControl: Math.min(
        ...controls.map((button) =>
          Math.min(
            button.getBoundingClientRect().width,
            button.getBoundingClientRect().height,
          ),
        ),
      ),
      iconControls:
        controls.length === 5 &&
        controls.every(
          (button) =>
            !button.textContent.trim() && button.getAttribute('aria-label'),
        ),
      badGlyph: /\uFFFD|Ã[\u0080-\u00BF]/.test(root.innerText),
    }
  })
  assert(
    layout.localBottomRight &&
      layout.overlay &&
      layout.clearOfControls &&
      layout.videoNotStretched &&
      layout.minControl >= 44 &&
      layout.iconControls &&
      !layout.badGlyph,
    'Remote stage, local inset or icon-control layout failed',
  )
  return { ...display, ...layout }
}

async function verifyContinuity(participant, role) {
  const { page, context } = participant
  await page.bringToFront()
  const accesses = participant.accessRequests()
  const before = await mediaCounters(page)
  continuityChecks.push({ role, phase: 'before-hide', counters: before })
  const otherTab = await context.newPage()
  try {
    await otherTab.goto('about:blank')
    await otherTab.bringToFront()
    await expect
      .poll(() => page.evaluate(() => document.visibilityState))
      .toBe('hidden')
    await new Promise((done) => setTimeout(done, 5000))
    assert(
      (await mediaCounters(page)).audioBytes > before.audioBytes,
      'Background audio did not continue',
    )
    await expect(
      page.getByRole('button', { name: 'Rời cuộc gọi' }),
    ).toBeAttached()
    assert.equal(
      participant.accessRequests(),
      accesses,
      'Tab hiding requested a new join token',
    )
  } finally {
    await otherTab.close()
    await page.bringToFront()
  }
  await expect
    .poll(async () => (await mediaCounters(page)).videoFrames, {
      timeout: 30000,
    })
    .toBeGreaterThan(before.videoFrames)
  continuityChecks.push({
    role,
    phase: 'tab-restored',
    counters: await mediaCounters(page),
  })
  const cdp = await context.newCDPSession(page)
  const { windowId } = await cdp.send('Browser.getWindowForTarget')
  const minimized = await mediaCounters(page)
  try {
    await cdp.send('Browser.setWindowBounds', {
      windowId,
      bounds: { windowState: 'minimized' },
    })
    await expect
      .poll(() => page.evaluate(() => document.visibilityState))
      .toBe('hidden')
    await new Promise((done) => setTimeout(done, 5000))
    assert(
      (await mediaCounters(page)).audioBytes > minimized.audioBytes,
      'Minimized-window audio did not continue',
    )
    await expect(
      page.getByRole('button', { name: 'Tham gia phiên tư vấn' }),
    ).toHaveCount(0)
  } finally {
    await cdp.send('Browser.setWindowBounds', {
      windowId,
      bounds: { windowState: 'normal' },
    })
    await page.bringToFront()
    await cdp.detach()
  }
  await expect
    .poll(async () => (await mediaCounters(page)).videoFrames, {
      timeout: 30000,
    })
    .toBeGreaterThan(minimized.videoFrames)
  assert.equal(participant.accessRequests(), accesses)
  continuityChecks.push({
    role,
    actualHiddenTab: true,
    minimizedWindow: true,
    audioContinued: true,
    videoResumed: true,
    additionalJoinRequests: 0,
  })
}

async function verifyNetworkRecovery(participant) {
  const { page, context } = participant
  await page.bringToFront()
  const before = await mediaCounters(page)
  const accesses = participant.accessRequests()
  const camera = await page
    .getByRole('button', { name: /^Camera:/ })
    .getAttribute('aria-pressed')
  const microphone = await page
    .getByRole('button', { name: /^Micro:/ })
    .getAttribute('aria-pressed')
  await page.evaluate(() => {
    globalThis.__mb384ReconnectObserved = false
    const status = document.querySelector(
      '[aria-label="Cuộc gọi tư vấn"] [role="status"]',
    )
    const observer = new MutationObserver(() => {
      if (status?.textContent.includes('đang kết nối lại'))
        globalThis.__mb384ReconnectObserved = true
    })
    observer.observe(status, {
      subtree: true,
      childList: true,
      characterData: true,
    })
    globalThis.__mb384StatusObserver = observer
  })
  try {
    await context.setOffline(true)
    const interrupted = await page.evaluate(() => {
      const signals = globalThis.__mb384Signals.filter(
        (socket) => socket.readyState === WebSocket.OPEN,
      )
      for (const signal of signals)
        signal.close(4000, 'controlled-test-interruption')
      return signals.length
    })
    assert.equal(
      interrupted,
      1,
      'Exactly one real media signaling connection must be interrupted',
    )
    await new Promise((done) => setTimeout(done, 12000))
  } finally {
    await context.setOffline(false)
  }
  await expect(page.getByText('Đã kết nối với người còn lại')).toBeVisible({
    timeout: 45000,
  })
  await expect
    .poll(
      async () => {
        const current = await mediaCounters(page)
        return (
          current.audioBytes > before.audioBytes &&
          current.videoFrames > before.videoFrames
        )
      },
      { timeout: 45000 },
    )
    .toBe(true)
  assert.equal(
    participant.accessRequests(),
    accesses,
    'Temporary network interruption required a new join',
  )
  continuityChecks.push({
    role: participant.role,
    reconnectedDeviceChoices: {
      expected: { camera, microphone },
      actual: {
        camera: await page
          .getByRole('button', { name: /^Camera:/ })
          .getAttribute('aria-pressed'),
        microphone: await page
          .getByRole('button', { name: /^Micro:/ })
          .getAttribute('aria-pressed'),
      },
    },
  })
  await expect(page.getByRole('button', { name: /^Camera:/ })).toHaveAttribute(
    'aria-pressed',
    camera,
  )
  await expect(page.getByRole('button', { name: /^Micro:/ })).toHaveAttribute(
    'aria-pressed',
    microphone,
  )
  const reconnectStatusObserved = await page.evaluate(() => {
    globalThis.__mb384StatusObserver.disconnect()
    return globalThis.__mb384ReconnectObserved
  })
  assert(
    reconnectStatusObserved,
    'A real signaling interruption must exercise SDK reconnect UI',
  )
  continuityChecks.push({
    temporaryOfflineSeconds: 12,
    realSignalingSocketInterrupted: true,
    recoveredRtp: true,
    reconnectStatusObserved,
    additionalJoinRequests: 0,
  })
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
  if (!lifecycle)
    browser = await chromium.launch({ channel: 'chrome', args: mediaArgs })
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
  await user.page.goto(`${baseURL}/appointments/${appointment.id}`)
  await specialist.page.goto(
    `${baseURL}/specialist/appointments?appointmentId=${appointment.id}`,
  )
  for (const participant of [user, specialist]) {
    step = `actual ${participant === user ? 'USER' : 'SPECIALIST'} appointment room entry`
    await participant.page.bringToFront()
    const entry = participant.page
      .getByRole('link', { name: /Mở phòng tư vấn/ })
      .or(participant.page.getByRole('button', { name: /Mở phòng tư vấn/ }))
      .first()
    await expect(entry).toBeVisible({ timeout: 15000 })
    await entry.click()
    step = `actual ${participant === user ? 'USER' : 'SPECIALIST'} join control`
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
    await clickMedia(participant.page, 'Micro: Đang tắt')
    await clickMedia(participant.page, 'Camera: Đang tắt')
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
    await participant.page.bringToFront()
    rtp.push({
      actor: participant === user ? 'USER' : 'SPECIALIST',
      ...(await mediaCounters(participant.page)),
    })
    for (const width of [1440, 1280, 768, 375, 320, 640]) {
      await participant.page.setViewportSize({
        width,
        height: width === 640 ? 400 : 900,
      })
      displayChecks.push({
        role: participant === user ? 'USER' : 'SPECIALIST',
        viewportWidth: width,
        ...(await verifyVideoDisplay(participant.page)),
      })
      if ([1440, 375].includes(width))
        await screenshot(
          participant.page,
          `${participant === user ? 'user' : 'specialist'}-connected${width === 375 ? '-375' : ''}.png`,
        )
    }
    await participant.page.setViewportSize({ width: 1440, height: 900 })
  }
  checks.push(
    'Two browser contexts connected through LIVE LiveKit Cloud; actual RTP audio bytes received and video frames decoded in both directions. Camera/mic input is synthetic, not a human consultation.',
  )
  checks.push(
    'Actual USER/SPECIALIST routes at 1440/1280/768/375/320 and 640x400: loaded fonts, readable call-status contrast, owner-reference bottom-right PiP above floating five-icon controls, 44px+ controls and no horizontal overflow.',
  )

  await user.page.bringToFront()
  await clickMedia(user.page, 'Camera: Đang bật')
  await expect(
    user.page.getByRole('button', { name: 'Camera: Đang tắt' }),
  ).toBeVisible()
  await clickMedia(user.page, 'Camera: Đang tắt')
  await clickMedia(user.page, 'Micro: Đang bật')
  await expect(
    user.page.getByRole('button', { name: 'Micro: Đang tắt' }),
  ).toBeVisible()
  await clickMedia(user.page, 'Micro: Đang tắt')
  if (lifecycle) {
    step = 'actual hidden-tab and minimized-window continuity'
    await verifyContinuity(user, 'USER')
    await verifyContinuity(specialist, 'SPECIALIST')
    step = 'temporary network interruption and SDK recovery'
    await verifyNetworkRecovery(user)
    checks.push(
      'Both isolated Chrome profiles: real hidden tabs and minimized windows retain audio; video resumes without Join. Twelve-second offline BFF + real signaling-socket interruption exercises SDK reconnect and recovers without new application access.',
    )
  }
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
  step = 'fresh-authorized leave and rejoin'
  await user.page.bringToFront()
  await user.page.getByRole('button', { name: 'Rời cuộc gọi' }).click()
  await user.page
    .getByRole('dialog', { name: 'Bạn muốn rời cuộc gọi tư vấn?' })
    .getByRole('button', { name: 'Rời cuộc gọi' })
    .click()
  await expect(
    user.page.getByRole('button', { name: 'Tham gia phiên tư vấn' }),
  ).toBeEnabled()
  await specialist.page.bringToFront()
  await specialist.page.getByRole('button', { name: 'Rời cuộc gọi' }).click()
  await specialist.page
    .getByRole('dialog', { name: 'Bạn muốn rời cuộc gọi tư vấn?' })
    .getByRole('button', { name: 'Rời cuộc gọi' })
    .click()
  for (const participant of [specialist, user]) {
    await participant.page.bringToFront()
    await participant.page
      .getByRole('button', { name: 'Tham gia phiên tư vấn' })
      .click()
    await expect(
      participant.page.getByRole('button', { name: 'Micro: Đang tắt' }),
    ).toBeEnabled({ timeout: 30000 })
    if (participant === specialist)
      await expect(
        participant.page.getByText('Đang chờ người còn lại tham gia'),
      ).toBeVisible()
    await clickMedia(participant.page, 'Micro: Đang tắt')
    await clickMedia(participant.page, 'Camera: Đang tắt')
  }
  for (const participant of [user, specialist]) {
    await expect(
      participant.page.getByText('Đã kết nối với người còn lại'),
    ).toBeVisible({ timeout: 30000 })
    const restarted = await mediaCounters(participant.page)
    await expect
      .poll(
        async () => {
          const next = await mediaCounters(participant.page)
          return (
            next.audioBytes > restarted.audioBytes &&
            next.videoFrames > restarted.videoFrames
          )
        },
        { timeout: 30000 },
      )
      .toBe(true)
  }
  checks.push(
    'Camera/microphone toggles; >65s real overlapping connection; both leave, Specialist rejoins first, then USER. Two-way RTP resumes and fresh-authorized rejoin does not invoke completion.',
  )

  step = 'explicit completion and authoritative reload'
  await specialist.page.bringToFront()
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
        mediaInput: 'synthetic-canvas-camera-and-Chromium-microphone',
        lifecycleMode: lifecycle,
        identity:
          'controlled JWT/current-account fixture; real Consultation owner and public BFF',
        database: 'disposable Testcontainers PostgreSQL',
        realSignedEventCount: received.signedEvents,
        verifiedCompletion: Boolean(config.requireWebhook),
        rtp,
        displayChecks,
        continuityChecks,
        transportEvents,
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
  const states = []
  for (const [index, context] of contexts.entries()) {
    const page = context.pages()[0]
    if (page) {
      states.push(
        await page.evaluate(() => ({
          visibility: document.visibilityState,
          status: document.querySelector(
            '[aria-label="Cuộc gọi tư vấn"] [role="status"]',
          )?.textContent,
          controls: globalThis.__mb384ControlClicks,
          mediaEvents: globalThis.__mb384MediaEvents,
          mediaControls: Array.from(
            document.querySelectorAll('button[aria-pressed]'),
            (button) => ({
              name: button.getAttribute('aria-label'),
              pressed: button.getAttribute('aria-pressed'),
            }),
          ).filter((button) => /^(Micro:|Camera:)/.test(button.name ?? '')),
          peers: (globalThis.__mb384Peers ?? []).map((peer) => ({
            connection: peer.connectionState,
            ice: peer.iceConnectionState,
            senders: peer.getSenders().map(({ track }) =>
              track
                ? {
                    kind: track.kind,
                    enabled: track.enabled,
                    muted: track.muted,
                    state: track.readyState,
                  }
                : null,
            ),
          })),
          hasJoin: [...document.querySelectorAll('button')].some(
            (button) => button.textContent === 'Tham gia phiên tư vấn',
          ),
        })),
      )
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
  }
  await writeFile(
    resolve(evidence, 'continuity-checkpoint.json'),
    JSON.stringify(
      { step, continuityChecks, transportEvents, states },
      null,
      2,
    ),
  )
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
  if (error instanceof Error && error.name === 'TimeoutError')
    console.error(
      error.message
        .split('\n')
        .filter((line) =>
          /waiting for|not visible|not stable|intercepts pointer|element was detached/.test(
            line,
          ),
        )
        .slice(0, 5)
        .join('\n'),
    )
  process.exitCode = 1
} finally {
  for (const context of contexts) await context.close()
  for (const owned of ownedBrowsers.reverse()) await owned.close()
  await browser?.close()
  await new Promise((done) => webhook.close(done))
  if (server && server.exitCode === null) server.kill()
}
