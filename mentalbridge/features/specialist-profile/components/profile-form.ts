import {
  ConsultationInputError,
  parseProfileInput,
  type SpecialistProfileInput,
} from '@/lib/consultation/consultation-validation'

export function profileFormValue(
  value: SpecialistProfileInput,
): SpecialistProfileInput {
  return {
    displayName: value.displayName,
    bio: value.bio,
    supportAreas: [...value.supportAreas],
    languages: [...value.languages],
    yearsOfExperience: value.yearsOfExperience,
    timezone: value.timezone,
  }
}

export const profileFieldErrors: Record<keyof SpecialistProfileInput, string> =
  {
    displayName: 'Nhập tên hiển thị (tối đa 120 ký tự).',
    bio: 'Viết giới thiệu từ 1 đến 2.000 ký tự.',
    supportAreas: 'Chọn ít nhất một lĩnh vực hỗ trợ.',
    languages: 'Chọn ít nhất một ngôn ngữ.',
    yearsOfExperience: 'Nhập số năm từ 0 đến 80.',
    timezone: 'Nhập múi giờ IANA hợp lệ.',
  }

export function validateProfileForm(value: SpecialistProfileInput) {
  const input = parseProfileInput(value)
  try {
    new Intl.DateTimeFormat('vi-VN', { timeZone: input.timezone }).format()
  } catch {
    throw new ConsultationInputError('timezone')
  }
  return input
}

export function focusProfileError(
  panel: HTMLElement | null,
  field: keyof SpecialistProfileInput,
) {
  const target =
    panel?.querySelector<HTMLElement>(`#profile-${field} input`) ??
    panel?.querySelector<HTMLElement>(`#profile-${field}`)
  target?.focus()
}
