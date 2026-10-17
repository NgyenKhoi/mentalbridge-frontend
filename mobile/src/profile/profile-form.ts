import type { ProblemDetails } from '@/api/problem-details'

import type { CareProfileUpdate } from './profile-contract'

export type ProfileForm = Readonly<{
  displayName: string
  dateOfBirth: string
  gender: string
}>

export type ProfileFieldErrors = Partial<Record<keyof ProfileForm, string>>

export type ProfileFormResult =
  | Readonly<{ success: true; value: CareProfileUpdate }>
  | Readonly<{ success: false; errors: ProfileFieldErrors }>

function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

export function validateProfileForm(form: ProfileForm): ProfileFormResult {
  const displayName = form.displayName.trim()
  const dateOfBirth = form.dateOfBirth.trim()
  const gender = form.gender.trim()
  const errors: ProfileFieldErrors = {}

  if (!displayName || displayName.length > 120) {
    errors.displayName = 'Tên hiển thị cần có từ 1 đến 120 ký tự.'
  }
  if (dateOfBirth && !isIsoDate(dateOfBirth)) {
    errors.dateOfBirth = 'Nhập ngày sinh theo định dạng YYYY-MM-DD.'
  }
  if (gender.length > 32) {
    errors.gender = 'Giới tính không được dài quá 32 ký tự.'
  }

  if (Object.keys(errors).length > 0) return { success: false, errors }

  return {
    success: true,
    value: {
      displayName,
      dateOfBirth: dateOfBirth || null,
      gender: gender || null,
    },
  }
}

export function profileErrorsFromProblem(
  problem: ProblemDetails | undefined,
): ProfileFieldErrors {
  const errors: ProfileFieldErrors = {}

  for (const violation of problem?.violations ?? []) {
    if (violation.field === 'displayName') {
      errors.displayName = 'Tên hiển thị cần có từ 1 đến 120 ký tự.'
    } else if (violation.field === 'gender') {
      errors.gender = 'Giới tính không được dài quá 32 ký tự.'
    } else if (violation.field === 'dateOfBirth') {
      errors.dateOfBirth =
        violation.code === 'MINIMUM_AGE_NOT_MET'
          ? 'Bạn cần đủ 18 tuổi để tạo hồ sơ.'
          : violation.code === 'DATE_OF_BIRTH_IN_FUTURE'
            ? 'Ngày sinh không thể ở tương lai.'
            : 'Ngày sinh chưa hợp lệ.'
    }
  }

  return errors
}
