import { createRequire } from 'node:module'
import { readFile, writeFile } from 'node:fs/promises'

const require = createRequire(new URL('../../package.json', import.meta.url))
const { JSDOM } = require('jsdom')
const dom = new JSDOM(await readFile(new URL('../community-social/baseline-desktop.html', import.meta.url), 'utf8'))
const document = dom.window.document
const safety = document.querySelector('[aria-controls="crisis-support-panel"]')?.cloneNode(true)
document.querySelectorAll('script,link,style,nextjs-portal').forEach(node => node.remove())
document.head.innerHTML = '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Community avatar · Interactive fixture prototype</title><link rel="stylesheet" href="../community-social/captured-baseline.css"><link rel="stylesheet" href="prototype.css">'
document.querySelectorAll('body > :not(.community-shell)').forEach(node => node.remove())
for (const nav of document.querySelectorAll('.community-header-tabs,.community-mobile-nav')) {
  for (const link of nav.querySelectorAll('a')) {
    const active = link.getAttribute('href') === '/community/profile'
    link.classList.toggle('is-active', active)
    if (active) link.setAttribute('aria-current', 'page')
    else link.removeAttribute('aria-current')
  }
}
document.querySelector('.community-shell-main').innerHTML = `
<div class="prototype-note">Prototype tương tác · dữ liệu mô phỏng, không gọi API.<details><summary>Thử các trạng thái</summary><div class="fixture-tools"><button data-failure="upload">Lỗi tải ảnh</button><button data-failure="select">Lỗi lưu ảnh</button><button data-failure="stale">Thay đổi ở nơi khác</button><button data-failure="remove">Lỗi gỡ ảnh</button></div></details></div>
<div class="community-profile-page">
<a class="community-back" href="/community">← Trở về bảng tin</a>
<header class="community-profile-heading"><h1>Bạn muốn xuất hiện như thế nào?</h1><p>Tên và hình đại diện ở đây độc lập với hồ sơ tài khoản và hồ sơ chăm sóc. Cộng đồng không hiển thị email hay mã tài khoản của bạn.</p></header>
<section class="community-profile-form" aria-label="Danh tính cộng đồng">
<div class="community-profile-preview"><div id="public-avatar" class="avatar-preview" aria-hidden="true">MA</div><div><span>Người khác sẽ thấy</span><strong id="preview-name">Minh An</strong></div></div>
<section class="photo-region" aria-labelledby="photo-title" aria-busy="false">
<h2 id="photo-title">Ảnh đại diện cộng đồng</h2><p>Ảnh xuất hiện cùng bài viết và bình luận dùng danh tính của bạn; không hiển thị khi đăng ẩn danh.</p>
<div class="photo-picker"><span class="photo-frame" id="photo-preview" aria-label="Xem trước ảnh đại diện">MA</span><div class="photo-picker-actions"><input type="file" id="photo-file" accept="image/jpeg,image/png,image/webp" hidden><button type="button" id="choose-photo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 7h4l2-3h4l2 3h4v13H4z"/><circle cx="12" cy="13" r="4"/></svg>Chọn ảnh từ máy</button><small>JPEG, PNG hoặc WebP · tối đa 10 MiB</small><button type="button" id="remove-photo" hidden>Gỡ ảnh hiện tại</button></div></div>
<div id="photo-stage" hidden><p id="file-name"></p><p class="photo-crop-help">Xem trước khung tròn: ảnh lấy phần giữa để hiển thị.</p><div class="photo-actions"><button type="button" id="cancel-photo">Hủy lựa chọn</button><button type="button" id="save-photo" class="primary">Lưu ảnh đại diện</button></div></div>
<p id="photo-status" role="status" aria-live="polite"></p><p id="photo-error" role="alert" hidden></p><button type="button" id="reload-profile" hidden>Tải thông tin mới để thử lại</button>
</section>
<form id="name-form" novalidate><div class="community-profile-field"><label for="profile-name">Tên hiển thị hoặc biệt danh</label><input id="profile-name" maxlength="160" value="Minh An" autocomplete="off" aria-describedby="name-help"><small id="name-help">Tối đa 80 ký tự. Tránh dùng họ tên thật nếu bạn muốn giữ riêng tư.</small></div>
<fieldset><legend>Biểu tượng dự phòng</legend><p>Được dùng khi bạn chưa chọn ảnh hoặc ảnh không tải được.</p><div class="community-avatar-options" id="presets"></div></fieldset>
<aside class="community-profile-privacy"><strong>Điều gì được công khai?</strong><p>Tên hiển thị và ảnh hoặc biểu tượng bạn chọn. Danh tính tài khoản được giữ kín để xác định quyền sở hữu, chặn và xử lý an toàn.</p></aside><p id="name-status" role="status"></p><p id="name-error" role="alert" hidden></p><button type="submit" class="primary">Lưu thay đổi</button></form>
</section></div>
<dialog id="remove-dialog" aria-labelledby="remove-title"><h2 id="remove-title">Gỡ ảnh đại diện?</h2><p>Hồ sơ sẽ dùng biểu tượng dự phòng bạn đã chọn. Tên và nội dung đã viết không thay đổi.</p><p id="remove-error" role="alert" hidden></p><div class="photo-actions"><button id="keep-photo" type="button" autofocus>Giữ ảnh</button><button id="confirm-remove" type="button" class="primary">Gỡ ảnh</button></div></dialog>`
if (safety) document.body.append(safety)
const script = document.createElement('script')
script.src = 'prototype.js'
document.body.append(script)
await writeFile(new URL('./interactive-prototype.html', import.meta.url), dom.serialize())
console.log('Avatar fixture prototype built inside the exact baseline shell DOM.')
