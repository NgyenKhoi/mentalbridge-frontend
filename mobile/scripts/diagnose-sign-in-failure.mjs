import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const [device, evidencePath] = process.argv.slice(2)
const hierarchyPath = '/sdcard/mentalbridge-staging-sign-in.xml'
const errors = [
  ['EMPTY_FIELDS', 'Nhập email và mật khẩu để tiếp tục.'],
  [
    'INVALID_CREDENTIALS',
    'Email, mật khẩu hoặc trạng thái tài khoản không hợp lệ.',
  ],
  [
    'IDENTITY_UNAVAILABLE',
    'Dịch vụ đăng nhập tạm thời chưa sẵn sàng. Vui lòng thử lại sau.',
  ],
  ['SIGN_IN_ERROR', 'Không thể đăng nhập lúc này. Vui lòng thử lại.'],
]
let outcome = 'DIAGNOSTIC_UNAVAILABLE'
try {
  const dump = spawnSync(
    'adb',
    ['-s', device, 'shell', 'uiautomator', 'dump', hierarchyPath],
    { timeout: 15000, stdio: 'pipe' },
  )
  if (dump.status === 0) {
    const read = spawnSync(
      'adb',
      ['-s', device, 'exec-out', 'cat', hierarchyPath],
      {
        encoding: 'utf8',
        timeout: 5000,
      },
    )
    if (read.status === 0) {
      outcome =
        errors.find(([, message]) => read.stdout.includes(message))?.[0] ??
        'NO_KNOWN_SIGN_IN_ERROR_VISIBLE'
    }
  }
} finally {
  spawnSync('adb', ['-s', device, 'shell', 'rm', '-f', hierarchyPath], {
    timeout: 5000,
    stdio: 'pipe',
  })
}
writeFileSync(evidencePath, `Sign-in state after failed journey: ${outcome}.\n`)
console.log(`Sign-in state after failed journey: ${outcome}.`)
