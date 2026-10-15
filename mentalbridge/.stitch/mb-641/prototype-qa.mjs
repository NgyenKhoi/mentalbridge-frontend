import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createServer } from 'node:http'
import { resolve, extname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const directory = fileURLToPath(new URL('.', import.meta.url))
const require = createRequire(resolve(directory, '../../package.json'))
const { chromium } = require('playwright')
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.woff2': 'font/woff2',
}
await mkdir(resolve(directory, 'qa'), { recursive: true })
const server = createServer(async (req, res) => {
  const path = resolve(
    directory,
    '.' + decodeURIComponent(new URL(req.url, 'http://local').pathname),
  )
  if (!path.startsWith(directory.endsWith(sep) ? directory : directory + sep)) {
    res.writeHead(403).end()
    return
  }
  try {
    res
      .writeHead(200, {
        'Content-Type': mime[extname(path)] ?? 'application/octet-stream',
      })
      .end(await readFile(path))
  } catch {
    res.writeHead(404).end()
  }
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const results = [],
  errors = [],
  external = [],
  contexts = []
const ids = {
  occurrenceId: '11111111-1111-4111-8111-111111111641',
  actionId: '22222222-2222-4222-8222-222222222641',
}
const model = async (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('mb641-prototype-v1')))
const fixture = async (page, value) => {
  await page.locator('.emotion-fixture').evaluate((x) => (x.open = true))
  await page.locator(`[data-fixture="${value}"]`).click()
}
const test = async (name, fn) => {
  try {
    await fn()
    results.push({ name, status: 'passed' })
    console.log(`PASS ${name}`)
  } catch (e) {
    results.push({ name, status: 'failed', error: e.message })
    console.log(`FAIL ${name}: ${e.message}`)
  }
}
const open = async (
  viewport = { width: 1440, height: 900 },
  reducedMotion = 'reduce',
  file = 'support-plan-prototype.html',
) => {
  const context = await browser.newContext({
    viewport,
    reducedMotion,
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
  })
  contexts.push(context)
  await context.route('**/*', (route) =>
    route
      .request()
      .url()
      .startsWith(origin + '/')
      ? route.continue()
      : (external.push(route.request().url()), route.abort()),
  )
  const page = await context.newPage()
  page.setDefaultTimeout(6000)
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`${origin}/${file}`)
  await page.evaluate(() => document.fonts.ready)
  return page
}
const clickCheck = async (page) => {
  await page.locator('[data-reconcile]').click()
  await page.waitForFunction(
    () =>
      document.querySelector('#activity-A').getAttribute('aria-busy') !==
      'true',
  )
}
try {
  await test('Five viewport full-frame shell parity, loaded fonts, no overflow and 44px controls', async () => {
    for (const [name, width, height] of [
      ['desktop', 1440, 900],
      ['laptop', 1280, 800],
      ['tablet', 768, 1024],
      ['mobile', 375, 812],
      ['zoom-equivalent', 640, 400],
    ]) {
      const page = await open({ width, height })
      const baseline = await open(
        { width, height },
        'reduce',
        'support-plan-baseline.html',
      )
      const geometry = async (page) =>
        page.evaluate(() =>
          Object.fromEntries(
            [
              '.ref-sidebar',
              '.ref-topbar',
              '.ref-brand',
              '.mb-support-workspace-header',
              '.mb-support-workspace-heading',
              '.mb-support-workspace-tabs',
            ].map((s) => {
              const e = document.querySelector(s),
                r = e.getBoundingClientRect()
              return [
                s,
                {
                  x: Math.round(r.x),
                  y: Math.round(r.y),
                  width: Math.round(r.width),
                  height: Math.round(r.height),
                },
              ]
            }),
          ),
        )
      assert.deepEqual(await geometry(page), await geometry(baseline))
      assert.deepEqual(await page.getByRole('tab').allTextContents(), [
        'Hôm nay',
        'Kế hoạch',
        'Tiến triển',
        'Điều chỉnh',
      ])
      assert.equal(
        await page
          .locator('.ref-topbar')
          .getByRole('link', { name: 'Cộng đồng', exact: true })
          .getAttribute('href'),
        '/community',
      )
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      )
      for (const selector of ['[data-start]', '[data-reconcile]']) {
        const r = await page.locator(selector).boundingBox()
        assert.ok(r.height >= 43.99 && r.width >= 43.99)
      }
      const font = await page.evaluate(async () => {
        const text = 'Ghi nhận cảm xúc · Điều chỉnh · Thử lại',
          a = getComputedStyle(
            document.querySelector('.emotion-action p'),
          ).fontFamily,
          b = getComputedStyle(
            document.querySelector('.emotion-action h3'),
          ).fontFamily
        const body = await document.fonts.load(
            `400 14px ${a.split(',')[0]}`,
            text,
          ),
          head = await document.fonts.load(`600 22px ${b.split(',')[0]}`, text)
        return {
          a,
          b,
          body: body.length > 0 && body.every((x) => x.status === 'loaded'),
          head: head.length > 0 && head.every((x) => x.status === 'loaded'),
        }
      })
      assert.match(font.a, /Be.Vietnam.Pro/)
      assert.match(font.b, /Fraunces/)
      assert.equal(font.body, true)
      assert.equal(font.head, true)
      await page.screenshot({
        path: resolve(directory, 'qa', `plan-${name}.png`),
        fullPage: true,
        animations: 'disabled',
      })
      await page.close()
      await baseline.close()
    }
  })
  const page = await open()
  await test('Canonical form retains exact origin; saving does not complete activity; explicit return restores focus', async () => {
    await page.locator('[data-start]').click()
    await page
      .getByRole('heading', { name: 'Cảm xúc hôm nay', exact: true })
      .waitFor()
    assert.equal(
      new URL(page.url()).searchParams.get('occurrenceId'),
      ids.occurrenceId,
    )
    assert.equal(new URL(page.url()).searchParams.get('actionId'), ids.actionId)
    assert.equal(await page.locator('.ref-panel-mood form').count(), 1)
    await page
      .getByRole('radio', { name: 'Tốt', exact: true })
      .locator('..')
      .click()
    await page
      .getByRole('radio', { name: '3', exact: true })
      .locator('..')
      .click()
    await page
      .getByRole('button', { name: 'Lưu ghi nhận', exact: true })
      .click()
    await page
      .locator('[data-check-in-status]')
      .filter({ hasText: 'Đã lưu ghi nhận' })
      .waitFor()
    assert.equal((await model(page)).accepted, false)
    assert.equal((await model(page)).reconcileCount, 0)
    await page.locator('[data-return]').click()
    await page.waitForFunction(
      () => document.activeElement.id === 'activity-title-A',
    )
    assert.equal((await model(page)).accepted, false)
    assert.equal(await page.locator('[data-origin-note]').isVisible(), true)
    await page.screenshot({
      path: resolve(directory, 'qa', 'returned-before-check.png'),
      fullPage: true,
      animations: 'disabled',
    })
  })
  await test('Pending is local; authoritative completion persists; repeat and reload preserve time/version', async () => {
    await page.locator('[data-reconcile]').click()
    assert.equal(
      await page.locator('#activity-A').getAttribute('aria-busy'),
      'true',
    )
    assert.equal(await page.locator('[data-other-details]').isEnabled(), true)
    await page.waitForFunction(
      () =>
        document.querySelector('#activity-A').getAttribute('aria-busy') !==
        'true',
    )
    const accepted = await model(page)
    assert.equal(accepted.accepted, true)
    assert.equal(accepted.version, 1)
    assert.ok(accepted.completedAt)
    await clickCheck(page)
    const retry = await model(page)
    assert.equal(retry.version, accepted.version)
    assert.equal(retry.completedAt, accepted.completedAt)
    await page.reload()
    assert.equal(
      await page.locator('[data-outcome]').innerText(),
      'Đã ghi nhận hoàn thành',
    )
    assert.equal((await model(page)).completedAt, accepted.completedAt)
    await page.screenshot({
      path: resolve(directory, 'qa', 'accepted.png'),
      fullPage: true,
      animations: 'disabled',
    })
  })
  await test('Deletion and source absence never erase accepted history; unavailable never becomes missing/success', async () => {
    await fixture(page, 'deleted')
    await clickCheck(page)
    assert.equal((await model(page)).accepted, true)
    assert.match(
      await page.locator('[data-evidence-status]').innerText(),
      /trước khi xóa/,
    )
    await fixture(page, 'missing')
    await clickCheck(page)
    assert.equal((await model(page)).accepted, true)
    await fixture(page, 'unavailable')
    await clickCheck(page)
    assert.equal((await model(page)).accepted, true)
    assert.match(
      await page.locator('[data-evidence-status]').innerText(),
      /Trạng thái trước đó vẫn được giữ/,
    )
    await fixture(page, 'available')
    await clickCheck(page)
    assert.equal((await model(page)).accepted, true)
    await page.screenshot({
      path: resolve(directory, 'qa', 'history-source-missing.png'),
      fullPage: true,
      animations: 'disabled',
    })
  })
  await test('Missing/deleted not accepted; wrong zone and preactivation fact cannot become completion', async () => {
    await fixture(page, 'reset')
    await fixture(page, 'missing')
    await clickCheck(page)
    assert.equal((await model(page)).accepted, false)
    await fixture(page, 'deleted')
    await clickCheck(page)
    assert.equal((await model(page)).accepted, false)
    await fixture(page, 'mismatch')
    await clickCheck(page)
    assert.equal((await model(page)).accepted, false)
    assert.match(
      await page.locator('[data-evidence-status]').innerText(),
      /múi giờ/,
    )
    await fixture(page, 'available')
    await fixture(page, 'preactivation')
    await clickCheck(page)
    assert.equal((await model(page)).accepted, false)
    assert.match(
      await page.locator('[data-evidence-status]').innerText(),
      /trước khi kế hoạch/,
    )
  })
  await test('Check-in save failure retains choices and retry; delete dialog Escape focus then explicit deletion', async () => {
    await fixture(page, 'reset')
    await page.locator('[data-start]').click()
    await fixture(page, 'save-error')
    await page
      .getByRole('radio', { name: 'Tốt', exact: true })
      .locator('..')
      .click()
    await page
      .getByRole('radio', { name: '3', exact: true })
      .locator('..')
      .click()
    await page
      .getByRole('button', { name: 'Lưu ghi nhận', exact: true })
      .click()
    await page
      .locator('[data-check-in-status]')
      .filter({ hasText: 'Chưa thể lưu' })
      .waitFor()
    assert.equal(
      await page.getByRole('radio', { name: 'Tốt', exact: true }).isChecked(),
      true,
    )
    assert.equal((await model(page)).accepted, false)
    await fixture(page, 'available')
    await page
      .getByRole('button', { name: 'Lưu ghi nhận', exact: true })
      .click()
    await page.locator('[data-delete-check-in]').waitFor()
    await page.locator('[data-delete-check-in]').click()
    assert.equal(await page.getByRole('dialog').isVisible(), true)
    await page.keyboard.press('Escape')
    assert.equal(
      await page
        .locator('[data-delete-check-in]')
        .evaluate((x) => x === document.activeElement),
      true,
    )
    await page.locator('[data-delete-check-in]').click()
    await page.locator('[data-delete-confirm]').click()
    assert.equal((await model(page)).sourceState, 'DELETED')
    assert.equal((await model(page)).accepted, false)
    await page.locator('[data-return]').click()
  })
  await test('Explicit native draft activation and keyboard tabs preserve route ownership; factual partial recovery', async () => {
    await fixture(page, 'draft')
    await page.getByRole('tab', { name: 'Kế hoạch', exact: true }).click()
    assert.equal((await model(page)).planStatus, 'DRAFT')
    await page.locator('[data-activate]').click()
    await page.waitForFunction(
      () =>
        document.querySelector('#tab-today').getAttribute('aria-selected') ===
        'true',
    )
    assert.equal((await model(page)).planStatus, 'ACTIVE')
    await page.getByRole('tab', { name: 'Hôm nay', exact: true }).focus()
    await page.keyboard.press('ArrowRight')
    assert.equal(
      await page
        .getByRole('tab', { name: 'Kế hoạch', exact: true })
        .getAttribute('aria-selected'),
      'true',
    )
    await page.getByRole('tab', { name: 'Tiến triển', exact: true }).click()
    await fixture(page, 'unavailable')
    await page.locator('[data-progress-retry]').click()
    assert.match(
      await page.locator('[data-progress-status]').innerText(),
      /Dữ liệu đang hiển thị vẫn được giữ/,
    )
    assert.match(
      await page.locator('[data-progress-summary]').innerText(),
      /2ngày/,
    )
  })
  await test('Malformed origin cannot mutate nearby activity; reduced motion removes commit animation', async () => {
    const bad = await open(
      { width: 375, height: 812 },
      'reduce',
      `support-plan-prototype.html?returned=1&occurrenceId=wrong&actionId=${ids.actionId}`,
    )
    assert.equal(await bad.locator('[data-reconcile]').isVisible(), false)
    assert.match(
      await bad.locator('[data-origin-note]').innerText(),
      /Không xác định/,
    )
    await bad
      .locator('#activity-A')
      .evaluate((x) => x.classList.add('is-updated'))
    assert.equal(
      await bad
        .locator('.emotion-state')
        .evaluate((x) => getComputedStyle(x).animationName),
      'none',
    )
  })
  await test('Canonical dashboard full frames at desktop/mobile preserve shell and form with origin strip', async () => {
    for (const [name, width, height] of [
      ['desktop', 1440, 900],
      ['mobile', 375, 812],
    ]) {
      const page = await open(
        { width, height },
        'reduce',
        `dashboard-prototype.html?occurrenceId=${ids.occurrenceId}&actionId=${ids.actionId}#canonical-check-in`,
      )
      assert.equal(await page.locator('.ref-panel-mood form').count(), 1)
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      )
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({
        path: resolve(directory, 'qa', `dashboard-${name}.png`),
        fullPage: true,
        animations: 'disabled',
      })
      await page.locator('.emotion-return-strip').scrollIntoViewIfNeeded()
      await page.screenshot({
        path: resolve(
          directory,
          'qa',
          `dashboard-${name}-context-viewport.png`,
        ),
        animations: 'disabled',
      })
    }
  })
  await test('No external/business API calls or JavaScript errors', async () => {
    assert.deepEqual(external, [])
    assert.deepEqual(errors, [])
  })
} finally {
  await writeFile(
    resolve(directory, 'qa', 'report.json'),
    JSON.stringify(
      {
        results,
        errors,
        external,
        nativeExecution:
          'NOT_RUN — MB-666; browser prototype is not native runtime',
      },
      null,
      2,
    ),
  )
  await browser.close()
  await new Promise((resolve) => server.close(resolve))
}
if (results.some((x) => x.status === 'failed')) process.exitCode = 1
