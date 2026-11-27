import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { extname, resolve, sep } from 'node:path'

const directory = fileURLToPath(new URL('.', import.meta.url))
const require = createRequire(new URL('../../package.json', import.meta.url))
const { chromium } = require('playwright')
const results = []
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.woff2': 'font/woff2' }
const server = createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname)
  if (pathname === '/favicon.ico') { response.writeHead(204).end(); return }
  const path = resolve(directory, '.' + pathname)
  if (!path.startsWith(directory.endsWith(sep) ? directory : directory + sep)) { response.writeHead(403).end(); return }
  try { response.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream' }).end(await readFile(path)) }
  catch { response.writeHead(404).end() }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`
const browser = await chromium.launch({ executablePath: process.env.PROTOTYPE_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true })
const test = async (name, callback) => {
  try { await callback(); results.push({ name, status: 'passed' }); console.log(`PASS ${name}`) }
  catch (error) { results.push({ name, status: 'failed', error: error.message }); console.log(`FAIL ${name}: ${error.message}`) }
}
const contexts = []
const errors = []
const network = []
async function pageFor(viewport = { width: 1440, height: 900 }, reducedMotion = 'no-preference', filename = 'support-plan-interactive-prototype.html') {
  const context = await browser.newContext({ viewport, reducedMotion, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' })
  contexts.push(context)
  await context.route('**/*', route => {
    const url = route.request().url()
    if (!url.startsWith(origin + '/')) { network.push(url); return route.abort() }
    return route.continue()
  })
  const page = await context.newPage()
  page.setDefaultTimeout(8000)
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(`${origin}/${filename}`)
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(() => Promise.all(document.getAnimations().filter(animation => animation.effect.getComputedTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {}))))
  await page.locator('.mb-support-workspace-header').waitFor()
  return page
}
const page = await pageFor()
const readValue = selector => page.locator(selector).inputValue()
const openFixture = async () => { if (!(await page.locator('.prototype-fixture').getAttribute('open') !== null)) await page.locator('.prototype-fixture summary').click() }
const fixture = async (attribute, value) => { await openFixture(); await page.locator(`.prototype-fixture [data-${attribute}="${value}"]`).click() }
const saved = async id => page.locator(`#${id}-save`).isDisabled()
const clickSave = async id => { await page.locator(`#${id}-save`).click(); await page.waitForFunction(id => !document.querySelector(`[data-activity="${id}"]`)?.hasAttribute('aria-busy'), id) }
const geometry = async targetPage => targetPage.evaluate(() => {
  const selectors = ['.ref-sidebar', '.ref-topbar', '.ref-brand', '.mb-support-workspace-header', '.mb-support-workspace-heading', '.mb-support-workspace-tabs']
  return Object.fromEntries(selectors.map(selector => {
    const element = document.querySelector(selector)
    const box = element.getBoundingClientRect()
    return [selector, { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height), font: getComputedStyle(element).fontFamily }]
  }))
})

try {
  await test('Exact shell geometry, workspace heading and four captured tabs', async () => {
    const baseline = await pageFor({ width: 1440, height: 900 }, 'no-preference', 'captured-baseline.html')
    assert.deepEqual(await geometry(page), await geometry(baseline))
    assert.equal(await page.getByRole('tab').count(), 4)
    assert.deepEqual(await page.getByRole('tab').allTextContents(), ['Hôm nay', 'Kế hoạch', 'Tiến triển', 'Điều chỉnh'])
    await baseline.close()
  })
  await test('Actual Be Vietnam Pro and Fraunces loaded for Vietnamese text', async () => {
    const fonts = await page.evaluate(async () => {
      const body = getComputedStyle(document.querySelector('.prototype-activity-title p')).fontFamily.split(',')[0].replaceAll('"', '').trim()
      const heading = getComputedStyle(document.querySelector('.mb-support-workspace-heading h1')).fontFamily.split(',')[0].replaceAll('"', '').trim()
      const sample = 'Kế hoạch hỗ trợ · Đi bộ nhẹ · Điều chỉnh · Cộng đồng'
      const bodyFaces = await document.fonts.load(`400 14px "${body}"`, sample)
      const headingFaces = await document.fonts.load(`500 28px "${heading}"`, sample)
      return { body, heading, bodyLoaded: bodyFaces.length > 0 && bodyFaces.every(face => face.status === 'loaded'), headingLoaded: headingFaces.length > 0 && headingFaces.every(face => face.status === 'loaded') }
    })
    assert.match(fonts.body, /Be.Vietnam.Pro/i)
    assert.match(fonts.heading, /Fraunces/i)
    assert.equal(fonts.bodyLoaded, true)
    assert.equal(fonts.headingLoaded, true)
    results.push({ name: 'Resolved font families', status: 'evidence', ...fonts })
  })
  await test('Save A pending and success preserve unsaved B', async () => {
    await page.locator('#A-duration').fill('15')
    await page.locator('#B-duration').fill('20')
    await page.locator('#A-save').click()
    assert.equal(await page.locator('[data-activity="A"]').getAttribute('aria-busy'), 'true')
    assert.equal(await readValue('#B-duration'), '20')
    await page.locator('#B-time').fill('20:00')
    await page.waitForFunction(() => !document.querySelector('[data-activity="A"]').hasAttribute('aria-busy'))
    assert.equal(await readValue('#B-duration'), '20')
    assert.equal(await readValue('#B-time'), '20:00')
    assert.equal(await saved('A'), true)
    assert.equal(await saved('B'), false)
  })
  await test('Undo A returns to its latest saved snapshot; editing again is dirty', async () => {
    await page.locator('#A-duration').fill('25')
    await page.locator('#A-undo').click()
    assert.equal(await readValue('#A-duration'), '15')
    assert.equal(await readValue('#B-duration'), '20')
    await page.locator('#A-duration').fill('30')
    assert.equal(await saved('A'), false)
  })
  await test('Simulated 412 retains A+B; authoritative reload affects only A', async () => {
    await fixture('outcome', 'CONFLICT')
    await clickSave('A')
    assert.equal(await readValue('#A-duration'), '30')
    assert.equal(await readValue('#B-duration'), '20')
    assert.equal(await page.locator('[data-reload="A"]').count(), 1)
    await page.locator('[data-reload="A"]').click()
    assert.equal(await readValue('#A-duration'), '15')
    assert.equal(await readValue('#A-time'), '19:40')
    assert.equal(await readValue('#B-duration'), '20')
    assert.equal(await readValue('#B-time'), '20:00')
    assert.equal(await saved('B'), false)
  })
  await test('Connection error retains editable draft and retry saves it', async () => {
    await page.locator('#A-duration').fill('25')
    await fixture('outcome', 'ERROR')
    await clickSave('A')
    assert.equal(await readValue('#A-duration'), '25')
    assert.match(await page.locator('#A-error').innerText(), /thay đổi.*vẫn còn/)
    assert.equal(await saved('A'), false)
    await clickSave('A')
    assert.equal(await page.locator('#A-error').count(), 0)
    assert.equal(await saved('A'), true)
  })
  await test('Invalid duration and empty weekly days explain and focus a field', async () => {
    await page.locator('#A-duration').fill('7')
    await page.locator('#A-save').click()
    assert.match(await page.locator('#A-error').innerText(), /bước 5 phút/)
    assert.equal(await page.locator('#A-duration').getAttribute('aria-invalid'), 'true')
    assert.equal(await page.evaluate(() => document.activeElement.id), 'A-duration')
    await page.locator('#A-duration').fill('25')
    await page.locator('label[for="A-day-1"]').click()
    await page.locator('label[for="A-day-4"]').click()
    await page.locator('#A-save').click()
    assert.match(await page.locator('#A-error').innerText(), /ít nhất một ngày/)
    assert.equal(await page.evaluate(() => document.activeElement.id), 'A-day-1')
    await page.locator('label[for="A-day-1"]').click()
  })
  await test('DRAFT activation blocked by dirty state until both actions saved/undone', async () => {
    await fixture('plan-state', 'DRAFT')
    assert.equal(await page.locator('#prototype-activate').isDisabled(), true)
    await page.locator('#A-undo').click()
    await page.locator('#B-undo').click()
    assert.equal(await page.locator('#prototype-activate').isEnabled(), true)
    await page.locator('#prototype-activate').click()
    assert.equal(await page.locator('#prototype-confirm').evaluate(element => element.open), true)
    assert.equal(await page.evaluate(() => document.activeElement.hasAttribute('data-confirm-cancel')), true)
    await page.locator('[data-confirm-cancel]').click()
    assert.equal(await page.evaluate(() => document.activeElement.id), 'prototype-activate')
    assert.match(await page.locator('[data-plan-status]').innerText(), /Bản nháp/)
  })
  await test('Lifecycle confirmation accept, PAUSED read-only and resume cancel/Escape', async () => {
    await fixture('plan-state', 'ACTIVE')
    await page.locator('#prototype-pause').click()
    await page.locator('[data-confirm-accept]').click()
    assert.equal(await page.locator('#A-duration').isDisabled(), true)
    assert.equal(await page.locator('#B-enabled').isDisabled(), true)
    assert.equal(await page.locator('#A-cadence').isDisabled(), true)
    await page.waitForFunction(() => document.activeElement.id === 'prototype-resume')
    await page.locator('#prototype-resume').click()
    await page.keyboard.press('Escape')
    assert.equal(await page.locator('#prototype-confirm').evaluate(element => element.open), false)
    assert.match(await page.locator('[data-plan-status]').innerText(), /tạm dừng/)
    await page.locator('#prototype-resume').click()
    await page.locator('[data-confirm-accept]').click()
    assert.equal(await page.locator('#A-duration').isEnabled(), true)
  })
  await test('Custom select supports arrows, Home/End, Enter, Escape and Tab', async () => {
    await page.locator('#A-cadence').focus()
    await page.keyboard.press('ArrowDown')
    assert.equal(await page.evaluate(() => document.activeElement.id), 'A-cadence-option-0')
    await page.keyboard.press('End')
    assert.equal(await page.evaluate(() => document.activeElement.id), 'A-cadence-option-2')
    await page.keyboard.press('Home')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    assert.match(await page.locator('#A-cadence').innerText(), /Mỗi ngày/)
    assert.equal(await page.evaluate(() => document.activeElement.id), 'A-cadence')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Escape')
    assert.equal(await page.locator('#A-cadence').getAttribute('aria-expanded'), 'false')
    assert.equal(await page.evaluate(() => document.activeElement.id), 'A-cadence')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Tab')
    assert.equal(await page.locator('#A-cadence').getAttribute('aria-expanded'), 'false')
    assert.equal(await page.evaluate(() => document.activeElement.id), 'A-daypart')
  })
  await test('Themed checkbox toggles with Space and retains keyboard focus', async () => {
    const before = await page.locator('#A-reminder').isChecked()
    await page.locator('#A-reminder').focus()
    await page.keyboard.press('Space')
    assert.equal(await page.locator('#A-reminder').isChecked(), !before)
    assert.equal(await page.evaluate(() => document.activeElement.id), 'A-reminder')
    const focus = await page.locator('label[for="A-reminder"] .prototype-check').evaluate(element => getComputedStyle(element).outlineWidth)
    assert.equal(focus, '3px')
  })
  await test('Community entry, bookmark simulation and return preserve plan draft/tab', async () => {
    await page.locator('#A-duration').fill('35')
    await page.locator('.prototype-community-entry').click()
    assert.equal(await page.locator('#prototype-community').isVisible(), true)
    assert.equal(await page.locator('.support-plan-page').isVisible(), false)
    assert.match(await page.locator('.prototype-fixture-note').innerText(), /không tải.*dữ liệu tài khoản thật/)
    await page.locator('[data-community-save]').click()
    assert.equal(await page.locator('[data-community-save]').getAttribute('aria-pressed'), 'true')
    await page.locator('.prototype-return').click()
    assert.equal(await page.locator('#panel-adjust').isVisible(), true)
    assert.equal(await readValue('#A-duration'), '35')
    assert.equal(await page.evaluate(() => document.activeElement.classList.contains('prototype-community-entry')), true)
  })
  await test('Loading, empty, error-retry and non-schedulable states remain reversible', async () => {
    for (const value of ['LOADING', 'EMPTY', 'ERROR', 'READ_ONLY']) {
      await fixture('source', value)
      assert.equal(await page.locator('.prototype-state').isVisible(), true)
      await fixture('source', 'READY')
      assert.equal(await readValue('#A-duration'), '35')
    }
  })
  await test('All four tabs are keyboard-operable without replacing the workspace', async () => {
    await page.locator('#tab-adjust').focus()
    await page.keyboard.press('Home')
    assert.equal(await page.locator('#tab-today').getAttribute('aria-selected'), 'true')
    await page.keyboard.press('ArrowRight')
    assert.equal(await page.locator('#panel-plan').isVisible(), true)
    await page.keyboard.press('End')
    assert.equal(await page.locator('#panel-adjust').isVisible(), true)
    assert.equal(await readValue('#A-duration'), '35')
  })
  for (const [width, height, name] of [[1440,900,'desktop'],[1280,800,'laptop'],[768,1024,'tablet'],[375,812,'mobile'],[640,400,'zoom-200-percent-equivalent']]) {
    await test(`No horizontal overflow and 44px new control targets at ${width}px`, async () => {
      const responsive = await pageFor({ width, height })
      const metrics = await responsive.evaluate(() => ({
        viewport: innerWidth, document: document.documentElement.scrollWidth,
        short: [...document.querySelectorAll('#prototype-editor button, #prototype-editor .prototype-choice, #prototype-editor .prototype-day > span, #prototype-editor input:not([type="checkbox"]), .prototype-community-entry')].filter(element => element.getClientRects().length && (element.getBoundingClientRect().height < 43.99 || element.getBoundingClientRect().width < 43.99)).map(element => ({ id: element.id, text: element.textContent, width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })),
      }))
      assert.ok(metrics.document <= metrics.viewport, JSON.stringify(metrics))
      assert.deepEqual(metrics.short, [])
      await responsive.screenshot({ path: resolve(directory, `prototype-${name}.png`), fullPage: true })
      if (width === 375) {
        await responsive.locator('.ref-mobile').click()
        assert.equal(await responsive.locator('.ref-shell').evaluate(element => element.classList.contains('mobile-open')), true)
        await responsive.locator('.ref-sidebar a[href="#community"]').click()
        assert.equal(await responsive.locator('#prototype-community').isVisible(), true)
        await responsive.screenshot({ path: resolve(directory, 'prototype-mobile-community.png'), fullPage: true })
        await responsive.locator('.prototype-return').click()
        assert.equal(await responsive.evaluate(() => document.activeElement.classList.contains('ref-mobile')), true)
        await responsive.locator('.ref-mobile').click()
        await responsive.keyboard.press('Escape')
        assert.equal(await responsive.locator('.ref-shell').evaluate(element => element.classList.contains('mobile-open')), false)
      }
      await responsive.close()
    })
  }
  await test('Reduced motion removes all prototype animations and transitions', async () => {
    const reduced = await pageFor({ width: 375, height: 812 }, 'reduce')
    const active = await reduced.evaluate(() => [...document.querySelectorAll('#prototype-editor *, #prototype-confirm *, #prototype-community *')].filter(element => {
      const style = getComputedStyle(element)
      return style.animationName !== 'none' || style.transitionDuration.split(',').some(value => parseFloat(value) > 0)
    }).map(element => element.className))
    assert.deepEqual(active, [])
    await reduced.screenshot({ path: resolve(directory, 'prototype-mobile-reduced-motion.png'), fullPage: true })
    await reduced.close()
  })
  await test('No JavaScript/render errors and no external/business API requests', async () => {
    assert.deepEqual(errors, [])
    assert.deepEqual(network, [])
  })
} finally {
  const report = { fixtureOnly: true, generatedAt: new Date().toISOString(), visualStitchApproval: 'pending parent review', zoom: '640x400 CSS viewport models 1280x800 at 200%; actual browser zoom still requires manual review', results }
  await writeFile(resolve(directory, 'prototype-qa-results.json'), JSON.stringify(report, null, 2) + '\n')
  await Promise.all(contexts.map(context => context.close().catch(() => {})))
  await browser.close()
  await new Promise(resolve => server.close(resolve))
}
if (results.some(result => result.status === 'failed')) process.exitCode = 1
