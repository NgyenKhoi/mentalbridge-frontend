// MB-775: measures what Mầm costs on the production standalone build, flag off
// versus flag on, on this machine. Needs `npm run build` first. Starts the E2E
// fixture servers (3201, 3202) and the app (3100), so stop other E2E runs first.
// Writes docs/evidence/mb-775-mam-gate-measurements.json; the numbers are
// evidence for the budgets in docs/evidence/mb-775-mam-web-gate.md, not a
// device claim: headless Chromium on a dev machine says nothing about phones.
import { spawn } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { arch, cpus, platform, release, totalmem } from 'node:os'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'

const host = '127.0.0.1'
const ports = { identity: 3201, care: 3202, app: 3100 }
const base = `http://${host}:${ports.app}`
const standalone = resolve('.next', 'standalone')
const RUNS = Number(process.env.MAM_GATE_RUNS ?? 3)
const IDLE_MS = 10_000
// The gallery's one earned item must keep one key: a different unlockedAt per read
// is a new award and would celebrate on its own.
const OLD_AT = Date.now() - 5 * 3600_000
const CELEBRATION_LEAD_MS = 7_000 // the director coalesces for 10 s before the flight
const CELEBRATION_MS = 7_000
// MB-772 added /support-plan: the first route whose page needs a plan, mocked below.
const ROUTES = ['/achievements', '/journal', '/support-plan']
const MAM_PREFS = [
  'mentalbridge_mam_hidden',
  'mentalbridge_mam_motion',
  'mentalbridge_mam_session_muted',
]

const children = []
function start(args, env, cwd = process.cwd()) {
  const child = spawn('node', args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: 'ignore',
    windowsHide: true,
  })
  children.push(child)
  return child
}
async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return
  const exited = new Promise((done) => child.once('exit', done))
  const code = await new Promise((done) => {
    const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    })
    killer.once('exit', done)
    killer.once('error', () => done(-1))
  })
  // 128: the process was already gone, which is what stopping wants.
  if (code !== 0 && code !== 128)
    console.error(`[mam-gate] taskkill pid ${child.pid} exited with ${code}`)
  await Promise.race([exited, new Promise((done) => setTimeout(done, 5000))])
}
async function waitFor(url) {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return
    } catch {
      /* not up yet */
    }
    await new Promise((done) => setTimeout(done, 250))
  }
  throw new Error(`${url} did not become ready`)
}
async function portFree(port) {
  try {
    await fetch(`http://${host}:${port}/`)
    return false
  } catch {
    return true
  }
}

const appEnv = (flag) => ({
  IDENTITY_API_BASE_URL: `http://${host}:${ports.identity}`,
  CARE_API_BASE_URL: `http://${host}:${ports.care}`,
  CARE_API_TIMEOUT_MS: '3000',
  MAM_WEB_ENABLED: flag,
  CARE_QUESTIONNAIRE_LOCALE: 'vi-VN',
  CONTENT_SERVICE_URL: `http://${host}:${ports.identity}`,
  CONSULTATION_SERVICE_URL: `http://${host}:${ports.identity}`,
  COMMUNITY_SERVICE_URL: `http://${host}:${ports.identity}`,
  CONSULTATION_SERVICE_TIMEOUT_MS: '3000',
  JOURNAL_AI_SERVICE_URL: `http://${host}:${ports.identity}`,
  JOURNAL_AI_SERVICE_TIMEOUT_MS: '3000',
  HOSTNAME: host,
  PORT: String(ports.app),
})
async function startApp(flag) {
  const app = start(['server.js'], appEnv(flag), standalone)
  await waitFor(base)
  return app
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = sorted.length >> 1
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
}
const round = (value, digits = 2) => Number(value.toFixed(digits))

async function newContext(browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    timezoneId: 'Asia/Ho_Chi_Minh',
  })
  await context.addCookies([
    {
      name: 'mentalbridge_access',
      value: 'synthetic-resource-e2e-access',
      url: base,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
  return context
}

const gallery = (items) => ({
  visibilityState: 'VISIBLE',
  preferenceVersion: '0',
  policyVersion: 'achievement-rules-v1',
  calculatedAt: new Date().toISOString(),
  sources: [
    {
      domain: 'JOURNAL',
      availability: 'AVAILABLE',
      asOfLocalDate: new Date().toISOString().slice(0, 10),
    },
  ],
  items,
})
const earned = (id, title, unlockedAt) => ({
  definitionId: id,
  domain: 'JOURNAL',
  kind: 'MILESTONE',
  tier: 'FIRST_STEP',
  title,
  description: 'Mốc riêng tư dựa trên hoạt động đã lưu.',
  status: 'EARNED',
  evidenceClass: 'OWNER_SOURCE_FACT',
  unlockedAt: new Date(unlockedAt).toISOString(),
  ruleVersion: 'achievement-rules-v1',
  privacy: 'PRIVATE',
  progress: { current: 1, target: 1, unit: 'EVENT' },
})

// Frame stamps seen by requestAnimationFrame over `ms`, plus the moment the dock
// shows `data-flight="true"` (the hero one-shot is playing) and the moment it ends.
const sampleFrames = (ms) =>
  new Promise((done) => {
    const stamps = []
    const flight = { alreadyPlaying: false, start: null, end: null }
    const check = () => {
      const on =
        document.querySelector('[data-flight]')?.getAttribute('data-flight') ===
        'true'
      const now = performance.now()
      if (on && flight.start === null) {
        flight.start = now
        flight.alreadyPlaying = stamps.length === 0
      }
      if (!on && flight.start !== null && flight.end === null) flight.end = now
    }
    const observer = new MutationObserver(check)
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-flight'],
    })
    check()
    const end = performance.now() + ms
    const tick = (now) => {
      stamps.push(now)
      check()
      if (now < end) requestAnimationFrame(tick)
      else {
        observer.disconnect()
        done({ stamps, flight })
      }
    }
    requestAnimationFrame(tick)
  })

// Frame cadence inside [from, to] of the page clock; gaps over 33 ms are dropped frames.
function frameStats(stamps, from = -Infinity, to = Infinity) {
  const inside = stamps.filter((stamp) => stamp >= from && stamp <= to)
  const gaps = inside.slice(1).map((stamp, i) => stamp - inside[i])
  const sorted = [...gaps].sort((a, b) => a - b)
  return {
    frames: inside.length,
    fps: round((gaps.length * 1000) / (inside.at(-1) - inside[0]), 1),
    p95GapMs: round(sorted[Math.floor(sorted.length * 0.95)] ?? 0, 1),
    maxGapMs: round(sorted.at(-1) ?? 0, 1),
    gapsOver33ms: gaps.filter((gap) => gap > 33).length,
  }
}

async function metrics(cdp) {
  const { metrics: list } = await cdp.send('Performance.getMetrics')
  return Object.fromEntries(list.map(({ name, value }) => [name, value]))
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

// One measuring window. CPU is the TaskDuration delta over the CDP-clock delta.
// With `pollMs` the metrics are also polled so CPU can be taken over the hero
// one-shot alone; polling costs main-thread time, so the idle window is unpolled
// and the one-shot is compared with the polled stretch just before it.
async function sampleWindow(page, cdp, ms, pollMs = 0) {
  const polls = []
  const read = async () => {
    const m = await metrics(cdp)
    polls.push({
      at: m.Timestamp * 1000,
      task: m.TaskDuration * 1000,
      script: m.ScriptDuration * 1000,
    })
  }
  // Map the page clock onto the CDP clock from a read on each side of one evaluate.
  await read()
  const pageNow = await page.evaluate(() => performance.now())
  await read()
  const offset = (polls[0].at + polls[1].at) / 2 - pageNow
  let running = true
  const poller = (async () => {
    while (pollMs && running) {
      await sleep(pollMs)
      await read()
    }
  })()
  const { stamps, flight } = await page.evaluate(sampleFrames, ms)
  running = false
  await poller
  await read()
  const taskAt = (at) => {
    const next = polls.findIndex((poll) => poll.at >= at)
    if (next <= 0) return polls[Math.max(next, 0)].task
    const [a, b] = [polls[next - 1], polls[next]]
    return a.task + ((b.task - a.task) * (at - a.at)) / (b.at - a.at)
  }
  const cpu = (from, to) =>
    round(((taskAt(to) - taskAt(from)) / (to - from)) * 100)
  const first = polls[1]
  const last = polls.at(-1)
  const result = {
    elapsedMs: round(last.at - first.at, 1),
    cpuPercent: cpu(first.at, last.at),
    scriptMs: round(last.script - first.script),
    ...frameStats(stamps),
  }
  if (flight.start !== null) {
    const end = flight.end ?? stamps.at(-1)
    result.flight = {
      alreadyPlayingAtStart: flight.alreadyPlaying,
      ended: flight.end !== null,
      durationMs: round(end - flight.start, 1),
      cpuPercent: cpu(flight.start + offset, end + offset),
      ...frameStats(stamps, flight.start, end),
    }
    result.beforeFlight = {
      durationMs: round(flight.start - stamps[0], 1),
      cpuPercent: cpu(first.at, flight.start + offset),
      ...frameStats(stamps, -Infinity, flight.start),
    }
  }
  return result
}

// The plan fixture is TypeScript with type-only imports; the installed
// TypeScript compiler strips the types (works on Node 20, unlike Node's own
// type stripping), so the script keeps one source of truth with the tests.
let supportPlanFixture
async function planFixture() {
  if (!supportPlanFixture) {
    const { default: ts } = await import('typescript')
    const { outputText } = ts.transpileModule(
      await readFile(
        'features/support-plan/testing/native-support-plan-fixture.ts',
        'utf8',
      ),
      { compilerOptions: { module: ts.ModuleKind.ESNext } },
    )
    const f = await import(
      `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
    )
    supportPlanFixture = {
      plan: f.nativeSupportPlanFixture(),
      occurrence: f.emotionOccurrenceFixture(),
    }
  }
  return supportPlanFixture
}

// An active plan with today's one open Emotion check-in: Today shows its card,
// which carries Mầm's button with the flag on.
async function mockSupportPlan(page) {
  const { plan, occurrence: base } = await planFixture()
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date())
  const occurrence = {
    ...base,
    localDate: today,
    scheduledAt: `${today}T12:00:00Z`,
    displayState: 'SCHEDULED',
  }
  await page.route('**/api/care/**', (handler) => {
    const { pathname } = new URL(handler.request().url())
    const json = (body, status = 200) =>
      handler.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      })
    if (pathname === '/api/care/v2/support-plans/current') return json(plan)
    if (pathname === '/api/care/v2/support-plans/current-draft')
      return json(
        {
          type: 'about:blank',
          title: 'SUPPORT_PLAN_DRAFT_NOT_FOUND',
          status: 404,
          code: 'SUPPORT_PLAN_DRAFT_NOT_FOUND',
        },
        404,
      )
    if (pathname === '/api/care/v2/support-plans/history')
      return json({ items: [], hasMore: false, nextCursor: null })
    if (pathname === '/api/care/v2/support-plan-occurrences')
      return json({
        supportPlanId: plan.supportPlanId,
        supportPlanStatus: plan.status,
        representationMode: plan.representationMode,
        from: today,
        through: today,
        occurrences: [occurrence],
        interpretationCode:
          'SELF_REPORTED_WELLBEING_ACTIVITY_NOT_TREATMENT_ADHERENCE',
      })
    return handler.fallback()
  })
}

async function measure(browser, flag, route) {
  const context = await newContext(browser)
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Performance.enable')
  const seen = new Map()
  cdp.on('Network.responseReceived', ({ requestId, response, type }) =>
    seen.set(requestId, { url: response.url, type, bytes: 0 }),
  )
  cdp.on('Network.loadingFinished', ({ requestId, encodedDataLength }) => {
    const entry = seen.get(requestId)
    if (entry) entry.bytes = encodedDataLength
  })
  await page.route('**/api/achievements?*', (handler) =>
    handler.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { ETag: '"0"' },
      body: JSON.stringify(gallery([earned('old', 'Cũ', OLD_AT)])),
    }),
  )
  if (route === '/support-plan') await mockSupportPlan(page)
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto(`${base}${route}`, { waitUntil: 'load' })
  if (flag === 'true')
    await page.waitForSelector(
      '[data-mam-dock] [data-mam-status="ready"], [data-mam-dock] [data-mam-status="fallback"]',
      { timeout: 30_000 },
    )
  await page.waitForTimeout(2000)
  const idle = await sampleWindow(page, cdp, IDLE_MS)
  if (idle.flight)
    throw new Error(
      'A celebration played in the idle window; it must stay baseline-only.',
    )
  await cdp.send('HeapProfiler.collectGarbage')
  const heap = (await cdp.send('Runtime.getHeapUsage')).usedSize
  const entries = [...seen.values()]
  const scripts = entries.filter((entry) => entry.type === 'Script')
  const result = {
    route,
    dockCount: await page.locator('[data-mam-dock]').count(),
    status: await page
      .locator('[data-mam-dock] [data-mam-status]')
      .getAttribute('data-mam-status')
      .catch(() => null),
    transfer: {
      jsBytes: scripts.reduce((sum, entry) => sum + entry.bytes, 0),
      totalBytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
      mam: entries
        .filter((entry) => new URL(entry.url).pathname.startsWith('/mam/'))
        .map(({ url, bytes }) => ({ path: new URL(url).pathname, bytes })),
      scriptUrls: scripts.map((entry) => new URL(entry.url).pathname),
    },
    idle,
    heapBytes: heap,
    pageErrors,
  }

  if (flag === 'true' && route === '/achievements') {
    const dispatch = (awards) =>
      page.evaluate((list) => {
        window.dispatchEvent(
          new CustomEvent('mam:award-read', {
            detail: {
              scope: 'achievements:JOURNAL',
              available: true,
              visible: true,
              readAt: Date.now(),
              awards: list,
            },
          }),
        )
      }, awards)
    const at = (ago) => Date.now() - ago
    const old = {
      key: `achievement:old:${new Date(OLD_AT).toISOString()}`,
      kind: 'achievement',
      at: OLD_AT,
      title: 'Cũ',
    }
    const fresh = {
      key: `achievement:new:${new Date(at(60_000)).toISOString()}`,
      kind: 'achievement',
      at: at(60_000),
      title: 'Bước đầu tiên',
    }
    await dispatch([old, fresh])
    // The director waits 10 s to coalesce, then the hero flies for about 1.7 s and
    // the bubble opens. Sample from before the flight: the window starts at 7 s
    // and the dock's `data-flight` attribute witnesses the flight inside it.
    await sleep(CELEBRATION_LEAD_MS)
    const flyingEarly = await page.locator('[data-flight="true"]').count()
    const sample = await sampleWindow(page, cdp, CELEBRATION_MS, 100)
    result.celebration = {
      played:
        flyingEarly === 0 &&
        sample.flight !== undefined &&
        sample.flight.ended &&
        !sample.flight.alreadyPlayingAtStart,
      ...sample,
    }
  }
  await context.close()
  return result
}

function summarize(runs) {
  const pick = (get) => {
    const values = runs.map(get)
    return {
      median: round(median(values)),
      min: round(Math.min(...values)),
      max: round(Math.max(...values)),
    }
  }
  const summary = {
    jsBytes: pick((run) => run.transfer.jsBytes),
    totalBytes: pick((run) => run.transfer.totalBytes),
    mamBytes: pick((run) =>
      run.transfer.mam.reduce((sum, entry) => sum + entry.bytes, 0),
    ),
    idleCpuPercent: pick((run) => run.idle.cpuPercent),
    idleFps: pick((run) => run.idle.fps),
    idleMaxGapMs: pick((run) => run.idle.maxGapMs),
    heapBytes: pick((run) => run.heapBytes),
  }
  const celebrated = runs.filter((run) => run.celebration)
  if (celebrated.length) {
    const played = celebrated
      .map((run) => run.celebration)
      .filter((c) => c.played)
    summary.celebration = {
      flightWitnessed: `${played.length}/${celebrated.length}`,
    }
    if (played.length) {
      const med = (get) => round(median(played.map(get)))
      Object.assign(summary.celebration, {
        flightMs: med((c) => c.flight.durationMs),
        flightCpuPercent: med((c) => c.flight.cpuPercent),
        beforeFlightCpuPercent: med((c) => c.beforeFlight.cpuPercent),
        windowCpuPercent: med((c) => c.cpuPercent),
        flightFps: med((c) => c.flight.fps),
        flightMaxGapMs: Math.max(...played.map((c) => c.flight.maxGapMs)),
        flightGapsOver33ms: Math.max(
          ...played.map((c) => c.flight.gapsOver33ms),
        ),
      })
    }
  }
  return summary
}

// Rollback drill: the flag flips with an env change and a server restart, never
// a rebuild; one browser context carries the user's choices through all three.
async function drill(browser) {
  const steps = []
  const context = await newContext(browser)
  const page = await context.newPage()
  const mamRequests = []
  page.on('request', (request) => {
    const { pathname } = new URL(request.url())
    if (pathname.startsWith('/mam/')) mamRequests.push(pathname)
  })
  const prefs = () =>
    page.evaluate(
      (keys) => ({
        hidden: localStorage.getItem(keys[0]),
        motion: localStorage.getItem(keys[1]),
        muted: sessionStorage.getItem(keys[2]),
      }),
      MAM_PREFS,
    )
  const observe = async (label, flag) => {
    const app = await startApp(flag)
    mamRequests.length = 0
    await page.goto(`${base}/journal`, { waitUntil: 'load' })
    await page.waitForTimeout(2500)
    steps.push({
      step: label,
      flag,
      dockElements: await page.locator('[data-mam-dock]').count(),
      showHandle: await page.getByRole('button', { name: 'Hiện Mầm' }).count(),
      mamRequests: mamRequests.length,
      preferences: await prefs(),
    })
    return app
  }
  let app = await observe('flag on, fresh user', 'true')
  await page.getByRole('button', { name: 'Mầm', exact: true }).click()
  await page.getByRole('button', { name: 'Ẩn Mầm' }).click()
  await page.evaluate(() =>
    localStorage.setItem('mentalbridge_mam_motion', 'reduced'),
  )
  steps.push({
    step: 'user hides Mầm and turns motion off',
    preferences: await prefs(),
  })
  await stop(app)
  app = await observe('rollback: flag off, server restarted', 'false')
  await stop(app)
  app = await observe('roll forward: flag on, server restarted', 'true')
  await stop(app)
  await context.close()
  return steps
}

for (const port of Object.values(ports))
  if (!(await portFree(port)))
    throw new Error(`Port ${port} is in use; stop other E2E runs first.`)

const browser = await chromium.launch()

// One idempotent cleanup for normal end, failure and SIGINT/SIGTERM: close the
// browser, stop every child and wait for it, then check the ports are free.
let cleanup
const cleanUp = () =>
  (cleanup ??= (async () => {
    await browser.close().catch((error) => {
      console.error(`[mam-gate] browser close failed: ${error.message}`)
    })
    await Promise.all([...children].reverse().map(stop))
    for (const port of Object.values(ports)) {
      let free = false
      for (let i = 0; i < 20 && !free; i++) {
        free = await portFree(port)
        if (!free) await sleep(250)
      }
      if (!free) {
        console.error(`[mam-gate] port ${port} is still in use after cleanup`)
        process.exitCode = 1
      }
    }
  })())
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, async () => {
    await cleanUp()
    process.exit(130)
  })
const output = {
  meta: {
    story: 'MB-775',
    date: new Date().toISOString(),
    machine: {
      cpu: cpus()[0].model.trim(),
      logicalCores: cpus().length,
      memoryGiB: round(totalmem() / 2 ** 30, 1),
      os: `${platform()} ${release()} ${arch()}`,
      node: process.version,
    },
    browser: `Chromium ${browser.version()} headless (Playwright)`,
    build: 'production standalone (.next/standalone)',
    runsPerCell: RUNS,
    idleWindowMs: IDLE_MS,
    note: 'Fixture backends; the Achievements gallery returns one earned item, 5 h old (a silent baseline); cold browser context per run; the idle window is unpolled, the celebration window polls CDP metrics at 10 Hz. Dev-machine numbers, not device numbers.',
  },
  runs: {},
  summary: {},
}
try {
  children.push(start(['scripts/identity-e2e-server.mjs'], {}))
  await waitFor(`http://${host}:${ports.identity}/health`)
  children.push(
    start(['scripts/identity-e2e-server.mjs'], {
      IDENTITY_E2E_PORT: String(ports.care),
    }),
  )
  await waitFor(`http://${host}:${ports.care}/health`)

  for (const flag of ['false', 'true']) {
    const app = await startApp(flag)
    output.runs[flag] = {}
    for (const route of ROUTES) {
      output.runs[flag][route] = []
      for (let i = 0; i < RUNS; i++) {
        console.log(`[mam-gate] flag=${flag} ${route} run ${i + 1}/${RUNS}`)
        output.runs[flag][route].push(await measure(browser, flag, route))
      }
      output.summary[`${flag === 'true' ? 'on' : 'off'} ${route}`] = summarize(
        output.runs[flag][route],
      )
    }
    await stop(app)
  }

  // Scripts only the flag-on run loads are Mầm's chunks (Rive runtime, dock).
  for (const route of ROUTES) {
    const off = new Set(
      output.runs.false[route].flatMap((run) => run.transfer.scriptUrls),
    )
    output.summary[`mam-only scripts ${route}`] = [
      ...new Set(
        output.runs.true[route].flatMap((run) =>
          run.transfer.scriptUrls.filter((url) => !off.has(url)),
        ),
      ),
    ]
  }
  output.rollbackDrill = await drill(browser)
} finally {
  await cleanUp()
}

await writeFile(
  'docs/evidence/mb-775-mam-gate-measurements.json',
  `${JSON.stringify(output, null, 2)}\n`,
  'utf8',
)
console.log(JSON.stringify(output.summary, null, 2))
console.log(JSON.stringify(output.rollbackDrill, null, 2))
