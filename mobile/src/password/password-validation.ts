export type PasswordFormErrors = Readonly<{
  currentPassword?: string
  newPassword?: string
  confirmation?: string
}>

function utf8ByteLength(value: string) {
  let length = 0
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0
    length +=
      codePoint <= 0x7f
        ? 1
        : codePoint <= 0x7ff
          ? 2
          : codePoint <= 0xffff
            ? 3
            : 4
  }
  return length
}

export function validateNewPassword(
  newPassword: string,
  confirmation: string,
): PasswordFormErrors {
  const codePoints = Array.from(newPassword).length

  if (codePoints < 12) {
    return { newPassword: 'Mật khẩu mới phải có ít nhất 12 ký tự.' }
  }
  if (codePoints > 128 || utf8ByteLength(newPassword) > 72) {
    return { newPassword: 'Mật khẩu mới không được vượt quá 72 byte UTF-8.' }
  }
  if (newPassword !== confirmation) {
    return { confirmation: 'Mật khẩu xác nhận chưa khớp.' }
  }
  return {}
}

export function validatePasswordChange(
  currentPassword: string,
  newPassword: string,
  confirmation: string,
): PasswordFormErrors {
  if (!currentPassword) {
    return { currentPassword: 'Nhập mật khẩu hiện tại.' }
  }
  if (Array.from(currentPassword).length > 128) {
    return { currentPassword: 'Mật khẩu hiện tại không được quá 128 ký tự.' }
  }
  return validateNewPassword(newPassword, confirmation)
}
