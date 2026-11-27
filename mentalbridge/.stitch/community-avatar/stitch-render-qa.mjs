import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createServer } from 'node:http'
import { resolve } from 'node:path'

const require = createRequire(new URL('../../package.json', import.meta.url))
const { chromium } = require('@playwright/test')
const directory = resolve(new URL('./', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'))
const output = resolve(directory, 'stitch-render-qa')
const desktop = await readFile(resolve(directory, 'stitch-desktop-approved.html'), 'utf8')
const referenceImageUrl = desktop.match(/id="live-preview-img" src="([^"]+)"/)[1]
const image = await readFile(resolve(directory, 'stitch-avatar-reference.png'))
const server = createServer(async (request, response) => {
  const name = new URL(request.url, 'http://localhost').pathname.slice(1)
  if (!['stitch-desktop-approved.html', 'stitch-mobile-approved.html'].includes(name)) { response.writeHead(404).end(); return }
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  response.end(await readFile(resolve(directory, name)))
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage()
const report = { result: 'pending', checks: [], errors: [], captures: [], images: [] }
page.on('pageerror', error => report.errors.push(error.message))
await page.route(referenceImageUrl, route => route.fulfill({ contentType: 'image/png', body: image }))
try {
  for (const [name, width, height] of [['desktop', 1440, 900], ['mobile', 375, 812]]) {
    await page.setViewportSize({ width, height })
    await page.goto(`http://127.0.0.1:${server.address().port}/stitch-${name}-approved.html`)
    await page.evaluate(() => document.fonts.ready)
    await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0))
    const result = await page.evaluate(() => ({ headerHeight: document.querySelector('header').getBoundingClientRect().height, routes: [...document.querySelectorAll('header a,nav a')].map(link => link.getAttribute('href')), images: [...document.images].map(image => ({ width: image.naturalWidth, height: image.naturalHeight, fit: getComputedStyle(image).objectFit })), fonts: [...document.fonts].filter(font => font.status === 'loaded').map(font => font.family), overflow: document.documentElement.scrollWidth > innerWidth + 1, safety: { tag: document.querySelector('[aria-label="Mở hỗ trợ khẩn cấp"]').tagName, paths: [...document.querySelectorAll('[aria-label="Mở hỗ trợ khẩn cấp"] svg path')].map(path => path.getAttribute('d')) } }))
    assert.equal(result.headerHeight, name === 'desktop' ? 68 : 64)
    for (const route of ['/community', '/community/saved', '/community/profile', '/dashboard', '/safety-directory']) assert.ok(result.routes.includes(route))
    assert.equal(result.overflow, false)
    assert.equal(result.safety.tag, 'BUTTON')
    assert.equal(result.safety.paths.length, 4)
    assert.ok(result.safety.paths[0].startsWith('M12 11.3 8.9 8.4'))
    assert.ok(result.fonts.some(font => font.includes('Be Vietnam Pro')))
    assert.ok(result.images.every(image => image.width > 0 && image.fit === 'cover'))
    const path = resolve(output, `${name}-${width}x${height}.png`)
    await page.screenshot({ path, fullPage: true })
    report.checks.push({ name, width, height, ...result })
    report.captures.push(path.split(/[\\/]/).at(-1))
  }
  assert.deepEqual(report.errors, [])
  report.result = 'passed'
} catch (error) { report.result = 'failed'; report.failure = error.stack; throw error } finally {
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2))
  await browser.close()
  await new Promise(resolve => server.close(resolve))
  console.log(JSON.stringify({ result: report.result, checks: report.checks.length, captures: report.captures.length }))
}
