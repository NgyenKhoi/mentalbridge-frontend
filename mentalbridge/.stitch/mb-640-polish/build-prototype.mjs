import { createRequire } from 'node:module'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const directory = fileURLToPath(new URL('.', import.meta.url))
const require = createRequire(new URL('../../package.json', import.meta.url))
const { JSDOM } = require('jsdom')
const source = await readFile(resolve(directory, 'baseline-desktop.html'), 'utf8')
const document = new JSDOM(source).window.document
const origin = 'http://127.0.0.1:3100'
await mkdir(resolve(directory, 'captured-fonts'), { recursive: true })
const assets = new Map()
const css = []

for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
  const response = await fetch(link.href)
  if (!response.ok) throw new Error(`Captured shell stylesheet unavailable: ${response.status}`)
  let text = await response.text()
  const references = [...text.matchAll(/url\(["']?([^)'"\s]+)["']?\)/g)]
  for (const [, reference] of references) {
    if (reference.startsWith('data:')) continue
    const url = new URL(reference, link.href).href
    if (!url.startsWith(origin + '/') || !url.includes('.woff2')) continue
    const filename = new URL(url).pathname.split('/').at(-1)
    if (!assets.has(url)) {
      const font = await fetch(url)
      if (!font.ok) throw new Error(`Captured font unavailable: ${font.status}`)
      await writeFile(resolve(directory, 'captured-fonts', filename), Buffer.from(await font.arrayBuffer()))
      assets.set(url, `captured-fonts/${filename}`)
    }
    text = text.split(reference).join(assets.get(url))
  }
  css.push(text)
  link.remove()
}
await writeFile(resolve(directory, 'captured-shell.css'), css.join('\n'), 'utf8')
document.querySelectorAll('script,nextjs-portal,next-route-announcer,link[rel="preload"],link[rel="icon"]').forEach(node => node.remove())
document.querySelectorAll('head style').forEach(node => node.remove())
document.documentElement.lang = 'vi'
document.title = 'Mô phỏng tương tác — Kế hoạch hỗ trợ / Cộng đồng'
for (const href of ['captured-shell.css', 'prototype.css']) {
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = href
  document.head.append(link)
}
// Retain a script-free reference for reproducible locked-frame geometry checks.
await writeFile(resolve(directory, 'captured-baseline.html'), '<!doctype html>\n' + document.documentElement.outerHTML, 'utf8')
const main = document.querySelector('.ref-content')
if (!main || document.querySelectorAll('[role="tab"]').length !== 4) {
  throw new Error('Expected real shell and four captured workspace tabs')
}
document.querySelector('#panel-adjust').innerHTML = '<section id="prototype-editor" aria-labelledby="prototype-title"></section>'
const progress = document.createElement('section')
progress.id = 'panel-progress'
progress.className = 'support-plan-tab-pane is-hidden'
progress.setAttribute('role', 'tabpanel')
progress.setAttribute('aria-labelledby', 'tab-progress')
progress.innerHTML = '<h2>Tiến triển của bạn</h2><p>Chưa có ghi nhận trong dữ liệu mô phỏng. Bạn không cần lấp đầy mọi ngày để kế hoạch có ý nghĩa.</p>'
document.querySelector('.support-plan-card').append(progress)
const communityIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z"/><path d="M8 11h8M8 15h4"/></svg>'
const entry = document.createElement('a')
entry.href = '#community'
entry.className = 'prototype-community-entry'
entry.innerHTML = communityIcon + '<span>Cộng đồng</span>'
entry.setAttribute('aria-label', 'Cộng đồng — mở bản mô phỏng')
document.querySelector('.ref-top-actions').prepend(entry)
const menuEntry = entry.cloneNode(true)
menuEntry.className = ''
menuEntry.innerHTML = '<i>' + communityIcon + '</i><span>Cộng đồng</span>'
const lastNavigation = document.querySelector('.ref-sidebar nav section:last-child')
lastNavigation.querySelector('h2').after(menuEntry)
const overlay = document.createElement('button')
overlay.className = 'ref-overlay prototype-menu-overlay'
overlay.setAttribute('aria-label', 'Đóng menu')
document.querySelector('.ref-shell').append(overlay)
const community = document.createElement('section')
community.id = 'prototype-community'
community.hidden = true
community.innerHTML = '<div class="prototype-fixture-note">Mô phỏng điều hướng — không tải bài viết hoặc dữ liệu tài khoản thật.</div><a href="#support-plan" class="prototype-return">← Quay lại kế hoạch hỗ trợ</a><h1 tabindex="-1">Cộng đồng</h1><p>Không gian chia sẻ với cộng đồng, tách biệt với dữ liệu nhật ký và bài sàng lọc.</p><article class="prototype-community-post"><span class="prototype-tag">Bài viết mẫu</span><h2>Một khoảng nghỉ nhỏ trong ngày</h2><p>Hôm nay mình dành vài phút để đi dạo và rời màn hình. Bạn thường chọn khoảng nghỉ nào cho riêng mình?</p><button type="button" class="btn btn-outline" data-community-save aria-pressed="false">Lưu bài viết mẫu</button><p role="status" data-community-status></p></article>'
main.append(community)
const dialog = document.createElement('dialog')
dialog.id = 'prototype-confirm'
dialog.setAttribute('aria-labelledby', 'prototype-confirm-title')
dialog.innerHTML = '<h2 id="prototype-confirm-title"></h2><p id="prototype-confirm-copy"></p><div class="prototype-dialog-actions"><button type="button" class="btn btn-outline" data-confirm-cancel>Quay lại</button><button type="button" class="btn btn-primary" data-confirm-accept>Xác nhận</button></div>'
document.body.append(dialog)
const status = document.createElement('p')
status.id = 'prototype-announcement'
status.className = 'prototype-sr-only'
status.setAttribute('role', 'status')
status.setAttribute('aria-live', 'polite')
document.body.append(status)
const script = document.createElement('script')
script.src = 'prototype.js'
script.defer = true
document.body.append(script)
await writeFile(resolve(directory, 'support-plan-interactive-prototype.html'), '<!doctype html>\n' + document.documentElement.outerHTML, 'utf8')
console.log(JSON.stringify({ artifact: 'support-plan-interactive-prototype.html', capturedStylesheets: css.length, localFonts: assets.size, shell: 'exact baseline DOM', tabs: 4 }))
