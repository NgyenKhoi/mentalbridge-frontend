import {
  validateNewPassword,
  validatePasswordChange,
} from './password-validation'

describe('mobile password policy', () => {
  it('enforces the current Identity character, byte, and confirmation limits', () => {
    expect(validateNewPassword('short', 'short')).toEqual({
      newPassword: 'Mật khẩu mới phải có ít nhất 12 ký tự.',
    })
    expect(validateNewPassword('😀'.repeat(19), '😀'.repeat(19))).toEqual({
      newPassword: 'Mật khẩu mới không được vượt quá 72 byte UTF-8.',
    })
    expect(
      validateNewPassword('new-correct-password', 'different-password'),
    ).toEqual({ confirmation: 'Mật khẩu xác nhận chưa khớp.' })
    expect(
      validateNewPassword('new-correct-password', 'new-correct-password'),
    ).toEqual({})
  })

  it('requires a bounded current password before a password change', () => {
    expect(
      validatePasswordChange(
        '',
        'new-correct-password',
        'new-correct-password',
      ),
    ).toEqual({ currentPassword: 'Nhập mật khẩu hiện tại.' })
    expect(
      validatePasswordChange(
        'x'.repeat(129),
        'new-correct-password',
        'new-correct-password',
      ),
    ).toEqual({
      currentPassword: 'Mật khẩu hiện tại không được quá 128 ký tự.',
    })
  })
})
