import { createRequire } from 'node:module'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const directory = fileURLToPath(new URL('.', import.meta.url))
const app = resolve(directory, '../..')
const require = createRequire(resolve(app, 'package.json'))
const { JSDOM } = require('jsdom')
const fontAssets = new Map()
await mkdir(resolve(directory, 'fonts'), { recursive: true })
const smile =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 14s1 3 4 3 4-3 4-3M8 9h.01M16 9h.01"/></svg>'
const check =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4 10-10"/></svg>'

for (const route of ['support-plan', 'dashboard']) {
  const source = await readFile(
    resolve(directory, 'baseline', `${route}-desktop.html`),
    'utf8',
  )
  const document = new JSDOM(source).window.document
  const css = []
  for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
    const url = new URL(link.href)
    const cssPath = resolve(app, '.next', url.pathname.replace('/_next/', ''))
    let content = await readFile(cssPath, 'utf8')
    for (const [, reference] of content.matchAll(
      /url\(["']?([^)'"\s]+)["']?\)/g,
    )) {
      if (reference.startsWith('data:') || !reference.includes('.woff2'))
        continue
      const assetUrl = new URL(reference, url)
      const filename = assetUrl.pathname.split('/').at(-1)
      if (!fontAssets.has(filename)) {
        await writeFile(
          resolve(directory, 'fonts', filename),
          await readFile(
            resolve(app, '.next', assetUrl.pathname.replace('/_next/', '')),
          ),
        )
        fontAssets.set(filename, true)
      }
      content = content.split(reference).join(`fonts/${filename}`)
    }
    css.push(content)
    link.remove()
  }
  await writeFile(resolve(directory, `${route}-baseline.css`), css.join('\n'))
  document
    .querySelectorAll(
      'script,nextjs-portal,next-route-announcer,link[rel="preload"],link[rel="icon"]',
    )
    .forEach((x) => x.remove())
  const baselineLink = document.createElement('link')
  baselineLink.rel = 'stylesheet'
  baselineLink.href = `${route}-baseline.css`
  document.head.append(baselineLink)
  await writeFile(
    resolve(directory, `${route}-baseline.html`),
    '<!doctype html>\n' + document.documentElement.outerHTML,
  )
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = 'prototype.css'
  document.head.append(link)
  document.title = `MB-641 — Mô phỏng ${route}`
  document.body.dataset.route = route
  if (route === 'support-plan') {
    const column = document.querySelector('.support-plan-activities-col')
    column.querySelector(':scope > p').remove()
    column.querySelector('.support-plan-count-badge').textContent = '2 mục'
    const region = document.createElement('div')
    region.innerHTML = `<article class="emotion-action" id="activity-A" aria-labelledby="activity-title-A">
      <div class="emotion-action-top"><span class="emotion-mark">${smile}</span><div><p class="emotion-meta">Ghi nhận cảm xúc · 19:00 · 5 phút</p><h3 id="activity-title-A" tabindex="-1">Dành một phút nhìn lại cảm xúc</h3></div></div>
      <p class="emotion-state" data-outcome>${check}<span>Chưa ghi nhận hoàn thành</span></p>
      <ul class="emotion-purpose"><li>Nhận biết điều bạn đang cảm nhận.</li><li>Ghi nhận một lần theo nhịp bạn đã chọn.</li></ul>
      <div data-origin-note></div><p data-evidence-status role="status" aria-live="polite"></p>
      <div class="emotion-actions"><a class="btn btn-primary" data-start>Ghi nhận cảm xúc</a><button class="btn btn-outline" type="button" data-reconcile>Kiểm tra ghi nhận</button></div>
      <p class="emotion-context">Mở phần Cảm xúc hôm nay trên trang Tổng quan. Sau khi lưu, quay lại hoạt động này để kiểm tra ghi nhận.</p>
    </article>
    <article class="emotion-secondary" id="activity-B"><div><span class="emotion-meta">Bài đọc · 19:05 · 5 phút</span><h3>Chuẩn bị một nhịp ngủ dễ chịu hơn</h3><p>Một bài đọc để chuẩn bị nhịp nghỉ ngơi.</p></div><button class="btn btn-outline" data-other-details type="button">Xem chi tiết</button></article>`
    column.querySelector('.support-plan-col-header').after(region)
    document.querySelector(
      '.support-plan-rhythm-card .support-plan-side-card-desc',
    ).textContent =
      'Bạn có thể thực hiện từng hoạt động theo nhịp phù hợp; không cần hoàn thành tất cả hôm nay.'
    const planPanel = document.querySelector('#panel-plan')
    planPanel.innerHTML = `<section class="emotion-plan-review" aria-labelledby="review-title"><p class="emotion-meta">Kế hoạch được đề xuất</p><h2 id="review-title">Một phút để nhận biết cảm xúc</h2><p>Hoạt động này được thêm vì bạn đã chọn ghi nhận cảm xúc trong phần điều chỉnh.</p><ul class="emotion-purpose"><li>Mục tiêu: nhận biết điều bạn đang cảm nhận.</li><li>Nhịp dự kiến: mỗi ngày lúc19:00 ·5phút.</li></ul><p>Ghi nhận không tự thay đổi những hoạt động khác trong kế hoạch.</p><div data-review-status role="status"></div><button class="btn btn-primary" data-activate type="button">Bắt đầu kế hoạch</button></section>`
    const progress = document.createElement('section')
    progress.id = 'panel-progress'
    progress.className = 'support-plan-tab-pane is-hidden'
    progress.setAttribute('role', 'tabpanel')
    progress.setAttribute('aria-labelledby', 'tab-progress')
    progress.innerHTML =
      '<div class="emotion-progress"><h2>Nhịp ghi nhận cảm xúc</h2><p data-progress-summary>Trong7ngày gần đây, bạn có2ngày ghi nhận cảm xúc.</p><p>Đây là số ngày có ghi nhận, không phải điểm sức khỏe hoặc đánh giá mức độ cố gắng.</p><button class="btn btn-outline" data-progress-retry type="button">Tải lại ghi nhận</button><p data-progress-status role="status"></p></div>'
    document.querySelector('.support-plan-card').append(progress)
    document.querySelector('#panel-adjust').innerHTML =
      '<section class="emotion-plan-review"><h2>Nhịp ghi nhận đã chọn</h2><p>Mỗi ngày lúc19:00 ·5phút. Thay đổi lịch dùng trình điều chỉnh hiện có; không tự thay đổi theo cảm xúc.</p></section>'
  } else {
    const card = document.querySelector('.ref-panel-mood > div')
    card.id = 'canonical-check-in'
    const strip = document.createElement('section')
    strip.className = 'emotion-return-strip'
    strip.setAttribute('aria-label', 'Quay lại hoạt động')
    strip.innerHTML =
      '<p>Đang ghi nhận cho hoạt động trong kế hoạch</p><strong>Dành một phút nhìn lại cảm xúc</strong><p data-return-status>Lưu cảm xúc xong, bạn có thể quay lại để kiểm tra hoạt động.</p><a class="btn btn-outline" data-return>Quay lại hoạt động</a>'
    card.querySelector('header').after(strip)
    const status = card.querySelector('[role="status"]')
    if (status) status.dataset.checkInStatus = ''
    else {
      const p = document.createElement('p')
      p.setAttribute('role', 'status')
      p.dataset.checkInStatus = ''
      card.append(p)
    }
    const remove = document.createElement('button')
    remove.type = 'button'
    remove.dataset.deleteCheckIn = ''
    remove.className = 'btn btn-outline'
    remove.textContent = 'Xóa ghi nhận đã lưu'
    remove.hidden = true
    card.append(remove)
    for (const field of card.querySelectorAll('input[type="radio"]'))
      field.addEventListener?.('change', () => {})
  }
  const fixture = document.createElement('details')
  fixture.className = 'emotion-fixture'
  fixture.innerHTML =
    '<summary>Mô phỏng tương tác — không dùng dữ liệu thật</summary><p>Điều khiển dưới đây chỉ để kiểm tra prototype. Không gọi API, không lưu dữ liệu tài khoản hay sức khỏe thật.</p><div><button type="button" data-fixture="reset">Bắt đầu lại</button><button type="button" data-fixture="missing">Chưa có ghi nhận</button><button type="button" data-fixture="deleted">Đã xóa nguồn</button><button type="button" data-fixture="unavailable">Lỗi khi kiểm tra</button><button type="button" data-fixture="available">Khôi phục kết nối</button><button type="button" data-fixture="save-error">Lỗi khi lưu</button><button type="button" data-fixture="mismatch">Khác múi giờ</button><button type="button" data-fixture="preactivation">Ghi nhận trước kế hoạch</button><button type="button" data-fixture="draft">Đề xuất mới</button><button type="button" data-fixture="removed">Hoạt động đã thay đổi</button></div><p data-fixture-status role="status"></p></details>'
  document.querySelector('.ref-content').append(fixture)
  const dialog = document.createElement('dialog')
  dialog.id = 'delete-confirm'
  dialog.setAttribute('aria-labelledby', 'delete-title')
  dialog.innerHTML =
    '<h2 id="delete-title">Xóa ghi nhận hôm nay?</h2><p>Ghi nhận sẽ không còn trong lịch sử cảm xúc. Hoạt động đã được ghi nhận trước đó vẫn giữ nguyên.</p><div class="emotion-actions"><button type="button" class="btn btn-outline" data-delete-cancel autofocus>Giữ lại</button><button type="button" class="btn btn-primary" data-delete-confirm>Xóa ghi nhận</button></div>'
  document.body.append(dialog)
  const script = document.createElement('script')
  script.src = 'prototype.js'
  script.defer = true
  document.body.append(script)
  await writeFile(
    resolve(directory, `${route}-prototype.html`),
    '<!doctype html>\n' + document.documentElement.outerHTML,
  )
}
console.log(
  JSON.stringify({
    pages: 2,
    shell: 'fresh captured source-owned shell DOM',
    fonts: fontAssets.size,
  }),
)
