import type { Emotion } from '@/lib/emotion-check-in/contract'
import { emotionPresentation } from '@/lib/emotion-check-in/presentation'

import type { LookBackNarrative, LookBackNextStep } from './look-back-model'

// Approved Mầm copy (MB-898 brief); tớ/bạn, association, never causality.
export const narrativeCopy: Readonly<
  Record<Exclude<LookBackNarrative, 'UNKNOWN'>, string>
> = {
  IMPROVING:
    'Hai tuần qua, tuần sau bạn ghi nhận nhẹ nhõm hơn tuần đầu đó. Tớ thấy những cố gắng nhỏ của bạn đang dần có kết quả.',
  STEADY:
    'Hai tuần qua cảm xúc của bạn khá đều. Giữ được nhịp như vậy cũng là một điều đáng ghi nhận nè.',
  HARDER:
    'Tuần vừa rồi có vẻ nặng hơn với bạn. Mình cùng xem lại kế hoạch, và nếu cần, nói chuyện với chuyên gia cũng là một bước tốt.',
  SPARSE:
    'Tớ chưa có đủ ghi nhận để nhìn lại cùng bạn. Mỗi ngày ghi một chút thôi là đủ để lần sau tụi mình thấy rõ hơn.',
}

export const nextStepAction: Readonly<
  Record<LookBackNextStep, Readonly<{ label: string; href: string }>>
> = {
  PLAN: { label: 'Tiếp tục kế hoạch hôm nay', href: '/support-plan' },
  SUPPORT: { label: 'Xem hướng hỗ trợ', href: '/support-guides' },
  CHECK_IN: { label: 'Ghi cảm xúc hôm nay', href: '/dashboard' },
}

export const dimensionLabel = {
  PHQ9: { plain: 'Tâm trạng', name: 'Trầm cảm (PHQ-9)' },
  GAD7: { plain: 'Lo lắng', name: 'Lo âu (GAD-7)' },
} as const

const levels: readonly Emotion[] = ['VERY_LOW', 'LOW', 'OKAY', 'GOOD', 'GREAT']

export function moodLabel(level: number) {
  const key = levels[Math.min(5, Math.max(1, Math.round(level))) - 1]
  return { key, label: emotionPresentation[key].label }
}

export const dayMonth = (localDate: string) =>
  `${localDate.slice(8, 10)}/${localDate.slice(5, 7)}`

// Journey palette from the approved Stitch reference: warm amber at the top, cool slate and plum below, never alarm red.
export const moodTone: Readonly<
  Record<Emotion, Readonly<{ color: string; soft: string }>>
> = {
  GREAT: { color: '#B45F06', soft: '#FDF1E1' },
  GOOD: { color: '#2D6A4F', soft: '#E3F2E9' },
  OKAY: { color: '#4F7489', soft: '#E6EEF2' },
  LOW: { color: '#76618A', soft: '#F0EBF4' },
  VERY_LOW: { color: '#5B4868', soft: '#ECE6F0' },
}

const weekdays = [
  'Chủ Nhật',
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
]
export const weekdayOf = (localDate: string) =>
  weekdays[new Date(`${localDate}T00:00:00Z`).getUTCDay()]
