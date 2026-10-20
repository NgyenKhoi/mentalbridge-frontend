import { readFile } from 'node:fs/promises'

const html = await readFile(
  new URL('./prototype.html', import.meta.url),
  'utf8',
)
const required = [
  'lang="vi"',
  'prefers-reduced-motion: reduce',
  'role="dialog"',
  'aria-modal="true"',
  'aria-haspopup="dialog"',
  'Mở hướng dẫn có giới hạn',
  'Vì sao hoạt động này có trong kế hoạch?',
  'Mở Ghi nhận cảm xúc',
  'heading.focus()',
  'openButton.focus()',
]
for (const marker of required)
  if (!html.includes(marker))
    throw new Error(`Missing prototype marker: ${marker}`)
if (/textarea|contenteditable|type="text"/i.test(html))
  throw new Error('Prototype must not contain a free-text companion input.')
console.log('MB-654 prototype structure: PASS')
