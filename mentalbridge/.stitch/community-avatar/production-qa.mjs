import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const directory = fileURLToPath(new URL('.', import.meta.url))
const app = resolve(directory, '../..')
const require = createRequire(resolve(app, 'package.json'))
const { chromium, expect } = require('@playwright/test')
const origin = 'http://127.0.0.1:3131'
const output = resolve(directory, 'production-qa')
const image = await readFile(resolve(directory, 'stitch-avatar-reference.png'))
const mediaId = '30000000-0000-4000-8000-000000000091'
const profileId = '10000000-0000-4000-8000-000000000091'
const photo = { mediaId, url: 'https://avatar.qa.invalid/photo.png', width: 512, height: 512 }
const time = '2026-10-13T13:00:00Z'
const initialProfile = { communityProfileId: profileId, displayName: 'Mầm Xanh QA', avatarPreset: 'SPROUT', avatarImage: null, status: 'ACTIVE', version: 2, createdAt: time, updatedAt: time }
const children = []
const report = { scope: 'Current production build; isolated synthetic Identity and browser Community responses, no shared DB/provider requests.', checks: [], captures: [], runtimeErrors: [], requests: [] }
let profile = structuredClone(initialProfile)
let avatarFailure = null
let pendingAvatar = null
let intentCount = 0
let uploadCount = 0
let finalizeCount = 0
let avatarCount = 0
const launch = (args, cwd, env) => {
  const child = spawn(process.execPath, args, { cwd, env: { ...process.env, ...env }, stdio: 'ignore', windowsHide: true })
  children.push(child)
}
const ready = async url => {
  const deadline = Date.now() + 45000
  while (Date.now() < deadline) {
    try { if ((await fetch(url)).ok) return } catch { /* bounded local startup */ }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(`QA helper unavailable: ${url}`)
}
const json = (route, body, status = 200, headers = {}) => route.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(body) })
const profileWire = () => ({ ...profile, avatarImage: profile.avatarImage ?? undefined })
const problem = (route, status, code) => json(route, { type: 'about:blank', title: 'Synthetic QA failure', code, status, correlationId: '62cda42f-b286-43c6-aa48-88ef64ff3361' }, status)
async function intercept(route) {
  const request = route.request()
  const url = new URL(request.url())
  if (url.hostname === 'avatar.qa.invalid') {
    if (url.pathname === '/upload') {
      uploadCount++
      return json(route, {}, 200, { 'Access-Control-Allow-Origin': origin })
    }
    return route.fulfill({ status: 200, contentType: 'image/png', body: image })
  }
  if (url.origin !== origin) throw new Error(`External request outside avatar QA: ${url.origin}`)
  if (!url.pathname.startsWith('/api/community/')) return route.continue()
  const path = url.pathname.slice('/api/community'.length)
  report.requests.push({ method: request.method(), path })
  if (path === '/profile' && request.method() === 'GET') return json(route, profileWire(), 200, { ETag: `"${profile.version}"` })
  if (path === '/profile' && request.method() === 'PUT') {
    if (request.headers()['if-match'] !== `"${profile.version}"`) return problem(route, 412, 'COMMUNITY_PROFILE_VERSION_MISMATCH')
    Object.assign(profile, request.postDataJSON(), { version: profile.version + 1 })
    return json(route, profileWire(), 200, { ETag: `"${profile.version}"` })
  }
  if (path === '/profile/avatar' && request.method() === 'PUT') {
    avatarCount++
    if (pendingAvatar) { const gate = pendingAvatar; pendingAvatar = null; await gate.promise }
    if (avatarFailure) { const failure = avatarFailure; avatarFailure = null; return problem(route, failure.status, failure.code) }
    if (request.headers()['if-match'] !== `"${profile.version}"`) return problem(route, 412, 'COMMUNITY_PROFILE_VERSION_MISMATCH')
    const body = request.postDataJSON()
    assert.deepEqual(Object.keys(body), ['mediaId'])
    assert.ok(body.mediaId === null || body.mediaId === mediaId)
    profile.avatarImage = body.mediaId === null ? null : photo
    profile.version++
    return json(route, profileWire(), 200, { ETag: `"${profile.version}"` })
  }
  if (path === '/media/upload-intents') {
    intentCount++
    assert.equal(request.postDataJSON().mediaType, 'IMAGE')
    return json(route, { mediaId, state: 'PENDING', version: 0, expiresAt: '2099-10-14T14:00:00Z', uploadUrl: 'https://avatar.qa.invalid/upload', uploadFields: { signature: 'synthetic-only' } })
  }
  if (path === `/media/${mediaId}/finalize`) {
    finalizeCount++
    return json(route, { mediaId, mediaType: 'IMAGE', state: 'READY', version: 1, createdAt: time, updatedAt: time })
  }
  if (path === '/topics') return json(route, [{ code: 'MY_STORY', label: 'Câu chuyện của tôi', description: 'Synthetic topic.' }])
  if (path === '/feed' || path === '/saved-posts') return json(route, { items: [], nextCursor: null, hasMore: false })
  throw new Error(`Unconfigured QA operation: ${request.method()} ${path}`)
}
async function capture(page, name) {
  const path = resolve(output, `${name}.png`)
  await page.screenshot({ path, fullPage: true, animations: 'disabled' })
  report.captures.push(path.split(/[\\/]/).at(-1))
}
async function stage(page, fileName = 'avatar.png') {
  await page.getByLabel('Chọn tệp ảnh đại diện').setInputFiles({ name: fileName, mimeType: 'image/png', buffer: image })
  await expect(page.getByText(fileName, { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Lưu ảnh đại diện', exact: true })).toBeEnabled()
}
function deferred() {
  let release
  const promise = new Promise(resolve => { release = resolve })
  return { promise, release }
}

await mkdir(output, { recursive: true })
launch(['scripts/identity-e2e-server.mjs'], app, { IDENTITY_E2E_PORT: '3231' })
launch(['server.js'], resolve(app, '.next/standalone'), {
  IDENTITY_API_BASE_URL: 'http://127.0.0.1:3231', CARE_API_BASE_URL: 'http://127.0.0.1:3231',
  CONTENT_SERVICE_URL: 'http://127.0.0.1:3231', CONSULTATION_SERVICE_URL: 'http://127.0.0.1:3231',
  COMMUNITY_SERVICE_URL: 'http://127.0.0.1:3231', JOURNAL_AI_SERVICE_URL: 'http://127.0.0.1:3231',
  HOSTNAME: '127.0.0.1', PORT: '3131',
})
let browser
try {
  await Promise.all([ready('http://127.0.0.1:3231/health'), ready(origin)])
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  const context = await browser.newContext({ locale: 'vi-VN', viewport: { width: 1280, height: 800 } })
  await context.addCookies([{ name: 'mentalbridge_access', value: 'synthetic-mb273-e2e-access', url: origin, httpOnly: true, sameSite: 'Lax' }])
  const page = await context.newPage()
  await page.route('**/*', intercept)
  page.on('pageerror', error => report.runtimeErrors.push(error.message))
  await page.goto(`${origin}/community`)
  await page.getByRole('link', { name: 'Danh tính', exact: true }).first().click()
  await expect(page.getByLabel('Tên hiển thị hoặc biệt danh')).toHaveValue(profile.displayName)
  for (const [width, height] of [[1440, 900], [1280, 800], [768, 1024], [375, 812], [640, 400]]) {
    await page.setViewportSize({ width, height })
    await page.evaluate(() => document.fonts.ready)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    assert.ok(await page.evaluate(() => document.fonts.check('14px "Be Vietnam Pro"')))
    const picker = await page.getByRole('button', { name: 'Chọn ảnh từ máy' }).boundingBox()
    assert.ok(picker && picker.width >= 44 && picker.height >= 44)
    await capture(page, `initial-${width}x${height}`)
    report.checks.push(`${width}x${height}: real UI, fonts, no overflow, picker44`)
  }
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.getByLabel('Tên hiển thị hoặc biệt danh').fill('Tên đang sửa')
  await stage(page)
  await page.evaluate(() => history.back())
  const leaveDialog = page.getByRole('dialog', { name: 'Rời trang khi chưa lưu?' })
  await expect(leaveDialog).toBeVisible()
  await leaveDialog.getByRole('button', { name: 'Tiếp tục chỉnh sửa' }).click()
  await expect(page.getByLabel('Tên hiển thị hoặc biệt danh')).toHaveValue('Tên đang sửa')
  await expect(page.getByText('avatar.png', { exact: true })).toBeVisible()
  report.checks.push('Browser Back cancel preserves local File and name draft')
  await capture(page, 'staged-desktop')
  avatarFailure = { status: 503, code: 'COMMUNITY_MEDIA_STORAGE_UNAVAILABLE' }
  await page.getByRole('button', { name: 'Lưu ảnh đại diện' }).click()
  await expect(page.getByRole('region', { name: 'Ảnh đại diện cộng đồng' }).getByRole('alert')).toContainText('Chưa lưu được ảnh')
  assert.equal(intentCount, 1)
  assert.equal(uploadCount, 1)
  await page.getByRole('button', { name: 'Lưu ảnh đại diện' }).click()
  await expect(page.getByRole('status')).toContainText('Đã lưu ảnh đại diện')
  assert.equal(intentCount, 1)
  assert.equal(uploadCount, 1)
  assert.equal(finalizeCount, 1)
  await expect(page.getByLabel('Tên hiển thị hoặc biệt danh')).toHaveValue('Tên đang sửa')
  assert.equal(await page.getByLabel('Ảnh đại diện hiện tại').locator('img').evaluate(el => getComputedStyle(el).objectFit), 'cover')
  report.checks.push('Save failure preserves photo/name; retry reuses ready media and commits confirmed photo')
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click()
  await expect(page.getByText('Đã lưu danh tính cộng đồng', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Lưu thay đổi', exact: true })).toBeEnabled()
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByLabel('Tên hiển thị hoặc biệt danh')).toHaveValue('Tên đang sửa')
  await expect(page.getByLabel('Ảnh đại diện hiện tại').locator('img')).toBeVisible()
  report.checks.push('Authoritative reload retains selected photo and saved independent name')
  const remove = page.getByRole('button', { name: 'Gỡ ảnh tải lên' })
  await remove.click()
  const dialog = page.getByRole('dialog', { name: 'Gỡ ảnh đại diện đã tải lên?' })
  await expect(dialog.getByRole('button', { name: 'Giữ ảnh' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(remove).toBeFocused()
  await remove.click()
  const gate = deferred()
  pendingAvatar = gate
  avatarFailure = { status: 503, code: 'COMMUNITY_TEMPORARILY_UNAVAILABLE' }
  const previousCount = avatarCount
  await dialog.getByRole('button', { name: 'Gỡ ảnh', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Đang gỡ ảnh…' })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  await capture(page, 'remove-pending')
  gate.release()
  await expect(dialog.getByRole('alert')).toContainText('Ảnh hiện tại vẫn được giữ')
  assert.equal(avatarCount, previousCount + 1)
  await capture(page, 'remove-error')
  await dialog.getByRole('button', { name: 'Giữ ảnh' }).click()
  await expect(dialog).not.toBeVisible()
  await expect(remove).toBeFocused()
  report.checks.push('Remove Escape/cancel restores trigger after pending/error rerenders, failure keeps current photo')
  await remove.click()
  await dialog.getByRole('button', { name: 'Gỡ ảnh', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Đã gỡ ảnh tải lên')
  await expect(page.getByLabel('Ảnh đại diện hiện tại').locator('.is-sprout svg')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Chọn ảnh từ máy' })).toBeFocused()
  report.checks.push('Confirmed remove returns to actual saved SPROUT and picker focus')
  await page.getByLabel('Tên hiển thị hoặc biệt danh').fill('Bản nháp sau xung đột')
  await stage(page, 'next.png')
  profile.version++
  profile.displayName = 'Tên ở nơi khác'
  await page.getByRole('button', { name: 'Lưu ảnh đại diện' }).click()
  await expect(page.getByRole('region', { name: 'Ảnh đại diện cộng đồng' }).getByRole('alert')).toContainText('Danh tính đã thay đổi')
  await expect(page.getByRole('button', { name: 'Lưu ảnh đại diện' })).toBeDisabled()
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Tải thông tin mới' })).toHaveCount(2)
  await page.getByRole('button', { name: 'Tải thông tin mới' }).last().click()
  await expect(page.getByRole('button', { name: 'Lưu ảnh đại diện' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Tải thông tin mới' })).toHaveCount(0)
  await expect(page.getByLabel('Tên hiển thị hoặc biệt danh')).toHaveValue('Bản nháp sau xung đột')
  report.checks.push('Reload from name conflict also clears photo conflict without discarding either draft')
  await page.setViewportSize({ width: 375, height: 812 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await capture(page, 'staged-mobile-reduced-motion')
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  await page.evaluate(() => history.back())
  await expect(leaveDialog).toBeVisible()
  await leaveDialog.getByRole('button', { name: 'Rời trang', exact: true }).click()
  await expect(page).toHaveURL(`${origin}/community`)
  report.checks.push('Confirmed browser Back returns to previous feed, reduced motion preserves feedback')
  assert.deepEqual(report.runtimeErrors, [])
  report.result = 'passed'
  await context.close()
} catch (error) {
  report.result = 'failed'
  report.failure = error.stack
  throw error
} finally {
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2))
  await browser?.close()
  for (const child of children) child.kill()
}
console.log(JSON.stringify({ result: report.result, checks: report.checks.length, captures: report.captures.length, intentCount, uploadCount, avatarCount }))
