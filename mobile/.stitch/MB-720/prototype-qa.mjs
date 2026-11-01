import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const html = readFileSync(
  fileURLToPath(new URL('./prototype.html', import.meta.url)),
  'utf8',
)
const normalized = html.replace(/\s+/g, ' ')

for (const state of ['recovery', 'reset', 'change']) {
  assert.match(html, new RegExp(`data-target="${state}"`))
  assert.match(html, new RegExp(`<section[^>]+id="${state}"`))
}

for (const copy of [
  'Phản hồi luôn giống nhau để bảo vệ trạng thái tài khoản.',
  '12–128 ký tự và tối đa 72 byte UTF-8.',
  'Đổi mật khẩu và đăng xuất',
]) {
  assert.ok(normalized.includes(copy), `Missing required copy: ${copy}`)
}

assert.ok(html.includes('location.hash = target'))
assert.doesNotMatch(html, /Secure Access|HIPAA|bottom navigation|sidebar/i)

console.log('MB-720 prototype shell and state transitions verified.')
