import type { ProblemDetails } from '@/api/problem-details'

import {
  specialistProfileRequestSchema,
  type AvailabilitySlot,
  type AvailabilityModality,
  type SpecialistDecisionReason,
  type SpecialistLanguage,
  type SpecialistProfile,
  type SpecialistProfileRequest,
  type SupportArea,
} from './specialist-contract'

export type SpecialistProfileState =
  'NEW' | 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED'

export type SpecialistProfileForm = Readonly<{
  displayName: string
  bio: string
  supportAreas: readonly SupportArea[]
  languages: readonly SpecialistLanguage[]
  yearsOfExperience: string
  timezone: string
}>

export type SpecialistProfileField = keyof SpecialistProfileForm
export type SpecialistProfileFieldErrors = Partial<
  Record<SpecialistProfileField, string>
>

export const emptySpecialistProfileForm: SpecialistProfileForm = {
  displayName: '',
  bio: '',
  supportAreas: [],
  languages: ['vi'],
  yearsOfExperience: '0',
  timezone: 'Asia/Ho_Chi_Minh',
}

export const specialistProfileStatusLabels: Record<
  SpecialistProfileState,
  string
> = {
  NEW: 'Chưa tạo hồ sơ',
  DRAFT: 'Bản nháp chưa gửi',
  PENDING_REVIEW: 'Đang chờ xét duyệt',
  APPROVED: 'Đã được phê duyệt',
  REJECTED: 'Cần chỉnh sửa và gửi lại',
  SUSPENDED: 'Đang tạm ngưng',
}

export const specialistDecisionReasonLabels: Record<
  SpecialistDecisionReason,
  string
> = {
  PROFILE_INFORMATION_INCOMPLETE: 'Thông tin hồ sơ chưa đầy đủ.',
  PROFILE_CONTENT_NOT_APPROVED: 'Nội dung hồ sơ chưa phù hợp để công khai.',
  OUTSIDE_SUPPORTED_SCOPE: 'Phạm vi hỗ trợ nằm ngoài phạm vi của nền tảng.',
  POLICY_VIOLATION: 'Tài khoản đang tạm ngưng do vi phạm chính sách.',
  QUALITY_REVIEW_REQUIRED: 'Tài khoản đang được rà soát chất lượng.',
  ACCOUNT_REVIEW_REQUIRED: 'Tài khoản đang được rà soát vận hành.',
}

const fieldMessages: Record<SpecialistProfileField, string> = {
  displayName: 'Nhập tên hiển thị, tối đa 120 ký tự.',
  bio: 'Viết phần giới thiệu từ 1 đến 2.000 ký tự.',
  supportAreas: 'Chọn ít nhất một và tối đa hai lĩnh vực hỗ trợ.',
  languages: 'Chọn ít nhất một và tối đa hai ngôn ngữ.',
  yearsOfExperience: 'Nhập số năm kinh nghiệm từ 0 đến 80.',
  timezone: 'Nhập múi giờ IANA hợp lệ, ví dụ Asia/Ho_Chi_Minh.',
}

export function profileState(
  profile: SpecialistProfile | null,
): SpecialistProfileState {
  if (!profile) return 'NEW'
  if (profile.approvalStatus === 'PENDING') {
    return profile.submittedAt ? 'PENDING_REVIEW' : 'DRAFT'
  }
  return profile.approvalStatus
}

export function profileForm(
  profile: SpecialistProfile | null,
): SpecialistProfileForm {
  if (!profile) return emptySpecialistProfileForm
  return {
    displayName: profile.displayName,
    bio: profile.bio,
    supportAreas: [...profile.supportAreas],
    languages: [...profile.languages],
    yearsOfExperience: String(profile.yearsOfExperience),
    timezone: profile.timezone,
  }
}

export function validateSpecialistProfileForm(form: SpecialistProfileForm):
  | Readonly<{ success: true; value: SpecialistProfileRequest }>
  | Readonly<{
      success: false
      errors: SpecialistProfileFieldErrors
    }> {
  const years = Number(form.yearsOfExperience)
  const candidate = {
    displayName: form.displayName,
    bio: form.bio,
    supportAreas: [...form.supportAreas],
    languages: [...form.languages],
    yearsOfExperience: years,
    timezone: form.timezone,
  }
  const parsed = specialistProfileRequestSchema.safeParse(candidate)
  const errors: SpecialistProfileFieldErrors = {}

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0]
      if (typeof field === 'string' && field in fieldMessages) {
        errors[field as SpecialistProfileField] =
          fieldMessages[field as SpecialistProfileField]
      }
    }
  }

  if (!Number.isInteger(years) || years < 0 || years > 80) {
    errors.yearsOfExperience = fieldMessages.yearsOfExperience
  }

  try {
    new Intl.DateTimeFormat('vi-VN', {
      timeZone: form.timezone.trim(),
    }).format()
  } catch {
    errors.timezone = fieldMessages.timezone
  }

  if (!parsed.success || Object.keys(errors).length > 0) {
    return { success: false, errors }
  }
  return { success: true, value: parsed.data }
}

export function profileErrorsFromProblem(
  problem: ProblemDetails | undefined,
): SpecialistProfileFieldErrors {
  const errors: SpecialistProfileFieldErrors = {}
  for (const violation of problem?.violations ?? []) {
    if (violation.field in fieldMessages) {
      errors[violation.field as SpecialistProfileField] =
        fieldMessages[violation.field as SpecialistProfileField]
    }
  }
  return errors
}

export function toggleValue<Value extends string>(
  current: readonly Value[],
  value: Value,
  maximum: number,
): readonly Value[] {
  if (current.includes(value)) return current.filter((item) => item !== value)
  if (current.length >= maximum) return current
  return [...current, value]
}

export function defaultTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh'
}

function datePartsAt(instant: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant)
  return Object.fromEntries(parts.map((part) => [part.type, part.value]))
}

export function localSlotToUtc(
  date: string,
  time: string,
  timezone: string,
): Readonly<{ startAt: string; endAt: string }> {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time)
  if (!dateMatch || !timeMatch) {
    throw new Error('Nhập ngày theo YYYY-MM-DD và giờ theo HH:mm.')
  }

  const desired = Date.UTC(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
  )
  let candidate = desired
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const represented = datePartsAt(new Date(candidate), timezone)
    const representedUtc = Date.UTC(
      Number(represented.year),
      Number(represented.month) - 1,
      Number(represented.day),
      Number(represented.hour),
      Number(represented.minute),
      Number(represented.second),
    )
    candidate += desired - representedUtc
  }

  const verified = datePartsAt(new Date(candidate), timezone)
  if (
    verified.year !== dateMatch[1] ||
    verified.month !== dateMatch[2] ||
    verified.day !== dateMatch[3] ||
    verified.hour !== timeMatch[1] ||
    verified.minute !== timeMatch[2]
  ) {
    throw new Error('Giờ đã chọn không tồn tại trong múi giờ này.')
  }

  const startAt = new Date(candidate)
  return {
    startAt: startAt.toISOString(),
    endAt: new Date(startAt.getTime() + 60 * 60 * 1000).toISOString(),
  }
}

export function availabilitySignature(input: {
  startAt: string
  endAt: string
  timezone: string
  modality: AvailabilityModality
}): string {
  return JSON.stringify(input)
}

export const availabilityReadinessLabels = {
  AVAILABLE: 'Có thể đặt',
  STARTED: 'Đã bắt đầu',
  WITHDRAWN: 'Đã rút',
  VIDEO_DISABLED: 'Video đang tắt',
} as const

export function formatAvailabilitySlot(slot: AvailabilitySlot): string {
  const start = new Intl.DateTimeFormat('vi-VN', {
    timeZone: slot.timezone,
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const end = new Intl.DateTimeFormat('vi-VN', {
    timeZone: slot.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  return `${start.format(new Date(slot.startAt))}–${end.format(new Date(slot.endAt))}`
}
